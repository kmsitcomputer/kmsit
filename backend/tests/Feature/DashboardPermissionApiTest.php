<?php

namespace Tests\Feature;

use App\Models\{Role, Setting, User};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{Cache, Hash};
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class DashboardPermissionApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    private function user(string $role, string $email): User
    {
        return User::create(['id' => Str::lower(Str::random(12)), 'role_key' => $role, 'name' => ucfirst($role), 'email' => $email,
            'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);
    }

    private function limitAdmin(array $permissions): User
    {
        Role::where('role_key', 'admin')->update(['permissions' => json_encode($permissions)]);
        return $this->user('admin', 'limited-' . Str::random(4) . '@example.com');
    }

    public function test_admin_summary_only_contains_permitted_cards(): void
    {
        $admin = $this->limitAdmin(['dashboard', 'manage_articles']);
        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/dashboard/summary')->assertOk();
        $this->assertSame(['articles'], array_keys($response->json('summary')));
        $response->assertJsonMissingPath('revenue_chart')->assertJsonMissingPath('recent_orders')->assertJsonMissingPath('platform');
    }

    public function test_finance_cards_require_finance_permissions(): void
    {
        $admin = $this->limitAdmin(['dashboard', 'view_payments', 'manage_orders']);
        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/dashboard/summary')->assertOk();
        $this->assertArrayHasKey('revenue', $response->json('summary'));
        $this->assertArrayHasKey('orders', $response->json('summary'));
        $this->assertArrayNotHasKey('users', $response->json('summary'));
        $response->assertJsonStructure(['revenue_chart', 'recent_orders'])->assertJsonMissingPath('platform');
    }

    public function test_super_admin_summary_includes_platform_health(): void
    {
        Cache::put('ops:scheduler-heartbeat', now()->timestamp, 60);
        $super = $this->user('super_admin', 'root@example.com');
        $this->actingAs($super, 'sanctum')->getJson('/api/v1/dashboard/summary')->assertOk()
            ->assertJsonStructure(['summary' => ['users'], 'platform' => ['queue' => ['connection', 'failed_jobs'], 'scheduler' => ['healthy'], 'integrations', 'warnings']])
            ->assertJsonPath('platform.scheduler.healthy', true);
        $this->getJson('/api/v1/admin/ops/status')->assertOk()->assertJsonPath('status.queue.connection', config('queue.default'));
        $body = $this->getJson('/api/v1/admin/ops/status')->getContent();
        foreach (['api_key', 'private_key', 'secret', 'password'] as $needle) $this->assertStringNotContainsString($needle, strtolower($body));
    }

    public function test_operations_status_is_super_admin_only(): void
    {
        $admin = $this->limitAdmin(['*']);
        $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/ops/status')->assertForbidden();
        $this->actingAs($this->user('student', 's@example.com'), 'sanctum')->getJson('/api/v1/admin/ops/status')->assertForbidden();
    }

    public function test_instructor_and_student_summaries_stay_role_scoped(): void
    {
        $this->actingAs($this->user('instructor', 'i@example.com'), 'sanctum')->getJson('/api/v1/dashboard/summary')->assertOk()
            ->assertJsonPath('role', 'instructor')->assertJsonStructure(['summary' => ['platform_fee_percent']])->assertJsonMissingPath('platform');
        $this->actingAs($this->user('student', 'st@example.com'), 'sanctum')->getJson('/api/v1/dashboard/summary')->assertOk()
            ->assertJsonPath('role', 'student')->assertJsonMissingPath('summary.revenue');
    }

    public static function limitedAdminDeniedRoutes(): array
    {
        return [
            'audit logs' => ['get', '/api/v1/admin/audit-logs'],
            'contact messages' => ['get', '/api/v1/admin/contact-messages'],
            'webhook logs' => ['get', '/api/v1/payments/webhook-logs'],
            'categories write' => ['post', '/api/v1/categories'],
            'certificates' => ['get', '/api/v1/certificates'],
            'withdrawals' => ['get', '/api/v1/admin/withdrawals'],
            'settings read' => ['get', '/api/v1/settings'],
            'settings write' => ['put', '/api/v1/settings'],
            'payment settings' => ['get', '/api/v1/settings/payment'],
            'backup' => ['get', '/api/v1/admin/backup'],
            'users' => ['get', '/api/v1/admin/users'],
            'vouchers' => ['get', '/api/v1/admin/vouchers'],
            'instructor sales' => ['get', '/api/v1/instructor/sales'],
        ];
    }

    #[DataProvider('limitedAdminDeniedRoutes')]
    public function test_direct_routes_are_denied_without_permission(string $method, string $uri): void
    {
        $admin = $this->limitAdmin(['dashboard', 'manage_articles']);
        $this->actingAs($admin, 'sanctum')->json($method, $uri, $method === 'get' ? [] : ['key' => 'site_name', 'value' => 'X', 'scope' => 'course', 'name' => 'X'])->assertForbidden();
    }

    public function test_limited_admin_orders_and_payments_are_own_only(): void
    {
        $admin = $this->limitAdmin(['dashboard']);
        $this->actingAs($admin, 'sanctum')->getJson('/api/v1/orders')->assertOk()->assertJsonPath('total', 0);
        $this->getJson('/api/v1/payments')->assertOk()->assertJsonPath('payments.total', 0);
    }

    public function test_about_editor_uses_manage_about_and_bulk_writes_validate_urls(): void
    {
        $admin = $this->limitAdmin(['dashboard', 'manage_about']);
        $this->actingAs($admin, 'sanctum');
        $this->getJson('/api/v1/settings')->assertOk()->assertJsonMissingPath('settings.site_name');
        $this->putJson('/api/v1/settings/bulk', ['settings' => ['about_vision' => 'Visi baru']])->assertOk();
        $this->assertSame('Visi baru', Setting::where('setting_key', 'about_vision')->value('setting_value'));
        $this->putJson('/api/v1/settings/bulk', ['settings' => ['about_vision' => 'X', 'site_name' => 'Hijack']])->assertForbidden();
        $this->assertSame('Visi baru', Setting::where('setting_key', 'about_vision')->value('setting_value'), 'rejected bulk write must not be partial');

        $super = $this->user('super_admin', 'root2@example.com');
        $this->actingAs($super, 'sanctum')->putJson('/api/v1/settings/bulk', ['settings' => ['social_facebook' => 'javascript:alert(1)']])->assertStatus(422);
        $this->putJson('/api/v1/settings/bulk', ['settings' => ['about_video' => 'data:text/html,x']])->assertStatus(422);
        $this->putJson('/api/v1/settings/bulk', ['settings' => ['social_facebook' => 'https://facebook.com/kmsit']])->assertOk();
    }
}
