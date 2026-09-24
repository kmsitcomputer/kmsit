<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class SuspendedSessionApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_suspended_user_loses_api_access_on_existing_session(): void
    {
        $this->seed();
        $user = User::create([
            'id' => Str::lower(Str::random(12)), 'role_key' => 'student', 'name' => 'Student',
            'email' => 'suspended@example.com', 'password_hash' => Hash::make('password'),
            'status' => 'active', 'instructor_approved' => true,
        ]);

        $this->actingAs($user, 'sanctum')->getJson('/api/v1/notifications')->assertOk();
        $this->actingAs($user, 'web')->getJson('/api/v1/auth/me')->assertOk();

        $user->update(['status' => 'suspended']);
        $fresh = $user->fresh();

        $this->actingAs($fresh, 'sanctum')->getJson('/api/v1/notifications')->assertUnauthorized();
        $this->actingAs($fresh, 'web')->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    /**
     * Web-guard path through AuthenticateApiUser (e.g. /notifications), which has
     * no per-controller status check of its own — unlike /auth/me.
     *
     * Note: actingAs() only fakes guard resolution for the request; it does not
     * prove a real cookie/session HTTP flow would behave identically.
     */
    public function test_suspended_user_is_rejected_on_web_guard_middleware_path(): void
    {
        $this->seed();
        $user = User::create([
            'id' => Str::lower(Str::random(12)), 'role_key' => 'student', 'name' => 'Student',
            'email' => 'suspended-web@example.com', 'password_hash' => Hash::make('password'),
            'status' => 'active', 'instructor_approved' => true,
        ]);

        $this->actingAs($user, 'web')
            ->getJson('/api/v1/notifications')
            ->assertOk()
            ->assertJsonStructure(['notifications']);

        $user->update(['status' => 'suspended']);

        $this->actingAs($user->fresh(), 'web')
            ->getJson('/api/v1/notifications')
            ->assertUnauthorized();
    }
}
