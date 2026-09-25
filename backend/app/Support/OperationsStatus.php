<?php

namespace App\Support;

use App\Models\AuditLog;
use App\Models\Setting;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Read-only platform health for super_admin (queue, scheduler heartbeat, failed jobs, maintenance,
 * mail, payment and integration status). Mirrors `php artisan production:check` without secrets:
 * only driver names, counts, timestamps and boolean "configured" flags leave the server.
 */
class OperationsStatus
{
    private const HEARTBEAT_STALE_SECONDS = 300;

    public function snapshot(): array
    {
        $heartbeat = $this->safe(fn () => Cache::get('ops:scheduler-heartbeat'));
        $heartbeatAge = $heartbeat ? max(0, now()->timestamp - (int) $heartbeat) : null;
        $queue = (string) config('queue.default');
        $failedJobs = $this->safe(fn () => Schema::hasTable('failed_jobs') ? DB::table('failed_jobs')->count() : null);
        $pending = $queue === 'database' ? $this->safe(fn () => Schema::hasTable('jobs') ? DB::table('jobs')->count() : null) : null;
        $oldest = $queue === 'database' ? $this->safe(fn () => DB::table('jobs')->whereNull('reserved_at')->min('available_at')) : null;
        $mailer = (string) config('mail.default');
        $lastBackup = $this->safe(fn () => AuditLog::where('action', 'backup_export')->latest()->value('created_at'));

        $warnings = [];
        if ($queue === 'sync') $warnings[] = 'queue_sync';
        if (!$heartbeat) $warnings[] = 'scheduler_heartbeat_missing';
        elseif ($heartbeatAge > self::HEARTBEAT_STALE_SECONDS) $warnings[] = 'scheduler_heartbeat_stale';
        if ($failedJobs) $warnings[] = 'failed_jobs';
        if ($oldest && now()->timestamp - (int) $oldest > 600) $warnings[] = 'queue_backlog';
        if (in_array($mailer, ['log', 'array'], true)) $warnings[] = 'mail_not_delivered';

        return [
            'maintenance' => $this->safe(fn () => Setting::where('setting_key', 'maintenance_mode')->value('setting_value') === '1') ?? false,
            'environment' => app()->environment(),
            'queue' => [
                'connection' => $queue,
                'scheduler_worker' => (bool) config('queue.scheduler_worker.enabled'),
                'pending_jobs' => $pending,
                'oldest_pending_minutes' => $oldest ? intdiv(max(0, now()->timestamp - (int) $oldest), 60) : null,
                'failed_jobs' => $failedJobs,
            ],
            'scheduler' => [
                'heartbeat_at' => $heartbeat ? now()->setTimestamp((int) $heartbeat)->toIso8601String() : null,
                'heartbeat_age_seconds' => $heartbeatAge,
                'healthy' => $heartbeat !== null && $heartbeatAge <= self::HEARTBEAT_STALE_SECONDS,
            ],
            'cache' => ['store' => (string) config('cache.default')],
            'mail' => ['mailer' => $mailer, 'delivers' => !in_array($mailer, ['log', 'array'], true)],
            'backup' => ['last_export_at' => $lastBackup ? (string) $lastBackup : null],
            'integrations' => $this->integrations(),
            'warnings' => $warnings,
        ];
    }

    /** Status reflects the code, not the settings screen: configuration-only integrations stay "not_active". */
    private function integrations(): array
    {
        $mode = $this->safe(fn () => Setting::where('setting_key', 'gateway_mode')->value('setting_value')) ?: config('payment.mode');
        $active = $this->safe(fn () => Setting::where('setting_key', 'gateway_active')->value('setting_value')) ?: config('payment.active');
        $configured = [
            'tripay' => (bool) (config('payment.tripay.api_key') && config('payment.tripay.private_key') && config('payment.tripay.merchant_code')),
            'xendit' => (bool) (config('payment.xendit.api_key') && config('payment.xendit.callback_token')),
            'stripe' => (bool) (config('payment.stripe.secret_key') && config('payment.stripe.webhook_secret')),
        ];
        $rows = [];
        foreach ($configured as $key => $ok) {
            $rows[] = ['key' => $key, 'kind' => 'payment', 'status' => $ok ? 'active' : 'not_configured', 'selected' => $active === $key, 'mode' => $active === $key ? $mode : null];
        }
        $rows[] = ['key' => 'video_embed', 'kind' => 'content', 'status' => 'active', 'selected' => false, 'mode' => null];
        $shippingReady = (bool) (config('shipping.api_key') && config('shipping.origin_subdistrict_id'));
        $rows[] = ['key' => 'rajaongkir', 'kind' => 'shipping', 'status' => $shippingReady ? 'active' : 'not_configured', 'selected' => false, 'mode' => null];
        foreach (['zoom', 'google_meet', 'youtube_channel', 'openroute'] as $key) {
            $rows[] = ['key' => $key, 'kind' => 'planned', 'status' => 'not_active', 'selected' => false, 'mode' => null];
        }
        return $rows;
    }

    private function safe(callable $read): mixed
    {
        try { return $read(); } catch (\Throwable) { return null; }
    }
}
