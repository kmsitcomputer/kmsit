<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Lesson;
use App\Models\Section;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class CourseApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_private_lesson_content_requires_enrollment(): void
    {
        $this->seed();
        $instructor = $this->user('instructor', 'instructor@example.com');
        $student = $this->user('student', 'student@example.com');
        $course = Course::create([
            'id' => 'course001', 'slug' => 'php-dasar', 'instructor_id' => $instructor->id,
            'title' => 'PHP Dasar', 'is_free' => true, 'status' => 'published',
        ]);
        $section = Section::create(['id' => 'section001', 'course_id' => $course->id, 'title' => 'Modul 1']);
        Lesson::create([
            'id' => 'lesson001', 'course_id' => $course->id, 'section_id' => $section->id,
            'title' => 'Rahasia', 'type' => 'text', 'content' => 'Konten privat', 'preview' => false,
        ]);

        $this->getJson('/api/v1/courses/php-dasar')
            ->assertOk()
            ->assertJsonPath('course.sections.0.lessons.0.content', null);

        $this->actingAs($student, 'sanctum')
            ->postJson('/api/v1/courses/php-dasar/enroll')
            ->assertCreated();

        $this->actingAs($student, 'sanctum')
            ->getJson('/api/v1/courses/php-dasar')
            ->assertOk()
            ->assertJsonPath('course.enrolled', true)
            ->assertJsonPath('course.sections.0.lessons.0.content', 'Konten privat');

        $this->actingAs($student, 'sanctum')
            ->postJson('/api/v1/courses/php-dasar/enroll')
            ->assertOk();

        $this->actingAs($student, 'sanctum')
            ->postJson('/api/v1/courses/php-dasar/lessons/lesson001/complete')
            ->assertOk()
            ->assertJsonPath('enrollment.progress_pct', 100)
            ->assertJsonPath('enrollment.status', 'completed');

        $this->actingAs($student, 'sanctum')
            ->getJson('/api/v1/courses/php-dasar/progress')
            ->assertOk()
            ->assertJsonPath('progress.pct', 100)
            ->assertJsonPath('progress.completed_lesson_ids.0', 'lesson001');

        $otherStudent = $this->user('student', 'other@example.com');
        $this->actingAs($otherStudent, 'sanctum')
            ->postJson('/api/v1/courses/php-dasar/lessons/lesson001/complete')
            ->assertNotFound();
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
