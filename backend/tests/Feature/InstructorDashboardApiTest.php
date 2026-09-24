<?php

namespace Tests\Feature;

use App\Models\{Course, Enrollment, Order, OrderItem, Quiz, QuizAttempt, User, WalletTransaction};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class InstructorDashboardApiTest extends TestCase
{
    use RefreshDatabase;

    private User $a;
    private User $b;
    private Course $courseA;
    private Course $courseB;
    private User $student;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        $this->a = $this->user('instructor', 'ia@example.com');
        $this->b = $this->user('instructor', 'ib@example.com');
        $this->student = $this->user('student', 'st@example.com');
        $this->courseA = $this->course($this->a, 'course-a');
        $this->courseB = $this->course($this->b, 'course-b');
        Enrollment::create(['id' => 'enrolla00001', 'user_id' => $this->student->id, 'course_id' => $this->courseA->id, 'status' => 'active', 'progress_pct' => 40]);
        Enrollment::create(['id' => 'enrollb00001', 'user_id' => $this->student->id, 'course_id' => $this->courseB->id, 'status' => 'active', 'progress_pct' => 90]);
        // A sale of course A (student buys) and the instructor's own purchase of course B.
        $this->sale('orderasale01', $this->student, $this->courseA, 'paid');
        $this->sale('orderapurch1', $this->a, $this->courseB, 'paid');
        WalletTransaction::create(['id' => 'wtxa00000001', 'user_id' => $this->a->id, 'type' => 'earning', 'ref_id' => $this->courseA->id, 'order_id' => 'orderasale01', 'amount' => 85000, 'gross' => 100000, 'platform_fee' => 15000, 'payment_fee' => 0, 'status' => 'completed']);
        WalletTransaction::create(['id' => 'wtxb00000001', 'user_id' => $this->b->id, 'type' => 'earning', 'ref_id' => $this->courseB->id, 'order_id' => 'orderapurch1', 'amount' => 85000, 'gross' => 100000, 'platform_fee' => 15000, 'payment_fee' => 0, 'status' => 'completed']);
        $quizA = Quiz::create(['id' => 'quizcoursea1', 'course_id' => $this->courseA->id, 'creator_id' => $this->a->id, 'title' => 'Quiz A', 'passing_score' => 70, 'max_attempts' => 3, 'time_limit_min' => 0, 'active' => true]);
        $quizB = Quiz::create(['id' => 'quizcourseb1', 'course_id' => $this->courseB->id, 'creator_id' => $this->b->id, 'title' => 'Quiz B', 'passing_score' => 70, 'max_attempts' => 3, 'time_limit_min' => 0, 'active' => true]);
        foreach ([[$quizA, 'attempta0001'], [$quizB, 'attemptb0001']] as [$quiz, $id]) {
            QuizAttempt::create(['id' => $id, 'quiz_id' => $quiz->id, 'user_id' => $this->student->id, 'status' => 'submitted', 'answers' => [], 'score' => 8, 'max_score' => 10, 'percent' => 80, 'passed' => true, 'started_at' => now(), 'submitted_at' => now()]);
        }
    }

    private function user(string $role, string $email): User
    {
        return User::create(['id' => Str::lower(Str::random(12)), 'role_key' => $role, 'name' => ucfirst($role) . ' ' . Str::before($email, '@'), 'email' => $email,
            'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);
    }

    private function course(User $owner, string $slug): Course
    {
        return Course::create(['id' => Str::lower(Str::random(12)), 'slug' => $slug, 'instructor_id' => $owner->id, 'title' => 'Course ' . $slug,
            'is_free' => false, 'price' => 100000, 'status' => 'published']);
    }

    private function sale(string $orderId, User $buyer, Course $course, string $status): void
    {
        Order::create(['id' => $orderId, 'user_id' => $buyer->id, 'type' => 'course', 'status' => $status, 'subtotal' => 100000, 'total' => 100000, 'currency' => 'IDR', 'paid_at' => now(), 'needs_shipping' => false]);
        OrderItem::create(['id' => 'item' . substr($orderId, 0, 8), 'order_id' => $orderId, 'kind' => 'course', 'ref_id' => $course->id, 'title' => $course->title, 'price' => 100000, 'qty' => 1, 'instructor_id' => $course->instructor_id]);
    }

    public function test_only_instructors_can_use_the_endpoints(): void
    {
        $admin = $this->user('admin', 'adm@example.com');
        $super = $this->user('super_admin', 'root@example.com');
        $endpoints = ['/students', '/sales', '/earnings', '/quizzes', '/quiz-attempts', "/courses/{$this->courseA->id}/progress"];
        foreach ([$this->student, $admin, $super] as $actor) {
            foreach ($endpoints as $endpoint) {
                $this->actingAs($actor, 'sanctum')->getJson('/api/v1/instructor' . $endpoint)->assertForbidden();
            }
        }
        $this->getJson('/api/v1/instructor/students')->assertForbidden();
        foreach ($endpoints as $endpoint) {
            $this->actingAs($this->a, 'sanctum')->getJson('/api/v1/instructor' . $endpoint)->assertOk();
        }
    }

    public function test_students_are_scoped_to_own_courses_with_pagination_and_filters(): void
    {
        $response = $this->actingAs($this->a, 'sanctum')->getJson('/api/v1/instructor/students?per_page=500')->assertOk();
        $response->assertJsonPath('students.total', 1)->assertJsonPath('students.per_page', 100)
            ->assertJsonPath('students.data.0.course_id', $this->courseA->id)->assertJsonPath('students.data.0.progress_pct', 40);
        $this->getJson("/api/v1/instructor/students?course_id={$this->courseB->id}")->assertNotFound();
        $this->getJson('/api/v1/instructor/students?q=nobody')->assertJsonPath('students.total', 0);
        $this->getJson('/api/v1/instructor/students?q=st@example')->assertJsonPath('students.total', 1);
    }

    public function test_sales_are_course_sales_not_own_purchases(): void
    {
        $response = $this->actingAs($this->a, 'sanctum')->getJson('/api/v1/instructor/sales')->assertOk();
        $response->assertJsonPath('sales.total', 1)->assertJsonPath('sales.data.0.order_id', 'orderasale01')
            ->assertJsonPath('sales.data.0.net_earning', 85000)->assertJsonPath('summary.gross', 100000);
        $this->assertStringNotContainsString('st@example.com', $response->getContent());
        $this->getJson('/api/v1/instructor/sales?status=bogus')->assertStatus(422);
        $this->actingAs($this->b, 'sanctum')->getJson('/api/v1/instructor/sales')->assertJsonPath('sales.data.0.order_id', 'orderapurch1');
    }

    public function test_earnings_quizzes_attempts_and_progress_are_owned(): void
    {
        $this->actingAs($this->a, 'sanctum');
        $this->getJson('/api/v1/instructor/earnings')->assertJsonPath('earnings.total', 1)->assertJsonPath('summary.net', 85000)
            ->assertJsonPath('earnings.data.0.course_title', $this->courseA->title);
        $this->getJson('/api/v1/instructor/quizzes')->assertJsonPath('quizzes.total', 1)->assertJsonPath('quizzes.data.0.id', 'quizcoursea1')
            ->assertJsonPath('quizzes.data.0.submitted_attempts_count', 1);
        $this->getJson('/api/v1/instructor/quiz-attempts')->assertJsonPath('attempts.total', 1)->assertJsonPath('attempts.data.0.id', 'attempta0001');
        $this->postJson('/api/v1/instructor/quiz-attempts')->assertJsonPath('attempts.total', 1);
        $this->getJson('/api/v1/instructor/quiz-attempts?quiz_id=quizcourseb1')->assertNotFound();
        $this->getJson("/api/v1/instructor/courses/{$this->courseA->id}/progress")->assertOk()
            ->assertJsonPath('course.enrolled', 1)->assertJsonPath('students_progress.data.0.progress_pct', 40);
        $this->getJson("/api/v1/instructor/courses/{$this->courseB->id}/progress")->assertNotFound();
    }
}
