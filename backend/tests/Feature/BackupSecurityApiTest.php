<?php

namespace Tests\Feature;

use App\Models\{Setting, User};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class BackupSecurityApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_backup_excludes_sessions_reset_tokens_and_legacy_secret_settings(): void
    {
        $this->seed();
        $admin = User::create(['id' => 'backupadmin1', 'role_key' => 'super_admin', 'name' => 'Backup Admin',
            'email' => 'backup@example.test', 'password_hash' => Hash::make('password'), 'status' => 'active']);
        Setting::create(['setting_key' => 'site_name', 'setting_value' => 'Safe Site']);
        Setting::create(['setting_key' => 'tripay_private_key', 'setting_value' => 'SECRET-CANARY']);
        \DB::table('password_reset_tokens')->insert(['email' => $admin->email, 'token' => 'RESET-CANARY']);
        \DB::table('sessions')->insert(['id' => 'session-canary', 'user_id' => $admin->id, 'ip_address' => '127.0.0.1',
            'user_agent' => 'test', 'payload' => 'SESSION-CANARY', 'last_activity' => now()->timestamp]);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/backup')->assertOk();
        $body = $response->getContent();
        $this->assertStringContainsString('Safe Site', $body);
        $this->assertStringNotContainsString('SECRET-CANARY', $body);
        $this->assertStringNotContainsString('RESET-CANARY', $body);
        $this->assertStringNotContainsString('SESSION-CANARY', $body);
        $response->assertJsonMissingPath('tables.sessions')->assertJsonMissingPath('tables.password_reset_tokens');
    }
}
