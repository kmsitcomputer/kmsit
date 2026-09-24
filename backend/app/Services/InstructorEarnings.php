<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Order;
use App\Models\Setting;
use App\Models\WalletTransaction;
use Illuminate\Support\Str;

class InstructorEarnings
{
    /**
     * Credit instructor earnings for a paid order. Caller runs this inside the paid-order
     * transaction with the order row already locked. Amounts are derived only from stored
     * backend order/item data — never from client input. Idempotent per order item so a
     * repeated webhook cannot duplicate the ledger.
     */
    public function creditForOrder(Order $order): int
    {
        $percent = $this->platformFeePercent();
        $subtotal = (int) $order->subtotal;
        $gatewayFee = (int) $order->gateway_fee;
        $credited = 0;

        foreach ($order->items as $item) {
            if ($item->kind !== 'course' || !$item->instructor_id || (int) $item->price <= 0) continue;

            $alreadyCredited = WalletTransaction::where('order_id', $order->id)
                ->where('user_id', $item->instructor_id)->where('type', 'earning')->where('ref_id', $item->ref_id)->exists();
            if ($alreadyCredited) continue;

            $gross = (int) $item->price * (int) $item->qty;
            $platformFee = (int) round($gross * $percent / 100);
            $paymentFee = $subtotal > 0 ? (int) round($gatewayFee * $gross / $subtotal) : 0;
            $net = $gross - $platformFee - $paymentFee;
            $id = Str::lower(Str::random(12));

            WalletTransaction::create([
                'id' => $id, 'user_id' => $item->instructor_id, 'type' => 'earning', 'ref_id' => $item->ref_id,
                'order_id' => $order->id, 'amount' => $net, 'gross' => $gross, 'platform_fee' => $platformFee,
                'payment_fee' => $paymentFee, 'status' => 'completed',
                'note' => 'Penjualan "' . $item->title . '" (fee platform ' . $percent . '%)',
            ]);
            AuditLog::create([
                'user_id' => $item->instructor_id, 'user_name' => 'system', 'action' => 'wallet_earning',
                'model' => 'WalletTransaction', 'model_id' => $id,
                'detail' => sprintf('order=%s course=%s gross=%d platform_fee=%d payment_fee=%d net=%d', $order->id, $item->ref_id, $gross, $platformFee, $paymentFee, $net),
            ]);
            app(NotificationService::class)->notify($item->instructor_id, "earning:{$order->id}:{$item->ref_id}",
                'Penjualan kelas baru', "\"{$item->title}\" terjual. Pendapatan bersih " . NotificationService::money($net) . '.', '/dashboard/sales', 'success');
            $credited++;
        }

        return $credited;
    }

    private function platformFeePercent(): float
    {
        $value = Setting::where('setting_key', 'platform_fee_percent')->value('setting_value');
        $percent = is_numeric($value) ? (float) $value : 15.0;
        return max(0.0, min(100.0, $percent));
    }
}
