<?php

namespace Tests\Feature;

use App\Models\{Course, Enrollment, Lesson, Section, Setting, User};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{Auth, DB, Hash};
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * T-01: exercises the real cookie-session path (database session + cookie, guards reset per
 * request) instead of actingAs(), which previously hid A-02/A-03/A-04 regressions.
 */
class CookieSessionRegressionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
        $this->withCredentials();
        config(['session.driver' => 'database', 'session.connection' => null, 'session.table' => 'sessions', 'session.lottery' => [0, 100]]);
    }

    private function user(string $role, string $email): User
    {
        return User::create(['id' => Str::lower(Str::random(12)), 'role_key' => $role, 'name' => ucfirst($role), 'email' => $email,
            'password_hash' => Hash::make('password'), 'status' => 'active', 'instructor_approved' => true]);
    }

    /** Stores a logged-in session row and returns [session id, csrf token]. */
    private function sessionFor(User $user): array
    {
        $id = Str::random(40);
        $token = Str::random(40);
        DB::table('sessions')->insert(['id' => $id, 'user_id' => $user->id, 'last_activity' => time(),
            'payload' => base64_encode(json_encode([Auth::guard('web')->getName() => $user->id, '_token' => $token]))]);
        return [$id, $token];
    }

    private function fresh(): void
    {
        Auth::forgetGuards();
        $this->app->forgetInstance('auth.driver');
        $this->app['session']->forgetDrivers();
        $this->app->forgetInstance('session.store');
        $this->defaultCookies = [];
        $this->flushHeaders();
    }

    private function asCookie(string $sessionId): static
    {
        $this->fresh();
        return $this->withCookie(config('session.cookie'), $sessionId);
    }

    public function test_enrolled_student_sees_paid_lesson_content_through_cookie_session(): void
    {
        $instructor = $this->user('instructor', 'ci@example.com');
        $student = $this->user('student', 'cs@example.com');
        $course = Course::create(['id' => 'cookiecourse', 'slug' => 'cookie-course', 'instructor_id' => $instructor->id, 'title' => 'Cookie', 'price' => 100000, 'status' => 'published']);
        $section = Section::create(['id' => 'cookiesect01', 'course_id' => $course->id, 'title' => 'S', 'sort' => 0]);
        Lesson::create(['id' => 'cookielesson', 'course_id' => $course->id, 'section_id' => $section->id, 'title' => 'L', 'type' => 'text', 'content' => '<p>PAID-BODY</p>', 'status' => 'published', 'preview' => false, 'sort' => 0]);

        $this->fresh();
        $this->getJson('/api/v1/courses/cookie-course')->assertOk()->assertJsonPath('course.enrolled', false)->assertJsonPath('course.sections.0.lessons.0.content', null);

        Enrollment::create(['id' => 'cookieenroll', 'user_id' => $student->id, 'course_id' => $course->id, 'status' => 'active', 'progress_pct' => 0]);
        [$session] = $this->sessionFor($student);
        $this->asCookie($session)->getJson('/api/v1/courses/cookie-course')->assertOk()
            ->assertJsonPath('course.enrolled', true)->assertJsonPath('course.sections.0.lessons.0.content', '<p>PAID-BODY</p>');
    }

    public function test_cookie_mutations_require_csrf_but_bearer_tokens_do_not(): void
    {
        $student = $this->user('student', 'csrf@example.com');
        [$session, $token] = $this->sessionFor($student);
        $this->asCookie($session)->putJson('/api/v1/profile', ['name' => 'No Token'])->assertStatus(419);
        $this->assertNotSame('No Token', $student->fresh()->name);
        $this->asCookie($session)->withHeader('X-CSRF-TOKEN', $token)->putJson('/api/v1/profile', ['name' => 'With Token'])->assertOk();
        $this->assertSame('With Token', $student->fresh()->name);
        // The SPA echoes the encrypted XSRF-TOKEN cookie; it must decrypt to the session token.
        $xsrf = app('encrypter')->encrypt(\Illuminate\Cookie\CookieValuePrefix::create('XSRF-TOKEN', app('encrypter')->getKey()) . $token, false);
        $this->asCookie($session)->withHeader('X-XSRF-TOKEN', $xsrf)->putJson('/api/v1/profile', ['name' => 'Via Xsrf'])->assertOk();
        $this->asCookie($session)->withHeader('X-XSRF-TOKEN', 'forged')->putJson('/api/v1/profile', ['name' => 'Forged'])->assertStatus(419);
        $this->assertSame('Via Xsrf', $student->fresh()->name);

        $bearer = $student->createToken('app')->plainTextToken;
        $this->fresh();
        $this->withToken($bearer)->putJson('/api/v1/profile', ['name' => 'Bearer'])->assertOk();
    }

    public function test_maintenance_blocks_visitors_but_not_admin_cookie_sessions(): void
    {
        $admin = $this->user('admin', 'madmin@example.com');
        $student = $this->user('student', 'mstudent@example.com');
        Setting::updateOrCreate(['setting_key' => 'maintenance_mode'], ['setting_value' => '1']);
        [$adminSession, $adminToken] = $this->sessionFor($admin);
        [$studentSession] = $this->sessionFor($student);

        $this->asCookie($studentSession)->getJson('/api/v1/dashboard/summary')->assertStatus(503);
        $this->asCookie($adminSession)->getJson('/api/v1/dashboard/summary')->assertOk();
        // The admin must be able to switch maintenance off again (no lock-out).
        $super = $this->user('super_admin', 'mroot@example.com');
        [$superSession, $superToken] = $this->sessionFor($super);
        $this->asCookie($superSession)->withHeader('X-CSRF-TOKEN', $superToken)->putJson('/api/v1/settings', ['key' => 'maintenance_mode', 'value' => '0'])->assertOk();
        $this->assertSame('0', Setting::where('setting_key', 'maintenance_mode')->value('setting_value'));
    }
}
