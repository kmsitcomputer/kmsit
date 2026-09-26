<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\LiveClass;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * IMP-006: Zoom S2S provider, all HTTP faked (never live). Covers OAuth
 * normalization, create/update/cancel, fail-closed cancel, orphan
 * compensation path, failure mapping, and credential secrecy.
 */
class LiveClassZoomTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        config([
            'services.zoom.account_id' => 'test-account',
            'services.zoom.client_id' => 'test-client',
            'services.zoom.client_secret' => 'test-secret',
        ]);
        $this->seed();
    }

    private function instructor(string $email = 'live-instructor@example.com'): User
    {
        return User::create(['id' => Str::lower(Str::random(12)), 'role_key' => 'instructor', 'name' => 'Instructor', 'email' => $email, 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);
    }

    private function course(User $instructor, string $id = 'livecourse01', string $status = 'published'): Course
    {
        return Course::create(['id' => $id, 'slug' => 'live-' . $id, 'instructor_id' => $instructor->id, 'title' => 'Live Course', 'is_free' => true, 'status' => $status]);
    }

    private function payload(array $overrides = []): array
    {
        return ['provider' => 'zoom', 'title' => 'Sesi 1', 'scheduled_at' => now()->addDay()->toIso8601String(), 'duration_minutes' => 60, 'timezone' => 'Asia/Jakarta', ...$overrides];
    }

    private function fakeOAuth(): void
    {
        Http::fake([
            'zoom.us/oauth/token' => Http::response(['access_token' => 'test-token', 'token_type' => 'bearer', 'expires_in' => 3600]),
        ]);
    }

    private function fakeMeeting(array $meeting = []): void
    {
        $this->fakeOAuth();
        Http::fake([
            'zoom.us/oauth/token' => Http::response(['access_token' => 'test-token', 'token_type' => 'bearer', 'expires_in' => 3600]),
            'api.zoom.us/v2/users/me/meetings' => Http::response(['id' => 987654321, 'join_url' => 'https://zoom.us/j/987654321', 'start_url' => 'https://zoom.us/s/secret-host', ...$meeting]),
            'api.zoom.us/*' => Http::response(['id' => 987654321, 'join_url' => 'https://zoom.us/j/987654321', 'start_url' => 'https://zoom.us/s/secret-host']),
        ]);
    }

    public function test_oauth_token_normalization_and_auth_header(): void
    {
        $instructor = $this->instructor();
        $course = $this->course($instructor);
        $this->fakeMeeting();
        $this->actingAs($instructor, 'sanctum')->postJson("/api/v1/admin/courses/{$course->id}/live-classes", $this->payload())
            ->assertCreated()->assertJsonPath('live_class.provider_meeting_id', '987654321');
        Http::assertSent(function ($request) {
            if (!str_contains($request->url(), 'oauth/token')) return false;
            $auth = $request->header('Authorization')[0] ?? '';
            $this->assertSame('Basic ' . base64_encode('test-client:test-secret'), $auth);
            $this->assertSame('account_credentials', $request['grant_type'] ?? null);
            $this->assertSame('test-account', $request['account_id'] ?? null);
            return true;
        });
        Http::assertSent(function ($request) {
            if (!str_contains($request->url(), '/v2/users/me/meetings')) return false;
            $this->assertSame('Bearer test-token', $request->header('Authorization')[0] ?? null);
            return true;
        });
    }

    public function test_authorization_matrix(): void
    {
        $owner = $this->instructor('live-owner@example.com');
        $other = $this->instructor('live-other@example.com');
        $student = User::create(['id' => Str::lower(Str::random(12)), 'role_key' => 'student', 'name' => 'Student', 'email' => 'live-student@example.com', 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);
        $admin = User::create(['id' => Str::lower(Str::random(12)), 'role_key' => 'admin', 'name' => 'Admin', 'email' => 'live-admin@example.com', 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);
        $course = $this->course($owner);
        $this->fakeMeeting();
        $this->postJson("/api/v1/admin/courses/{$course->id}/live-classes", $this->payload())->assertUnauthorized();
        $this->actingAs($student, 'sanctum')->postJson("/api/v1/admin/courses/{$course->id}/live-classes", $this->payload())->assertForbidden();
        $this->actingAs($other, 'sanctum')->postJson("/api/v1/admin/courses/{$course->id}/live-classes", $this->payload())->assertForbidden();
        $this->actingAs($owner, 'sanctum')->postJson("/api/v1/admin/courses/{$course->id}/live-classes", $this->payload())->assertCreated();
        $this->actingAs($admin, 'sanctum')->postJson("/api/v1/admin/courses/{$course->id}/live-classes", $this->payload())->assertCreated();
        $this->assertSame(2, LiveClass::count());
    }

    public function test_create_converts_utc_to_zoom_wall_time(): void
    {
        $instructor = $this->instructor('live-walltime@example.com');
        $course = $this->course($instructor, 'livecoursewt');
        $this->fakeMeeting();
        $this->actingAs($instructor, 'sanctum')->postJson("/api/v1/admin/courses/{$course->id}/live-classes", $this->payload([
            'scheduled_at' => '2026-09-25T12:00:00Z', 'timezone' => 'Asia/Jakarta',
        ]))->assertCreated();
        Http::assertSent(function ($request) {
            if (!str_contains($request->url(), '/v2/users/me/meetings')) return false;
            $this->assertSame('2026-09-25T19:00:00', $request['start_time'] ?? null);
            $this->assertSame('Asia/Jakarta', $request['timezone'] ?? null);
            return true;
        });
    }

    public function test_title_only_update_keeps_meeting_time(): void
    {
        $instructor = $this->instructor('live-titleonly@example.com');
        $course = $this->course($instructor, 'livecourseto');
        $this->fakeMeeting();
        $id = $this->actingAs($instructor, 'sanctum')->postJson("/api/v1/admin/courses/{$course->id}/live-classes", $this->payload([
            'scheduled_at' => '2026-09-25T12:00:00Z', 'timezone' => 'Asia/Jakarta',
        ]))->assertCreated()->json('live_class.id');
        $this->actingAs($instructor, 'sanctum')->putJson("/api/v1/admin/live-classes/{$id}", ['title' => 'Renamed'])
            ->assertOk();
        $patch = collect(Http::recorded())->map(fn ($pair) => $pair[0])
            ->first(fn ($request) => str_contains($request->url(), '/v2/meetings/') && $request->method() === 'PATCH');
        $this->assertNotNull($patch);
        $this->assertSame('2026-09-25T19:00:00', $patch['start_time'] ?? null);
        $this->assertSame('Asia/Jakarta', $patch['timezone'] ?? null);
    }

    public function test_invalid_timezone_rejected_without_provider_contact(): void
    {
        $instructor = $this->instructor('live-badtz@example.com');
        $course = $this->course($instructor, 'livecoursetz');
        $this->fakeMeeting();
        foreach (['Jakarta', 'Asia/NotReal', 'not-a-zone'] as $tz) {
            $this->actingAs($instructor, 'sanctum')->postJson("/api/v1/admin/courses/{$course->id}/live-classes", $this->payload(['timezone' => $tz]))
                ->assertStatus(422);
        }
        $this->assertSame(0, LiveClass::count());
        $this->actingAs($instructor, 'sanctum')->postJson("/api/v1/admin/courses/{$course->id}/live-classes", $this->payload(['timezone' => 'UTC']))
            ->assertCreated();
        Http::assertSent(function ($request) {
            if (!str_contains($request->url(), '/v2/users/me/meetings')) return false;
            $this->assertSame('UTC', $request['timezone'] ?? null);
            return true;
        });
    }

    /**
     * R01: DB stores the canonical instant; Zoom gets the wall representation.
     * Instants compared as timestamps, never formatted local strings.
     */
    private function assertInstant(int $expectedTs, string $liveId, string $message = ''): void
    {
        $reloaded = LiveClass::findOrFail($liveId);
        $this->assertSame($expectedTs, $reloaded->scheduled_at->getTimestamp(), $message);
    }

    public function test_utc_persistence_preserves_instant(): void
    {
        $instructor = $this->instructor('live-utc@example.com');
        $course = $this->course($instructor, 'livecourseutc');
        $this->fakeMeeting();
        $id = $this->actingAs($instructor, 'sanctum')->postJson("/api/v1/admin/courses/{$course->id}/live-classes", $this->payload([
            'scheduled_at' => '2026-09-25T12:00:00Z', 'timezone' => 'UTC',
        ]))->assertCreated()->json('live_class.id');
        Http::assertSent(function ($request) {
            if (!str_contains($request->url(), '/v2/users/me/meetings')) return false;
            $this->assertSame('2026-09-25T12:00:00', $request['start_time'] ?? null);
            return true;
        });
        $this->assertInstant(strtotime('2026-09-25T12:00:00Z'), $id, 'UTC instant must survive persistence');
    }

    public function test_jakarta_persistence_preserves_instant(): void
    {
        $instructor = $this->instructor('live-jkt@example.com');
        $course = $this->course($instructor, 'livecoursejkt');
        $this->fakeMeeting();
        $id = $this->actingAs($instructor, 'sanctum')->postJson("/api/v1/admin/courses/{$course->id}/live-classes", $this->payload([
            'scheduled_at' => '2026-09-25T12:00:00Z', 'timezone' => 'Asia/Jakarta',
        ]))->assertCreated()->json('live_class.id');
        $this->assertInstant(strtotime('2026-09-25T12:00:00Z'), $id, 'Jakarta session must store the same 12:00Z instant');
        $row = LiveClass::findOrFail($id);
        $this->assertSame('Asia/Jakarta', $row->timezone);
    }

    public function test_non_app_timezone_persistence_preserves_instant(): void
    {
        $instructor = $this->instructor('live-tyo@example.com');
        $course = $this->course($instructor, 'livecoursetyo');
        $this->fakeMeeting();
        $id = $this->actingAs($instructor, 'sanctum')->postJson("/api/v1/admin/courses/{$course->id}/live-classes", $this->payload([
            'scheduled_at' => '2026-09-25T12:00:00Z', 'timezone' => 'Asia/Tokyo',
        ]))->assertCreated()->json('live_class.id');
        Http::assertSent(function ($request) {
            if (!str_contains($request->url(), '/v2/users/me/meetings')) return false;
            $this->assertSame('2026-09-25T21:00:00', $request['start_time'] ?? null);
            $this->assertSame('Asia/Tokyo', $request['timezone'] ?? null);
            return true;
        });
        $this->assertInstant(strtotime('2026-09-25T12:00:00Z'), $id, 'Tokyo session must store the same 12:00Z instant');
    }

    public function test_title_only_update_preserves_instant(): void
    {
        $instructor = $this->instructor('live-titinst@example.com');
        $course = $this->course($instructor, 'livecourseti');
        $this->fakeMeeting();
        $id = $this->actingAs($instructor, 'sanctum')->postJson("/api/v1/admin/courses/{$course->id}/live-classes", $this->payload([
            'scheduled_at' => '2026-09-25T12:00:00Z', 'timezone' => 'Asia/Jakarta',
        ]))->assertCreated()->json('live_class.id');
        $before = LiveClass::findOrFail($id)->scheduled_at->getTimestamp();
        $this->actingAs($instructor, 'sanctum')->putJson("/api/v1/admin/live-classes/{$id}", ['title' => 'Renamed again'])
            ->assertOk();
        $this->assertInstant($before, $id, 'title-only update must not shift the instant');
        $this->assertSame(strtotime('2026-09-25T12:00:00Z'), LiveClass::findOrFail($id)->scheduled_at->getTimestamp());
        $patch = collect(Http::recorded())->map(fn ($pair) => $pair[0])
            ->first(fn ($request) => str_contains($request->url(), '/v2/meetings/') && $request->method() === 'PATCH');
        $this->assertNotNull($patch);
        $this->assertSame('2026-09-25T19:00:00', $patch['start_time'] ?? null);
    }

    public function test_timezone_only_update_keeps_instant_changes_representation(): void
    {
        $instructor = $this->instructor('live-tzonly@example.com');
        $course = $this->course($instructor, 'livecoursetz2');
        $this->fakeMeeting();
        $id = $this->actingAs($instructor, 'sanctum')->postJson("/api/v1/admin/courses/{$course->id}/live-classes", $this->payload([
            'scheduled_at' => '2026-09-25T12:00:00Z', 'timezone' => 'Asia/Jakarta',
        ]))->assertCreated()->json('live_class.id');
        $this->actingAs($instructor, 'sanctum')->putJson("/api/v1/admin/live-classes/{$id}", ['timezone' => 'UTC'])
            ->assertOk()->assertJsonPath('live_class.timezone', 'UTC');
        $this->assertInstant(strtotime('2026-09-25T12:00:00Z'), $id, 'tz-only update must not shift the instant');
        $patch = collect(Http::recorded())->map(fn ($pair) => $pair[0])
            ->first(fn ($request) => str_contains($request->url(), '/v2/meetings/') && $request->method() === 'PATCH');
        $this->assertNotNull($patch);
        $this->assertSame('2026-09-25T12:00:00', $patch['start_time'] ?? null);
        $this->assertSame('UTC', $patch['timezone'] ?? null);
    }

    public function test_create_orphan_compensation_targets_new_meeting(): void
    {
        $instructor = $this->instructor('live-orphan@example.com');
        $course = $this->course($instructor, 'livecourseor');
        $this->fakeMeeting(['id' => 555666777, 'join_url' => 'https://zoom.us/j/555666777']);
        // Force local persistence failure AFTER successful Zoom creation by
        // throwing inside the creating listener (a `false` return would
        // silently abort without an exception and skip the catch path).
        LiveClass::creating(function () { throw new \RuntimeException('simulated persist failure'); });
        $response = $this->actingAs($instructor, 'sanctum')->postJson("/api/v1/admin/courses/{$course->id}/live-classes", $this->payload());
        $response->assertStatus(502);
        $this->assertSame(0, LiveClass::count());
        Http::assertSent(function ($request) {
            if ($request->method() !== 'DELETE') return false;
            $this->assertStringContainsString('555666777', $request->url());
            return true;
        });
        $this->assertStringNotContainsString('test-secret', $response->getContent());
        $this->assertStringNotContainsString('secret-host', $response->getContent());
    }

    public function test_create_update_cancel_lifecycle(): void
    {
        $instructor = $this->instructor();
        $course = $this->course($instructor);
        $this->fakeMeeting();
        $id = $this->actingAs($instructor, 'sanctum')->postJson("/api/v1/admin/courses/{$course->id}/live-classes", $this->payload())
            ->assertCreated()->json('live_class.id');
        $this->actingAs($instructor, 'sanctum')->putJson("/api/v1/admin/live-classes/{$id}", ['title' => 'Sesi 1 Updated', 'duration_minutes' => 90])
            ->assertOk()->assertJsonPath('live_class.title', 'Sesi 1 Updated')->assertJsonPath('live_class.duration_minutes', 90);
        $this->actingAs($instructor, 'sanctum')->deleteJson("/api/v1/admin/live-classes/{$id}")
            ->assertOk()->assertJsonPath('live_class.status', 'cancelled');
        $this->assertSame('cancelled', LiveClass::find($id)->status);
    }

    public function test_oauth_and_meeting_failures_map_safely(): void
    {
        $instructor = $this->instructor();
        $course = $this->course($instructor);
        Http::fake(['zoom.us/oauth/token' => Http::response(['message' => 'bad auth'], 401)]);
        $this->actingAs($instructor, 'sanctum')->postJson("/api/v1/admin/courses/{$course->id}/live-classes", $this->payload())->assertStatus(502);
        $this->assertSame(0, LiveClass::count());
        Http::fake([
            'zoom.us/oauth/token' => Http::response(['access_token' => 't', 'token_type' => 'bearer', 'expires_in' => 3600]),
            'api.zoom.us/*' => Http::response(['message' => 'boom'], 500),
        ]);
        $this->actingAs($instructor, 'sanctum')->postJson("/api/v1/admin/courses/{$course->id}/live-classes", $this->payload())->assertStatus(502);
        $this->assertSame(0, LiveClass::count());
        Http::fake([
            'zoom.us/oauth/token' => Http::response(['not_token' => true], 200),
            'api.zoom.us/*' => Http::response(['id' => 1, 'join_url' => 'x']),
        ]);
        $this->actingAs($instructor, 'sanctum')->postJson("/api/v1/admin/courses/{$course->id}/live-classes", $this->payload())->assertStatus(502);
        Http::fake([
            'zoom.us/oauth/token' => Http::response(['access_token' => 't', 'token_type' => 'bearer', 'expires_in' => 3600]),
            'api.zoom.us/*' => Http::response(['id' => 1], 200),
        ]);
        $this->actingAs($instructor, 'sanctum')->postJson("/api/v1/admin/courses/{$course->id}/live-classes", $this->payload())->assertStatus(502);
        $this->assertSame(0, LiveClass::count());
    }

    public function test_cancel_failure_stays_scheduled(): void
    {
        $instructor = $this->instructor('live-cancelfail@example.com');
        $course = $this->course($instructor, 'livecoursecf');
        Http::fake([
            'zoom.us/oauth/token' => Http::response(['access_token' => 't', 'token_type' => 'bearer', 'expires_in' => 3600]),
            'api.zoom.us/v2/users/me/meetings' => Http::response(['id' => 111222333, 'join_url' => 'https://zoom.us/j/111222333']),
            'api.zoom.us/v2/meetings/111222333' => Http::response(['message' => 'down'], 500),
        ]);
        $id = $this->actingAs($instructor, 'sanctum')->postJson("/api/v1/admin/courses/{$course->id}/live-classes", $this->payload())
            ->assertCreated()->json('live_class.id');
        $this->actingAs($instructor, 'sanctum')->deleteJson("/api/v1/admin/live-classes/{$id}")->assertStatus(502);
        $this->assertSame('scheduled', LiveClass::find($id)->status);
    }

    public function test_student_join_requires_enrollment_and_hides_secrets(): void
    {
        $instructor = $this->instructor();
        $course = $this->course($instructor);
        $student = User::create(['id' => Str::lower(Str::random(12)), 'role_key' => 'student', 'name' => 'Student', 'email' => 'live-join@example.com', 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);
        $outsider = User::create(['id' => Str::lower(Str::random(12)), 'role_key' => 'student', 'name' => 'Outsider', 'email' => 'live-outsider@example.com', 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);
        $this->fakeMeeting();
        $id = $this->actingAs($instructor, 'sanctum')->postJson("/api/v1/admin/courses/{$course->id}/live-classes", $this->payload())
            ->assertCreated()->json('live_class.id');
        $this->actingAs($outsider, 'sanctum')->getJson("/api/v1/courses/{$course->id}/live-classes")->assertForbidden();
        $this->actingAs($outsider, 'sanctum')->postJson("/api/v1/live-classes/{$id}/join")->assertForbidden();
        Enrollment::create(['id' => 'liveenroll001', 'user_id' => $student->id, 'course_id' => $course->id, 'status' => 'active']);
        $response = $this->actingAs($student, 'sanctum')->postJson("/api/v1/live-classes/{$id}/join")->assertOk();
        $response->assertJsonPath('live_class.join_url', 'https://zoom.us/j/987654321');
        $content = $response->getContent();
        $this->assertStringNotContainsString('start_url', $content);
        $this->assertStringNotContainsString('secret', $content);
        $this->assertStringNotContainsString('test-client', $content);
    }

    public function test_unpublished_course_hides_sessions(): void
    {
        $instructor = $this->instructor();
        $course = $this->course($instructor, 'livedraft001', 'draft');
        $student = User::create(['id' => Str::lower(Str::random(12)), 'role_key' => 'student', 'name' => 'Student', 'email' => 'live-draft@example.com', 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);
        $this->fakeMeeting();
        $id = $this->actingAs($instructor, 'sanctum')->postJson("/api/v1/admin/courses/{$course->id}/live-classes", $this->payload())
            ->assertCreated()->json('live_class.id');
        Enrollment::create(['id' => 'liveenroll002', 'user_id' => $student->id, 'course_id' => $course->id, 'status' => 'active']);
        $this->actingAs($student, 'sanctum')->getJson("/api/v1/courses/{$course->id}/live-classes")->assertNotFound();
        $this->actingAs($student, 'sanctum')->postJson("/api/v1/live-classes/{$id}/join")->assertNotFound();
    }
}
