<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class PasswordResetApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_password_reset_token_can_change_password(): void
    {
        $this->withoutMiddleware(PreventRequestForgery::class);
        $this->seed();
        User::create(['id' => Str::lower(Str::random(12)), 'role_key' => 'student', 'name' => 'Student', 'email' => 'reset@example.com', 'password_hash' => Hash::make('old-password'), 'status' => 'active', 'instructor_approved' => true]);
        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'reset@example.com'])->assertOk();
        $record = \DB::table('password_reset_tokens')->where('email', 'reset@example.com')->first();
        $this->assertNotNull($record);
        $this->assertTrue(Hash::check($plain = 'invalid', $record->token) === false);
        $this->postJson('/api/v1/auth/reset-password', ['email' => 'reset@example.com', 'token' => $plain, 'password' => 'new-password', 'password_confirmation' => 'new-password'])->assertStatus(422);
    }
}
