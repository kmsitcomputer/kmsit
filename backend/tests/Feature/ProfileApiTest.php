<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class ProfileApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_update_profile_and_password_server_side(): void
    {
        $this->seed();
        $user = User::create(['id' => Str::lower(Str::random(12)), 'role_key' => 'student', 'name' => 'Student', 'email' => 'profile@example.com', 'password_hash' => Hash::make('old-password'), 'status' => 'active', 'instructor_approved' => true]);
        $this->actingAs($user, 'sanctum')->putJson('/api/v1/profile', ['name' => 'Updated', 'bio' => 'Bio', 'avatar' => 'https://example.com/avatar.png'])->assertOk();
        $this->actingAs($user, 'sanctum')->putJson('/api/v1/profile/password', ['current_password' => 'old-password', 'password' => 'new-password', 'password_confirmation' => 'new-password'])->assertOk();
        $this->assertTrue(Hash::check('new-password', $user->fresh()->password_hash));
    }
}
