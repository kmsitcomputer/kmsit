<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class QuizController extends Controller
{
    public function byCourse(Request $request, string $courseId): JsonResponse
    {
        abort_unless(Enrollment::where('user_id', $request->user()->id)->where('course_id', $courseId)->exists(), 403, 'Student belum terdaftar di course ini.');
        return response()->json(['quizzes' => Quiz::where('course_id', $courseId)->where('active', true)->get(['id', 'course_id', 'creator_id', 'title', 'description', 'time_limit_min', 'passing_score', 'max_attempts', 'randomize', 'active'])]);
    }

    public function show(Request $request, string $quizId): JsonResponse
    {
        $quiz = Quiz::with('questions.options')->where('id', $quizId)->where('active', true)->firstOrFail();
        $this->ensureEnrollment($request, $quiz);

        return response()->json(['quiz' => [
            'id' => $quiz->id,
            'course_id' => $quiz->course_id,
            'title' => $quiz->title,
            'description' => $quiz->description,
            'time_limit_min' => $quiz->time_limit_min,
            'passing_score' => $quiz->passing_score,
            'max_attempts' => $quiz->max_attempts,
            'questions' => $quiz->questions->map(fn ($question) => [
                'id' => $question->id,
                'type' => $question->type,
                'text' => $question->text,
                'points' => $question->points,
                'options' => $question->options->map(fn ($option) => ['id' => $option->id, 'text' => $option->text])->values(),
            ])->values(),
        ]]);
    }

    public function start(Request $request, string $quizId): JsonResponse
    {
        $quiz = Quiz::with('questions')->where('id', $quizId)->where('active', true)->firstOrFail();
        $this->ensureEnrollment($request, $quiz);
        $submitted = $quiz->attempts()->where('user_id', $request->user()->id)->where('status', 'submitted')->count();

        if ($quiz->max_attempts > 0 && $submitted >= $quiz->max_attempts) {
            return response()->json(['message' => 'Batas percobaan quiz tercapai.'], 422);
        }

        $attempt = QuizAttempt::create([
            'id' => Str::lower(Str::random(12)), 'quiz_id' => $quiz->id, 'user_id' => $request->user()->id,
            'status' => 'running', 'answers' => [], 'max_score' => $quiz->questions->sum('points'),
            'started_at' => now(),
        ]);

        return response()->json(['attempt' => $attempt], 201);
    }

    public function submit(Request $request, string $attemptId): JsonResponse
    {
        $attempt = QuizAttempt::with('quiz.questions.options')->where('id', $attemptId)->where('user_id', $request->user()->id)->firstOrFail();
        if ($attempt->status === 'submitted') {
            return response()->json(['message' => 'Attempt sudah disubmit.'], 422);
        }
        $answers = $request->validate(['answers' => ['required', 'array']])['answers'];
        $expired = $attempt->quiz->time_limit_min > 0 && $attempt->started_at->addMinutes($attempt->quiz->time_limit_min)->isPast();
        $score = 0;

        foreach ($attempt->quiz->questions as $question) {
            $given = array_values(array_map('strval', $answers[$question->id] ?? []));
            $correct = $question->options->where('is_correct', true)->pluck('id')->map(fn ($id) => (string) $id)->values()->all();
            $isCorrect = match ($question->type) {
                'single', 'boolean' => count($given) === 1 && $given[0] === ($correct[0] ?? null),
                'multiple' => count($given) === count($correct) && empty(array_diff($given, $correct)) && empty(array_diff($correct, $given)),
                'short' => $this->shortAnswerMatches($given[0] ?? '', $correct, $question),
                default => false,
            };
            if ($isCorrect) $score += $question->points;
        }

        $maxScore = $attempt->quiz->questions->sum('points');
        $percent = $maxScore > 0 ? (int) round(($score / $maxScore) * 100) : 0;
        $attempt = DB::transaction(function () use ($attempt, $answers, $score, $maxScore, $percent, $expired) {
            return tap($attempt)->update([
                'answers' => $answers, 'score' => $score, 'max_score' => $maxScore,
                'percent' => $percent, 'passed' => !$expired && $percent >= $attempt->quiz->passing_score,
                'status' => 'submitted', 'submitted_at' => now(),
            ]);
        });

        return response()->json(['attempt' => $attempt->fresh()]);
    }

    private function ensureEnrollment(Request $request, Quiz $quiz): void
    {
        if ($quiz->course_id && !Enrollment::where('user_id', $request->user()->id)->where('course_id', $quiz->course_id)->exists()) {
            abort(403, 'Student belum terdaftar di course ini.');
        }
    }

    private function shortAnswerMatches(string $given, array $correct, $question): bool
    {
        $answers = $question->options->where('is_correct', true)->pluck('text')->all();
        return in_array(mb_strtolower(trim($given)), array_map(fn ($answer) => mb_strtolower(trim($answer)), $answers), true)
            || in_array(mb_strtolower(trim($given)), array_map(fn ($answer) => mb_strtolower(trim($answer)), $correct), true);
    }
}
