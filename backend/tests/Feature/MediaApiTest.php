<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class MediaApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_allowed_media_upload_is_stored_and_recorded(): void
    {
        Storage::fake('public');
        $this->seed();
        $admin = User::create(['id' => Str::lower(Str::random(12)), 'role_key' => 'admin', 'name' => 'Admin', 'email' => 'media@example.com', 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);
        $response = $this->actingAs($admin, 'sanctum')->post('/api/v1/media', ['file' => UploadedFile::fake()->image('cover.png')]);
        $response->assertCreated()->assertJsonStructure(['media', 'url']);
        Storage::disk('public')->assertExists($response->json('media.path'));
    }
}
