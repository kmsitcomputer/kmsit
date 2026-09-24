<?php

namespace Tests\Feature;

use App\Models\Certificate;
use App\Models\CertificateTemplate;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Media;
use App\Models\Quiz;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Tahap 1 — backend adalah sumber keputusan akses.
 * Super admin penuh; admin mengikuti permission existing; instructor hanya miliknya;
 * student hanya yang diizinkan/enrolled.
 */
class DomainAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_without_manage_courses_cannot_mutate_courses_but_super_admin_can(): void
    {
        $this->seed();
        $this->limitAdmin(['dashboard']);
        $admin = $this->makeUser('admin', 'nocourse-admin@example.com');
        $super = $this->makeUser('super_admin', 'course-super@example.com');

        $this->actingAs($admin, 'sanctum')->postJson('/api/v1/admin/courses', [
            'title' => 'X', 'price' => 1000, 'level' => 'beginner',
        ])->assertForbidden();

        $course = $this->actingAs($super, 'sanctum')->postJson('/api/v1/admin/courses', [
            'title' => 'Y', 'price' => 1000, 'level' => 'beginner',
        ])->assertCreated()->json('course');

        $this->actingAs($admin, 'sanctum')->putJson("/api/v1/admin/courses/{$course['id']}", [
            'title' => 'Y', 'price' => 1000, 'level' => 'beginner',
        ])->assertForbidden();
    }

    public function test_instructor_cannot_transfer_course_ownership_via_mass_assignment(): void
    {
        $this->seed();
        $owner = $this->makeUser('instructor', 'owner-instr@example.com');
        $other = $this->makeUser('instructor', 'other-instr@example.com');
        $admin = $this->makeUser('admin', 'transfer-admin@example.com');
        $course = Course::create(['id' => 'owncourse0001', 'slug' => 'own-course', 'instructor_id' => $owner->id, 'title' => 'Own Course', 'status' => 'draft']);

        $this->actingAs($owner, 'sanctum')->putJson("/api/v1/admin/courses/{$course->id}", [
            'title' => 'Own Course', 'price' => 0, 'level' => 'beginner', 'instructor_id' => $other->id,
        ])->assertOk();
        $this->assertSame($owner->id, $course->fresh()->instructor_id);

        $this->actingAs($admin, 'sanctum')->putJson("/api/v1/admin/courses/{$course->id}", [
            'title' => 'Own Course', 'price' => 0, 'level' => 'beginner', 'instructor_id' => $other->id,
        ])->assertOk();
        $this->assertSame($other->id, $course->fresh()->instructor_id);
    }

    public function test_instructor_cannot_touch_quiz_they_did_not_create(): void
    {
        $this->seed();
        $creator = $this->makeUser('instructor', 'quiz-creator@example.com');
        $other = $this->makeUser('instructor', 'quiz-other@example.com');
        $quiz = Quiz::create(['id' => 'quizown00001', 'creator_id' => $creator->id, 'title' => 'Q', 'active' => true]);

        $this->actingAs($other, 'sanctum')->putJson("/api/v1/admin/quizzes/{$quiz->id}", [
            'title' => 'Hijacked',
        ])->assertForbidden();
        $this->actingAs($other, 'sanctum')->getJson("/api/v1/admin/quizzes/{$quiz->id}")->assertForbidden();
        $this->actingAs($other, 'sanctum')->deleteJson("/api/v1/admin/quizzes/{$quiz->id}")->assertForbidden();
        $this->assertSame('Q', $quiz->fresh()->title);
    }

    public function test_admin_without_manage_quizzes_cannot_mutate_quizzes(): void
    {
        $this->seed();
        $this->limitAdmin(['dashboard']);
        $admin = $this->makeUser('admin', 'noquiz-admin@example.com');

        $this->actingAs($admin, 'sanctum')->postJson('/api/v1/admin/quizzes', [
            'title' => 'Q',
        ])->assertForbidden();
    }

    public function test_student_must_be_enrolled_to_take_quiz(): void
    {
        $this->seed();
        $instructor = $this->makeUser('instructor', 'takeq-instr@example.com');
        $enrolled = $this->makeUser('student', 'takeq-enrolled@example.com');
        $outsider = $this->makeUser('student', 'takeq-outsider@example.com');
        $course = Course::create(['id' => 'takeqcourse01', 'slug' => 'takeq', 'instructor_id' => $instructor->id, 'title' => 'TakeQ', 'is_free' => true, 'status' => 'published']);
        Enrollment::create(['id' => 'takeqenroll01', 'user_id' => $enrolled->id, 'course_id' => $course->id, 'status' => 'active']);
        $quiz = Quiz::create(['id' => 'takeqquiz0001', 'course_id' => $course->id, 'creator_id' => $instructor->id, 'title' => 'Q', 'active' => true]);

        $this->actingAs($outsider, 'sanctum')->getJson("/api/v1/courses/{$course->id}/quizzes")->assertForbidden();
        $this->actingAs($outsider, 'sanctum')->getJson("/api/v1/quizzes/{$quiz->id}")->assertForbidden();
        $this->actingAs($outsider, 'sanctum')->postJson("/api/v1/quizzes/{$quiz->id}/attempts")->assertForbidden();
        $this->actingAs($enrolled, 'sanctum')->getJson("/api/v1/quizzes/{$quiz->id}")->assertOk();
    }

    public function test_students_only_see_their_own_certificates(): void
    {
        $this->seed();
        $instructor = $this->makeUser('instructor', 'certiso-instr@example.com');
        $studentA = $this->makeUser('student', 'certiso-a@example.com');
        $studentB = $this->makeUser('student', 'certiso-b@example.com');
        $course = Course::create(['id' => 'certisocrs01', 'slug' => 'certiso', 'instructor_id' => $instructor->id, 'title' => 'CertIso', 'status' => 'published']);
        $template = CertificateTemplate::create(['id' => 'ctplcertiso1', 'name' => 'T', 'theme' => 'navy', 'accent' => '#ffffff', 'frame' => 'modern']);
        Certificate::create(['id' => 'certiso00001', 'number' => 'KMSIT-2026-ISOA01', 'user_id' => $studentA->id, 'course_id' => $course->id, 'template_id' => $template->id, 'status' => 'issued']);

        $listB = $this->actingAs($studentB, 'sanctum')->getJson('/api/v1/certificates')->assertOk()->json('certificates.data');
        $this->assertSame([], $listB);
        $this->actingAs($studentB, 'sanctum')->patchJson('/api/v1/certificates/certiso00001/revoke')->assertForbidden();
    }

    public function test_media_upload_delete_and_listing_guards(): void
    {
        Storage::fake('public');
        $this->seed();
        $uploader = $this->makeUser('instructor', 'media-owner@example.com');
        $other = $this->makeUser('instructor', 'media-other@example.com');
        $student = $this->makeUser('student', 'media-student@example.com');
        $media = Media::create(['id' => 'media0000001', 'name' => 'a.png', 'mime' => 'image/png', 'size' => 10, 'path' => 'media/a.png', 'uploaded_by' => $uploader->id]);

        $this->actingAs($student, 'sanctum')->post('/api/v1/media', ['file' => UploadedFile::fake()->image('s.png')])->assertForbidden();
        $this->actingAs($student, 'sanctum')->getJson('/api/v1/media')->assertForbidden();
        $this->actingAs($other, 'sanctum')->deleteJson('/api/v1/media/' . $media->id)->assertForbidden();
        $this->assertTrue(Media::whereKey($media->id)->exists());
        $this->actingAs($uploader, 'sanctum')->deleteJson('/api/v1/media/' . $media->id)->assertOk();
    }

    public function test_admin_without_manage_media_cannot_upload(): void
    {
        Storage::fake('public');
        $this->seed();
        $this->limitAdmin(['dashboard']);
        $admin = $this->makeUser('admin', 'nomedia-admin@example.com');

        $this->actingAs($admin, 'sanctum')->post('/api/v1/media', ['file' => UploadedFile::fake()->image('a.png')])->assertForbidden();
    }

    public function test_homepage_mutation_requires_manage_homepage(): void
    {
        $this->seed();
        $this->limitAdmin(['dashboard']);
        $admin = $this->makeUser('admin', 'nohome-admin@example.com');
        $super = $this->makeUser('super_admin', 'home-super@example.com');
        $instructor = $this->makeUser('instructor', 'home-instr@example.com');

        $this->actingAs($admin, 'sanctum')->postJson('/api/v1/homepage/blocks', ['type' => 'hero'])->assertForbidden();
        $this->actingAs($instructor, 'sanctum')->postJson('/api/v1/homepage/blocks', ['type' => 'hero'])->assertForbidden();
        $this->actingAs($super, 'sanctum')->postJson('/api/v1/homepage/blocks', ['type' => 'hero'])->assertCreated();
    }

    public function test_menu_mutation_requires_manage_menus(): void
    {
        $this->seed();
        $this->limitAdmin(['dashboard']);
        $admin = $this->makeUser('admin', 'nomenu-admin@example.com');
        $super = $this->makeUser('super_admin', 'menu-super@example.com');

        $this->actingAs($admin, 'sanctum')->postJson('/api/v1/menus', ['name' => 'H', 'location' => 'header'])->assertForbidden();
        $this->actingAs($super, 'sanctum')->postJson('/api/v1/menus', ['name' => 'H', 'location' => 'header'])->assertCreated()->assertJsonPath('menu.location', 'header');
    }

    public function test_cms_content_requires_per_type_permission(): void
    {
        $this->seed();
        $this->limitAdmin(['dashboard', 'manage_articles']);
        $admin = $this->makeUser('admin', 'cmslimited-admin@example.com');
        $instructor = $this->makeUser('instructor', 'cms-instr@example.com');

        $this->actingAs($admin, 'sanctum')->postJson('/api/v1/articles', [
            'title' => 'OK', 'content' => 'x', 'status' => 'draft',
        ])->assertCreated();
        $this->actingAs($admin, 'sanctum')->postJson('/api/v1/news', [
            'title' => 'NO', 'content' => 'x', 'status' => 'draft',
        ])->assertForbidden();
        $this->actingAs($instructor, 'sanctum')->postJson('/api/v1/articles', [
            'title' => 'NO', 'content' => 'x', 'status' => 'draft',
        ])->assertForbidden();
    }

    public function test_draft_course_hidden_from_public_and_other_instructor(): void
    {
        $this->seed();
        $owner = $this->makeUser('instructor', 'draft-owner@example.com');
        $other = $this->makeUser('instructor', 'draft-other@example.com');
        $course = Course::create(['id' => 'draftcourse01', 'slug' => 'draft-course', 'instructor_id' => $owner->id, 'title' => 'Draft', 'status' => 'draft']);

        $this->getJson('/api/v1/courses/draft-course')->assertNotFound();
        $this->actingAs($other, 'sanctum')->getJson("/api/v1/admin/courses/{$course->id}")->assertForbidden();
        $this->actingAs($owner, 'sanctum')->getJson("/api/v1/admin/courses/{$course->id}")->assertOk();
    }

    public function test_certificate_revoke_and_template_require_manage_certificates(): void
    {
        $this->seed();
        $this->limitAdmin(['dashboard']);
        $admin = $this->makeUser('admin', 'nocert-admin@example.com');
        $instructor = $this->makeUser('instructor', 'cert-instr@example.com');
        $student = $this->makeUser('student', 'cert-student@example.com');
        $course = Course::create(['id' => 'certreqcrs01', 'slug' => 'certreq', 'instructor_id' => $instructor->id, 'title' => 'C', 'status' => 'published']);
        $template = CertificateTemplate::create(['id' => 'ctplcertreq1', 'name' => 'T', 'theme' => 'navy', 'accent' => '#ffffff', 'frame' => 'modern']);
        $certificate = Certificate::create(['id' => 'certreq00001', 'number' => 'KMSIT-2026-REQ001', 'user_id' => $student->id, 'course_id' => $course->id, 'template_id' => $template->id, 'status' => 'issued']);

        $this->actingAs($admin, 'sanctum')->patchJson("/api/v1/certificates/{$certificate->id}/revoke")->assertForbidden();
        $this->actingAs($admin, 'sanctum')->postJson('/api/v1/certificate-templates', [
            'name' => 'T2', 'theme' => 'navy', 'accent' => '#ffffff', 'frame' => 'modern',
        ])->assertForbidden();
        $this->assertSame('issued', $certificate->fresh()->status);
    }

    public function test_course_moderate_requires_moderate_courses(): void
    {
        $this->seed();
        $this->limitAdmin(['dashboard', 'manage_courses']);
        $admin = $this->makeUser('admin', 'nomod-admin@example.com');
        $instructor = $this->makeUser('instructor', 'mod-instr@example.com');
        $course = Course::create(['id' => 'modcourse0001', 'slug' => 'mod-course', 'instructor_id' => $instructor->id, 'title' => 'M', 'status' => 'pending']);

        $this->actingAs($instructor, 'sanctum')->patchJson("/api/v1/admin/courses/{$course->id}/moderate", ['action' => 'approve'])->assertForbidden();
        $this->actingAs($admin, 'sanctum')->patchJson("/api/v1/admin/courses/{$course->id}/moderate", ['action' => 'approve'])->assertForbidden();
        $this->assertSame('pending', $course->fresh()->status);
    }

    private function makeUser(string $role, string $email): User
    {
        return User::create([
            'id' => Str::lower(Str::random(12)), 'role_key' => $role, 'name' => ucfirst($role),
            'email' => $email, 'password_hash' => Hash::make('password'), 'status' => 'active',
            'instructor_approved' => true,
        ]);
    }

    private function limitAdmin(array $permissions): void
    {
        Role::where('role_key', 'admin')->update(['permissions' => json_encode($permissions)]);
    }
}
