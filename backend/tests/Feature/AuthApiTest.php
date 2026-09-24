<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register_and_use_sanctum_token(): void
    {
        $this->withoutMiddleware(PreventRequestForgery::class);
        $this->seed();

        $register = $this->postJson('/api/v1/auth/register', [
            'name' => 'Student Baru',
            'email' => 'student@example.com',
            'password' => 'Strong-password-123',
            'password_confirmation' => 'Strong-password-123',
        ]);

        $register->assertCreated()
            ->assertJsonPath('user.role_key', 'student')
            ->assertJsonStructure(['user']);

        $this
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('user.email', 'student@example.com');

        $this->postJson('/api/v1/auth/logout')
            ->assertOk();
    }

    public function test_registration_is_blocked_when_allow_registration_is_false(): void
    {
        $this->withoutMiddleware(PreventRequestForgery::class);
        $this->seed();
        \App\Models\Setting::create(['setting_key' => 'allow_registration', 'setting_value' => '0']);

        $this->postJson('/api/v1/auth/register', [
            'name' => 'Blocked User',
            'email' => 'blocked@example.com',
            'password' => 'Strong-password-123',
            'password_confirmation' => 'Strong-password-123',
        ])->assertForbidden()->assertJsonPath('message', 'Registrasi ditutup saat ini.');
    }

    public function test_registration_works_when_allow_registration_is_true(): void
    {
        $this->withoutMiddleware(PreventRequestForgery::class);
        $this->seed();
        \App\Models\Setting::create(['setting_key' => 'allow_registration', 'setting_value' => '1']);

        $this->postJson('/api/v1/auth/register', [
            'name' => 'Allowed User',
            'email' => 'allowed@example.com',
            'password' => 'Strong-password-123',
            'password_confirmation' => 'Strong-password-123',
        ])->assertCreated();
    }
}
