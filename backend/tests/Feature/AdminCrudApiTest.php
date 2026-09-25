<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class AdminCrudApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_instructor_can_build_course_curriculum_and_admin_can_moderate(): void
    {
        $this->seed();
        $instructor = $this->user('instructor', 'course-instructor@example.com');
        $admin = $this->user('admin', 'course-admin@example.com');
        $other = $this->user('instructor', 'other-instructor@example.com');

        $course = $this->actingAs($instructor, 'sanctum')->postJson('/api/v1/admin/courses', [
            'title' => 'Belajar Laravel', 'price' => 100000, 'level' => 'beginner',
        ])->assertCreated()->json('course');
        $this->assertSame('draft', $course['status']);
        $this->assertSame($instructor->id, $course['instructor_id']);

        $updated = $this->actingAs($instructor, 'sanctum')->putJson("/api/v1/admin/courses/{$course['id']}", [
            'title' => 'Belajar Laravel', 'price' => 100000, 'level' => 'beginner',
            'sections' => [[
                'title' => 'Pengantar',
                'lessons' => [['title' => 'Video 1', 'type' => 'youtube', 'media_url' => 'abc', 'duration_min' => 10]],
            ]],
        ])->assertOk()->json('course');
        $this->assertCount(1, $updated['sections']);
        $this->assertCount(1, $updated['sections'][0]['lessons']);
        $lessonId = $updated['sections'][0]['lessons'][0]['id'];
        $sectionId = $updated['sections'][0]['id'];

        // Other instructor cannot edit someone else's course.
        $this->actingAs($other, 'sanctum')->putJson("/api/v1/admin/courses/{$course['id']}", [
            'title' => 'Hack', 'price' => 0, 'level' => 'beginner',
        ])->assertForbidden();

        $this->actingAs($instructor, 'sanctum')->postJson("/api/v1/admin/courses/{$course['id']}/submit")->assertOk()->assertJsonPath('course.status', 'pending');

        // Instructor cannot approve their own course.
        $this->actingAs($instructor, 'sanctum')->patchJson("/api/v1/admin/courses/{$course['id']}/moderate", ['action' => 'approve'])->assertForbidden();

        $this->actingAs($admin, 'sanctum')->patchJson("/api/v1/admin/courses/{$course['id']}/moderate", ['action' => 'approve'])->assertOk()->assertJsonPath('course.status', 'published');

        // Re-saving without one of the lessons removes it (idempotent curriculum sync), keeping the other by id.
        $resaved = $this->actingAs($instructor, 'sanctum')->putJson("/api/v1/admin/courses/{$course['id']}", [
            'title' => 'Belajar Laravel', 'price' => 100000, 'level' => 'beginner',
            'sections' => [[
                'id' => $sectionId, 'title' => 'Pengantar',
                'lessons' => [['id' => $lessonId, 'title' => 'Video 1 Edited', 'type' => 'youtube', 'media_url' => 'abc', 'duration_min' => 12]],
            ]],
        ])->assertOk()->json('course');
        $this->assertSame($lessonId, $resaved['sections'][0]['lessons'][0]['id']);
        $this->assertSame('Video 1 Edited', $resaved['sections'][0]['lessons'][0]['title']);

        $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/courses')->assertOk()->assertJsonCount(1, 'courses.data')->assertJsonPath('courses.total', 1);
        $this->actingAs($other, 'sanctum')->getJson('/api/v1/admin/courses')->assertOk()->assertJsonCount(0, 'courses.data');

        $this->actingAs($other, 'sanctum')->deleteJson("/api/v1/admin/courses/{$course['id']}")->assertForbidden();
        $this->actingAs($instructor, 'sanctum')->deleteJson("/api/v1/admin/courses/{$course['id']}")->assertOk();
    }

    public function test_quiz_admin_crud_saves_questions_and_correct_answers_stay_hidden_from_public_endpoint(): void
    {
        $this->seed();
        $instructor = $this->user('instructor', 'quiz-instructor@example.com');
        $course = Course::create(['id' => 'quizcourse01', 'slug' => 'quiz-course', 'instructor_id' => $instructor->id, 'title' => 'Course', 'status' => 'published']);

        $quiz = $this->actingAs($instructor, 'sanctum')->postJson('/api/v1/admin/quizzes', [
            'course_id' => $course->id, 'title' => 'Quiz 1', 'passing_score' => 60,
            'questions' => [[
                'type' => 'single', 'text' => '2+2?', 'points' => 10,
                'options' => [['text' => '4', 'is_correct' => true], ['text' => '5', 'is_correct' => false]],
            ]],
        ])->assertCreated()->json('quiz');
        $this->assertCount(1, $quiz['questions']);
        $this->assertTrue($quiz['questions'][0]['options'][0]['is_correct']);

        // Admin CRUD view exposes correct answers, but the public quiz-taking endpoint must never leak them.
        $this->actingAs($instructor, 'sanctum')->getJson("/api/v1/quizzes/{$quiz['id']}")->assertForbidden();

        // A quiz created via the admin dashboard must actually reach the enrolled student's
        // course view — this is the exact "input doesn't show up on the frontend" pipeline.
        $student = $this->user('student', 'quiz-frontend-student@example.com');
        \App\Models\Enrollment::create(['id' => 'enrollquizfe1', 'user_id' => $student->id, 'course_id' => $course->id, 'status' => 'active']);
        $this->actingAs($student, 'sanctum')->getJson("/api/v1/courses/{$course->id}/quizzes")
            ->assertOk()->assertJsonPath('quizzes.0.id', $quiz['id']);

        $this->actingAs($instructor, 'sanctum')->getJson('/api/v1/admin/quizzes')->assertOk()->assertJsonCount(1, 'quizzes.data');
        $this->actingAs($instructor, 'sanctum')->deleteJson("/api/v1/admin/quizzes/{$quiz['id']}")->assertOk();
    }

    public function test_voucher_admin_crud(): void
    {
        $this->seed();
        $admin = $this->user('admin', 'voucher-admin@example.com');
        $student = $this->user('student', 'voucher-student@example.com');

        $this->actingAs($student, 'sanctum')->postJson('/api/v1/admin/vouchers', ['code' => 'HACK', 'type' => 'fixed', 'value' => 1000])->assertForbidden();

        $voucher = $this->actingAs($admin, 'sanctum')->postJson('/api/v1/admin/vouchers', [
            'code' => 'promo10', 'type' => 'percent', 'value' => 10, 'min_order' => 0,
        ])->assertCreated()->json('voucher');
        $this->assertSame('PROMO10', $voucher['code']);

        $this->actingAs($admin, 'sanctum')->putJson("/api/v1/admin/vouchers/{$voucher['id']}", [
            'code' => 'promo10', 'type' => 'percent', 'value' => 20, 'active' => false,
        ])->assertOk()->assertJsonPath('voucher.value', 20)->assertJsonPath('voucher.active', false);

        $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/vouchers')->assertOk()->assertJsonCount(1, 'vouchers.data');
        $this->actingAs($admin, 'sanctum')->deleteJson("/api/v1/admin/vouchers/{$voucher['id']}")->assertOk();
    }

    public function test_user_admin_crud_and_instructor_approval(): void
    {
        $this->seed();
        $admin = $this->user('admin', 'people-admin@example.com');
        $student = $this->user('student', 'people-student@example.com');

        $created = $this->actingAs($admin, 'sanctum')->postJson('/api/v1/admin/users', [
            'name' => 'New Instructor', 'email' => 'newinstr@example.com', 'password' => 'password123',
            'password_confirmation' => 'password123', 'role_key' => 'instructor',
        ])->assertCreated()->json('user');
        $this->assertFalse($created['instructor_approved']);

        $this->actingAs($student, 'sanctum')->postJson('/api/v1/admin/users', [
            'name' => 'x', 'email' => 'x@example.com', 'password' => 'password123', 'password_confirmation' => 'password123', 'role_key' => 'student',
        ])->assertForbidden();

        $this->actingAs($admin, 'sanctum')->patchJson("/api/v1/admin/users/{$created['id']}/approve-instructor", ['approved' => true])
            ->assertOk()->assertJsonPath('user.instructor_approved', true);

        $this->actingAs($admin, 'sanctum')->putJson("/api/v1/admin/users/{$created['id']}", ['name' => 'Renamed'])->assertOk()->assertJsonPath('user.name', 'Renamed');

        // Cannot self-delete.
        $this->actingAs($admin, 'sanctum')->deleteJson("/api/v1/admin/users/{$admin->id}")->assertStatus(422);
        $this->actingAs($admin, 'sanctum')->deleteJson("/api/v1/admin/users/{$created['id']}")->assertOk();

        $this->actingAs($admin, 'sanctum')->getJson('/api/v1/admin/users')->assertOk();
    }

    public function test_dashboard_summary_includes_recent_orders_and_revenue_chart_for_admin(): void
    {
        $this->seed();
        $admin = $this->user('admin', 'dash-admin@example.com');
        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/dashboard/summary')->assertOk();
        $response->assertJsonStructure(['role', 'summary', 'revenue_chart', 'recent_orders']);
    }

    public function test_owner_instructor_edit_keeps_published_course_live(): void
    {
        $this->seed();
        $instructor = $this->user('instructor', 'published-owner@example.com');
        $other = $this->user('instructor', 'published-other@example.com');
        $student = $this->user('student', 'published-student@example.com');
        $admin = $this->user('admin', 'published-admin@example.com');

        $course = Course::create([
            'id' => 'pubedit00001', 'slug' => 'published-edit', 'instructor_id' => $instructor->id,
            'title' => 'Published Course', 'is_free' => true, 'level' => 'beginner',
            'price' => 0, 'status' => 'published', 'published_at' => now(),
        ]);
        Enrollment::create(['id' => 'pubeditenr01', 'user_id' => $student->id, 'course_id' => $course->id, 'status' => 'active']);

        $this->actingAs($student, 'sanctum')->putJson("/api/v1/admin/courses/{$course->id}", [
            'title' => 'Published Course', 'slug' => 'published-edit', 'price' => 0, 'level' => 'beginner',
        ])->assertForbidden();

        $this->actingAs($other, 'sanctum')->putJson("/api/v1/admin/courses/{$course->id}", [
            'title' => 'Published Course', 'slug' => 'published-edit', 'price' => 0, 'level' => 'beginner',
        ])->assertForbidden();

        $this->actingAs($instructor, 'sanctum')->putJson("/api/v1/admin/courses/{$course->id}", [
            'title' => 'Published Course Edited', 'slug' => 'published-edit', 'price' => 0, 'level' => 'beginner',
        ])->assertOk()->assertJsonPath('course.status', 'published');

        $this->actingAs($admin, 'sanctum')->putJson("/api/v1/admin/courses/{$course->id}", [
            'title' => 'Published Course Admin', 'slug' => 'published-edit', 'price' => 0, 'level' => 'beginner',
        ])->assertOk()->assertJsonPath('course.status', 'published');

        $this->assertDatabaseHas('courses', ['id' => $course->id, 'status' => 'published', 'title' => 'Published Course Admin']);
        $this->assertDatabaseHas('enrollments', ['user_id' => $student->id, 'course_id' => $course->id]);
        $this->actingAs($student, 'sanctum')->getJson('/api/v1/courses/published-edit')
            ->assertOk()->assertJsonPath('course.enrolled', true);
    }

    private function user(string $role, string $email): User
    {
        return User::create([
            'id' => Str::lower(Str::random(12)), 'role_key' => $role, 'name' => ucfirst($role),
            'email' => $email, 'password_hash' => Hash::make('password'), 'status' => 'active',
            'instructor_approved' => $role !== 'instructor',
        ]);
    }
}
