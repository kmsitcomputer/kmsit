<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\LiveClass;
use App\Services\GoogleMeetProvider;
use App\Services\LiveClassManager;
use App\Support\AdminAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use InvalidArgumentException;
use RuntimeException;

/**
 * Live class sessions (IMP-006). Course-level entity; management is
 * owner/staff gated, student join is enrollment gated. Zoom start_url and
 * all credentials never leave the server.
 */
class LiveClassController extends Controller
{
    public function index(Request $request, string $courseId): JsonResponse
    {
        $course = Course::findOrFail($courseId);
        $this->authorizeManage($request, $course);
        $sessions = LiveClass::where('course_id', $course->id)->orderBy('scheduled_at')->orderBy('id')->get()
            ->map(fn (LiveClass $session) => $this->presentStaff($session));
        return response()->json(['live_classes' => $sessions]);
    }

    public function store(Request $request, string $courseId): JsonResponse
    {
        $course = Course::findOrFail($courseId);
        $this->authorizeManage($request, $course);
        $data = $this->validateSession($request);
        $provider = $data['provider'];
        try {
            app(LiveClassManager::class)->assertProviderUsable($provider);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        try {
            $normalized = $provider === 'zoom'
                ? app(LiveClassManager::class)->resolve('zoom')->createMeeting($data['title'], $data['scheduled_at'], $data['duration_minutes'], $data['timezone'] ?? config('app.timezone'))
                : (new GoogleMeetProvider())->createStoredLink($data['join_url']);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }

        // Canonical instant boundary (R01): persist the absolute instant in
        // app timezone (existing Eloquent convention) — never the Zoom wall
        // time. The session `timezone` is metadata only. Zoom receives the
        // wall-time representation via normalizeTime in the provider call.
        $tz = $data['timezone'] ?? config('app.timezone');
        $scheduledAt = \App\Services\ZoomProvider::canonicalInstant($data['scheduled_at'])->format('Y-m-d H:i:s');
        try {
            $session = DB::transaction(function () use ($request, $course, $data, $provider, $normalized, $scheduledAt, $tz) {
                return LiveClass::create([
                    'id' => Str::lower(Str::random(12)), 'course_id' => $course->id, 'created_by' => $request->user()->id,
                    'provider' => $provider, 'provider_meeting_id' => $normalized['provider_meeting_id'],
                    'title' => $data['title'], 'scheduled_at' => $scheduledAt,
                    'duration_minutes' => $data['duration_minutes'], 'timezone' => $tz,
                    'join_url' => $normalized['join_url'], 'status' => 'scheduled',
                ]);
            });
        } catch (\Throwable $e) {
            $this->compensateOrphan($provider, $normalized['provider_meeting_id'] ?? null);
            report($e);
            return response()->json(['message' => 'Sesi Live Class gagal disimpan. Coba lagi.'], 502);
        }
        return response()->json(['live_class' => $this->presentStaff($session->fresh())], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $session = LiveClass::findOrFail($id);
        $course = Course::findOrFail($session->course_id);
        $this->authorizeManage($request, $course);
        if ($session->status !== 'scheduled') abort(422, 'Sesi yang sudah dibatalkan tidak dapat diubah.');
        $data = $this->validateSession($request, true);

        try {
            if ($session->provider === 'zoom') {
                $normalized = app(LiveClassManager::class)->resolve('zoom')->updateMeeting(
                    (string) $session->provider_meeting_id, $data['title'] ?? $session->title,
                    $data['scheduled_at'] ?? $session->scheduled_at->toIso8601String(),
                    $data['duration_minutes'] ?? $session->duration_minutes,
                    $data['timezone'] ?? $session->timezone ?? config('app.timezone'));
                // Case A (new time given): canonicalize the new instant.
                // Case B (tz changed, time omitted): existing instant is
                // untouched — only the wall representation for Zoom changes.
                // Case C (title-only): instant and timezone both unchanged.
                $tz = $data['timezone'] ?? $session->timezone ?? config('app.timezone');
                $scheduledAt = array_key_exists('scheduled_at', $data)
                    ? \App\Services\ZoomProvider::canonicalInstant($data['scheduled_at'])->format('Y-m-d H:i:s')
                    : $session->getRawOriginal('scheduled_at');
                try {
                    $session->update([
                        'title' => $data['title'] ?? $session->title,
                        'scheduled_at' => $scheduledAt,
                        'duration_minutes' => $data['duration_minutes'] ?? $session->duration_minutes,
                        'timezone' => $tz,
                        'join_url' => $normalized['join_url'],
                    ]);
                } catch (\Throwable $e) {
                    // Zoom already updated; local persistence failed. Do NOT
                    // claim rollback of Zoom (no prior-state restore exists)
                    // and do NOT report success — controlled failure with safe
                    // operational evidence only (no token, secret, start_url,
                    // or raw provider payload).
                    Log::warning('LiveClass update drift: provider updated, local persist failed', [
                        'live_class_id' => $session->id, 'provider' => 'zoom',
                        'provider_meeting_id' => $session->provider_meeting_id,
                        'exception' => $e::class,
                    ]);
                    return response()->json(['message' => 'Meeting Zoom diperbarui tetapi penyimpanan lokal gagal. Hubungi admin dengan ID sesi ini.'], 502);
                }
            } else {
                // Meet update: same canonical instant boundary (R01) as the
                // Zoom branch. A newly provided scheduled_at is canonicalized
                // to the app timezone before persisting; if omitted the stored
                // raw instant is preserved unchanged (no conversion duplicated).
                $scheduledAt = array_key_exists('scheduled_at', $data)
                    ? \App\Services\ZoomProvider::canonicalInstant($data['scheduled_at'])->format('Y-m-d H:i:s')
                    : $session->getRawOriginal('scheduled_at');
                if (isset($data['join_url'])) {
                    $normalized = (new GoogleMeetProvider())->createStoredLink($data['join_url']);
                    $session->update([
                        'title' => $data['title'] ?? $session->title,
                        'scheduled_at' => $scheduledAt,
                        'duration_minutes' => $data['duration_minutes'] ?? $session->duration_minutes,
                        'timezone' => $data['timezone'] ?? $session->timezone,
                        'provider_meeting_id' => $normalized['provider_meeting_id'],
                        'join_url' => $normalized['join_url'],
                    ]);
                } else {
                    $session->update(array_filter([
                        'title' => $data['title'] ?? null,
                        'scheduled_at' => $scheduledAt,
                        'duration_minutes' => $data['duration_minutes'] ?? null,
                        'timezone' => $data['timezone'] ?? null,
                    ], fn ($value) => $value !== null));
                }
            }
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }
        return response()->json(['live_class' => $this->presentStaff($session->fresh())]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $session = LiveClass::findOrFail($id);
        $course = Course::findOrFail($session->course_id);
        $this->authorizeManage($request, $course);
        if ($session->status !== 'scheduled') abort(422, 'Sesi sudah dibatalkan.');
        if ($session->provider === 'zoom') {
            try {
                app(LiveClassManager::class)->resolve('zoom')->cancelMeeting((string) $session->provider_meeting_id);
            } catch (InvalidArgumentException $e) {
                return response()->json(['message' => $e->getMessage()], 422);
            } catch (RuntimeException $e) {
                return response()->json(['message' => $e->getMessage()], 502);
            }
        }
        $session->update(['status' => 'cancelled']);
        return response()->json(['live_class' => $this->presentStaff($session->fresh())]);
    }

    public function forCourse(Request $request, string $courseId): JsonResponse
    {
        $course = Course::where('id', $courseId)->where('status', 'published')->firstOrFail();
        abort_unless(Enrollment::where('user_id', $request->user()->id)->where('course_id', $course->id)->exists(), 403, 'Student belum terdaftar di course ini.');
        $sessions = LiveClass::where('course_id', $course->id)->where('status', 'scheduled')
            ->orderBy('scheduled_at')->orderBy('id')->get()->map(fn (LiveClass $session) => $this->presentStudent($session));
        return response()->json(['live_classes' => $sessions]);
    }

    public function join(Request $request, string $id): JsonResponse
    {
        $session = LiveClass::where('id', $id)->where('status', 'scheduled')->firstOrFail();
        $course = Course::where('id', $session->course_id)->where('status', 'published')->firstOrFail();
        abort_unless(Enrollment::where('user_id', $request->user()->id)->where('course_id', $course->id)->exists(), 403, 'Student belum terdaftar di course ini.');
        return response()->json(['live_class' => $this->presentStudent($session)]);
    }

    private function authorizeManage(Request $request, Course $course): void
    {
        $user = $request->user();
        if ($user->id === $course->instructor_id) return;
        AdminAccess::authorize($user, 'manage_courses');
    }

    private function validateSession(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';
        $data = $request->validate([
            'provider' => $partial ? ['sometimes', 'string', 'in:zoom,google_meet'] : ['required', 'string', 'in:zoom,google_meet'],
            'title' => [$required, 'string', 'max:190'],
            'scheduled_at' => [$required, 'date'],
            'duration_minutes' => [$required, 'integer', 'min:1', 'max:1440'],
            'timezone' => ['nullable', 'string', 'max:60'],
            'join_url' => ['nullable', 'string', 'max:2000'],
        ]);
        $provider = $data['provider'] ?? null;
        if (!$partial && $provider === 'google_meet' && empty($data['join_url'])) {
            abort(422, 'Link Google Meet wajib diisi.');
        }
        // Timezone allowlist is the real PHP identifier list (F01), shared
        // with the Zoom wall-time boundary; Meet writes need it too.
        if (array_key_exists('timezone', $data) && $data['timezone'] !== null && trim((string) $data['timezone']) !== '') {
            try {
                \App\Services\ZoomProvider::assertTimezone((string) $data['timezone']);
            } catch (InvalidArgumentException $e) {
                abort(422, $e->getMessage());
            }
        }
        return $data;
    }

    /** Staff view: normalized fields, never credentials or start_url. */
    private function presentStaff(LiveClass $session): array
    {
        return [...$this->presentBase($session), 'provider_meeting_id' => $session->provider_meeting_id];
    }

    /** Student view: join URL only, never provider internals. */
    private function presentStudent(LiveClass $session): array
    {
        return $this->presentBase($session);
    }

    private function presentBase(LiveClass $session): array
    {
        return [
            'id' => $session->id, 'course_id' => $session->course_id, 'provider' => $session->provider,
            'title' => $session->title, 'scheduled_at' => $session->scheduled_at?->toIso8601String(),
            'duration_minutes' => $session->duration_minutes, 'timezone' => $session->timezone,
            'join_url' => $session->join_url, 'status' => $session->status,
            'display_state' => $this->displayState($session),
        ];
    }

    private function displayState(LiveClass $session): string
    {
        if ($session->status === 'cancelled' || !$session->scheduled_at) return 'cancelled';
        $now = now();
        $end = $session->scheduled_at->copy()->addMinutes($session->duration_minutes);
        if ($now->lt($session->scheduled_at)) return 'upcoming';
        return $now->lte($end) ? 'in_session_window' : 'ended';
    }

    private function compensateOrphan(string $provider, ?string $providerMeetingId): void
    {
        if ($provider !== 'zoom' || !$providerMeetingId) return;
        try {
            app(LiveClassManager::class)->resolve('zoom')->cancelMeeting($providerMeetingId);
        } catch (\Throwable $e) {
            Log::warning('LiveClass orphan compensation failed', ['provider' => $provider, 'exception' => $e::class]);
        }
    }
}
