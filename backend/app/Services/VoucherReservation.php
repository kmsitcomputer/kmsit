<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Order;
use App\Models\Voucher;
use Illuminate\Support\Facades\DB;

class VoucherReservation
{
    /** Caller holds the order lock (and payment lock, if any), inside its transaction. */
    public function confirm(Order $order, ?string $paymentReference = null): void
    {
        if ($order->voucher_reservation_status === 'released') {
            // A real late payment must remain visible even when the freed quota was reused.
            $voucher = Voucher::whereKey($order->voucher_id)->lockForUpdate()->first();
            if ($voucher) {
                $voucher->increment('used_count');
                if ($voucher->usage_limit > 0 && (int) $voucher->used_count > (int) $voucher->usage_limit) {
                    // Recorded once: this branch runs at most once because the order lock plus the
                    // released -> consumed transition is the persistent idempotency guard.
                    $this->recordOverLimit($order, $voucher, $paymentReference);
                }
            }
            $order->forceFill(['voucher_reservation_status' => 'consumed'])->save();
            return;
        }
        if ($order->voucher_reservation_status === 'reserved') {
            $order->forceFill(['voucher_reservation_status' => 'consumed'])->save();
        }
    }

    /** Order -> voucher. Never identify a voucher by code. */
    public function release(Order $order): void
    {
        if ($order->status === 'paid' || $order->voucher_reservation_status !== 'reserved') return;

        $voucher = Voucher::whereKey($order->voucher_id)->lockForUpdate()->first();
        if ($voucher) {
            if ($voucher->used_count < 1) throw new \LogicException('Voucher reservation counter is inconsistent.');
            $voucher->decrement('used_count');
        }
        $order->forceFill(['voucher_reservation_status' => 'released'])->save();
    }

    public function cancel(string $orderId, string $userId): Order
    {
        return DB::transaction(function () use ($orderId, $userId) {
            $order = Order::whereKey($orderId)->where('user_id', $userId)->lockForUpdate()->firstOrFail();
            abort_if($order->status === 'paid', 422, 'Order sudah dibayar.');
            abort_if(in_array($order->status, ['failed', 'expired', 'cancelled'], true), 409, 'Order tidak dapat dibatalkan lagi.');
            $order->update(['status' => 'cancelled']);
            $this->release($order);
            app(StockReservation::class)->release($order);
            return $order;
        });
    }

    /** Lazy reclaim for one voucher, addressed by code (UI/checkout path). */
    public function expireDue(string $code): void
    {
        $voucherId = Voucher::where('code', $code)->value('id');
        if (!$voucherId) return;

        $this->reclaim(fn ($query) => $query->where('voucher_id', $voucherId));
    }

    /** Scheduled batch reclaim across all vouchers, addressed by voucher_id, not code. */
    public function reclaimDue(int $limit = 1000): int
    {
        return $this->reclaim(null, max(1, $limit));
    }

    /** Reclaim ALL pending orders that have expired (universal TTL). Returns count. */
    public function reclaimExpiringOrders(int $limit = 5000): int
    {
        $processed = 0;
        // Only process orders without an explicit expires_at set — those are covered by
        // legacy paths. New orders always carry expires_at after migration 000021.
        $query = Order::where(function ($q) {
            $q->whereNull('expires_at')
              ->orWhere('expires_at', '<=', now());
        })->whereNotIn('status', ['paid', 'failed', 'expired', 'cancelled'])
          ->select('id')->orderBy('id');

        $query->chunkById($limit, function ($orders) use (&$processed) {
            foreach ($orders as $candidate) {
                $this->reclaimOrderById($candidate->id);
                $processed++;
            }
        });

        return $processed;
    }

    private function reclaimOrderById(string $orderId): void
    {
        DB::transaction(function () use ($orderId) {
            $order = Order::whereKey($orderId)->lockForUpdate()->first();
            if (!$order || in_array($order->status, ['paid', 'failed', 'expired', 'cancelled'], true)) return;

            $isVoucherReserved = $order->voucher_reservation_status === 'reserved'
                && $order->voucher_reserved_until
                && $order->voucher_reserved_until->isPast();

            $isUniversalExpired = $order->expires_at && $order->expires_at->isPast();

            if (!$isVoucherReserved && !$isUniversalExpired) return;

            if ($order->status === 'pending') $order->update(['status' => 'expired']);
            $this->release($order);
            app(StockReservation::class)->release($order);
        });
    }

    private function reclaim(?callable $scope = null, ?int $limit = null): int
    {
        $processed = 0;
        $query = Order::where('voucher_reservation_status', 'reserved')
            ->where('voucher_reserved_until', '<=', now());
        if ($scope) $scope($query);

        // Never hold a voucher lock while waiting for existing orders (lock inversion).
        $query->select('id')->chunkById(100, function ($orders) use (&$processed, $limit) {
            foreach ($orders as $candidate) {
                if ($limit !== null && $processed >= $limit) return false;
                $this->reclaimOrder($candidate->id);
                $processed++;
            }
        });

        return $processed;
    }

    private function reclaimOrder(string $orderId): void
    {
        DB::transaction(function () use ($orderId) {
            $order = Order::whereKey($orderId)->lockForUpdate()->first();
            if (!$order || $order->status === 'paid' || $order->voucher_reservation_status !== 'reserved'
                || !$order->voucher_reserved_until || $order->voucher_reserved_until->isFuture()) return;
            if ($order->status === 'pending') $order->update(['status' => 'expired']);
            $this->release($order);
            app(StockReservation::class)->release($order);
        });
    }

    private function recordOverLimit(Order $order, Voucher $voucher, ?string $reference): void
    {
        AuditLog::create([
            'user_id' => $order->user_id,
            'user_name' => 'system',
            'action' => 'voucher_over_limit',
            'model' => 'Order',
            'model_id' => $order->id,
            'detail' => sprintf(
                'late paid after reservation release; voucher=%s; reference=%s; usage_limit=%d; used_count=%d; reason=quota_exceeded',
                $voucher->id,
                $reference ?? '-',
                $voucher->usage_limit,
                $voucher->used_count
            ),
        ]);
        app(NotificationService::class)->notifyStaff('manage_vouchers', "order:{$order->id}:voucher_over_limit",
            'Kuota voucher terlampaui', "Pembayaran terlambat untuk order {$order->id} membuat voucher {$voucher->code} melewati kuota.",
            '/dashboard/vouchers', 'warning');
    }
}
