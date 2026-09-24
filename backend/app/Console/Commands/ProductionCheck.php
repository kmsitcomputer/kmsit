<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ProductionCheck extends Command
{
    protected $signature = 'production:check';
    protected $description = 'Check production configuration and required application resources';

    public function handle(): int
    {
        $checks = [
            'APP_ENV=production' => app()->environment('production'),
            'APP_DEBUG=false' => !config('app.debug'),
            'APP_KEY configured' => filled(config('app.key')),
            'APP_URL uses HTTPS' => str_starts_with((string) config('app.url'), 'https://'),
            'MySQL connection' => $this->databaseAvailable(),
            'Storage link' => file_exists(public_path('storage')),
            'Queue is not sync' => config('queue.default') !== 'sync',
            'Payment mode configured' => in_array(config('payment.mode'), ['sandbox', 'live'], true),
        ];
        $failed = 0;
        foreach ($checks as $label => $passed) {
            $passed ? $this->line("<info>PASS</info> $label") : $this->error("FAIL $label");
            if (!$passed) $failed++;
        }
        $this->newLine();
        $this->line($failed === 0 ? '<info>Production checks passed.</info>' : "$failed production check(s) failed.");
        return $failed === 0 ? self::SUCCESS : self::FAILURE;
    }

    private function databaseAvailable(): bool
    {
        try { DB::connection()->getPdo(); return Schema::hasTable('users'); }
        catch (\Throwable) { return false; }
    }
}
