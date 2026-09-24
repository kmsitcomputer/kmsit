<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Question;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\QuizOption;
use App\Support\AdminAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class QuizController extends Controller
{
    public function adminIndex(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Quiz::withCount('questions')->with('course:id,title')->latest();
        if (!in_array($user->role_key, ['admin', 'super_admin'], true)) {
            $query->where('creator_id', $user->id);
        } else {
            AdminAccess::authorize($user, 'manage_quizzes');
        }
        $query->when($request->string('course_id')->trim()->value(), fn ($q, string $courseId) => $q->where('course_id', $courseId))
            ->when($request->string('q')->trim()->value(), fn ($q, string $search) => $q->where('title', 'like', '%' . addcslashes($search, '%_\\') . '%'));
        return response()->json(['quizzes' => \App\Support\Pagination::paginate($query, $request)]);
    }

    public function adminShow(Request $request, string $id): JsonResponse
    {
        $quiz = Quiz::with('questions.options')->findOrFail($id);
        $this->authorizeOwner($request, $quiz);
        return response()->json(['quiz' => $this->presentWithAnswers($quiz)]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user->role_key !== 'instructor') AdminAccess::authorize($user, 'manage_quizzes');
        $data = $this->validateQuiz($request);
        $questions = $data['questions'] ?? [];
        unset($data['questions']);
        if (!empty($data['course_id'])) $this->authorizeCourse($request, $data['course_id']);

        $quiz = DB::transaction(function () use ($data, $questions, $user) {
            $quiz = Quiz::create(['id' => Str::lower(Str::random(12)), ...$data, 'creator_id' => $user->id]);
            $this->syncQuestions($quiz, $questions);
            return $quiz->fresh(['questions.options']);
        });

        return response()->json(['quiz' => $this->presentWithAnswers($quiz)], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $quiz = Quiz::findOrFail($id);
        $this->authorizeOwner($request, $quiz);
        // Prevent moving quiz to another instructor's course (A-15)
        if ($request->has('course_id') && $request->input('course_id') !== $quiz->course_id) {
            $this->authorizeCourse($request, $request->input('course_id'));
        }
        $data = $this->validateQuiz($request);
        $shouldSync = array_key_exists('questions', $data);

        $quiz = DB::transaction(function () use ($quiz, $data, $shouldSync) {
            $quiz->update($data);
            if ($shouldSync) {
                $this->syncQuestions($quiz, $data['questions']);
            }
            return $quiz->fresh(['questions.options']);
        });

        return response()->json(['quiz' => $this->presentWithAnswers($quiz)]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $quiz = Quiz::findOrFail($id);
        $this->authorizeOwner($request, $quiz);
        $quiz->delete();
        return response()->json(['message' => 'Quiz dihapus.']);
    }

    public function attempts(Request $request, string $id): JsonResponse
    {
        $quiz = Quiz::findOrFail($id);
        $this->authorizeOwner($request, $quiz);
        return response()->json(['attempts' => \App\Support\Pagination::paginate($quiz->attempts()->with('user:id,name,email')->latest()->orderByDesc('id'), $request)]);
    }

    private function syncQuestions(Quiz $quiz, array $questions): void
    {
        $keepQuestionIds = [];
        foreach ($questions as $index => $questionData) {
            $question = !empty($questionData['id']) ? Question::where('quiz_id', $quiz->id)->find($questionData['id']) : null;
            if (!$question) $question = new Question(['id' => Str::lower(Str::random(12)), 'quiz_id' => $quiz->id]);
            $question->type = $questionData['type'] ?? 'single';
            $question->text = $questionData['text'] ?? '';
            $question->points = $questionData['points'] ?? 1;
            $question->sort = $index;
            $question->save();
            $keepQuestionIds[] = $question->id;

            $keepOptionIds = [];
            foreach (($questionData['options'] ?? []) as $optionIndex => $optionData) {
                $option = !empty($optionData['id']) ? QuizOption::where('question_id', $question->id)->find($optionData['id']) : null;
                if (!$option) $option = new QuizOption(['id' => Str::lower(Str::random(12)), 'question_id' => $question->id]);
                $option->text = $optionData['text'] ?? '';
                $option->is_correct = (bool) ($optionData['is_correct'] ?? false);
                $option->sort = $optionIndex;
                $option->save();
                $keepOptionIds[] = $option->id;
            }
            QuizOption::where('question_id', $question->id)->whereNotIn('id', $keepOptionIds)->delete();
        }
        Question::where('quiz_id', $quiz->id)->whereNotIn('id', $keepQuestionIds)->delete();
    }

    private function presentWithAnswers(Quiz $quiz): array
    {
        $payload = $quiz->toArray();
        $payload['questions'] = $quiz->questions->map(fn (Question $question) => [
            'id' => $question->id, 'type' => $question->type, 'text' => $question->text, 'points' => $question->points, 'sort' => $question->sort,
            'options' => $question->options->map(fn (QuizOption $option) => ['id' => $option->id, 'text' => $option->text, 'is_correct' => (bool) $option->is_correct])->values(),
        ])->values();
        return $payload;
    }

    private function validateQuiz(Request $request): array
    {
        return $request->validate([
            'course_id' => ['nullable', 'string', 'exists:courses,id'], 'title' => ['required', 'string', 'max:190'],
            'description' => ['nullable', 'string'], 'time_limit_min' => ['nullable', 'integer', 'min:0'],
            'passing_score' => ['nullable', 'integer', 'min:0', 'max:100'], 'max_attempts' => ['nullable', 'integer', 'min:0'],
            'randomize' => ['sometimes', 'boolean'], 'active' => ['sometimes', 'boolean'],
            'questions' => ['nullable', 'array'], 'questions.*.type' => ['required_with:questions', 'in:single,multiple,boolean,short'],
            'questions.*.text' => ['required_with:questions', 'string'], 'questions.*.points' => ['nullable', 'integer', 'min:0'],
            'questions.*.options' => ['nullable', 'array'], 'questions.*.options.*.text' => ['required', 'string'],
            'questions.*.options.*.is_correct' => ['sometimes', 'boolean'],
        ]);
    }

    private function authorizeOwner(Request $request, Quiz $quiz): void
    {
        $user = $request->user();
        if ($user->id === $quiz->creator_id) return;
        AdminAccess::authorize($user, 'manage_quizzes');
    }

    private function authorizeCourse(Request $request, string $courseId): void
    {
        $user = $request->user();
        $course = Course::findOrFail($courseId);
        if ($user->id === $course->instructor_id) return;
        AdminAccess::authorize($user, 'manage_quizzes');
    }

    public function byCourse(Request $request, string $courseId): JsonResponse
    {
        $course = Course::where('id', $courseId)->where('status', 'published')->firstOrFail();
        abort_unless(Enrollment::where('user_id', $request->user()->id)->where('course_id', $course->id)->exists(), 403, 'Student belum terdaftar di course ini.');
        return response()->json(['quizzes' => Quiz::where('course_id', $course->id)->where('active', true)->get(['id', 'course_id', 'creator_id', 'title', 'description', 'time_limit_min', 'passing_score', 'max_attempts', 'randomize', 'active'])]);
    }

    public function show(Request $request, string $quizId): JsonResponse
    {
        $quiz = Quiz::with(['questions.options', 'course:id,status'])->where('id', $quizId)->where('active', true)->firstOrFail();
        abort_if($this->courseUnavailable($quiz), 404);
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
                'options' => $question->type === 'short' ? collect([]) : $question->options->map(fn ($option) => ['id' => $option->id, 'text' => $option->text])->values(),
            ])->values(),
        ]]);
    }

    public function start(Request $request, string $quizId): JsonResponse
    {
        $quiz = Quiz::with(['questions', 'course:id,status'])->where('id', $quizId)->where('active', true)->firstOrFail();
        abort_if($this->courseUnavailable($quiz), 404);
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
        $attempt = QuizAttempt::with('quiz.questions.options', 'quiz.course:id,status')->where('id', $attemptId)->where('user_id', $request->user()->id)->firstOrFail();
        if ($attempt->status === 'submitted') {
            return response()->json(['message' => 'Attempt sudah disubmit.'], 422);
        }
        abort_if($this->courseUnavailable($attempt->quiz), 404);
        if ($attempt->quiz->max_attempts > 0 && QuizAttempt::where('quiz_id', $attempt->quiz_id)->where('user_id', $request->user()->id)->where('status', 'submitted')->count() >= $attempt->quiz->max_attempts) {
            return response()->json(['message' => 'Batas percobaan quiz tercapai.'], 422);
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

    private function courseUnavailable(Quiz $quiz): bool
    {
        if (!$quiz->course_id) return false;
        return !$quiz->course || $quiz->course->status !== 'published';
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
