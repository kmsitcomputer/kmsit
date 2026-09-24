<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class SettingsPublicApiTest extends TestCase
{
    use RefreshDatabase;

    /**
     * The dashboard's "Pengaturan Umum" form lets admins edit footer text, contact info,
     * social links, and map details — but the public site reads them through a SEPARATE
     * allowlisted endpoint (GET /settings/public). Any of these fields missing from that
     * allowlist meant they saved fine from the dashboard yet stayed empty on the public
     * footer/contact page forever, with no error anywhere to indicate why.
     */
    public function test_footer_and_contact_settings_saved_by_admin_reach_the_public_settings_endpoint(): void
    {
        $this->seed();
        $admin = User::create(['id' => Str::lower(Str::random(12)), 'role_key' => 'admin', 'name' => 'Admin', 'email' => 'settings-admin@example.com', 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);

        $fields = [
            'footer_text' => '© 2026 KMSIT Computer', 'email' => 'hello@kmsit.test', 'phone' => '021-555-0100',
            'whatsapp' => '6281234567890', 'address' => 'Jl. Contoh No. 1, Jakarta', 'social_facebook' => 'https://facebook.com/kmsit',
            'social_instagram' => 'https://instagram.com/kmsit', 'social_youtube' => 'https://youtube.com/@kmsit',
            'social_tiktok' => 'https://tiktok.com/@kmsit', 'map_lat' => '-6.2', 'map_lng' => '106.8', 'map_query' => 'KMSIT Computer',
        ];
        $this->actingAs($admin, 'sanctum')->putJson('/api/v1/settings/bulk', ['settings' => $fields])->assertOk();

        $public = $this->getJson('/api/v1/settings/public')->assertOk()->json('settings');
        foreach ($fields as $key => $value) {
            $this->assertSame($value, $public[$key] ?? null, "public settings missing or wrong for [{$key}]");
        }
    }
}
