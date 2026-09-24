<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Certificate;
use App\Models\CertificateTemplate;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\LessonProgress;
use App\Models\Quiz;
use App\Services\NotificationService;
use App\Support\AdminAccess;
use Illuminate\Support\Facades\DB;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CertificateController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Certificate::with(['user:id,name', 'course:id,title,slug,instructor_id', 'course.instructor:id,name', 'template'])
            ->when($request->string('status')->trim()->value(), fn ($q, string $status) => $q->where('status', $status))
            ->latest()->orderByDesc('id');
        if ($user->role_key === 'student') $query->where('user_id', $user->id);
        elseif ($user->role_key === 'instructor') $query->whereHas('course', fn ($course) => $course->where('instructor_id', $user->id));
        else AdminAccess::authorize($user, 'manage_certificates');
        return response()->json(['certificates' => Pagination::paginate($query, $request)]);
    }

    public function mine(Request $request): JsonResponse
    {
        return response()->json(['certificates' => Certificate::with('course:id,title,slug')->where('user_id', $request->user()->id)->latest()->get()]);
    }

    public function verify(string $number): JsonResponse
    {
        $certificate = Certificate::with(['user:id,name', 'course:id,title,slug,instructor_id', 'course.instructor:id,name', 'template'])->where('number', $number)->firstOrFail();
        if ($certificate->status !== 'issued') return response()->json(['valid' => false, 'certificate' => $certificate], 200);
        $certificate->increment('views');
        return response()->json(['valid' => true, 'certificate' => $certificate]);
    }

    public function issue(Request $request, string $courseId): JsonResponse
    {
        $course = Course::where('id', $courseId)->where('status', 'published')->firstOrFail();
        $userId = $request->user()->id;
        $enrollment = Enrollment::where('user_id', $userId)->where('course_id', $course->id)->firstOrFail();
        $total = $course->lessons()->where('status', 'published')->count();
        $done = LessonProgress::where('user_id', $userId)->whereIn('lesson_id', $course->lessons()->where('status', 'published')->pluck('id'))->count();
        if ($total === 0 || $done < $total) return response()->json(['message' => 'Selesaikan seluruh materi terlebih dahulu.'], 422);
        $hasUnpassedQuiz = Quiz::where('course_id', $course->id)->where('active', true)
            ->whereDoesntHave('attempts', fn ($attempts) => $attempts->where('user_id', $userId)->where('passed', true))
            ->exists();
        if ($hasUnpassedQuiz) return response()->json(['message' => 'Semua quiz aktif harus lulus terlebih dahulu.'], 422);
        $existing = Certificate::where('user_id', $userId)->where('course_id', $course->id)->first();
        if ($existing) return response()->json(['certificate' => $existing]);
        $template = CertificateTemplate::firstOrCreate(['id' => 'ctpl_default'], ['name' => 'KMSIT Modern', 'theme' => 'navy', 'accent' => '#2dd4bf', 'frame' => 'modern']);
        $certificate = DB::transaction(function () use ($userId, $course, $template, $enrollment) {
            $certificate = Certificate::create(['id' => Str::lower(Str::random(12)), 'number' => 'KMSIT-' . now()->year . '-' . strtoupper(Str::random(6)), 'user_id' => $userId, 'course_id' => $course->id, 'template_id' => $template->id, 'status' => 'issued', 'views' => 0]);
            $enrollment->update(['status' => 'completed', 'progress_pct' => 100, 'completed_at' => now()]);
            app(NotificationService::class)->notify($userId, "certificate:{$certificate->id}:issued", 'Sertifikat terbit',
                "Sertifikat \"{$course->title}\" ({$certificate->number}) sudah terbit.", '/dashboard/certificates', 'success');
            return $certificate;
        });
        return response()->json(['certificate' => $certificate], 201);
    }

    public function revoke(Request $request, string $id): JsonResponse
    {
        AdminAccess::authorize($request->user(), 'manage_certificates');
        $certificate = Certificate::where('status', 'issued')->findOrFail($id);
        DB::transaction(function () use ($certificate, $request) {
            $certificate->update(['status' => 'revoked', 'revoked_by' => $request->user()->id, 'revoked_at' => now()]);
            app(NotificationService::class)->notify($certificate->user_id, "certificate:{$certificate->id}:revoked", 'Sertifikat dicabut',
                "Sertifikat {$certificate->number} dicabut oleh admin.", '/dashboard/certificates', 'danger');
        });
        return response()->json(['certificate' => $certificate->fresh()]);
    }
}
