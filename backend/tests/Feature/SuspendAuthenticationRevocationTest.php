<?php

namespace Tests\Feature;

use App\Models\{Role, User};
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{Auth, DB, Hash};
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class SuspendAuthenticationRevocationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $target;
    private User $other;
    private string $adminToken;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withCredentials(); // JSON requests must actually carry the fixture cookies.
        config(['session.driver' => 'database', 'session.connection' => null, 'session.table' => 'sessions', 'session.lottery' => [0, 100]]);
        foreach (['admin', 'student', 'instructor'] as $role) {
            Role::firstOrCreate(['role_key' => $role], ['id' => Str::lower(Str::random(12)), 'name' => $role, 'permissions' => []]);
        }
        Role::where('role_key', 'admin')->firstOrFail()->update(['permissions' => ['manage_students', 'manage_instructors']]);
        $this->admin = $this->user('admin');
        $this->target = $this->user('student');
        $this->other = $this->user('student');
        $this->adminToken = $this->admin->createToken('admin')->plainTextToken;
    }

    public function test_suspend_revokes_only_target_and_old_credentials_stay_invalid_after_reactivation(): void
    {
        $first = $this->sessionFor($this->target);
        $second = $this->sessionFor($this->target);
        $otherSession = $this->sessionFor($this->other);
        $adminSession = $this->sessionFor($this->admin);
        $oldRemember = $this->target->remember_token;
        $token = $this->target->createToken('phone')->plainTextToken;
        $this->target->createToken('laptop');
        $otherToken = $this->other->createToken('other')->plainTextToken;
        $otherRows = DB::table('sessions')->whereIn('id', [$otherSession, $adminSession])->orderBy('id')->get()->toJson();

        $this->bearerGet($token)->assertOk();
        $this->cookieGet($first)->assertOk()->assertJsonPath('user.id', $this->target->id);
        $this->adminUpdate(['status' => 'suspended'])->assertOk()->assertJsonPath('user.status', 'suspended');
        $this->assertSame(0, DB::table('sessions')->where('user_id', $this->target->id)->count());
        $this->assertSame(0, $this->target->tokens()->count());
        $this->assertNotSame($oldRemember, $this->target->fresh()->remember_token);
        $this->assertSame($otherRows, DB::table('sessions')->whereIn('id', [$otherSession, $adminSession])->orderBy('id')->get()->toJson());
        $this->assertSame(1, $this->other->tokens()->count());
        $this->assertSame(1, $this->admin->tokens()->count());
        $this->bearerGet($token)->assertUnauthorized();
        $this->cookieGet($second)->assertUnauthorized();

        $this->adminUpdate(['status' => 'active'])->assertOk();
        $this->bearerGet($token)->assertUnauthorized();
        $this->cookieGet($first)->assertUnauthorized();
        $this->freshRequest();
        $recaller = Auth::guard('web')->getRecallerName();
        $this->withCookie($recaller, $this->target->id . '|' . $oldRemember . '|' . $this->target->getAuthPassword())
            ->getJson('/api/v1/auth/me')->assertUnauthorized();
        $this->assertSame(0, $this->target->tokens()->count());
        $this->bearerGet($otherToken)->assertOk();
        $this->freshRequest();
        $this->postJson('/api/v1/auth/login', ['email' => $this->target->email, 'password' => 'password'])
            ->assertOk()->assertJsonPath('user.id', $this->target->id);
    }

    public static function unchangedAuthentication(): array
    {
        return [
            ['active', ['name' => 'Updated']],
            ['active', ['role_key' => 'instructor']],
            ['active', ['status' => 'active']],
            ['suspended', ['status' => 'suspended']],
            ['suspended', ['status' => 'active']],
        ];
    }

    public function test_login_accepts_mixed_case_email_saved_by_admin_update(): void
    {
        $this->adminUpdate(['email' => 'MixedCase.Login@Example.test'])->assertOk();
        $this->freshRequest();
        $this->postJson('/api/v1/auth/login', ['email' => 'MIXEDCASE.LOGIN@example.test', 'password' => 'password'])
            ->assertOk()->assertJsonPath('user.id', $this->target->id);
    }

    #[DataProvider('unchangedAuthentication')]
    public function test_updates_without_suspend_transition_preserve_authentication(string $initial, array $data): void
    {
        $this->target->update(['status' => $initial]);
        $session = $this->sessionFor($this->target);
        $token = $this->target->createToken('existing')->accessToken;
        $remember = $this->target->remember_token;
        $this->adminUpdate($data)->assertOk();
        $this->assertDatabaseHas('sessions', ['id' => $session, 'user_id' => $this->target->id]);
        $this->assertDatabaseHas('personal_access_tokens', ['id' => $token->id]);
        $this->assertSame($remember, $this->target->fresh()->remember_token);
    }

    public function test_token_delete_failure_rolls_back_status_sessions_tokens_and_remember_token(): void
    {
        $session = $this->sessionFor($this->target);
        $this->target->createToken('one');
        $this->target->createToken('two');
        $remember = $this->target->remember_token;
        $this->assertSame('sqlite', DB::connection()->getDriverName());
        DB::unprepared("CREATE TRIGGER fail_auth_revocation BEFORE DELETE ON personal_access_tokens BEGIN SELECT RAISE(ABORT, 'injected token deletion failure'); END");
        $this->withoutExceptionHandling();
        try {
            $this->adminUpdate(['status' => 'suspended']);
            $this->fail('Expected injected database failure');
        } catch (QueryException $error) {
            $this->assertStringContainsString('injected token deletion failure', $error->getMessage());
        } finally {
            DB::unprepared('DROP TRIGGER fail_auth_revocation');
        }
        $this->assertSame('active', $this->target->fresh()->status);
        $this->assertSame($remember, $this->target->fresh()->remember_token);
        $this->assertDatabaseHas('sessions', ['id' => $session, 'user_id' => $this->target->id]);
        $this->assertSame(2, $this->target->tokens()->count());
        $this->assertSame(1, $this->admin->tokens()->count());
        $this->adminUpdate(['status' => 'suspended'])->assertOk();
        $this->assertSame(0, $this->target->tokens()->count());
        $this->assertDatabaseMissing('sessions', ['id' => $session]);
    }

    public function test_self_suspend_invalidates_current_admin_session_without_recreating_login(): void
    {
        $session = $this->sessionFor($this->admin);
        $otherSession = $this->sessionFor($this->other);
        $this->freshRequest();
        // Cookie-authenticated mutations must carry the session CSRF token (A-02).
        $csrf = json_decode(base64_decode(DB::table('sessions')->where('id', $session)->value('payload')), true)['_token'];
        $this->withCookie(config('session.cookie'), $session)->withHeader('X-CSRF-TOKEN', $csrf)
            ->putJson('/api/v1/admin/users/' . $this->admin->id, ['status' => 'suspended'])
            ->assertOk()->assertJsonPath('user.status', 'suspended');
        $this->assertSame(0, DB::table('sessions')->where('user_id', $this->admin->id)->count());
        $this->assertSame(0, $this->admin->tokens()->count());
        $this->assertDatabaseHas('sessions', ['id' => $otherSession]);
        $this->cookieGet($session)->assertUnauthorized();
        $this->bearerGet($this->adminToken)->assertUnauthorized();
    }

    private function user(string $role): User
    {
        $user = User::create(['id' => Str::lower(Str::random(12)), 'role_key' => $role, 'name' => 'Fixture',
            'email' => Str::lower(Str::random(12)) . '@example.test', 'password_hash' => Hash::make('password'), 'status' => 'active']);
        $user->setRememberToken(Str::random(60));
        $user->save();
        return $user;
    }

    private function sessionFor(User $user): string
    {
        $id = Str::random(40);
        $payload = [Auth::guard('web')->getName() => $user->id, '_token' => Str::random(40)];
        DB::table('sessions')->insert(['id' => $id, 'user_id' => $user->id,
            'payload' => base64_encode(json_encode($payload)), 'last_activity' => time()]);
        return $id;
    }

    private function freshRequest(): void
    {
        // Reset in-process guard/session caches; exercise real guards, not actingAs.
        $this->app['session']->driver()->flush();
        Auth::forgetGuards();
        $this->app->forgetInstance('auth.driver');
        $this->app['session']->forgetDrivers();
        $this->app->forgetInstance('session.store');
        $this->app->forgetInstance(\Illuminate\Session\Middleware\StartSession::class);
        $this->defaultCookies = [];
        $this->flushHeaders();
    }

    private function adminUpdate(array $data): TestResponse
    {
        $this->freshRequest();
        return $this->withToken($this->adminToken)->putJson('/api/v1/admin/users/' . $this->target->id, $data);
    }

    private function bearerGet(string $token): TestResponse
    {
        $this->freshRequest();
        return $this->withToken($token)->getJson('/api/v1/notifications');
    }

    private function cookieGet(string $id): TestResponse
    {
        $this->freshRequest();
        return $this->withCookie(config('session.cookie'), $id)->getJson('/api/v1/auth/me');
    }
}
