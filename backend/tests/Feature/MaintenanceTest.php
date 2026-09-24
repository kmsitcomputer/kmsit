<?php

namespace Tests\Feature;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class MaintenanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_visitor_is_blocked_during_maintenance_but_admin_is_allowed(): void
    {
        $this->seed();
        Setting::create(['setting_key' => 'maintenance_mode', 'setting_value' => '1']);
        $this->getJson('/api/v1/courses')->assertStatus(503);

        $admin = User::create(['id' => Str::lower(Str::random(12)), 'role_key' => 'admin', 'name' => 'Admin', 'email' => 'maintenance@example.com', 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);
        $this->actingAs($admin, 'sanctum')->getJson('/api/v1/courses')->assertOk();
        $this->getJson('/api/v1/settings/public')->assertOk();
    }
}
