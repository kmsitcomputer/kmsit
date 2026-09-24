<?php

namespace Tests\Feature;

use App\Models\Certificate;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Models\LessonProgress;
use App\Models\Question;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\QuizOption;
use App\Models\Section;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class LmsStage4RegressionTest extends TestCase
{
    use RefreshDatabase;

    public function test_paid_course_requires_valid_enrollment_and_guest_sees_no_private_content(): void
    {
        $this->seed();
        $instructor = $this->makeUser('instructor', 'lms4-inst@example.com');
        $student = $this->makeUser('student', 'lms4-stud@example.com');
        $course = Course::create([
            'id' => 'lms4paid0001', 'slug' => 'lms4-paid', 'instructor_id' => $instructor->id,
            'title' => 'Paid Course', 'is_free' => false, 'price' => 50000, 'status' => 'published',
        ]);
        $section = Section::create(['id' => 'lms4sec00001', 'course_id' => $course->id, 'title' => 'Modul']);
        Lesson::create([
            'id' => 'lms4les00001', 'course_id' => $course->id, 'section_id' => $section->id,
            'title' => 'Privat', 'content' => 'Konten privat', 'preview' => false, 'status' => 'published',
        ]);
        Lesson::create([
            'id' => 'lms4les00002', 'course_id' => $course->id, 'section_id' => $section->id,
            'title' => 'Preview', 'content' => 'Konten preview', 'preview' => true, 'status' => 'published',
        ]);

        $this->getJson('/api/v1/courses/lms4-paid')
            ->assertOk()
            ->assertJsonPath('course.sections.0.lessons.0.content', null)
            ->assertJsonPath('course.sections.0.lessons.1.content', 'Konten preview');

        $this->actingAs($student, 'sanctum')->postJson('/api/v1/courses/lms4-paid/enroll')->assertStatus(402);

        $this->actingAs($student, 'sanctum')
            ->getJson('/api/v1/courses/lms4-paid')
            ->assertOk()
            ->assertJsonPath('course.enrolled', false)
            ->assertJsonPath('course.sections.0.lessons.0.content', null);

        Enrollment::create(['id' => 'lms4enr00001', 'user_id' => $student->id, 'course_id' => $course->id, 'status' => 'active']);

        $this->actingAs($student, 'sanctum')
            ->getJson('/api/v1/courses/lms4-paid')
            ->assertOk()
            ->assertJsonPath('course.enrolled', true)
            ->assertJsonPath('course.sections.0.lessons.0.content', 'Konten privat');
    }

    public function test_progress_is_scoped_to_owner_and_course(): void
    {
        $this->seed();
        $instructor = $this->makeUser('instructor', 'lms4-inst2@example.com');
        $student = $this->makeUser('student', 'lms4-stud2@example.com');
        $other = $this->makeUser('student', 'lms4-other2@example.com');
        $outsider = $this->makeUser('student', 'lms4-out2@example.com');

        $course = $this->makeFreeCourse($instructor, 'lms4free0001', 'lms4-free');
        $section = Section::create(['id' => 'lms4sec00002', 'course_id' => $course->id, 'title' => 'Modul']);
        $lesson = Lesson::create([
            'id' => 'lms4les00003', 'course_id' => $course->id, 'section_id' => $section->id,
            'title' => 'Materi', 'content' => 'Isi', 'status' => 'published',
        ]);
        $draft = Lesson::create([
            'id' => 'lms4les00004', 'course_id' => $course->id, 'section_id' => $section->id,
            'title' => 'Draft', 'content' => 'Draft', 'status' => 'draft',
        ]);
        $course2 = $this->makeFreeCourse($instructor, 'lms4free0002', 'lms4-free-2');
        $section2 = Section::create(['id' => 'lms4sec00003', 'course_id' => $course2->id, 'title' => 'Modul']);
        $foreign = Lesson::create([
            'id' => 'lms4les00005', 'course_id' => $course2->id, 'section_id' => $section2->id,
            'title' => 'Asing', 'content' => 'Isi', 'status' => 'published',
        ]);

        $this->actingAs($student, 'sanctum')->postJson('/api/v1/courses/lms4-free/enroll')->assertCreated();
        $this->actingAs($other, 'sanctum')->postJson('/api/v1/courses/lms4-free/enroll')->assertCreated();

        $this->actingAs($student, 'sanctum')
            ->postJson('/api/v1/courses/lms4-free/lessons/lms4les00003/complete')
            ->assertOk()
            ->assertJsonPath('enrollment.progress_pct', 100);

        $this->actingAs($other, 'sanctum')
            ->postJson('/api/v1/courses/lms4-free/lessons/lms4les00003/complete')
            ->assertOk();

        $this->actingAs($student, 'sanctum')
            ->getJson('/api/v1/courses/lms4-free/progress')
            ->assertOk()
            ->assertJsonPath('progress.pct', 100)
            ->assertJsonPath('progress.completed_lesson_ids.0', 'lms4les00003');

        $this->actingAs($outsider, 'sanctum')
            ->postJson('/api/v1/courses/lms4-free/lessons/lms4les00003/complete')
            ->assertNotFound();
        $this->actingAs($outsider, 'sanctum')->getJson('/api/v1/courses/lms4-free/progress')->assertNotFound();

        $this->actingAs($student, 'sanctum')
            ->postJson('/api/v1/courses/lms4-free/lessons/lms4les00005/complete')
            ->assertNotFound();
        $this->actingAs($student, 'sanctum')
            ->postJson('/api/v1/courses/lms4-free/lessons/lms4les00004/complete')
            ->assertNotFound();
    }

    public function test_quiz_answers_never_leak_and_client_score_is_ignored(): void
    {
        $this->seed();
        $instructor = $this->makeUser('instructor', 'lms4-inst3@example.com');
        $student = $this->makeUser('student', 'lms4-stud3@example.com');
        $course = $this->makeFreeCourse($instructor, 'lms4free0003', 'lms4-quiz');
        Enrollment::create(['id' => 'lms4enr00003', 'user_id' => $student->id, 'course_id' => $course->id, 'status' => 'active']);
        [$quiz, $question, $correct, $wrong] = $this->makeSingleQuiz($instructor, $course, 'lms4quiz0001', 0);

        $show = $this->actingAs($student, 'sanctum')->getJson('/api/v1/quizzes/lms4quiz0001')->assertOk()->json();
        $this->assertNoKeyRecursive('is_correct', $show);

        $attemptId = $this->actingAs($student, 'sanctum')
            ->postJson('/api/v1/quizzes/lms4quiz0001/attempts')
            ->assertCreated()
            ->json('attempt.id');

        $bad = $this->actingAs($student, 'sanctum')
            ->postJson('/api/v1/quiz-attempts/' . $attemptId . '/submit', [
                'answers' => [$question->id => [$wrong->id]], 'score' => 100, 'percent' => 100, 'passed' => true,
            ])
            ->assertOk()
            ->json('attempt');
        $this->assertSame(0, $bad['percent']);
        $this->assertFalse((bool) $bad['passed']);
        $this->assertNoKeyRecursive('is_correct', $bad);

        $attempt2 = $this->actingAs($student, 'sanctum')
            ->postJson('/api/v1/quizzes/lms4quiz0001/attempts')
            ->assertCreated()
            ->json('attempt.id');
        $good = $this->actingAs($student, 'sanctum')
            ->postJson('/api/v1/quiz-attempts/' . $attempt2 . '/submit', [
                'answers' => [$question->id => [$correct->id]], 'score' => 0, 'percent' => 0, 'passed' => false,
            ])
            ->assertOk()
            ->json('attempt');
        $this->assertSame(100, $good['percent']);
        $this->assertTrue((bool) $good['passed']);
    }

    public function test_quiz_timer_max_attempts_and_replay(): void
    {
        $this->seed();
        $instructor = $this->makeUser('instructor', 'lms4-inst4@example.com');
        $student = $this->makeUser('student', 'lms4-stud4@example.com');
        $course = $this->makeFreeCourse($instructor, 'lms4free0004', 'lms4-limit');
        Enrollment::create(['id' => 'lms4enr00004', 'user_id' => $student->id, 'course_id' => $course->id, 'status' => 'active']);
        [$quiz, $question, $correct] = $this->makeSingleQuiz($instructor, $course, 'lms4quiz0002', 1);

        $first = $this->actingAs($student, 'sanctum')
            ->postJson('/api/v1/quizzes/lms4quiz0002/attempts')
            ->assertCreated()
            ->json('attempt.id');
        $second = $this->actingAs($student, 'sanctum')
            ->postJson('/api/v1/quizzes/lms4quiz0002/attempts')
            ->assertCreated()
            ->json('attempt.id');

        $this->actingAs($student, 'sanctum')
            ->postJson('/api/v1/quiz-attempts/' . $first . '/submit', ['answers' => [$question->id => [$correct->id]]])
            ->assertOk()
            ->assertJsonPath('attempt.passed', true);

        $this->actingAs($student, 'sanctum')
            ->postJson('/api/v1/quiz-attempts/' . $second . '/submit', ['answers' => [$question->id => [$correct->id]]])
            ->assertStatus(422);

        $this->actingAs($student, 'sanctum')
            ->postJson('/api/v1/quiz-attempts/' . $first . '/submit', ['answers' => [$question->id => [$correct->id]]])
            ->assertStatus(422);

        $this->actingAs($student, 'sanctum')->postJson('/api/v1/quizzes/lms4quiz0002/attempts')->assertStatus(422);

        [$timed] = $this->makeSingleQuiz($instructor, $course, 'lms4quiz0003', 0, 1);
        $timedId = $this->actingAs($student, 'sanctum')
            ->postJson('/api/v1/quizzes/lms4quiz0003/attempts')
            ->assertCreated()
            ->json('attempt.id');
        QuizAttempt::whereKey($timedId)->update(['started_at' => now()->subMinutes(5)]);
        $timedQuestion = Question::where('quiz_id', 'lms4quiz0003')->firstOrFail();
        $timedCorrect = QuizOption::where('question_id', $timedQuestion->id)->where('is_correct', true)->firstOrFail();
        $this->actingAs($student, 'sanctum')
            ->postJson('/api/v1/quiz-attempts/' . $timedId . '/submit', ['answers' => [$timedQuestion->id => [$timedCorrect->id]]])
            ->assertOk()
            ->assertJsonPath('attempt.percent', 100)
            ->assertJsonPath('attempt.passed', false);
    }

    public function test_quiz_course_mismatch_and_attempt_ownership(): void
    {
        $this->seed();
        $instructor = $this->makeUser('instructor', 'lms4-inst5@example.com');
        $student = $this->makeUser('student', 'lms4-stud5@example.com');
        $other = $this->makeUser('student', 'lms4-other5@example.com');
        $course1 = $this->makeFreeCourse($instructor, 'lms4free0005', 'lms4-one');
        $course2 = $this->makeFreeCourse($instructor, 'lms4free0006', 'lms4-two');
        Enrollment::create(['id' => 'lms4enr00005', 'user_id' => $student->id, 'course_id' => $course1->id, 'status' => 'active']);
        Enrollment::create(['id' => 'lms4enr00006', 'user_id' => $other->id, 'course_id' => $course1->id, 'status' => 'active']);
        [$quiz1, $q1, $c1] = $this->makeSingleQuiz($instructor, $course1, 'lms4quiz0004', 0);
        $this->makeSingleQuiz($instructor, $course2, 'lms4quiz0005', 0);

        $this->actingAs($student, 'sanctum')->getJson('/api/v1/quizzes/lms4quiz0005')->assertForbidden();
        $this->actingAs($student, 'sanctum')->postJson('/api/v1/quizzes/lms4quiz0005/attempts')->assertForbidden();
        $this->actingAs($student, 'sanctum')->getJson('/api/v1/courses/lms4free0006/quizzes')->assertForbidden();

        $otherAttempt = $this->actingAs($other, 'sanctum')
            ->postJson('/api/v1/quizzes/lms4quiz0004/attempts')
            ->assertCreated()
            ->json('attempt.id');
        $this->actingAs($student, 'sanctum')
            ->postJson('/api/v1/quiz-attempts/' . $otherAttempt . '/submit', ['answers' => [$q1->id => [$c1->id]]])
            ->assertNotFound();

        $course1->update(['status' => 'archived']);
        $this->actingAs($student, 'sanctum')->getJson('/api/v1/quizzes/lms4quiz0004')->assertNotFound();
        $this->actingAs($student, 'sanctum')->postJson('/api/v1/quizzes/lms4quiz0004/attempts')->assertNotFound();
        $this->actingAs($student, 'sanctum')->getJson('/api/v1/courses/lms4free0005/quizzes')->assertNotFound();

        $course2->delete();
        $this->actingAs($student, 'sanctum')->getJson('/api/v1/quizzes/lms4quiz0005')->assertNotFound();
        $this->actingAs($student, 'sanctum')->postJson('/api/v1/quizzes/lms4quiz0005/attempts')->assertNotFound();
        $this->actingAs($student, 'sanctum')->getJson('/api/v1/courses/lms4free0006/quizzes')->assertNotFound();
    }

    public function test_certificate_lifecycle_guards(): void
    {
        $this->seed();
        $instructor = $this->makeUser('instructor', 'lms4-inst6@example.com');
        $student = $this->makeUser('student', 'lms4-stud6@example.com');
        $admin = $this->makeUser('admin', 'lms4-admin6@example.com');
        $course = $this->makeFreeCourse($instructor, 'lms4free0007', 'lms4-cert');
        Enrollment::create(['id' => 'lms4enr00007', 'user_id' => $student->id, 'course_id' => $course->id, 'status' => 'active']);
        $section = Section::create(['id' => 'lms4sec00007', 'course_id' => $course->id, 'title' => 'Modul']);
        $lesson = Lesson::create([
            'id' => 'lms4les00007', 'course_id' => $course->id, 'section_id' => $section->id,
            'title' => 'Materi', 'content' => 'Isi', 'status' => 'published',
        ]);

        $this->actingAs($student, 'sanctum')->postJson('/api/v1/courses/lms4free0007/certificate')->assertStatus(422);

        LessonProgress::create(['id' => 'lms4prg00007', 'user_id' => $student->id, 'lesson_id' => $lesson->id, 'completed_at' => now()]);
        [$quiz, $question, $correct] = $this->makeSingleQuiz($instructor, $course, 'lms4quiz0006', 0);
        $this->actingAs($student, 'sanctum')->postJson('/api/v1/courses/lms4free0007/certificate')->assertStatus(422);

        $attempt = $this->actingAs($student, 'sanctum')
            ->postJson('/api/v1/quizzes/lms4quiz0006/attempts')
            ->assertCreated()
            ->json('attempt.id');
        $this->actingAs($student, 'sanctum')
            ->postJson('/api/v1/quiz-attempts/' . $attempt . '/submit', ['answers' => [$question->id => [$correct->id]]])
            ->assertOk();

        $number = $this->actingAs($student, 'sanctum')
            ->postJson('/api/v1/courses/lms4free0007/certificate')
            ->assertCreated()
            ->json('certificate.number');
        $this->actingAs($student, 'sanctum')->postJson('/api/v1/courses/lms4free0007/certificate')->assertOk();
        $this->assertSame(1, Certificate::where('user_id', $student->id)->where('course_id', $course->id)->count());

        $verify = $this->getJson('/api/v1/certificates/verify/' . $number)->assertOk()->assertJsonPath('valid', true)->json();
        $this->assertNoKeyRecursive('email', $verify);
        $this->assertNoKeyRecursive('password_hash', $verify);

        $certificate = Certificate::where('number', $number)->firstOrFail();
        $this->actingAs($student, 'sanctum')->patchJson('/api/v1/certificates/' . $certificate->id . '/revoke')->assertForbidden();
        $this->actingAs($instructor, 'sanctum')->patchJson('/api/v1/certificates/' . $certificate->id . '/revoke')->assertForbidden();
        $this->actingAs($admin, 'sanctum')->patchJson('/api/v1/certificates/' . $certificate->id . '/revoke')->assertOk();
        $this->getJson('/api/v1/certificates/verify/' . $number)->assertOk()->assertJsonPath('valid', false);
    }

    public function test_draft_lessons_are_hidden_from_non_owners(): void
    {
        $this->seed();
        $instructor = $this->makeUser('instructor', 'lms4-inst7@example.com');
        $student = $this->makeUser('student', 'lms4-stud7@example.com');
        $course = $this->makeFreeCourse($instructor, 'lms4free0008', 'lms4-draft');
        $section = Section::create(['id' => 'lms4sec00008', 'course_id' => $course->id, 'title' => 'Modul']);
        Lesson::create([
            'id' => 'lms4les00008', 'course_id' => $course->id, 'section_id' => $section->id,
            'title' => 'Terbit', 'content' => 'Konten terbit', 'preview' => false, 'status' => 'published',
        ]);
        Lesson::create([
            'id' => 'lms4les00009', 'course_id' => $course->id, 'section_id' => $section->id,
            'title' => 'Rahasia Draft', 'content' => 'Konten draft', 'preview' => false, 'status' => 'draft',
        ]);
        Lesson::create([
            'id' => 'lms4les00010', 'course_id' => $course->id, 'section_id' => $section->id,
            'title' => 'Preview Draft', 'content' => 'Konten preview draft', 'preview' => true, 'status' => 'draft',
        ]);

        $guest = $this->getJson('/api/v1/courses/lms4-draft')->assertOk()->json('course.sections.0.lessons');
        $this->assertCount(1, $guest);
        $this->assertSame('Terbit', $guest[0]['title']);

        Enrollment::create(['id' => 'lms4enr00008', 'user_id' => $student->id, 'course_id' => $course->id, 'status' => 'active']);
        $enrolled = $this->actingAs($student, 'sanctum')->getJson('/api/v1/courses/lms4-draft')->assertOk()->json('course.sections.0.lessons');
        $this->assertCount(1, $enrolled);

        $owner = $this->actingAs($instructor, 'sanctum')->getJson('/api/v1/courses/lms4-draft')->assertOk()->json('course.sections.0.lessons');
        $this->assertCount(3, $owner);
    }

    public function test_certificate_requires_published_course(): void
    {
        $this->seed();
        $instructor = $this->makeUser('instructor', 'lms4-inst8@example.com');
        $student = $this->makeUser('student', 'lms4-stud8@example.com');
        $course = Course::create([
            'id' => 'lms4draft0001', 'slug' => 'lms4-draft-course', 'instructor_id' => $instructor->id,
            'title' => 'Draft Course', 'is_free' => true, 'status' => 'draft',
        ]);
        Enrollment::create(['id' => 'lms4enr00009', 'user_id' => $student->id, 'course_id' => $course->id, 'status' => 'active']);
        $section = Section::create(['id' => 'lms4sec00009', 'course_id' => $course->id, 'title' => 'Modul']);
        $lesson = Lesson::create([
            'id' => 'lms4les00011', 'course_id' => $course->id, 'section_id' => $section->id,
            'title' => 'Materi', 'content' => 'Isi', 'status' => 'published',
        ]);
        LessonProgress::create(['id' => 'lms4prg00009', 'user_id' => $student->id, 'lesson_id' => $lesson->id, 'completed_at' => now()]);

        $this->actingAs($student, 'sanctum')->postJson('/api/v1/courses/lms4draft0001/certificate')->assertNotFound();
        $this->assertSame(0, Certificate::where('user_id', $student->id)->count());
    }

    private function makeUser(string $role, string $email): User
    {
        return User::create([
            'id' => Str::lower(Str::random(12)), 'role_key' => $role, 'name' => ucfirst($role),
            'email' => $email, 'password_hash' => Hash::make('password'), 'status' => 'active',
            'instructor_approved' => true,
        ]);
    }

    private function makeFreeCourse(User $instructor, string $id, string $slug): Course
    {
        return Course::create([
            'id' => $id, 'slug' => $slug, 'instructor_id' => $instructor->id,
            'title' => 'Course ' . $slug, 'is_free' => true, 'status' => 'published',
        ]);
    }

    private function makeSingleQuiz(User $creator, Course $course, string $id, int $maxAttempts, int $timeLimit = 10): array
    {
        $quiz = Quiz::create([
            'id' => $id, 'course_id' => $course->id, 'creator_id' => $creator->id,
            'title' => 'Quiz ' . $id, 'passing_score' => 70, 'max_attempts' => $maxAttempts,
            'time_limit_min' => $timeLimit, 'active' => true,
        ]);
        $suffix = substr($id, -8);
        $question = Question::create(['id' => 'q' . $suffix, 'quiz_id' => $quiz->id, 'type' => 'single', 'text' => 'Dua tambah dua?', 'points' => 10]);
        $correct = QuizOption::create(['id' => 'c' . $suffix, 'question_id' => $question->id, 'text' => '4', 'is_correct' => true]);
        $wrong = QuizOption::create(['id' => 'w' . $suffix, 'question_id' => $question->id, 'text' => '5', 'is_correct' => false]);

        return [$quiz, $question, $correct, $wrong];
    }

    private function assertNoKeyRecursive(string $key, mixed $data): void
    {
        if (is_array($data)) {
            $this->assertArrayNotHasKey($key, $data);
            foreach ($data as $value) $this->assertNoKeyRecursive($key, $value);
        }
    }
}
