<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
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

    public function test_student_can_upload_own_avatar_even_without_media_library_permission(): void
    {
        Storage::fake('public');
        $this->seed();
        $student = User::create(['id' => Str::lower(Str::random(12)), 'role_key' => 'student', 'name' => 'Student', 'email' => 'avatar-student@example.com', 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);

        // The general media library upload stays staff-only.
        $this->actingAs($student, 'sanctum')->postJson('/api/v1/media', ['file' => UploadedFile::fake()->image('pic.jpg')])->assertForbidden();

        // But every authenticated user, including students, can set their own avatar.
        $response = $this->actingAs($student, 'sanctum')->postJson('/api/v1/profile/avatar', ['file' => UploadedFile::fake()->image('avatar.jpg', 200, 200)])->assertOk();
        $avatarUrl = $response->json('user.avatar');
        $this->assertNotEmpty($avatarUrl);
        $this->assertStringContainsString('/storage/avatars/', $avatarUrl);
        $this->assertSame($avatarUrl, $student->fresh()->avatar);
    }

    /**
     * The dashboard's main "Simpan" button on the profile page only ever sends
     * name/phone/bio (avatar has its own dedicated upload endpoint) — saving profile info
     * must never wipe out a previously uploaded avatar just because this request omitted it.
     */
    public function test_saving_profile_info_without_avatar_field_does_not_clear_existing_avatar(): void
    {
        $this->seed();
        $user = User::create(['id' => Str::lower(Str::random(12)), 'role_key' => 'student', 'name' => 'Student', 'email' => 'keep-avatar@example.com', 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true, 'avatar' => 'https://example.com/existing-avatar.png']);

        $this->actingAs($user, 'sanctum')->putJson('/api/v1/profile', ['name' => 'Renamed', 'bio' => 'New bio'])
            ->assertOk()->assertJsonPath('user.avatar', 'https://example.com/existing-avatar.png');
        $this->assertSame('https://example.com/existing-avatar.png', $user->fresh()->avatar);
    }
}
