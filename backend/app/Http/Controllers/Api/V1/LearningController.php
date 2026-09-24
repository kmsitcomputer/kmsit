<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Certificate;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\LessonProgress;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Learner-owned read models (A-24): every query is scoped to the signed-in user, so the SPA
 * no longer derives progress, quiz results or certificate eligibility from browser storage.
 */
class LearningController extends Controller
{
    /** "Pembelajaranku": own enrollments with course summary; filter: status (active|completed). */
    public function enrollments(Request $request): JsonResponse
    {
        $query = Enrollment::where('user_id', $request->user()->id)
            ->whereHas('course')
            ->with(['course:id,slug,title,thumbnail,instructor_id,status', 'course.instructor:id,name'])
            ->when($request->string('status')->trim()->value(), fn ($q, string $status) => $q->where('status', $status))
            ->orderByDesc('updated_at')->orderByDesc('id');

        $page = Pagination::paginate($query, $request)->through(fn (Enrollment $e) => [
            'id' => $e->id,
            'course_id' => $e->course_id,
            'course_title' => $e->course?->title,
            'course_slug' => $e->course?->slug,
            'course_thumbnail' => $e->course?->thumbnail,
            'course_published' => $e->course?->status === 'published',
            'instructor_name' => $e->course?->instructor?->name,
            'progress_pct' => (int) $e->progress_pct,
            'status' => $e->status,
            'completed_at' => $e->completed_at?->toIso8601String(),
            'last_activity' => $e->updated_at?->toIso8601String(),
        ]);

        return response()->json(['enrollments' => $page]);
    }

    /** Own submitted quiz attempts; filters: quiz_id, course_id. */
    public function quizAttempts(Request $request): JsonResponse
    {
        $query = QuizAttempt::where('user_id', $request->user()->id)->where('status', 'submitted')
            ->with(['quiz:id,title,course_id,passing_score', 'quiz.course:id,title,slug'])
            ->when($request->string('quiz_id')->trim()->value(), fn ($q, string $quizId) => $q->where('quiz_id', $quizId))
            ->when($request->string('course_id')->trim()->value(), fn ($q, string $courseId) => $q->whereHas('quiz', fn ($quiz) => $quiz->where('course_id', $courseId)))
            ->orderByDesc('submitted_at')->orderByDesc('id');

        $page = Pagination::paginate($query, $request)->through(fn (QuizAttempt $a) => [
            'id' => $a->id,
            'quiz_id' => $a->quiz_id,
            'quiz_title' => $a->quiz?->title,
            'course_title' => $a->quiz?->course?->title,
            'course_slug' => $a->quiz?->course?->slug,
            'score' => (int) $a->score,
            'max_score' => (int) $a->max_score,
            'percent' => (int) $a->percent,
            'passing_score' => (int) ($a->quiz?->passing_score ?? 0),
            'passed' => (bool) $a->passed,
            'submitted_at' => $a->submitted_at?->toIso8601String(),
        ]);

        return response()->json(['attempts' => $page]);
    }

    /**
     * Progress, quiz results and certificate state for one enrolled course. Uses the same
     * rules as CertificateController::issue (all published lessons done + every active quiz passed).
     */
    public function status(Request $request, string $courseId): JsonResponse
    {
        $userId = $request->user()->id;
        $course = Course::where('id', $courseId)->where('status', 'published')->firstOrFail();
        abort_unless(Enrollment::where('user_id', $userId)->where('course_id', $course->id)->exists(), 404);

        $lessonIds = $course->lessons()->where('status', 'published')->pluck('id');
        $done = LessonProgress::where('user_id', $userId)->whereIn('lesson_id', $lessonIds)->count();
        $total = $lessonIds->count();

        $quizzes = Quiz::where('course_id', $course->id)->where('active', true)->orderBy('created_at')->get(['id', 'title', 'max_attempts', 'passing_score']);
        $attempts = QuizAttempt::where('user_id', $userId)->where('status', 'submitted')->whereIn('quiz_id', $quizzes->pluck('id'))->get(['quiz_id', 'percent', 'passed']);
        $quizRows = $quizzes->map(function (Quiz $quiz) use ($attempts) {
            $mine = $attempts->where('quiz_id', $quiz->id);
            return [
                'id' => $quiz->id, 'title' => $quiz->title, 'passing_score' => (int) $quiz->passing_score,
                'max_attempts' => (int) $quiz->max_attempts, 'attempts_used' => $mine->count(),
                'best_percent' => (int) ($mine->max('percent') ?? 0), 'passed' => $mine->contains('passed', true),
            ];
        })->values();

        $certificate = Certificate::with(['user:id,name', 'course:id,title,slug,instructor_id', 'course.instructor:id,name', 'template'])
            ->where('user_id', $userId)->where('course_id', $course->id)->first();

        return response()->json([
            'progress' => ['done' => $done, 'total' => $total, 'pct' => $total > 0 ? (int) round($done / $total * 100) : 0],
            'quizzes' => $quizRows,
            'certificate' => $certificate,
            'eligible' => $total > 0 && $done >= $total && $quizRows->every(fn (array $row) => $row['passed']),
        ]);
    }
}
