<?php

namespace Tests\Feature;

use App\Models\Certificate;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Models\LessonProgress;
use App\Models\Section;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class CertificateApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_certificate_requires_completion_and_is_idempotent(): void
    {
        $this->seed();
        $instructor = $this->user('instructor', 'certificate-instructor@example.com');
        $student = $this->user('student', 'certificate-student@example.com');
        $course = Course::create(['id' => 'certcourse001', 'slug' => 'cert-course', 'instructor_id' => $instructor->id, 'title' => 'Certificate Course', 'is_free' => true, 'status' => 'published']);
        Enrollment::create(['id' => 'certenroll001', 'user_id' => $student->id, 'course_id' => $course->id, 'status' => 'active']);
        $section = Section::create(['id' => 'certsection01', 'course_id' => $course->id, 'title' => 'Module']);
        $lesson = Lesson::create(['id' => 'certlesson01', 'course_id' => $course->id, 'section_id' => $section->id, 'title' => 'Lesson', 'content' => 'Content', 'status' => 'published']);

        $this->actingAs($student, 'sanctum')->postJson('/api/v1/courses/' . $course->id . '/certificate')->assertStatus(422);
        LessonProgress::create(['id' => 'certprogress01', 'user_id' => $student->id, 'lesson_id' => $lesson->id, 'completed_at' => now()]);
        $this->actingAs($student, 'sanctum')->postJson('/api/v1/courses/' . $course->id . '/certificate')->assertCreated()->assertJsonStructure(['certificate']);
        $this->actingAs($student, 'sanctum')->postJson('/api/v1/courses/' . $course->id . '/certificate')->assertOk();
        $this->assertSame(1, Certificate::where('user_id', $student->id)->where('course_id', $course->id)->count());
        $certificate = Certificate::firstOrFail();
        $this->actingAs($student, 'sanctum')->patchJson('/api/v1/certificates/' . $certificate->id . '/revoke')->assertForbidden();
        $this->actingAs($instructor, 'sanctum')->patchJson('/api/v1/certificates/' . $certificate->id . '/revoke')->assertForbidden();
        $this->actingAs($admin = $this->user('admin', 'certificate-admin@example.com'), 'sanctum')->patchJson('/api/v1/certificates/' . $certificate->id . '/revoke')->assertOk();
        $this->getJson('/api/v1/certificates/verify/' . $certificate->number)->assertOk()->assertJsonPath('valid', false);
    }

    private function user(string $role, string $email): User
    {
        return User::create(['id' => Str::lower(Str::random(12)), 'role_key' => $role, 'name' => ucfirst($role), 'email' => $email, 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);
    }
}
