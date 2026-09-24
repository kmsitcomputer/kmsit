<?php

namespace Tests\Feature;

use App\Models\{Article, Course, DigitalDelivery, Enrollment, HomepageBlock, Lesson, Media, Product, Section, User};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\{Hash, Storage};
use Tests\TestCase;

class CmsMediaFileSecurityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        Storage::fake('local');
        $this->seed();
    }

    public function test_media_accepts_valid_file_and_rejects_spoofed_oversize_and_active_content(): void
    {
        $admin = $this->user('media-security-admin@example.test', 'admin');
        $valid = $this->actingAs($admin, 'sanctum')->post('/api/v1/media', [
            'file' => UploadedFile::fake()->image('safe photo.JPG'),
        ])->assertCreated()->json('media');
        $this->assertStringStartsWith('media/', $valid['path']);
        $this->assertStringNotContainsString('safe photo', $valid['path']);
        $traversalName = $this->actingAs($admin, 'sanctum')->post('/api/v1/media', [
            'file' => UploadedFile::fake()->image('../../escape.png'),
        ])->assertCreated()->json('media');
        $this->assertSame('escape.png', $traversalName['name']);
        $this->assertStringStartsWith('media/', $traversalName['path']);

        $this->actingAs($admin, 'sanctum')->post('/api/v1/media', [
            'file' => UploadedFile::fake()->createWithContent('shell.php.jpg', '<?php echo 1;'),
        ])->assertStatus(422);
        $this->actingAs($admin, 'sanctum')->post('/api/v1/media', [
            'file' => UploadedFile::fake()->create('large.pdf', 5121, 'application/pdf'),
        ])->assertStatus(422);
        $this->actingAs($admin, 'sanctum')->post('/api/v1/media', [
            'file' => UploadedFile::fake()->createWithContent('active.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
        ])->assertStatus(422);
    }

    public function test_media_paths_cannot_traverse_serve_or_delete_boundaries_and_errors_hide_absolute_paths(): void
    {
        $owner = $this->user('media-owner@example.test', 'instructor');
        Storage::disk('public')->put('outside.txt', 'keep');
        $media = Media::create(['id' => 'unsafeMedia01', 'name' => '../outside.txt', 'mime' => 'text/plain',
            'size' => 4, 'path' => '../outside.txt', 'uploaded_by' => $owner->id]);

        $response = $this->actingAs($owner, 'sanctum')->deleteJson('/api/v1/media/' . $media->id);
        $response->assertStatus(422);
        $this->assertTrue(Storage::disk('public')->exists('outside.txt'));
        $this->assertStringNotContainsString(base_path(), $response->getContent());
        $this->get('/storage/%2e%2e/outside.txt')->assertNotFound();
    }

    public function test_media_delete_requires_owner(): void
    {
        $owner = $this->user('media-owner-two@example.test', 'instructor');
        $other = $this->user('media-other@example.test', 'instructor');
        Storage::disk('public')->put('media/owned.png', 'image');
        $media = Media::create(['id' => 'ownedMedia01', 'name' => 'owned.png', 'mime' => 'image/png',
            'size' => 5, 'path' => 'media/owned.png', 'uploaded_by' => $owner->id]);
        $this->actingAs($other, 'sanctum')->deleteJson('/api/v1/media/' . $media->id)->assertForbidden();
        Storage::disk('public')->assertExists('media/owned.png');
    }

    public function test_lesson_file_requires_owner_or_enrollment(): void
    {
        [$owner, $enrolled, $outsider, $course, $lesson] = $this->lessonFixture();
        Storage::disk('local')->put('lessons/course-file.pdf', '%PDF-safe');

        $this->actingAs($outsider, 'sanctum')->get('/api/v1/courses/' . $course->slug . '/lessons/' . $lesson->id . '/download')->assertNotFound();
        $this->actingAs($enrolled, 'sanctum')->get('/api/v1/courses/' . $course->slug . '/lessons/' . $lesson->id . '/download')->assertOk();
        $this->actingAs($owner, 'sanctum')->get('/api/v1/courses/' . $course->slug . '/lessons/' . $lesson->id . '/download')->assertOk();
    }

    public function test_digital_delivery_rejects_other_user_and_unsafe_path(): void
    {
        $owner = $this->user('digital-owner@example.test');
        $other = $this->user('digital-other@example.test');
        $product = Product::create(['id' => 'digitalprod1', 'slug' => 'digital-product', 'name' => 'Digital',
            'price' => 1000, 'stock' => 1, 'status' => 'published', 'is_digital' => true]);
        Storage::disk('local')->put('digital/manual.pdf', '%PDF-safe');
        Storage::disk('local')->put('secret.txt', 'secret');
        $delivery = DigitalDelivery::create(['id' => 'delivery0001', 'user_id' => $owner->id, 'product_id' => $product->id,
            'license_key' => 'LICENSE-1', 'download_url' => 'digital/manual.pdf', 'status' => 'active']);

        $this->actingAs($other, 'sanctum')->get('/api/v1/shop/digital-deliveries/' . $delivery->id . '/download')->assertNotFound();
        $this->actingAs($owner, 'sanctum')->get('/api/v1/shop/digital-deliveries/' . $delivery->id . '/download')->assertOk();
        $delivery->update(['download_url' => '../secret.txt']);
        $response = $this->actingAs($owner, 'sanctum')->get('/api/v1/shop/digital-deliveries/' . $delivery->id . '/download');
        $response->assertNotFound();
        $this->assertStringNotContainsString(base_path(), $response->getContent());
    }

    public function test_rich_text_is_sanitized_but_allowed_embed_survives(): void
    {
        $admin = $this->user('cms-security-admin@example.test', 'admin');
        $html = '<p style="background:url(javascript:alert(1));color:red">Safe</p><script>alert(1)</script>'
            . '<img src="x" onerror="alert(1)"><a href="javascript:alert(1)">bad</a>'
            . '<svg><script>alert(2)</script></svg>'
            . '<iframe src="https://evil.test/embed/1"></iframe><iframe src="https://www.youtube.com/embed/abc" allowfullscreen></iframe>';
        $article = $this->actingAs($admin, 'sanctum')->postJson('/api/v1/articles', [
            'title' => 'Sanitized', 'content' => $html, 'status' => 'published',
        ])->assertCreated()->json('article');
        $stored = Article::findOrFail($article['id'])->content;
        $this->assertStringNotContainsStringIgnoringCase('<script', $stored);
        $this->assertStringNotContainsStringIgnoringCase('onerror', $stored);
        $this->assertStringNotContainsStringIgnoringCase('javascript:', $stored);
        $this->assertStringNotContainsStringIgnoringCase('style=', $stored);
        $this->assertStringNotContainsString('evil.test', $stored);
        $this->assertStringContainsString('https://www.youtube.com/embed/abc', $stored);
        $public = $this->getJson('/api/v1/articles/' . $article['slug'])->assertOk()->json('article.content');
        $this->assertSame($stored, $public);
    }

    public function test_generic_content_homepage_and_lesson_html_are_sanitized_recursively(): void
    {
        $admin = $this->user('cms-security-two@example.test', 'admin');
        $page = $this->actingAs($admin, 'sanctum')->postJson('/api/v1/pages', [
            'title' => 'Safe Page', 'content' => '<p onclick="x()">Text</p><script>x()</script>', 'status' => 'published',
        ])->assertCreated()->json('content');
        $this->assertSame('<p>Text</p>', $page['content']);

        $block = $this->actingAs($admin, 'sanctum')->postJson('/api/v1/homepage/blocks', [
            'type' => 'html', 'content' => ['html' => '<img src=x onerror=alert(1)>', 'nested' => ['url' => 'javascript:alert(1)']],
        ])->assertCreated()->json('block');
        $saved = HomepageBlock::findOrFail($block['id'])->content;
        $this->assertStringNotContainsStringIgnoringCase('onerror', $saved['html']);
        $this->assertNull($saved['nested']['url']);

        [$owner, , , $course, $lesson] = $this->lessonFixture();
        $this->actingAs($owner, 'sanctum')->putJson('/api/v1/admin/courses/' . $course->id, [
            'title' => $course->title, 'price' => $course->price, 'level' => $course->level,
            'sections' => [['id' => $lesson->section_id, 'title' => 'Section', 'lessons' => [[
                'id' => $lesson->id, 'title' => 'Lesson', 'type' => 'text', 'content' => '<img src=x onerror=alert(1)><p>Safe</p>',
            ]]]],
        ])->assertOk();
        $this->assertStringNotContainsStringIgnoringCase('onerror', $lesson->fresh()->content);
    }

    private function lessonFixture(): array
    {
        $owner = $this->user('lesson-owner-' . uniqid() . '@example.test', 'instructor');
        $enrolled = $this->user('lesson-enrolled-' . uniqid() . '@example.test');
        $outsider = $this->user('lesson-outsider-' . uniqid() . '@example.test');
        $course = Course::create(['id' => strtolower(substr(md5(uniqid()), 0, 12)), 'slug' => 'course-' . uniqid(),
            'instructor_id' => $owner->id, 'title' => 'Course', 'price' => 10000, 'level' => 'beginner', 'status' => 'published']);
        $section = Section::create(['id' => strtolower(substr(md5(uniqid()), 0, 12)), 'course_id' => $course->id, 'title' => 'Section', 'sort' => 0]);
        $lesson = Lesson::create(['id' => strtolower(substr(md5(uniqid()), 0, 12)), 'course_id' => $course->id,
            'section_id' => $section->id, 'title' => 'Private file', 'type' => 'file', 'media_url' => 'lessons/course-file.pdf', 'status' => 'published']);
        Enrollment::create(['id' => strtolower(substr(md5(uniqid()), 0, 12)), 'user_id' => $enrolled->id,
            'course_id' => $course->id, 'status' => 'active', 'progress_pct' => 0]);
        return [$owner, $enrolled, $outsider, $course, $lesson];
    }

    private function user(string $email, string $role = 'student'): User
    {
        return User::create(['id' => strtolower(substr(md5($email), 0, 12)), 'role_key' => $role, 'name' => 'User',
            'email' => $email, 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);
    }
}
