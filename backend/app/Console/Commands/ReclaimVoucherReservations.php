<?php

namespace App\Console\Commands;

use App\Services\VoucherReservation;
use Illuminate\Console\Command;

class ReclaimVoucherReservations extends Command
{
    protected $signature = 'vouchers:reclaim-reservations {--limit=1000}';
    protected $description = 'Release expired voucher reservations in batches (idempotent, safe to repeat)';

    public function handle(VoucherReservation $reservations): int
    {
        $limit = max(1, (int) $this->option('limit'));
        $released = $reservations->reclaimDue($limit);
        $this->info("Reclaimed {$released} expired voucher reservation(s).");

        return self::SUCCESS;
    }
}
