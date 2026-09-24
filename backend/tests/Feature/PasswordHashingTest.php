<?php

namespace Tests\Feature;

use App\Mail\PasswordResetMail;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Documents how passwords are actually created/stored/checked/reset: Laravel Hash
 * (bcrypt) everywhere, not SHA-256 + salt. These are behavioral proofs, not the fix.
 */
class PasswordHashingTest extends TestCase
{
    use RefreshDatabase;

    public function test_registered_password_is_laravel_hash_and_only_the_right_password_logs_in(): void
    {
        $this->withoutMiddleware(PreventRequestForgery::class);
        $this->seed();

        $this->postJson('/api/v1/auth/register', [
            'name' => 'Student Baru', 'email' => 'hash@example.com',
            'password' => 'Strong-password-123', 'password_confirmation' => 'Strong-password-123',
        ])->assertCreated()->assertJsonMissingPath('user.password_hash');

        $user = User::where('email', 'hash@example.com')->firstOrFail();
        $this->assertNotSame('Strong-password-123', $user->password_hash);
        $this->assertLaravelHash($user->password_hash);
        $this->assertTrue(Hash::check('Strong-password-123', $user->password_hash));

        $this->postJson('/api/v1/auth/login', ['email' => 'hash@example.com', 'password' => 'Strong-password-123'])
            ->assertOk()->assertJsonPath('user.email', 'hash@example.com');

        $this->postJson('/api/v1/auth/login', ['email' => 'hash@example.com', 'password' => 'wrong-password'])
            ->assertStatus(422)->assertJsonPath('message', 'Email atau password tidak valid.');

        $this->assertTrue(Hash::check('Strong-password-123', $user->fresh()->password_hash));
        $this->assertFalse(Hash::check('wrong-password', $user->fresh()->password_hash));
    }

    public function test_password_change_stores_a_laravel_hash(): void
    {
        $this->seed();
        $user = $this->user('change@example.com', 'old-password');

        $this->actingAs($user, 'sanctum')->putJson('/api/v1/profile/password', [
            'current_password' => 'old-password', 'password' => 'Brand-new-pass-1', 'password_confirmation' => 'Brand-new-pass-1',
        ])->assertOk();

        $hash = $user->fresh()->password_hash;
        $this->assertNotSame('Brand-new-pass-1', $hash);
        $this->assertLaravelHash($hash);
        $this->assertTrue(Hash::check('Brand-new-pass-1', $hash));
        $this->assertFalse(Hash::check('old-password', $hash));
    }

    public function test_password_reset_writes_laravel_hash_and_stores_only_a_hashed_token(): void
    {
        $this->withoutMiddleware(PreventRequestForgery::class);
        Mail::fake();
        $this->seed();
        $user = $this->user('reset@example.com', 'old-password');

        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'reset@example.com'])->assertOk();

        $token = null;
        Mail::assertQueued(PasswordResetMail::class, function (PasswordResetMail $mail) use (&$token) {
            // URL format includes HashRouter fragment: http://host/#/path?email=&token=
            // parse_url(PHP_URL_QUERY) returns everything after first '?' including '#/path' prefix.
            // Extract query by splitting on '#' then parsing what remains.
            $parts = explode('#', $mail->url);
            $queryStr = isset($parts[1]) ? strstr($parts[1], '?') : '';
            if ($queryStr === false || empty(trim($queryStr))) {
                $queryStr = substr(parse_url($mail->url, PHP_URL_QUERY) ?: '', 0);
            }
            parse_str((string) ltrim($queryStr, '?'), $query);
            $token = $query['token'] ?? null;
            return true;
        });
        $this->assertNotNull($token);

        $record = DB::table('password_reset_tokens')->where('email', 'reset@example.com')->first();
        $this->assertNotSame($token, $record->token);
        $this->assertLaravelHash($record->token);
        $this->assertTrue(Hash::check($token, $record->token));

        $this->postJson('/api/v1/auth/reset-password', [
            'email' => 'reset@example.com', 'token' => $token,
            'password' => 'Brand-new-pass-2', 'password_confirmation' => 'Brand-new-pass-2',
        ])->assertOk();

        $hash = $user->fresh()->password_hash;
        $this->assertLaravelHash($hash);
        $this->assertTrue(Hash::check('Brand-new-pass-2', $hash));
        $this->assertFalse(Hash::check('old-password', $hash));
    }

    private function user(string $email, string $password): User
    {
        return User::create(['id' => Str::lower(Str::random(12)), 'role_key' => 'student', 'name' => 'Student',
            'email' => $email, 'password_hash' => Hash::make($password), 'status' => 'active', 'instructor_approved' => true]);
    }

    private function assertLaravelHash(string $hash): void
    {
        $this->assertTrue(str_starts_with($hash, '$2y$'), 'Expected a Laravel/bcrypt hash.');
    }
}
