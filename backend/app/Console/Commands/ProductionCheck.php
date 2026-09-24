<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * FAIL = the application cannot work correctly as configured (exit code 1).
 * WARN = it works, but the configuration or operations need attention (exit 0; 1 with --strict).
 * INFO = recommendation only.
 */
class ProductionCheck extends Command
{
    protected $signature = 'production:check {--strict : Treat warnings as failures}';
    protected $description = 'Check production configuration, queue/scheduler operations and required application resources';

    private const HEARTBEAT_STALE_SECONDS = 300;
    private const PENDING_JOB_STALE_SECONDS = 600;

    private int $failed = 0;
    private int $warnings = 0;

    public function handle(): int
    {
        $database = $this->databaseAvailable();
        $checks = [
            'APP_ENV=production' => app()->environment('production'),
            'APP_DEBUG=false' => !config('app.debug'),
            'APP_KEY configured' => filled(config('app.key')),
            'APP_URL uses HTTPS' => str_starts_with((string) config('app.url'), 'https://'),
            'Database connection' => $database,
            'Storage link' => file_exists(public_path('storage')),
            'Payment mode configured' => in_array(config('payment.mode'), ['sandbox', 'live'], true),
            'Cache store usable (' . config('cache.default') . ')' => $this->cacheUsable(),
            'Queue backend reachable (' . config('queue.default') . ')' => $this->queueBackendReachable($database),
            'Failed job storage available' => $this->failedJobStorageAvailable($database),
        ];
        if (config('session.driver') === 'redis') {
            $checks['Session backend reachable (redis)'] = $this->redisReachable(config('session.connection') ?: 'default');
        }
        foreach ($checks as $label => $passed) {
            $this->result($passed, $label);
        }

        $this->operationalWarnings($database);

        $this->newLine();
        if ($this->failed > 0) {
            $this->line("{$this->failed} production check(s) failed, {$this->warnings} warning(s).");
            return self::FAILURE;
        }
        if ($this->warnings > 0) {
            $this->line("<info>Production checks passed</info> with {$this->warnings} warning(s).");
            return $this->option('strict') ? self::FAILURE : self::SUCCESS;
        }
        $this->line('<info>Production checks passed.</info>');
        return self::SUCCESS;
    }

    private function operationalWarnings(bool $database): void
    {
        $queue = (string) config('queue.default');
        if ($queue === 'sync') {
            $this->warning('Queue connection is sync — password reset emails are sent inside the HTTP request. Use QUEUE_CONNECTION=redis (recommended) or database with a worker/cron.');
        } elseif ($queue !== 'redis') {
            $this->line("INFO Queue connection is {$queue} — Redis is recommended for production when available.");
        }
        $cache = (string) config('cache.default');
        if (in_array($cache, ['array', 'null'], true)) {
            $this->warning("Cache store is {$cache} — not shared between processes, so scheduler locks and the heartbeat cannot work.");
        } elseif ($cache !== 'redis') {
            $this->line("INFO Cache store is {$cache} — Redis is recommended for production when available.");
        }
        if (in_array(config('mail.default'), ['log', 'array'], true)) {
            $this->warning('Mail mailer is ' . config('mail.default') . ' — password reset emails are not delivered. Configure MAIL_MAILER=smtp.');
        }

        $heartbeat = $this->cacheValue('ops:scheduler-heartbeat');
        if (!$heartbeat) {
            $this->warning('Scheduler heartbeat not found — add the cron entry "* * * * * php artisan schedule:run" (voucher reclaim and queue fallback depend on it).');
        } elseif (now()->timestamp - (int) $heartbeat > self::HEARTBEAT_STALE_SECONDS) {
            $this->warning('Scheduler heartbeat is stale (' . intdiv(now()->timestamp - (int) $heartbeat, 60) . ' minute(s) old) — cron may have stopped.');
        } else {
            $this->line('<info>PASS</info> Scheduler heartbeat recent');
        }

        if (!$database) return;
        try {
            if (Schema::hasTable((string) config('queue.failed.table', 'failed_jobs'))) {
                $failed = DB::table((string) config('queue.failed.table', 'failed_jobs'))->count();
                if ($failed > 0) $this->warning("{$failed} failed job(s) — inspect with \"php artisan queue:failed\", then retry or forget.");
            }
            $jobsTable = (string) config('queue.connections.database.table', 'jobs');
            if ($queue === 'database' && Schema::hasTable($jobsTable)) {
                $oldest = DB::table($jobsTable)->whereNull('reserved_at')->min('available_at');
                if ($oldest && now()->timestamp - (int) $oldest > self::PENDING_JOB_STALE_SECONDS) {
                    $this->warning('Oldest pending job waits ' . intdiv(now()->timestamp - (int) $oldest, 60) . ' minute(s) — no worker or scheduler worker seems to be running.');
                }
            }
        } catch (\Throwable) {
            $this->warning('Queue statistics unavailable.');
        }
    }

    private function result(bool $passed, string $label): void
    {
        if ($passed) {
            $this->line("<info>PASS</info> $label");
            return;
        }
        $this->error("FAIL $label");
        $this->failed++;
    }

    private function warning(string $message): void
    {
        $this->warn("WARN $message");
        $this->warnings++;
    }

    private function databaseAvailable(): bool
    {
        try { DB::connection()->getPdo(); return Schema::hasTable('users'); }
        catch (\Throwable) { return false; }
    }

    private function cacheUsable(): bool
    {
        try {
            $key = 'ops:production-check:' . Str::random(8);
            Cache::put($key, 'ok', 10);
            $ok = Cache::get($key) === 'ok';
            Cache::forget($key);
            return $ok;
        } catch (\Throwable) {
            return false;
        }
    }

    private function cacheValue(string $key): mixed
    {
        try { return Cache::get($key); }
        catch (\Throwable) { return null; }
    }

    private function queueBackendReachable(bool $database): bool
    {
        $name = (string) config('queue.default');
        $connection = (array) config("queue.connections.{$name}", []);
        return match ($connection['driver'] ?? null) {
            'sync', 'null' => true,
            'database' => $database && $this->tableExists($connection['table'] ?? 'jobs'),
            'redis' => $this->redisReachable($connection['connection'] ?? 'default'),
            default => filled($connection),
        };
    }

    private function failedJobStorageAvailable(bool $database): bool
    {
        return match (config('queue.failed.driver')) {
            'database', 'database-uuids' => $database && $this->tableExists((string) config('queue.failed.table', 'failed_jobs')),
            default => true,
        };
    }

    private function tableExists(string $table): bool
    {
        try { return Schema::hasTable($table); }
        catch (\Throwable) { return false; }
    }

    private function redisReachable(string $connection): bool
    {
        try { Redis::connection($connection)->ping(); return true; }
        catch (\Throwable) { return false; }
    }
}
