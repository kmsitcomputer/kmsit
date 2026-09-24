<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Question;
use App\Models\Quiz;
use App\Models\QuizOption;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class QuizApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_quiz_is_scored_on_server_and_attempt_limit_is_enforced(): void
    {
        $this->seed();
        $instructor = $this->user('instructor', 'quiz-instructor@example.com');
        $student = $this->user('student', 'quiz-student@example.com');
        $course = Course::create(['id' => 'quizcourse01', 'slug' => 'quiz-course', 'instructor_id' => $instructor->id, 'title' => 'Quiz Course', 'is_free' => true, 'status' => 'published']);
        Enrollment::create(['id' => 'enrollquiz01', 'user_id' => $student->id, 'course_id' => $course->id, 'status' => 'active']);
        $quiz = Quiz::create(['id' => 'quiz00000001', 'course_id' => $course->id, 'creator_id' => $instructor->id, 'title' => 'Quiz 1', 'passing_score' => 70, 'max_attempts' => 1, 'active' => true]);
        $question = Question::create(['id' => 'question001', 'quiz_id' => $quiz->id, 'type' => 'single', 'text' => 'Dua tambah dua?', 'points' => 10]);
        $correct = QuizOption::create(['id' => 'optioncorrect', 'question_id' => $question->id, 'text' => '4', 'is_correct' => true]);
        QuizOption::create(['id' => 'optionwrong01', 'question_id' => $question->id, 'text' => '5', 'is_correct' => false]);

        $this->actingAs($student, 'sanctum')->getJson('/api/v1/courses/' . $course->id . '/quizzes')->assertOk()->assertJsonPath('quizzes.0.id', $quiz->id);

        $this->actingAs($student, 'sanctum')
            ->getJson('/api/v1/quizzes/' . $quiz->id)
            ->assertOk()
            ->assertJsonPath('quiz.questions.0.options.0.text', '4')
            ->assertJsonMissing(['is_correct' => true]);

        $attempt = $this->actingAs($student, 'sanctum')
            ->postJson('/api/v1/quizzes/' . $quiz->id . '/attempts')
            ->assertCreated()
            ->json('attempt.id');

        $this->actingAs($student, 'sanctum')
            ->postJson('/api/v1/quiz-attempts/' . $attempt . '/submit', ['answers' => [$question->id => [$correct->id]]])
            ->assertOk()
            ->assertJsonPath('attempt.percent', 100)
            ->assertJsonPath('attempt.passed', true);

        $this->actingAs($student, 'sanctum')
            ->postJson('/api/v1/quizzes/' . $quiz->id . '/attempts')
            ->assertStatus(422);
    }

    private function user(string $role, string $email): User
    {
        return User::create(['id' => Str::lower(Str::random(12)), 'role_key' => $role, 'name' => ucfirst($role), 'email' => $email, 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);
    }
}
