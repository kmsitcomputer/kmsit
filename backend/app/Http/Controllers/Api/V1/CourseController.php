<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Models\LessonProgress;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CourseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $courses = Course::query()
            ->with(['instructor:id,name', 'category:id,name,slug'])
            ->where('status', 'published')
            ->when($request->string('search')->trim()->value(), function ($query, string $search) {
                $query->where(function ($nested) use ($search) {
                    $nested->where('title', 'like', "%{$search}%")
                        ->orWhere('short_description', 'like', "%{$search}%");
                });
            })
            ->latest('published_at')
            ->paginate(min($request->integer('per_page', 12), 50));

        return response()->json($courses);
    }

    public function show(string $slug, Request $request): JsonResponse
    {
        $course = Course::withCount('enrollments')->with(['instructor:id,name,avatar', 'category:id,name,slug', 'sections.lessons'])
            ->where('slug', $slug)
            ->where('status', 'published')
            ->firstOrFail();

        $user = $request->user();
        $isOwner = $user && ($user->id === $course->instructor_id || in_array($user->role_key, ['admin', 'super_admin'], true));
        $enrolled = $user && Enrollment::where('user_id', $user->id)->where('course_id', $course->id)->exists();
        $canView = $isOwner || $enrolled;

        $payload = $course->toArray();
        $payload['enrolled'] = (bool) $enrolled;
        $payload['sections'] = $course->sections->map(fn ($section) => [
            'id' => $section->id,
            'title' => $section->title,
            'sort' => $section->sort,
            'lessons' => $section->lessons->map(fn ($lesson) => [
                'id' => $lesson->id,
                'title' => $lesson->title,
                'type' => $lesson->type,
                'duration_min' => $lesson->duration_min,
                'preview' => (bool) $lesson->preview,
                'status' => $lesson->status,
                'content' => ($canView || $lesson->preview) ? $lesson->content : null,
                'media_url' => ($canView || $lesson->preview) ? $lesson->media_url : null,
            ])->values(),
        ])->values();

        return response()->json(['course' => $payload]);
    }

    public function enroll(Request $request, string $slug): JsonResponse
    {
        $course = Course::where('slug', $slug)->where('status', 'published')->firstOrFail();

        if (!$course->is_free) {
            return response()->json(['message' => 'Course berbayar harus melalui pembayaran terlebih dahulu.'], 402);
        }

        $enrollment = Enrollment::firstOrCreate(
            ['user_id' => $request->user()->id, 'course_id' => $course->id],
            ['id' => Str::lower(Str::random(12)), 'status' => 'active', 'progress_pct' => 0]
        );

        return response()->json(['enrollment' => $enrollment->load('course:id,slug,title')], $enrollment->wasRecentlyCreated ? 201 : 200);
    }

    public function completeLesson(Request $request, string $slug, string $lessonId): JsonResponse
    {
        $course = Course::where('slug', $slug)->where('status', 'published')->firstOrFail();
        $enrollment = Enrollment::where('user_id', $request->user()->id)->where('course_id', $course->id)->firstOrFail();
        $lesson = Lesson::where('id', $lessonId)->where('course_id', $course->id)->where('status', 'published')->firstOrFail();

        $enrollment = DB::transaction(function () use ($request, $course, $enrollment, $lesson) {
            LessonProgress::firstOrCreate(
                ['user_id' => $request->user()->id, 'lesson_id' => $lesson->id],
                ['id' => Str::lower(Str::random(12)), 'completed_at' => now()]
            );

            $total = $course->lessons()->where('status', 'published')->count();
            $done = LessonProgress::where('user_id', $request->user()->id)
                ->whereIn('lesson_id', $course->lessons()->where('status', 'published')->pluck('id'))
                ->count();
            $progress = $total > 0 ? (int) round(($done / $total) * 100) : 0;

            $enrollment->update([
                'progress_pct' => $progress,
                'last_lesson_id' => $lesson->id,
                'status' => $progress >= 100 ? 'completed' : 'active',
                'completed_at' => $progress >= 100 ? now() : null,
            ]);

            return $enrollment;
        });

        return response()->json(['enrollment' => $enrollment->fresh()]);
    }

    public function progress(Request $request, string $slug): JsonResponse
    {
        $course = Course::where('slug', $slug)->where('status', 'published')->firstOrFail();
        $enrollment = Enrollment::where('user_id', $request->user()->id)->where('course_id', $course->id)->firstOrFail();
        $lessonIds = $course->lessons()->where('status', 'published')->pluck('id');
        $completedIds = LessonProgress::where('user_id', $request->user()->id)->whereIn('lesson_id', $lessonIds)->pluck('lesson_id')->values();
        return response()->json(['progress' => ['done' => $completedIds->count(), 'total' => $lessonIds->count(), 'pct' => $lessonIds->count() ? (int) round($completedIds->count() / $lessonIds->count() * 100) : 0, 'completed_lesson_ids' => $completedIds]]);
    }
}
