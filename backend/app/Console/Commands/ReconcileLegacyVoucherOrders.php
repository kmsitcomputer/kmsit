<?php

namespace App\Console\Commands;

use App\Models\Order;
use App\Models\Voucher;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ReconcileLegacyVoucherOrders extends Command
{
    protected $signature = 'vouchers:reconcile-legacy {--apply} {--limit=200}';
    protected $description = 'Report legacy voucher holds that predate reservation tracking; apply is opt-in and batch-limited';

    private const TERMINAL = ['failed', 'expired', 'cancelled'];

    public function handle(): int
    {
        $apply = (bool) $this->option('apply');
        $limit = max(1, (int) $this->option('limit'));

        $candidates = [];
        $ambiguous = 0;
        $skippedPaid = 0;
        $applied = 0;
        $processed = 0;

        Order::whereNull('voucher_reservation_status')->whereNotNull('voucher_code')
            ->select('id')->chunkById(100, function ($orders) use (&$candidates, &$ambiguous, &$skippedPaid, &$applied, &$processed, $apply, $limit) {
                foreach ($orders as $row) {
                    if ($processed >= $limit) return false;
                    $processed++;

                    $order = Order::whereKey($row->id)->first();
                    if (!$order) continue;

                    $voucher = $order->voucher_code ? Voucher::where('code', $order->voucher_code)->first() : null;
                    [$reason, $releasable] = $this->classify($order, $voucher);

                    if ($reason === 'paid_consumed') {
                        $skippedPaid++;
                        continue;
                    }
                    if (!$releasable) {
                        $ambiguous++;
                        $candidates[] = [$order->id, $order->status, (string) $order->voucher_code, $reason];
                        continue;
                    }
                    if ($apply && $this->releaseLegacy($order->id)) {
                        $applied++;
                        $this->line("applied {$order->id} ({$order->status}) voucher={$voucher->id}");
                        continue;
                    }
                    $candidates[] = [$order->id, $order->status, (string) $order->voucher_code, $reason];
                }
            });

        if ($candidates) {
            $this->table(['order', 'status', 'voucher_code', 'reason'], $candidates);
        }

        $mode = $apply ? 'apply' : 'dry-run';
        $this->newLine();
        $this->line("[{$mode}] scanned={$processed} releasable=" . ($apply ? $applied : count($candidates) - $ambiguous) . " ambiguous={$ambiguous} paid_consumed={$skippedPaid}");

        if (!$apply) {
            $this->warn('Dry-run only: no data was changed. Re-run with --apply to release the terminal holds above.');
            $this->line('Legacy orders with unknown provenance are reported as ambiguous and never modified.');
        }

        return self::SUCCESS;
    }

    /** @return array{0: string, 1: bool} reason and whether a release is safe */
    private function classify(Order $order, ?Voucher $voucher): array
    {
        if ($order->status === 'paid') return ['paid_consumed', false];
        if ($order->status === 'pending') return ['pending_unresolved', false];
        if (!in_array($order->status, self::TERMINAL, true)) return ['unknown_status', false];
        if (!$voucher) return ['voucher_missing', false];
        if ($voucher->used_count < 1) return ['counter_underflow_guard', false];
        return ['terminal_hold', true];
    }

    private function releaseLegacy(string $orderId): bool
    {
        return DB::transaction(function () use ($orderId) {
            $order = Order::whereKey($orderId)->lockForUpdate()->first();
            if (!$order || $order->voucher_reservation_status !== null || !in_array($order->status, self::TERMINAL, true)) return false;

            $voucher = Voucher::where('code', $order->voucher_code)->lockForUpdate()->first();
            if (!$voucher || $voucher->used_count < 1) return false;

            $voucher->decrement('used_count');
            $order->forceFill(['voucher_id' => $voucher->id, 'voucher_reservation_status' => 'released'])->save();
            return true;
        });
    }
}
