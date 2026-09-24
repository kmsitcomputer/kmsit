<?php

namespace App\Console\Commands;

use App\Services\VoucherReservation;
use Illuminate\Console\Command;

class ReclaimPendingOrders extends Command
{
    protected $signature = 'orders:reclaim-pending {--limit=5000}';
    protected $description = 'Release stock & voucher reservations for all expired pending orders (universal TTL)';

    public function handle(VoucherReservation $reservations): int
    {
        $limit = max(1, (int) $this->option('limit'));
        $released = $reservations->reclaimExpiringOrders($limit);
        $this->info("Reclaimed {$released} expired pending order(s).");

        return self::SUCCESS;
    }
}
