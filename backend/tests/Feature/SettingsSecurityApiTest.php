<?php

namespace Tests\Feature;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class SettingsSecurityApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_settings_endpoint_returns_only_allowlisted_safe_keys(): void
    {
        $this->seed();
        Setting::create(['setting_key' => 'site_name', 'setting_value' => 'KMSIT']);
        Setting::create(['setting_key' => 'tripay_private_key', 'setting_value' => 'SECRET-PRIV']);
        Setting::create(['setting_key' => 'xendit_callback_token', 'setting_value' => 'SECRET-TOKEN']);
        Setting::create(['setting_key' => 'stripe_secret_key', 'setting_value' => 'SECRET-STRIPE']);

        $payload = $this->getJson('/api/v1/settings/public')->assertOk()->json('settings');
        $this->assertSame('KMSIT', $payload['site_name'] ?? null);
        foreach (['tripay_private_key', 'xendit_callback_token', 'stripe_secret_key'] as $secret) {
            $this->assertArrayNotHasKey($secret, $payload);
        }
        $this->assertStringNotContainsString('SECRET-', json_encode($payload));
    }

    #[DataProvider('nonAdminRoles')]
    public function test_non_admin_roles_are_denied_settings_endpoints(string $role): void
    {
        $this->seed();
        $user = $this->user($role);
        $this->actingAs($user, 'sanctum')->getJson('/api/v1/settings')->assertForbidden();
        $this->actingAs($user, 'sanctum')->getJson('/api/v1/settings/payment')->assertForbidden();
        $this->actingAs($user, 'sanctum')->putJson('/api/v1/settings', ['key' => 'site_name', 'value' => 'X'])->assertForbidden();
        $this->actingAs($user, 'sanctum')->putJson('/api/v1/settings/bulk', ['settings' => ['site_name' => 'X']])->assertForbidden();
        $this->actingAs($user, 'sanctum')->putJson('/api/v1/settings/payment', ['gateway' => 'stripe', 'mode' => 'live'])->assertForbidden();
    }

    public static function nonAdminRoles(): array
    {
        return [['student'], ['instructor']];
    }

    public function test_admin_can_still_write_and_read_safe_settings(): void
    {
        $this->seed();
        $admin = $this->user('admin');

        $this->actingAs($admin, 'sanctum')->putJson('/api/v1/settings/bulk', ['settings' => [
            'site_name' => 'KMSIT', 'footer_text' => '© 2026', 'platform_fee_percent' => '15',
            'zoom_enabled' => '1', 'theme_website' => '{"a":1}',
        ]])->assertOk();

        $remote = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/settings')->assertOk()->json('settings');
        $this->assertSame('KMSIT', $remote['site_name']);
        $this->assertSame('© 2026', $remote['footer_text']);
        $this->assertSame('15', $remote['platform_fee_percent']);
        $this->assertSame('1', $remote['zoom_enabled']);
        $this->assertSame('{"a":1}', $remote['theme_website']);
    }

    public function test_secret_gateway_keys_cannot_be_written_or_read_through_normal_endpoints(): void
    {
        $this->seed();
        $admin = $this->user('admin');

        // A direct single write of a secret is explicitly refused and never stored.
        $this->actingAs($admin, 'sanctum')->putJson('/api/v1/settings', ['key' => 'tripay_private_key', 'value' => 'LEAK-1'])->assertForbidden();
        $this->assertNull(Setting::find('tripay_private_key'));

        // A mixed bulk payload stores the safe key and silently skips every secret.
        $this->actingAs($admin, 'sanctum')->putJson('/api/v1/settings/bulk', ['settings' => [
            'site_name' => 'Safe', 'tripay_api_key' => 'LEAK-2', 'xendit_callback_token' => 'LEAK-3', 'stripe_publishable_key' => 'LEAK-4',
        ]])->assertOk();
        $this->assertSame('Safe', Setting::find('site_name')->setting_value);
        foreach (['tripay_api_key', 'xendit_callback_token', 'stripe_publishable_key'] as $key) {
            $this->assertNull(Setting::find($key));
        }

        // A legacy secret row already in the table must never be returned to the dashboard.
        Setting::create(['setting_key' => 'xendit_callback_token', 'setting_value' => 'LEGACY']);
        $remote = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/settings')->assertOk()->json('settings');
        $this->assertArrayNotHasKey('xendit_callback_token', $remote);
        $this->assertStringNotContainsString('LEGACY', json_encode($remote));
    }

    public function test_non_super_admin_cannot_change_gateway_through_general_settings(): void
    {
        $this->seed();
        Setting::create(['setting_key' => 'gateway_active', 'setting_value' => 'stripe']);
        Setting::create(['setting_key' => 'gateway_mode', 'setting_value' => 'live']);
        $admin = $this->user('admin');

        $this->actingAs($admin, 'sanctum')->putJson('/api/v1/settings', ['key' => 'gateway_active', 'value' => 'xendit']);
        $this->assertSame('stripe', Setting::find('gateway_active')->setting_value);

        $this->actingAs($admin, 'sanctum')->putJson('/api/v1/settings/bulk', ['settings' => [
            'gateway_active' => 'xendit', 'gateway_mode' => 'sandbox', 'site_name' => 'Changed',
        ]])->assertOk();
        $this->assertSame('stripe', Setting::find('gateway_active')->setting_value);
        $this->assertSame('live', Setting::find('gateway_mode')->setting_value);
        $this->assertSame('Changed', Setting::find('site_name')->setting_value);

        // Super Admin keeps the sanctioned payment endpoint.
        $super = $this->user('super_admin');
        $this->actingAs($super, 'sanctum')->putJson('/api/v1/settings/payment', ['gateway' => 'xendit', 'mode' => 'sandbox'])
            ->assertOk()->assertJsonPath('gateway', 'xendit');
        $this->assertSame('xendit', Setting::find('gateway_active')->setting_value);
    }

    public function test_secret_key_case_and_whitespace_variations_do_not_bypass_the_block(): void
    {
        $this->seed();
        $admin = $this->user('admin');

        foreach (['Tripay_Private_Key', ' tripay_private_key', 'XENDIT_CALLBACK_TOKEN', 'stripe_publishable_key'] as $variant) {
            $this->actingAs($admin, 'sanctum')->putJson('/api/v1/settings', ['key' => $variant, 'value' => 'LEAK']);
        }
        $this->actingAs($admin, 'sanctum')->putJson('/api/v1/settings/bulk', ['settings' => [
            ' Stripe_Secret_Key' => 'LEAK', 'XENDIT_CALLBACK_TOKEN' => 'LEAK', 'Tripay_Api_Key' => 'LEAK',
        ]])->assertOk();

        $this->assertSame(0, DB::table('settings')->where('setting_value', 'LEAK')->count());
    }

    private function user(string $role): User
    {
        return User::create(['id' => Str::lower(Str::random(12)), 'role_key' => $role, 'name' => 'Fixture',
            'email' => Str::lower(Str::random(12)) . '@example.test', 'password_hash' => Hash::make('password'),
            'status' => 'active', 'instructor_approved' => true]);
    }
}
