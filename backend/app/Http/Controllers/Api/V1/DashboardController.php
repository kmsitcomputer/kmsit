<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\Article;
use App\Models\Certificate;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\News;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\Tutorial;
use App\Models\User;
use App\Models\WalletTransaction;
use App\Models\Withdrawal;
use App\Models\Setting;
use App\Support\AdminAccess;
use App\Support\OperationsStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class DashboardController extends Controller
{
    public function summary(Request $request): JsonResponse
    {
        $user = $request->user();

        if (in_array($user->role_key, ['admin', 'super_admin'], true)) {
            return response()->json($this->staffSummary($user));
        }

        if ($user->role_key === 'instructor') {
            $courseIds = Course::where('instructor_id', $user->id)->pluck('id');
            $earning = (int) WalletTransaction::where('user_id', $user->id)->where('type', 'earning')->where('status', 'completed')->sum('amount');
            $gross = (int) WalletTransaction::where('user_id', $user->id)->where('type', 'earning')->sum('gross');
            $reserved = (int) Withdrawal::where('user_id', $user->id)->whereIn('status', ['pending', 'approved', 'processing', 'completed'])->sum('amount');
            $recentStudents = Enrollment::whereIn('course_id', $courseIds)->with(['user:id,name,avatar', 'course:id,title'])->latest()->limit(5)->get()->map(fn (Enrollment $enrollment) => [
                'id' => $enrollment->id, 'user_name' => $enrollment->user?->name, 'user_avatar' => $enrollment->user?->avatar,
                'course_title' => $enrollment->course?->title, 'created_at' => $enrollment->created_at,
            ]);
            return response()->json(['role' => 'instructor', 'summary' => [
                'courses' => $courseIds->count(),
                'published_courses' => Course::whereIn('id', $courseIds)->where('status', 'published')->count(),
                'students' => Enrollment::whereIn('course_id', $courseIds)->count(),
                'certificates' => Certificate::whereIn('course_id', $courseIds)->count(),
                'quizzes' => Quiz::whereIn('course_id', $courseIds)->count(),
                'earnings' => $earning, 'gross' => $gross, 'balance' => max(0, $earning - $reserved), 'withdrawable' => max(0, $earning - $reserved),
                'completed_withdrawals' => Withdrawal::where('user_id', $user->id)->where('status', 'completed')->count(),
                'pending_withdrawals' => Withdrawal::where('user_id', $user->id)->where('status', 'pending')->sum('amount'),
                'platform_fee_percent' => (float) (Setting::where('setting_key', 'platform_fee_percent')->value('setting_value') ?? 15),
            ], 'revenue_chart' => $this->earningChart($user->id), 'recent_students' => $recentStudents]);
        }

        $enrollments = Enrollment::where('user_id', $user->id)->with('course')->get();
        $inProgress = $enrollments->where('status', '!=', 'completed')->sortByDesc('updated_at')->take(4)->values()->map(fn (Enrollment $enrollment) => [
            'course_id' => $enrollment->course_id, 'course_title' => $enrollment->course?->title, 'course_slug' => $enrollment->course?->slug,
            'course_thumbnail' => $enrollment->course?->thumbnail, 'progress_pct' => $enrollment->progress_pct,
        ]);
        return response()->json(['role' => 'student', 'summary' => [
            'enrollments' => $enrollments->count(),
            'completed_enrollments' => $enrollments->where('status', 'completed')->count(),
            'certificates' => Certificate::where('user_id', $user->id)->count(),
            'quiz_attempts' => QuizAttempt::where('user_id', $user->id)->where('status', 'submitted')->count(),
            'passed_quizzes' => QuizAttempt::where('user_id', $user->id)->where('status', 'submitted')->where('passed', true)->count(),
            'avg_progress' => $enrollments->count() ? (int) round($enrollments->avg('progress_pct')) : 0,
        ], 'in_progress' => $inProgress]);
    }

    /**
     * Staff overview: every card is gated by the permission that also guards its detail page,
     * so an admin never sees figures (e.g. revenue) for areas they cannot open.
     */
    private function staffSummary(User $user): array
    {
        $can = fn (string $permission) => AdminAccess::allows($user, $permission);
        $summary = [];
        $tasks = [];
        if ($user->role_key === 'super_admin') $summary['users'] = User::count();
        if ($can('manage_students')) $summary['students'] = User::where('role_key', 'student')->count();
        if ($can('manage_instructors')) {
            $summary['instructors'] = User::where('role_key', 'instructor')->count();
            $summary['pending_instructors'] = User::where('role_key', 'instructor')->where('instructor_approved', false)->count();
            if ($summary['pending_instructors'] > 0) $tasks[] = ['key' => 'pending_instructors', 'count' => $summary['pending_instructors'], 'link' => '/dashboard/instructors'];
        }
        if ($can('manage_courses') || $can('moderate_courses')) {
            $summary['courses'] = Course::count();
            $summary['published_courses'] = Course::where('status', 'published')->count();
            $summary['pending_courses'] = Course::where('status', 'pending')->count();
            if ($can('moderate_courses') && $summary['pending_courses'] > 0) $tasks[] = ['key' => 'pending_courses', 'count' => $summary['pending_courses'], 'link' => '/dashboard/courses?status=pending'];
        }
        if ($can('manage_orders')) {
            $summary['orders'] = Order::count();
            $summary['paid_orders'] = Order::where('status', 'paid')->count();
        }
        $finance = $can('view_reports') || $can('view_payments');
        if ($finance) {
            $summary['revenue'] = (int) Order::where('status', 'paid')->sum('total');
            $summary['platform_revenue'] = (int) WalletTransaction::where('type', 'earning')->sum('platform_fee');
        }
        if ($can('process_withdrawals')) {
            $summary['pending_withdrawals'] = Withdrawal::where('status', 'pending')->count();
            if ($summary['pending_withdrawals'] > 0) $tasks[] = ['key' => 'pending_withdrawals', 'count' => $summary['pending_withdrawals'], 'link' => '/dashboard/withdrawals'];
        }
        if ($can('view_messages')) {
            $unread = \App\Models\ContactMessage::where('is_read', false)->count();
            if ($unread > 0) $tasks[] = ['key' => 'unread_messages', 'count' => $unread, 'link' => '/dashboard/messages'];
        }
        foreach (['articles' => [Article::class, 'manage_articles'], 'news' => [News::class, 'manage_news'], 'tutorials' => [Tutorial::class, 'manage_tutorials'], 'activities' => [Activity::class, 'manage_activities']] as $key => [$model, $permission]) {
            if ($can($permission)) $summary[$key] = $model::count();
        }
        if ($can('manage_certificates')) $summary['certificates'] = Certificate::count();

        $payload = ['role' => $user->role_key, 'summary' => $summary, 'tasks' => $tasks];
        if ($finance) $payload['revenue_chart'] = $this->revenueChart();
        if ($can('manage_orders')) {
            $payload['recent_orders'] = Order::with(['items', 'user:id,name'])->latest()->limit(6)->get()->map(fn (Order $order) => [
                'id' => $order->id, 'user_name' => $order->user?->name, 'type' => $order->type, 'total' => $order->total,
                'status' => $order->status, 'item_title' => $order->items->first()?->title,
            ]);
        }
        if ($user->role_key === 'super_admin') $payload['platform'] = app(OperationsStatus::class)->snapshot();
        return $payload;
    }

    /** Instructor chart: own net earnings per day (ledger), not whole order payments. */
    private function earningChart(string $instructorId): array
    {
        $days = [];
        for ($i = 6; $i >= 0; $i--) {
            $date = Carbon::today()->subDays($i);
            $days[] = ['label' => $date->translatedFormat('D'), 'value' => (int) WalletTransaction::where('user_id', $instructorId)->where('type', 'earning')
                ->whereBetween('created_at', [$date->copy()->startOfDay(), $date->copy()->endOfDay()])->sum('amount')];
        }
        return $days;
    }

    private function revenueChart(?string $instructorId = null): array
    {
        $days = [];
        for ($i = 6; $i >= 0; $i--) {
            $date = Carbon::today()->subDays($i);
            $query = Payment::where('status', 'paid')->whereBetween('updated_at', [$date->copy()->startOfDay(), $date->copy()->endOfDay()]);
            if ($instructorId) $query->whereHas('order.items', fn ($items) => $items->where('instructor_id', $instructorId));
            $days[] = ['label' => $date->translatedFormat('D'), 'value' => (int) $query->sum('amount')];
        }
        return $days;
    }
}
