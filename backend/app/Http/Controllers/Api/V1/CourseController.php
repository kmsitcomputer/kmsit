<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Models\LessonProgress;
use App\Models\Section;
use App\Services\NotificationService;
use App\Support\AdminAccess;
use App\Support\Pagination;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;
use App\Support\FileSecurity;
use App\Support\HtmlSanitizer;

class CourseController extends Controller
{
    public function adminIndex(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Course::query()->withCount('enrollments')->with(['instructor:id,name', 'category:id,name,slug'])->latest();
        if (in_array($user->role_key, ['admin', 'super_admin'], true)) {
            AdminAccess::authorize($user, 'manage_courses');
        } else {
            abort_unless($user->role_key === 'instructor', 403, 'Tidak memiliki permission.');
            $query->where('instructor_id', $user->id);
        }
        $query->when($request->string('status')->trim()->value(), fn ($q, string $status) => $q->where('status', $status))
            ->when($request->string('q')->trim()->value(), fn ($q, string $search) => $q->where('title', 'like', '%' . addcslashes($search, '%_\\') . '%'));
        return response()->json(['courses' => Pagination::paginate($query, $request)->through(fn (Course $course) => $this->present($course))]);
    }

    public function adminShow(Request $request, string $id): JsonResponse
    {
        $course = Course::with(['sections.lessons', 'instructor:id,name', 'category:id,name,slug'])->findOrFail($id);
        $this->authorizeOwner($request, $course);
        return response()->json(['course' => $this->present($course, true)]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user->role_key === 'instructor') {
            // Instructor path: ownership implisit, selalu menjadi pemilik sendiri.
        } else {
            AdminAccess::authorize($user, 'manage_courses');
        }
        $data = $this->validateCourse($request);
        $data['description'] = app(HtmlSanitizer::class)->html($data['description'] ?? null);
        $data['instructor_id'] = in_array($user->role_key, ['admin', 'super_admin'], true) && !empty($data['instructor_id']) ? $data['instructor_id'] : $user->id;
        $course = Course::create(['id' => Str::lower(Str::random(12)), ...$data, 'status' => 'draft']);
        return response()->json(['course' => $this->present($course->fresh(['instructor:id,name', 'category:id,name,slug']))], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $course = Course::findOrFail($id);
        $this->authorizeOwner($request, $course);
        $data = $this->validateCourse($request, $id);
        $data['description'] = app(HtmlSanitizer::class)->html($data['description'] ?? null);
        // Hanya staf berpermission yang boleh memindahkan kepemilikan course.
        if (!in_array($request->user()->role_key, ['admin', 'super_admin'], true)) unset($data['instructor_id']);
        $sections = $request->input('sections');

        $course = DB::transaction(function () use ($course, $data, $sections) {
            $course->update($data);
            if (is_array($sections)) $this->syncCurriculum($course, $sections);
            return $course->fresh(['sections.lessons', 'instructor:id,name', 'category:id,name,slug']);
        });

        return response()->json(['course' => $this->present($course, true)]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $course = Course::findOrFail($id);
        $this->authorizeOwner($request, $course);
        $course->delete();
        return response()->json(['message' => 'Course dihapus.']);
    }

    public function submit(Request $request, string $id): JsonResponse
    {
        $course = Course::findOrFail($id);
        $this->authorizeOwner($request, $course);
        abort_unless(in_array($course->status, ['draft', 'rejected'], true), 422, 'Course tidak dapat diajukan dari status saat ini.');
        DB::transaction(function () use ($course) {
            $course->update(['status' => 'pending', 'reject_note' => null]);
            app(NotificationService::class)->notifyStaff('moderate_courses', "course:{$course->id}:submitted:" . $course->updated_at->timestamp,
                'Kelas menunggu moderasi', "\"{$course->title}\" diajukan untuk ditinjau.", '/dashboard/courses?status=pending', 'info');
        });
        return response()->json(['course' => $this->present($course->fresh())]);
    }

    public function moderate(Request $request, string $id): JsonResponse
    {
        AdminAccess::authorize($request->user(), 'moderate_courses');
        $data = $request->validate(['action' => ['required', 'in:approve,reject,archive'], 'reject_note' => ['nullable', 'string', 'max:500']]);
        $course = Course::findOrFail($id);
        DB::transaction(function () use ($course, $data) {
            $course->update(match ($data['action']) {
                'approve' => ['status' => 'published', 'published_at' => $course->published_at ?? now(), 'reject_note' => null],
                'reject' => ['status' => 'rejected', 'reject_note' => $data['reject_note'] ?? null],
                'archive' => ['status' => 'archived'],
            });
            [$title, $kind] = match ($data['action']) {
                'approve' => ['Kelas disetujui & terbit', 'success'],
                'reject' => ['Kelas ditolak', 'danger'],
                'archive' => ['Kelas diarsipkan', 'warning'],
            };
            $body = "\"{$course->title}\"" . ($data['action'] === 'reject' && !empty($data['reject_note']) ? ': ' . $data['reject_note'] : '.');
            app(NotificationService::class)->notify($course->instructor_id, "course:{$course->id}:{$data['action']}:" . $course->updated_at->timestamp, $title, $body, '/dashboard/courses', $kind);
        });
        return response()->json(['course' => $this->present($course->fresh())]);
    }

    private function syncCurriculum(Course $course, array $sections): void
    {
        $keepSectionIds = [];
        foreach ($sections as $sectionIndex => $sectionData) {
            $section = !empty($sectionData['id']) ? Section::where('course_id', $course->id)->find($sectionData['id']) : null;
            if (!$section) $section = new Section(['id' => Str::lower(Str::random(12)), 'course_id' => $course->id]);
            $section->title = $sectionData['title'] ?? 'Untitled';
            $section->sort = $sectionIndex;
            $section->save();
            $keepSectionIds[] = $section->id;

            $keepLessonIds = [];
            foreach (($sectionData['lessons'] ?? []) as $lessonIndex => $lessonData) {
                $lesson = !empty($lessonData['id']) ? Lesson::where('course_id', $course->id)->find($lessonData['id']) : null;
                if (!$lesson) $lesson = new Lesson(['id' => Str::lower(Str::random(12)), 'course_id' => $course->id]);
                $lesson->section_id = $section->id;
                $lesson->title = $lessonData['title'] ?? 'Untitled';
                $lesson->type = $lessonData['type'] ?? 'text';
                $lesson->content = app(HtmlSanitizer::class)->html($lessonData['content'] ?? null);
                $lesson->media_url = $this->lessonMediaUrl($lesson->type, $lessonData['media_url'] ?? null);
                $lesson->duration_min = $lessonData['duration_min'] ?? 0;
                $lesson->preview = (bool) ($lessonData['preview'] ?? false);
                $lesson->status = $lessonData['status'] ?? 'published';
                $lesson->sort = $lessonIndex;
                $lesson->save();
                $keepLessonIds[] = $lesson->id;
            }
            Lesson::where('section_id', $section->id)->whereNotIn('id', $keepLessonIds)->delete();
        }
        Section::where('course_id', $course->id)->whereNotIn('id', $keepSectionIds)->delete();
    }

    private function present(Course $course, bool $withCurriculum = false): array
    {
        $payload = $course->toArray();
        $payload['description'] = app(HtmlSanitizer::class)->html($course->description);
        if ($withCurriculum) {
            $payload['sections'] = $course->sections->map(fn (Section $section) => [
                'id' => $section->id, 'title' => $section->title, 'sort' => $section->sort,
                'lessons' => $section->lessons->map(fn (Lesson $lesson) => [
                    'id' => $lesson->id, 'title' => $lesson->title, 'type' => $lesson->type, 'content' => $lesson->content,
                    'media_url' => $lesson->media_url, 'duration_min' => $lesson->duration_min, 'preview' => (bool) $lesson->preview,
                    'status' => $lesson->status, 'sort' => $lesson->sort,
                ])->values(),
            ])->values();
        }
        return $payload;
    }

    private function validateCourse(Request $request, ?string $id = null): array
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:190'], 'slug' => ['nullable', 'string', 'max:140'],
            'category_id' => ['nullable', 'string', 'exists:categories,id'], 'short_description' => ['nullable', 'string', 'max:500'],
            'description' => ['nullable', 'string'], 'thumbnail' => ['nullable', 'string'],
            'price' => ['required', 'integer', 'min:0'], 'discount_price' => ['nullable', 'integer', 'min:0'],
            'is_free' => ['sometimes', 'boolean'], 'level' => ['required', 'in:beginner,intermediate,advanced'],
            'language' => ['nullable', 'string', 'max:40'], 'featured' => ['sometimes', 'boolean'],
            'requirements' => ['nullable', 'array'], 'outcomes' => ['nullable', 'array'], 'tags' => ['nullable', 'array'],
            'instructor_id' => ['nullable', 'string', 'exists:users,id'],
        ]);
        $data['slug'] = $data['slug'] ?? Str::slug($data['title']);
        return $data;
    }

    private function lessonMediaUrl(string $type, mixed $url): ?string
    {
        if (!is_string($url) || trim($url) === '') return null;
        if (in_array($type, ['file', 'pdf'], true)) return FileSecurity::isPathWithin($url, 'lessons') ? $url : null;
        if (in_array($type, ['youtube', 'embed'], true)) return app(HtmlSanitizer::class)->embedUrl($url);
        return app(HtmlSanitizer::class)->url($url);
    }

    private function authorizeOwner(Request $request, Course $course): void
    {
        $user = $request->user();
        if ($user->id === $course->instructor_id) return;
        AdminAccess::authorize($user, 'manage_courses');
    }

    public function index(Request $request): JsonResponse
    {
        // Effective price mirrors OrderController::storeCourse (free => 0, valid discount wins).
        $effectivePrice = 'CASE WHEN is_free = 1 THEN 0 WHEN discount_price > 0 AND discount_price < price THEN discount_price ELSE price END';
        $courses = Course::query()
            ->with(['instructor:id,name', 'category:id,name,slug'])
            ->withCount('enrollments')
            ->where('status', 'published')
            ->when($request->string('search')->trim()->value(), function ($query, string $search) {
                $like = '%' . addcslashes($search, '%_\\') . '%';
                $query->where(function ($nested) use ($like) {
                    $nested->where('title', 'like', $like)
                        ->orWhere('short_description', 'like', $like);
                });
            })
            ->when($request->string('category_id')->trim()->value(), fn ($q, string $categoryId) => $q->where('category_id', $categoryId))
            ->when($request->string('level')->trim()->value(), fn ($q, string $level) => $q->where('level', $level))
            ->when($request->string('type')->trim()->value(), fn ($q, string $type) => $type === 'free' ? $q->where('is_free', true) : ($type === 'paid' ? $q->where('is_free', false) : $q))
            ->when($request->string('exclude')->trim()->value(), fn ($q, string $id) => $q->whereKeyNot($id))
            ->when($request->boolean('featured'), fn ($q) => $q->where('featured', true));
        match ($request->string('sort', 'latest')->value()) {
            'popular' => $courses->orderByDesc('enrollments_count'),
            'price_asc' => $courses->orderByRaw($effectivePrice . ' asc'),
            'price_desc' => $courses->orderByRaw($effectivePrice . ' desc'),
            default => $courses->latest('published_at'),
        };

        return response()->json(Pagination::paginate($courses->orderByDesc('id'), $request, 12));
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
        $payload['description'] = app(HtmlSanitizer::class)->html($course->description);
        $payload['enrolled'] = (bool) $enrolled;
        $instructorCourses = Course::where('instructor_id', $course->instructor_id)->where('status', 'published');
        $payload['instructor_stats'] = [
            'courses' => (clone $instructorCourses)->count(),
            'students' => Enrollment::whereIn('course_id', (clone $instructorCourses)->select('id'))->count(),
        ];
        $visibleLessons = fn ($section) => $section->lessons->filter(fn ($lesson) => $lesson->status === 'published' || $isOwner)->values();
        $payload['sections'] = $course->sections->map(fn ($section) => [
            'id' => $section->id,
            'title' => $section->title,
            'sort' => $section->sort,
            'lessons' => $visibleLessons($section)->map(fn ($lesson) => [
                'id' => $lesson->id,
                'title' => $lesson->title,
                'type' => $lesson->type,
                'duration_min' => $lesson->duration_min,
                'preview' => (bool) $lesson->preview,
                'status' => $lesson->status,
                'content' => ($canView || $lesson->preview) ? app(HtmlSanitizer::class)->html($lesson->content) : null,
                'media_url' => ($canView || $lesson->preview) ? $lesson->media_url : null,
            ])->values(),
        ])->values();

        return response()->json(['course' => $payload]);
    }

    public function downloadLesson(Request $request, string $slug, string $lessonId)
    {
        $course = Course::where('slug', $slug)->where('status', 'published')->firstOrFail();
        $lesson = Lesson::whereKey($lessonId)->where('course_id', $course->id)->where('status', 'published')->firstOrFail();
        $user = $request->user();
        $allowed = $user->id === $course->instructor_id
            || Enrollment::where('user_id', $user->id)->where('course_id', $course->id)->exists();
        if (!$allowed && in_array($user->role_key, ['admin', 'super_admin'], true)) {
            AdminAccess::authorize($user, 'manage_courses');
            $allowed = true;
        }
        abort_unless($allowed, 404);
        abort_unless($lesson->media_url && FileSecurity::isPathWithin($lesson->media_url, 'lessons')
            && Storage::disk('local')->exists($lesson->media_url), 404, 'File lesson tidak tersedia.');
        return Storage::disk('local')->download($lesson->media_url);
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
