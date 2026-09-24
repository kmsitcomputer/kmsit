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
}
