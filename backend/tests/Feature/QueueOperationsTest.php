<?php

namespace Tests\Feature;

use App\Mail\PasswordResetMail;
use App\Models\User;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Mail\MailManager;
use Illuminate\Mail\SendQueuedMailable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Str;
use Tests\TestCase;

class QueueOperationsTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $email = 'queue@example.com'): User
    {
        return User::create(['id' => Str::lower(Str::random(12)), 'role_key' => 'student', 'name' => 'Queue User', 'email' => $email, 'password_hash' => Hash::make('old-password'), 'status' => 'active', 'instructor_approved' => true]);
    }

    private function requestReset(string $email = 'queue@example.com'): void
    {
        $this->withoutMiddleware(PreventRequestForgery::class)
            ->postJson('/api/v1/auth/forgot-password', ['email' => $email])->assertOk();
    }

    private function queuedMail(): PasswordResetMail
    {
        $found = null;
        Mail::assertQueued(PasswordResetMail::class, function (PasswordResetMail $mail) use (&$found) {
            $found = $mail;
            return true;
        });
        return $found;
    }

    public function test_reset_mail_is_queued_only_for_existing_user_with_retry_policy(): void
    {
        $this->seed();
        Mail::fake();
        $this->requestReset('missing@example.com');
        Mail::assertNothingQueued();

        $this->user();
        $this->requestReset();
        Mail::assertQueuedCount(1);
        Mail::assertNothingSent();

        $mail = $this->queuedMail();
        $this->assertTrue($mail->hasTo('queue@example.com'));
        $this->assertInstanceOf(ShouldBeEncrypted::class, $mail);
        $this->assertGreaterThan(1, $mail->tries);
        $this->assertNotEmpty($mail->backoff());
        $this->assertLessThan((int) config('queue.connections.database.retry_after'), $mail->timeout);
        $this->assertLessThan((int) config('queue.connections.redis.retry_after'), $mail->timeout);
        // Connection is not hardcoded: the job follows QUEUE_CONNECTION.
        $this->assertNull($mail->connection);
    }

    public function test_database_queue_stores_encrypted_payload_without_plain_token(): void
    {
        $this->seed();
        config(['queue.default' => 'database']);
        $this->user();
        $this->requestReset();

        $this->assertSame(1, DB::table('jobs')->count());
        $payload = DB::table('jobs')->value('payload');
        $this->assertStringNotContainsString('reset-password?email', $payload);
        $this->assertStringNotContainsString('queue@example.com', $payload);
    }

    public function test_queue_connection_follows_config_for_redis_without_contacting_redis(): void
    {
        $this->seed();
        config(['queue.default' => 'redis']);
        Queue::fake();
        $this->user();
        $this->requestReset();

        Queue::assertPushed(SendQueuedMailable::class, fn (SendQueuedMailable $job) => $job->connection === null && $job->shouldBeEncrypted);
    }

    /** A real (array transport) mailer, independent of Mail::fake(). */
    private function arrayMailer(): array
    {
        $manager = new MailManager($this->app);
        return [$manager, fn () => $manager->mailer('array')->getSymfonyTransport()->messages()->count()];
    }

    public function test_retry_after_successful_send_does_not_send_twice(): void
    {
        $this->seed();
        Mail::fake();
        $this->user();
        $this->requestReset();
        $mail = $this->queuedMail();

        [$manager, $sent] = $this->arrayMailer();
        $mail->send($manager);
        $this->assertSame(1, $sent());
        $mail->send($manager); // same job retried (e.g. worker killed after SMTP accepted)
        $this->assertSame(1, $sent());
    }

    public function test_stale_or_consumed_token_is_not_mailed_on_retry(): void
    {
        $this->seed();
        Mail::fake();
        $this->user();
        $this->requestReset();
        $first = $this->queuedMail();
        [$manager, $sent] = $this->arrayMailer();

        // A newer request supersedes the first link.
        $this->travel(1)->seconds();
        $this->requestReset();
        $first->send($manager);
        $this->assertSame(0, $sent());

        // Expired or consumed tokens are never delivered by a late retry.
        $latest = null;
        Mail::assertQueued(PasswordResetMail::class, function (PasswordResetMail $mail) use (&$latest) { $latest = $mail; return true; });
        $this->travel(61)->minutes();
        $latest->send($manager);
        $this->assertSame(0, $sent());
        $this->travelBack();
        DB::table('password_reset_tokens')->delete();
        $latest->send($manager);
        $this->assertSame(0, $sent());
    }

    public function test_worker_failure_is_logged_without_reset_token(): void
    {
        $this->seed();
        Mail::fake();
        $this->user();
        $this->requestReset();
        $mail = $this->queuedMail();

        Log::shouldReceive('warning')->once()->withArgs(function (string $message, array $context) {
            $encoded = json_encode($context);
            return str_contains($message, 'Password reset mail')
                && !str_contains($encoded, 'token=') && !str_contains($encoded, 'queue@example.com');
        });
        (new SendQueuedMailable($mail))->failed(new \RuntimeException('SMTP down'));
    }

    public function test_failed_job_storage_is_configured_on_database(): void
    {
        $this->assertSame('database-uuids', config('queue.failed.driver'));
        $this->assertTrue(\Schema::hasTable(config('queue.failed.table')));
        $this->assertTrue(\Schema::hasTable('jobs'));
    }

    public function test_dispatch_failure_is_reported_but_response_stays_generic(): void
    {
        $this->seed();
        $this->user();
        Exceptions::fake();
        Mail::shouldReceive('to')->andThrow(new \RuntimeException('queue backend unavailable'));

        $this->requestReset();
        Exceptions::assertReported(\RuntimeException::class);
    }

    public function test_scheduler_registers_reclaim_once_and_ops_tasks(): void
    {
        $events = collect(app(Schedule::class)->events());
        $commands = $events->map(fn ($event) => (string) $event->command);

        $reclaim = $commands->filter(fn ($c) => str_contains($c, 'vouchers:reclaim-reservations'));
        $this->assertCount(1, $reclaim);
        $reclaimEvent = $events->first(fn ($e) => str_contains((string) $e->command, 'vouchers:reclaim-reservations'));
        $this->assertTrue($reclaimEvent->withoutOverlapping);

        $this->assertCount(1, $commands->filter(fn ($c) => str_contains($c, 'queue:prune-failed')));
        $this->assertCount(1, $events->filter(fn ($e) => $e->description === 'ops:scheduler-heartbeat'));

        $worker = $events->first(fn ($e) => str_contains((string) $e->command, 'queue:work'));
        $this->assertNotNull($worker);
        $this->assertStringContainsString('--stop-when-empty', (string) $worker->command);
        $this->assertTrue($worker->withoutOverlapping);

        config(['queue.scheduler_worker.enabled' => false]);
        $this->assertFalse($worker->filtersPass($this->app));
        config(['queue.scheduler_worker.enabled' => true, 'queue.default' => 'database']);
        $this->assertTrue($worker->filtersPass($this->app));
        config(['queue.default' => 'sync']);
        $this->assertFalse($worker->filtersPass($this->app));
    }

    public function test_production_check_warns_on_sync_queue_without_failing_it(): void
    {
        config(['queue.default' => 'sync']);
        $this->artisan('production:check')
            ->expectsOutputToContain('WARN Queue connection is sync')
            ->doesntExpectOutputToContain('FAIL Queue');
    }

    public function test_production_check_passes_with_warnings_only(): void
    {
        $this->app['env'] = 'production';
        config([
            'app.debug' => false, 'app.url' => 'https://example.test', 'payment.mode' => 'sandbox',
            'queue.default' => 'sync', 'mail.default' => 'log', 'cache.default' => 'array',
        ]);
        $this->artisan('production:check')
            ->expectsOutputToContain('WARN Mail mailer is log')
            ->expectsOutputToContain('WARN Scheduler heartbeat')
            ->assertExitCode(0);

        $this->artisan('production:check', ['--strict' => true])->assertExitCode(1);
    }

    public function test_production_check_fails_when_configured_redis_is_unreachable(): void
    {
        config(['queue.default' => 'redis']);
        Redis::shouldReceive('connection')->andThrow(new \RuntimeException('Connection refused'));

        $this->artisan('production:check')
            ->expectsOutputToContain('FAIL Queue backend reachable (redis)')
            ->assertExitCode(1);
    }

    public function test_production_check_warns_about_failed_and_stale_jobs(): void
    {
        config(['queue.default' => 'database']);
        DB::table('failed_jobs')->insert(['uuid' => (string) Str::uuid(), 'connection' => 'database', 'queue' => 'default', 'payload' => '{}', 'exception' => 'x', 'failed_at' => now()]);
        DB::table('jobs')->insert(['queue' => 'default', 'payload' => '{}', 'attempts' => 0, 'reserved_at' => null, 'available_at' => now()->subHour()->timestamp, 'created_at' => now()->subHour()->timestamp]);

        $this->artisan('production:check')
            ->expectsOutputToContain('WARN 1 failed job(s)')
            ->expectsOutputToContain('WARN Oldest pending job');
    }
}
