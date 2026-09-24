<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\OrderItem;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\WalletTransaction;
use App\Support\InstructorAccess;
use App\Support\Pagination;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Ownership-scoped instructor dashboard (A-23). Every query is anchored on
 * courses.instructor_id = current user; a foreign course id is answered with 404.
 */
class InstructorController extends Controller
{
    /** Enrollments in the instructor's courses; filters: course_id, q (name/email). */
    public function students(Request $request): JsonResponse
    {
        InstructorAccess::authorize($request->user(), 'instructor_students');
        $courseId = $this->ownedCourseFilter($request);
        $query = Enrollment::query()
            ->whereIn('course_id', $courseId ? [$courseId] : $this->ownedCourseIds($request))
            ->with(['user:id,name,email,avatar,status', 'course:id,title,slug'])
            ->when($request->string('q')->trim()->value(), fn (Builder $q, string $search) => $q->whereHas('user', fn (Builder $user) => $user
                ->where('name', 'like', '%' . addcslashes($search, '%_\\') . '%')->orWhere('email', 'like', '%' . addcslashes($search, '%_\\') . '%')))
            ->latest();

        $page = Pagination::paginate($query, $request)->through(fn (Enrollment $e) => [
            'enrollment_id' => $e->id,
            'id' => $e->user?->id,
            'name' => $e->user?->name,
            'email' => $e->user?->email,
            'avatar' => $e->user?->avatar,
            'status' => $e->user?->status,
            'course_id' => $e->course_id,
            'course_title' => $e->course?->title,
            'course_slug' => $e->course?->slug,
            'progress_pct' => (int) $e->progress_pct,
            'enrollment_status' => $e->status,
            'enrolled_at' => $e->created_at?->toIso8601String(),
            'last_activity' => $e->updated_at?->toIso8601String(),
        ]);

        return response()->json(['students' => $page]);
    }

    /** Course sales of this instructor (not the instructor's own purchases); filters: course_id, status. */
    public function sales(Request $request): JsonResponse
    {
        InstructorAccess::authorize($request->user(), 'instructor_wallet');
        $me = $request->user()->id;
        $courseId = $this->ownedCourseFilter($request);
        $status = $request->string('status', 'paid')->value();
        abort_unless(in_array($status, ['paid', 'pending', 'failed', 'expired', 'cancelled', 'all'], true), 422, 'Status tidak valid.');

        $base = OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('order_items.instructor_id', $me)
            ->where('order_items.kind', 'course')
            ->when($courseId, fn (Builder $q) => $q->where('order_items.ref_id', $courseId))
            ->when($status !== 'all', fn (Builder $q) => $q->where('orders.status', $status));

        $summary = (clone $base)->selectRaw('COUNT(*) as count, COALESCE(SUM(order_items.price * order_items.qty), 0) as gross')->first();
        $page = Pagination::paginate((clone $base)->select('order_items.*')->with('order.user:id,name')
            ->orderByDesc('orders.paid_at')->orderByDesc('orders.created_at'), $request);

        $earnings = WalletTransaction::where('user_id', $me)->where('type', 'earning')
            ->whereIn('order_id', $page->getCollection()->pluck('order_id')->unique())
            ->get()->keyBy(fn (WalletTransaction $tx) => $tx->order_id . '|' . $tx->ref_id);

        $page->through(function (OrderItem $item) use ($earnings) {
            $earning = $earnings->get($item->order_id . '|' . $item->ref_id);
            return [
                'id' => $item->id,
                'order_id' => $item->order_id,
                'course_id' => $item->ref_id,
                'title' => $item->title,
                'price' => (int) $item->price,
                'qty' => (int) $item->qty,
                'gross' => (int) $item->price * (int) $item->qty,
                'net_earning' => $earning ? (int) $earning->amount : null,
                'platform_fee' => $earning ? (int) $earning->platform_fee : null,
                'order_status' => $item->order?->status,
                'buyer_name' => $item->order?->user?->name,
                'paid_at' => $item->order?->paid_at?->toIso8601String(),
                'ordered_at' => $item->order?->created_at?->toIso8601String(),
            ];
        });

        return response()->json(['sales' => $page, 'summary' => ['count' => (int) $summary->count, 'gross' => (int) $summary->gross]]);
    }

    /** Earning ledger of this instructor; filter: course_id. */
    public function earnings(Request $request): JsonResponse
    {
        InstructorAccess::authorize($request->user(), 'instructor_wallet');
        $courseId = $this->ownedCourseFilter($request);
        $base = WalletTransaction::where('user_id', $request->user()->id)->where('type', 'earning')
            ->when($courseId, fn (Builder $q) => $q->where('ref_id', $courseId));

        $summary = (clone $base)->selectRaw('COALESCE(SUM(amount), 0) as net, COALESCE(SUM(gross), 0) as gross, COALESCE(SUM(platform_fee), 0) as platform_fee, COALESCE(SUM(payment_fee), 0) as payment_fee')->first();
        $page = Pagination::paginate((clone $base)->latest(), $request);
        $titles = Course::whereIn('id', $page->getCollection()->pluck('ref_id')->filter()->unique())->pluck('title', 'id');
        $page->through(fn (WalletTransaction $tx) => [
            'id' => $tx->id, 'order_id' => $tx->order_id, 'course_id' => $tx->ref_id, 'course_title' => $titles[$tx->ref_id] ?? null,
            'amount' => (int) $tx->amount, 'gross' => (int) $tx->gross, 'platform_fee' => (int) $tx->platform_fee,
            'payment_fee' => (int) $tx->payment_fee, 'status' => $tx->status, 'created_at' => $tx->created_at?->toIso8601String(),
        ]);

        return response()->json(['earnings' => $page, 'summary' => [
            'net' => (int) $summary->net, 'gross' => (int) $summary->gross,
            'platform_fee' => (int) $summary->platform_fee, 'payment_fee' => (int) $summary->payment_fee,
        ]]);
    }

    /** Quizzes on the instructor's courses or created by the instructor; filter: course_id. */
    public function quizzes(Request $request): JsonResponse
    {
        InstructorAccess::authorize($request->user(), 'instructor_quizzes');
        $courseId = $this->ownedCourseFilter($request);
        $query = $this->ownedQuizzes($request)
            ->when($courseId, fn (Builder $q) => $q->where('course_id', $courseId))
            ->select('id', 'course_id', 'creator_id', 'title', 'active', 'max_attempts', 'time_limit_min', 'passing_score', 'created_at')
            ->with('course:id,title')
            ->withCount(['questions', 'attempts as submitted_attempts_count' => fn (Builder $q) => $q->where('status', 'submitted')])
            ->latest();

        return response()->json(['quizzes' => Pagination::paginate($query, $request)]);
    }

    /** Submitted attempts on the instructor's quizzes; filters: course_id, quiz_id, passed. */
    public function quizAttempts(Request $request): JsonResponse
    {
        InstructorAccess::authorize($request->user(), 'instructor_quizzes');
        $courseId = $this->ownedCourseFilter($request);
        $quizIds = $this->ownedQuizzes($request)->when($courseId, fn (Builder $q) => $q->where('course_id', $courseId))->select('id');
        $quizId = $request->string('quiz_id')->trim()->value();
        if ($quizId !== '') abort_unless((clone $quizIds)->whereKey($quizId)->exists(), 404);

        $query = QuizAttempt::query()
            ->whereIn('quiz_id', $quizId !== '' ? [$quizId] : $quizIds)
            ->where('status', 'submitted')
            ->when($request->has('passed'), fn (Builder $q) => $q->where('passed', $request->boolean('passed')))
            ->with(['quiz:id,title,course_id', 'quiz.course:id,title', 'user:id,name'])
            ->orderByDesc('submitted_at');

        $page = Pagination::paginate($query, $request)->through(fn (QuizAttempt $a) => [
            'id' => $a->id,
            'quiz_id' => $a->quiz_id,
            'quiz_title' => $a->quiz?->title,
            'course_id' => $a->quiz?->course_id,
            'course_title' => $a->quiz?->course?->title,
            'student_id' => $a->user_id,
            'student_name' => $a->user?->name,
            'score' => (int) $a->score,
            'max_score' => (int) $a->max_score,
            'percent' => (int) $a->percent,
            'passed' => (bool) $a->passed,
            'submitted_at' => $a->submitted_at?->toIso8601String(),
        ]);

        return response()->json(['attempts' => $page]);
    }

    /** Per-student progress in one instructor-owned course; filter: q. */
    public function courseProgress(Request $request, string $courseId): JsonResponse
    {
        InstructorAccess::authorize($request->user(), 'instructor_students');
        $course = Course::where('instructor_id', $request->user()->id)->whereKey($courseId)->firstOrFail();
        $lessonsTotal = $course->lessons()->where('status', 'published')->count();
        $stats = Enrollment::where('course_id', $course->id)
            ->selectRaw("COUNT(*) as enrolled, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed, COALESCE(AVG(progress_pct), 0) as avg_progress")->first();

        $query = Enrollment::where('course_id', $course->id)
            ->with('user:id,name,avatar')
            ->when($request->string('q')->trim()->value(), fn (Builder $q, string $search) => $q->whereHas('user', fn (Builder $user) => $user->where('name', 'like', '%' . addcslashes($search, '%_\\') . '%')))
            ->orderByDesc('progress_pct')->orderByDesc('updated_at');

        $page = Pagination::paginate($query, $request)->through(fn (Enrollment $e) => [
            'enrollment_id' => $e->id,
            'id' => $e->user?->id,
            'name' => $e->user?->name,
            'avatar' => $e->user?->avatar,
            'progress_pct' => (int) $e->progress_pct,
            'status' => $e->status,
            'completed_at' => $e->completed_at?->toIso8601String(),
            'last_activity' => $e->updated_at?->toIso8601String(),
        ]);

        return response()->json([
            'course' => ['id' => $course->id, 'title' => $course->title, 'slug' => $course->slug, 'lessons_total' => $lessonsTotal,
                'enrolled' => (int) $stats->enrolled, 'completed' => (int) $stats->completed, 'avg_progress' => (int) round((float) $stats->avg_progress)],
            'students_progress' => $page,
        ]);
    }

    private function ownedCourseIds(Request $request)
    {
        return Course::where('instructor_id', $request->user()->id)->select('id');
    }

    /** Optional ?course_id= must belong to the instructor (404 otherwise — no existence oracle). */
    private function ownedCourseFilter(Request $request): ?string
    {
        $courseId = $request->string('course_id')->trim()->value();
        if ($courseId === '') return null;
        abort_unless(Course::where('instructor_id', $request->user()->id)->whereKey($courseId)->exists(), 404);
        return $courseId;
    }

    private function ownedQuizzes(Request $request): Builder
    {
        $me = $request->user()->id;
        return Quiz::query()->where(fn (Builder $q) => $q
            ->whereIn('course_id', Course::where('instructor_id', $me)->select('id'))
            ->orWhere(fn (Builder $own) => $own->whereNull('course_id')->where('creator_id', $me)));
    }
}
