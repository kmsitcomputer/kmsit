<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * The public site only renders video through its own YouTube/Vimeo player, so the URL is
 * constrained server-side (https + allowlisted host) instead of trusting arbitrary admin input.
 */
class VideoEmbedUrlValidationTest extends TestCase
{
    use RefreshDatabase;

    public function test_content_video_url_accepts_https_youtube_and_rejects_other_schemes_or_hosts(): void
    {
        $this->seed();
        $admin = $this->admin();

        $created = $this->actingAs($admin, 'sanctum')->postJson('/api/v1/news', [
            'title' => 'Video News', 'status' => 'published', 'video_url' => 'https://www.youtube.com/watch?v=abcdefghijk',
        ])->assertCreated()->json('content');
        $this->assertSame('https://www.youtube.com/watch?v=abcdefghijk', $created['video_url']);

        foreach ([
            'http://www.youtube.com/watch?v=abcdefghijk',
            'https://evil.test/video.mp4',
            'https://www.youtube.com.evil.test/watch?v=abcdefghijk',
            'javascript:alert(1)',
        ] as $bad) {
            $this->actingAs($admin, 'sanctum')->postJson('/api/v1/news', [
                'title' => 'Bad Video', 'status' => 'draft', 'video_url' => $bad,
            ])->assertStatus(422)->assertJsonValidationErrors('video_url');
        }
    }

    public function test_lesson_media_url_is_sanitized_to_the_embed_allowlist(): void
    {
        $this->seed();
        $instructor = User::create(['id' => Str::lower(Str::random(12)), 'role_key' => 'instructor', 'name' => 'Teacher',
            'email' => 'video-teacher@example.com', 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);

        $course = $this->actingAs($instructor, 'sanctum')->postJson('/api/v1/admin/courses', [
            'title' => 'Video Course', 'price' => 0, 'level' => 'beginner', 'is_free' => true,
        ])->assertCreated()->json('course');

        $lessons = $this->actingAs($instructor, 'sanctum')->putJson("/api/v1/admin/courses/{$course['id']}", [
            'title' => 'Video Course', 'price' => 0, 'level' => 'beginner', 'is_free' => true,
            'sections' => [[
                'title' => 'Section',
                'lessons' => [
                    ['title' => 'Allowed', 'type' => 'embed', 'media_url' => 'https://player.vimeo.com/video/123'],
                    ['title' => 'Foreign host', 'type' => 'embed', 'media_url' => 'https://evil.test/embed/1'],
                    ['title' => 'Insecure', 'type' => 'youtube', 'media_url' => 'http://www.youtube.com/watch?v=abc'],
                ],
            ]],
        ])->assertOk()->json('course.sections.0.lessons');

        $this->assertSame('https://player.vimeo.com/video/123', $lessons[0]['media_url']);
        $this->assertNull($lessons[1]['media_url']);
        $this->assertNull($lessons[2]['media_url']);
    }

    private function admin(): User
    {
        return User::create(['id' => Str::lower(Str::random(12)), 'role_key' => 'admin', 'name' => 'Admin',
            'email' => 'video-admin@example.com', 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);
    }
}
