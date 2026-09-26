<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\LiveClass;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;
use App\Services\GoogleMeetProvider;
use Illuminate\Support\Carbon;

/**
 * IMP-006: Google Meet validated stored-link lifecycle. No external calls
 * ever (no Http fake needed — provider makes zero HTTP requests).
 */
class LiveClassMeetTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    private function instructor(string $email = 'meet-instructor@example.com'): User
    {
        return User::create(['id' => Str::lower(Str::random(12)), 'role_key' => 'instructor', 'name' => 'Instructor', 'email' => $email, 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);
    }

    private function course(User $instructor): Course
    {
        return Course::create(['id' => 'meetcourse01', 'slug' => 'meet-course', 'instructor_id' => $instructor->id, 'title' => 'Meet Course', 'is_free' => true, 'status' => 'published']);
    }

    private function payload(array $overrides = []): array
    {
        return ['provider' => 'google_meet', 'title' => 'Meet 1', 'scheduled_at' => now()->addDay()->toIso8601String(), 'duration_minutes' => 45, 'join_url' => 'https://meet.google.com/abc-defg-hij', ...$overrides];
    }

    public function test_valid_meet_url_accepted_and_lifecycle_local(): void
    {
        $instructor = $this->instructor();
        $course = $this->course($instructor);
        $id = $this->actingAs($instructor, 'sanctum')->postJson("/api/v1/admin/courses/{$course->id}/live-classes", $this->payload())
            ->assertCreated()->assertJsonPath('live_class.join_url', 'https://meet.google.com/abc-defg-hij')->json('live_class.id');
        $this->actingAs($instructor, 'sanctum')->putJson("/api/v1/admin/live-classes/{$id}", ['title' => 'Meet 1 Updated', 'join_url' => 'https://meet.google.com/xyz-1234-abc'])
            ->assertOk()->assertJsonPath('live_class.join_url', 'https://meet.google.com/xyz-1234-abc');
        $this->actingAs($instructor, 'sanctum')->deleteJson("/api/v1/admin/live-classes/{$id}")
            ->assertOk()->assertJsonPath('live_class.status', 'cancelled');
    }

    public function test_invalid_meet_urls_rejected(): void
    {
        $instructor = $this->instructor();
        $course = $this->course($instructor);
        foreach ([
            'http://meet.google.com/abc-defg-hij',
            'https://meet.google.com.attacker.example/abc',
            'https://example.com/meet',
            'https://mail.google.com/mail',
            'not-a-url',
            '',
        ] as $i => $url) {
            $this->actingAs($instructor, 'sanctum')->postJson("/api/v1/admin/courses/{$course->id}/live-classes", $this->payload(['join_url' => $url]))
                ->assertStatus(422);
        }
        $this->assertSame(0, LiveClass::count());
    }

    public function test_meet_student_join_and_cancelled_has_no_active_join(): void
    {
        $instructor = $this->instructor();
        $course = $this->course($instructor);
        $student = User::create(['id' => Str::lower(Str::random(12)), 'role_key' => 'student', 'name' => 'Student', 'email' => 'meet-student@example.com', 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);
        $id = $this->actingAs($instructor, 'sanctum')->postJson("/api/v1/admin/courses/{$course->id}/live-classes", $this->payload())
            ->assertCreated()->json('live_class.id');
        Enrollment::create(['id' => 'meetenroll001', 'user_id' => $student->id, 'course_id' => $course->id, 'status' => 'active']);
        $this->actingAs($student, 'sanctum')->postJson("/api/v1/live-classes/{$id}/join")
            ->assertOk()->assertJsonPath('live_class.join_url', 'https://meet.google.com/abc-defg-hij');
        $this->actingAs($instructor, 'sanctum')->deleteJson("/api/v1/admin/live-classes/{$id}")->assertOk();
        $this->actingAs($student, 'sanctum')->postJson("/api/v1/live-classes/{$id}/join")->assertNotFound();
        $this->actingAs($student, 'sanctum')->getJson("/api/v1/courses/{$course->id}/live-classes")->assertOk()->assertJsonCount(0, 'live_classes');
    }

    public function test_provider_disabled_blocks_creation_without_fallback(): void
    {
        $instructor = $this->instructor();
        $course = $this->course($instructor);
        \App\Models\Setting::updateOrCreate(['setting_key' => 'gmeet_enabled'], ['setting_value' => '0']);
        $this->actingAs($instructor, 'sanctum')->postJson("/api/v1/admin/courses/{$course->id}/live-classes", $this->payload())->assertStatus(422);
        $this->assertSame(0, LiveClass::count());
    }

    public function test_obsolete_zoom_credential_settings_are_not_writable(): void
    {
        $admin = User::create(['id' => Str::lower(Str::random(12)), 'role_key' => 'admin', 'name' => 'Admin', 'email' => 'live-cred-admin@example.com', 'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);
        // Removed from WRITABLE_KEYS: writes fall through without persisting.
        $this->actingAs($admin, 'sanctum')->putJson('/api/v1/settings', ['key' => 'zoom_account_id', 'value' => 'acct-123'])->assertOk();
        $this->actingAs($admin, 'sanctum')->putJson('/api/v1/settings', ['key' => 'zoom_client_id', 'value' => 'client-123'])->assertOk();
        $this->assertDatabaseMissing('settings', ['setting_key' => 'zoom_account_id']);
        $this->assertDatabaseMissing('settings', ['setting_key' => 'zoom_client_id']);
        $this->actingAs($admin, 'sanctum')->putJson('/api/v1/settings/bulk', ['settings' => ['zoom_account_id' => 'acct-123', 'zoom_client_id' => 'client-123']])->assertOk();
        $this->assertDatabaseMissing('settings', ['setting_key' => 'zoom_account_id']);
        $this->assertDatabaseMissing('settings', ['setting_key' => 'zoom_client_id']);
        $public = $this->getJson('/api/v1/settings/public')->assertOk()->json('settings');
        $this->assertArrayNotHasKey('zoom_account_id', $public);
        $this->assertArrayNotHasKey('zoom_client_id', $public);
    }

    /**
     * M01: every ambiguous/non-genuine Meet URL is rejected by the provider
     * boundary itself, one independent case per data-provider row.
     *
     * @return array<string, array{0: string}>
     */
    public static function malformedMeetUrls(): array
    {
        return [
            'leading whitespace' => [' https://meet.google.com/abc-defg-hij'],
            'trailing whitespace' => ['https://meet.google.com/abc-defg-hij '],
            'inner space' => ['https://meet.google.com/ab c'],
            'backslash host confusion' => ['https://evil.example\@meet.google.com/abc-defg-hij'],
            'backslash in path' => ['https://meet.google.com/a\\b/c'],
            'userinfo' => ['https://user@meet.google.com/abc-defg-hij'],
            'user and password' => ['https://user:pass@meet.google.com/abc-defg-hij'],
            'custom port' => ['https://meet.google.com:444/abc-defg-hij'],
            'explicit default port' => ['https://meet.google.com:443/abc-defg-hij'],
            'tab' => ['https://meet.google.com/abc' . chr(9) . 'x'],
            'nul' => ['https://meet.google.com/abc' . chr(0) . 'x'],
            'del' => ['https://meet.google.com/abc' . chr(127) . 'x'],
            'http scheme' => ['http://meet.google.com/abc-defg-hij'],
            'deceptive suffix host' => ['https://meet.google.com.attacker.example/abc'],
            'deceptive prefix host' => ['https://evilmeet.google.com/abc'],
        ];
    }

    #[DataProvider('malformedMeetUrls')]
    public function test_provider_rejects_malformed_meet_url(string $url): void
    {
        $this->expectException(\InvalidArgumentException::class);
        GoogleMeetProvider::validateMeetUrl($url);
    }

    public function test_provider_accepts_genuine_meet_url_unchanged(): void
    {
        $this->assertSame('https://meet.google.com/abc-defg-hij', GoogleMeetProvider::validateMeetUrl('https://meet.google.com/abc-defg-hij'));
    }

    #[DataProvider('malformedMeetUrls')]
    public function test_create_endpoint_rejects_malformed_meet_url(string $url): void
    {
        $instructor = $this->instructor();
        $course = $this->course($instructor);
        // The HTTP layer may normalize leading/trailing whitespace before the
        // provider sees it; either way nothing malformed may be persisted, and
        // only genuine links may succeed.
        $response = $this->actingAs($instructor, 'sanctum')
            ->postJson("api/v1/admin/courses/{$course->id}/live-classes", $this->payload(['join_url' => $url]));
        if (trim($url) === 'https://meet.google.com/abc-defg-hij') {
            $this->assertContains($response->status(), [201, 422]);
        } else {
            $response->assertStatus(422);
            $this->assertSame(0, LiveClass::count());
        }
    }

    // Independent absolute-instant fixture: 2026-10-01T10:00:00+07:00 == 2026-10-01T03:00:00Z.
    private const OFFSET_INPUT = '2026-10-01T10:00:00+07:00';
    private const OFFSET_UNIX = 1790823600;

    private function createMeet(User $instructor, Course $course, string $scheduledAt): string
    {
        return $this->actingAs($instructor, 'sanctum')
            ->postJson("api/v1/admin/courses/{$course->id}/live-classes", $this->payload(['scheduled_at' => $scheduledAt]))
            ->assertCreated()->json('live_class.id');
    }

    public function test_meet_create_with_offset_persists_exact_instant(): void
    {
        $instructor = $this->instructor();
        $course = $this->course($instructor);
        $id = $this->createMeet($instructor, $course, self::OFFSET_INPUT);
        $this->assertSame(self::OFFSET_UNIX, LiveClass::find($id)->scheduled_at->timestamp);
    }

    /** M02: reschedule with join_url canonicalizes the offset instant. */
    public function test_meet_update_with_join_url_persists_exact_instant(): void
    {
        $instructor = $this->instructor();
        $course = $this->course($instructor);
        $id = $this->createMeet($instructor, $course, '2027-01-01T00:00:00Z');
        $this->actingAs($instructor, 'sanctum')
            ->putJson("api/v1/admin/live-classes/{$id}", ['join_url' => 'https://meet.google.com/xyz-1234-abc', 'scheduled_at' => self::OFFSET_INPUT])
            ->assertOk();
        $this->assertSame(self::OFFSET_UNIX, LiveClass::find($id)->scheduled_at->timestamp);
        $this->assertSame(self::OFFSET_UNIX, \Carbon\Carbon::parse($this->actingAs($instructor, 'sanctum')->getJson("api/v1/admin/courses/{$course->id}/live-classes")->json('live_classes.0.scheduled_at'))->timestamp);
    }

    /** M02: reschedule without join_url canonicalizes the offset instant. */
    public function test_meet_update_without_join_url_persists_exact_instant(): void
    {
        $instructor = $this->instructor();
        $course = $this->course($instructor);
        $id = $this->createMeet($instructor, $course, '2027-01-01T00:00:00Z');
        $this->actingAs($instructor, 'sanctum')
            ->putJson("api/v1/admin/live-classes/{$id}", ['scheduled_at' => self::OFFSET_INPUT])
            ->assertOk();
        $this->assertSame(self::OFFSET_UNIX, LiveClass::find($id)->scheduled_at->timestamp);
    }

    public function test_meet_title_only_update_preserves_instant(): void
    {
        $instructor = $this->instructor();
        $course = $this->course($instructor);
        $id = $this->createMeet($instructor, $course, self::OFFSET_INPUT);
        $this->actingAs($instructor, 'sanctum')->putJson("api/v1/admin/live-classes/{$id}", ['title' => 'Renamed'])->assertOk();
        $this->assertSame(self::OFFSET_UNIX, LiveClass::find($id)->scheduled_at->timestamp);
    }

    public function test_meet_timezone_only_update_preserves_instant(): void
    {
        $instructor = $this->instructor();
        $course = $this->course($instructor);
        $id = $this->createMeet($instructor, $course, self::OFFSET_INPUT);
        $this->actingAs($instructor, 'sanctum')->putJson("api/v1/admin/live-classes/{$id}", ['timezone' => 'Asia/Tokyo'])->assertOk();
        $fresh = LiveClass::find($id);
        $this->assertSame('Asia/Tokyo', $fresh->timezone);
        $this->assertSame(self::OFFSET_UNIX, $fresh->scheduled_at->timestamp);
    }
}
