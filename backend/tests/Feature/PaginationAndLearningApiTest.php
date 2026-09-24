<?php

namespace Tests\Feature;

use App\Models\{AuditLog, Course, Enrollment, Lesson, LessonProgress, Order, Quiz, QuizAttempt, Section, Setting, User};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class PaginationAndLearningApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    private function user(string $role, string $email): User
    {
        return User::create(['id' => Str::lower(Str::random(12)), 'role_key' => $role, 'name' => ucfirst($role) . ' ' . Str::before($email, '@'), 'email' => $email,
            'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);
    }

    private function course(User $instructor, string $slug, array $extra = []): Course
    {
        return Course::create($extra + ['id' => Str::lower(Str::random(12)), 'slug' => $slug, 'instructor_id' => $instructor->id, 'title' => 'Kelas ' . $slug,
            'price' => 50000, 'is_free' => false, 'status' => 'published', 'published_at' => now()]);
    }

    public function test_listings_share_the_pagination_contract_and_cap_per_page(): void
    {
        $super = $this->user('super_admin', 'root@example.com');
        foreach (range(1, 3) as $i) $this->user('student', "s{$i}@example.com");
        foreach (range(1, 3) as $i) AuditLog::create(['user_id' => $super->id, 'user_name' => 'root', 'action' => 'test_action', 'model' => 'System', 'detail' => "row {$i}"]);
        $this->actingAs($super, 'sanctum');

        $meta = ['current_page', 'per_page', 'total', 'last_page', 'data'];
        foreach ([
            '/api/v1/admin/users?per_page=1000' => 'users',
            '/api/v1/admin/audit-logs?per_page=1000' => 'logs',
            '/api/v1/admin/contact-messages?per_page=1000' => 'messages',
            '/api/v1/payments/webhook-logs?per_page=1000' => 'webhook_logs',
            '/api/v1/admin/withdrawals?per_page=1000' => 'withdrawals',
            '/api/v1/admin/vouchers?per_page=1000' => 'vouchers',
            '/api/v1/admin/courses?per_page=1000' => 'courses',
            '/api/v1/admin/quizzes?per_page=1000' => 'quizzes',
            '/api/v1/media?per_page=1000' => 'media',
            '/api/v1/certificates?per_page=1000' => 'certificates',
            '/api/v1/notifications?per_page=1000' => 'notifications',
            '/api/v1/payments?per_page=1000' => 'payments',
            '/api/v1/admin/products?per_page=1000' => 'products',
        ] as $uri => $key) {
            $this->getJson($uri)->assertOk()->assertJsonStructure([$key => $meta])->assertJsonPath("{$key}.per_page", 100);
        }
        $this->getJson('/api/v1/orders?per_page=1000')->assertOk()->assertJsonStructure($meta)->assertJsonPath('per_page', 100);
        $this->getJson('/api/v1/admin/users?per_page=2&role=student')->assertJsonPath('users.total', 3)->assertJsonPath('users.last_page', 2);
        $this->getJson('/api/v1/admin/users?q=s2@')->assertJsonPath('users.total', 1);
        $this->getJson('/api/v1/admin/audit-logs?action=test_action')->assertJsonPath('logs.total', 3);
    }

    public function test_limited_admin_user_listing_total_matches_policy(): void
    {
        $admin = $this->user('admin', 'adm@example.com');
        $this->user('student', 'st1@example.com');
        $this->user('instructor', 'in1@example.com');
        $this->user('super_admin', 'sa@example.com');
        $this->user('admin', 'peer@example.com');
        // Seeded admin manages students + instructors, plus itself; never peers or super admins.
        $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/users')->assertOk()->assertJsonPath('users.total', 3);
    }

    public function test_order_and_catalog_filters_run_before_pagination(): void
    {
        $student = $this->user('student', 'buyer@example.com');
        $instructor = $this->user('instructor', 'teach@example.com');
        foreach (['paid', 'pending', 'paid'] as $i => $status) {
            Order::create(['id' => "pgorder0000{$i}", 'user_id' => $student->id, 'type' => 'course', 'status' => $status, 'subtotal' => 1, 'total' => 1, 'currency' => 'IDR']);
        }
        $this->actingAs($student, 'sanctum')->getJson('/api/v1/orders?status=paid&per_page=1')->assertJsonPath('total', 2)->assertJsonPath('last_page', 2);

        $this->course($instructor, 'cheap', ['price' => 10000]);
        $this->course($instructor, 'pricey', ['price' => 90000]);
        $this->course($instructor, 'gratis', ['price' => 0, 'is_free' => true, 'featured' => true]);
        $this->getJson('/api/v1/courses?sort=price_desc')->assertJsonPath('data.0.slug', 'pricey');
        $this->getJson('/api/v1/courses?sort=price_asc')->assertJsonPath('data.0.slug', 'gratis');
        $this->getJson('/api/v1/courses?type=free')->assertJsonPath('total', 1);
        $this->getJson('/api/v1/courses?featured=1')->assertJsonPath('data.0.slug', 'gratis');
        $this->getJson('/api/v1/courses/pricey')->assertJsonPath('course.instructor_stats.courses', 3);
    }

    public function test_learning_status_is_owner_scoped_and_matches_certificate_rules(): void
    {
        $instructor = $this->user('instructor', 'lt@example.com');
        $student = $this->user('student', 'ls@example.com');
        $stranger = $this->user('student', 'lx@example.com');
        $course = $this->course($instructor, 'learn-status');
        $section = Section::create(['id' => 'lssection001', 'course_id' => $course->id, 'title' => 'S', 'sort' => 0]);
        $lesson = Lesson::create(['id' => 'lslesson0001', 'course_id' => $course->id, 'section_id' => $section->id, 'title' => 'L', 'type' => 'text', 'status' => 'published', 'sort' => 0]);
        $quiz = Quiz::create(['id' => 'lsquiz000001', 'course_id' => $course->id, 'creator_id' => $instructor->id, 'title' => 'Q', 'passing_score' => 70, 'max_attempts' => 2, 'time_limit_min' => 0, 'active' => true]);
        Enrollment::create(['id' => 'lsenroll0001', 'user_id' => $student->id, 'course_id' => $course->id, 'status' => 'active', 'progress_pct' => 0]);

        $this->actingAs($stranger, 'sanctum')->getJson("/api/v1/my/courses/{$course->id}/status")->assertNotFound();
        $this->actingAs($student, 'sanctum')->getJson("/api/v1/my/courses/{$course->id}/status")->assertOk()
            ->assertJsonPath('progress.total', 1)->assertJsonPath('eligible', false)->assertJsonPath('quizzes.0.passed', false);

        LessonProgress::create(['id' => 'lsprogress01', 'user_id' => $student->id, 'lesson_id' => $lesson->id, 'completed_at' => now()]);
        QuizAttempt::create(['id' => 'lsattempt001', 'quiz_id' => $quiz->id, 'user_id' => $student->id, 'status' => 'submitted', 'answers' => [], 'score' => 9, 'max_score' => 10, 'percent' => 90, 'passed' => true, 'started_at' => now(), 'submitted_at' => now()]);
        $this->getJson("/api/v1/my/courses/{$course->id}/status")->assertJsonPath('eligible', true)->assertJsonPath('quizzes.0.attempts_used', 1);
        $this->postJson("/api/v1/courses/{$course->id}/certificate")->assertCreated();
        $this->getJson("/api/v1/my/courses/{$course->id}/status")->assertJsonPath('certificate.status', 'issued');

        $this->getJson('/api/v1/my/enrollments')->assertJsonPath('enrollments.total', 1)->assertJsonPath('enrollments.data.0.course_slug', 'learn-status');
        $this->getJson('/api/v1/my/quiz-attempts')->assertJsonPath('attempts.total', 1)->assertJsonPath('attempts.data.0.passed', true);
        $this->actingAs($stranger, 'sanctum')->getJson('/api/v1/my/quiz-attempts')->assertJsonPath('attempts.total', 0);
    }

    public function test_payment_options_come_from_server_settings_without_secrets(): void
    {
        $student = $this->user('student', 'po@example.com');
        Setting::updateOrCreate(['setting_key' => 'gateway_active'], ['setting_value' => 'xendit']);
        config(['payment.xendit.api_key' => 'secret-key-canary']);
        $response = $this->actingAs($student, 'sanctum')->getJson('/api/v1/payments/options')->assertOk()
            ->assertJsonPath('gateway', 'xendit')->assertJsonPath('methods.0.key', 'BCAVA');
        $this->assertStringNotContainsString('secret-key-canary', $response->getContent());
        $this->getJson('/api/v1/instructor/students')->assertForbidden();
    }
}
