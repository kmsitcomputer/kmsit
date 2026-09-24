<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class InstallApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_installer_creates_super_admin_and_locks_second_install(): void
    {
        $this->getJson('/api/v1/install/status')->assertOk()->assertJsonPath('installed', false);
        $this->postJson('/api/v1/install', ['site_name' => 'KMSIT', 'site_url' => 'https://kmsitcomputer.host', 'admin_name' => 'Owner', 'admin_email' => 'owner@example.com', 'password' => 'Strong-password-123', 'password_confirmation' => 'Strong-password-123', 'timezone' => 'Asia/Jakarta', 'language' => 'id', 'currency' => 'IDR'])->assertCreated()->assertJsonPath('installed', true);
        $user = User::firstOrFail();
        $this->assertSame('super_admin', $user->role_key);
        $this->assertTrue(Hash::check('Strong-password-123', $user->password_hash));
        $this->postJson('/api/v1/install', [])->assertStatus(409);
    }
}
