<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// All tasks run from one cron entry: * * * * * php artisan schedule:run (see docs/operations-queue-scheduler.md).

// Release expired voucher reservations. Safe to re-run; lazy reclaim on checkout/validation stays.
// Overlap lock expires after 55 minutes so a crashed run cannot block the next hours.
Schedule::command('vouchers:reclaim-reservations')->hourly()->withoutOverlapping(55)->onOneServer();

// Universal pending-order TTL reclaim — released stock locked by expired orders.
Schedule::command('orders:reclaim-pending')->everyFiveMinutes()->withoutOverlapping(10)->onOneServer();

// Lets production:check tell whether cron actually invokes the scheduler.
Schedule::call(fn () => Cache::put('ops:scheduler-heartbeat', now()->timestamp, now()->addDay()))
    ->everyMinute()->name('ops:scheduler-heartbeat');

Schedule::command('queue:prune-failed', ['--hours' => 336])->daily()->onOneServer();

// Shared hosting fallback: drain the queue from cron when no Supervisor/systemd worker exists.
// Registered last because it runs in the foreground for up to max_time seconds.
Schedule::command('queue:work', ['--stop-when-empty', '--max-time' => config('queue.scheduler_worker.max_time', 50)])
    ->everyMinute()->withoutOverlapping(5)
    ->when(fn () => config('queue.scheduler_worker.enabled') && config('queue.default') !== 'sync');
