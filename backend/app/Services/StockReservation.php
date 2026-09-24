<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Database\Eloquent\Collection;

class StockReservation
{
    /** Shared admin/reservation lock contract: product rows precede variant rows. */
    public function lockProductForUpdate(string $productId): ?Product
    {
        return Product::whereKey($productId)->lockForUpdate()->first();
    }

    /** Lock only variants belonging to the product, in deterministic row order. */
    public function lockVariantsForUpdate(string $productId): Collection
    {
        return ProductVariant::where('product_id', $productId)->orderBy('id')->lockForUpdate()->get();
    }

    /** Caller owns the surrounding transaction. */
    public function reserveCart(array $lines): void
    {
        $requirements = $this->requirements($lines);
        $locked = $this->lockStock($requirements);
        $this->assertAvailable($requirements, $locked);

        foreach ($requirements as $key => $required) {
            $locked[$key]->decrement('stock', $required['qty']);
        }
    }

    /** Caller holds the order lock. Returns false when a released late payment cannot be fulfilled. */
    public function confirm(Order $order, ?string $paymentReference = null): bool
    {
        if ($order->type !== 'shop') return true;
        if ($order->stock_reservation_status === 'confirmed') return true;
        if ($order->stock_reservation_status === 'shortage') return false;

        // NULL covers legacy pending orders created before reservation bookkeeping existed.
        if ($order->stock_reservation_status === 'released' || $order->stock_reservation_status === null) {
            $requirements = $this->requirementsFromOrder($order);
            $locked = $this->lockStock($requirements);
            if (!$this->available($requirements, $locked)) {
                $order->forceFill(['stock_reservation_status' => 'shortage'])->save();
                AuditLog::create([
                    'user_id' => $order->user_id,
                    'user_name' => 'system',
                    'action' => 'stock_fulfillment_shortage',
                    'model' => 'Order',
                    'model_id' => $order->id,
                    'detail' => sprintf('late payment recorded; fulfillment blocked; reference=%s; reason=stock_unavailable', $paymentReference ?? '-'),
                ]);
                app(NotificationService::class)->notifyStaff('manage_orders', "order:{$order->id}:stock_shortage",
                    'Stok kurang untuk order lunas', "Order {$order->id} sudah dibayar tetapi stok tidak mencukupi. Perlu tindak lanjut (restock/refund).",
                    '/dashboard/orders', 'danger');
                return false;
            }
            foreach ($requirements as $key => $required) {
                $locked[$key]->decrement('stock', $required['qty']);
            }
        }

        $order->forceFill(['stock_reservation_status' => 'confirmed'])->save();
        return true;
    }

    /** Caller holds the order lock. */
    public function release(Order $order): void
    {
        if ($order->type !== 'shop' || $order->stock_reservation_status !== 'reserved') return;
        $requirements = $this->requirementsFromOrder($order);
        $locked = $this->lockStock($requirements);
        foreach ($requirements as $key => $required) {
            $locked[$key]->increment('stock', $required['qty']);
        }
        $order->forceFill(['stock_reservation_status' => 'released'])->save();
    }

    private function requirementsFromOrder(Order $order): array
    {
        return $this->requirements($order->items()->where('kind', 'product')->get()->map(fn ($item) => [
            'product_id' => $item->ref_id,
            'variant_id' => $item->variant_id,
            'qty' => $item->qty,
            'name' => $item->title,
        ])->all());
    }

    private function requirements(array $lines): array
    {
        $requirements = [];
        foreach ($lines as $line) {
            $cart = $line['cart'] ?? null;
            $product = $line['product'] ?? null;
            $variantId = $cart?->variant_id ?? ($line['variant_id'] ?? null);
            $productId = $product?->id ?? $line['product_id'];
            $key = $variantId ? 'v:' . $variantId : 'p:' . $productId;
            $requirements[$key] ??= ['variant_id' => $variantId, 'product_id' => $productId, 'qty' => 0, 'name' => $product?->name ?? ($line['name'] ?? $productId)];
            $requirements[$key]['qty'] += (int) ($cart?->qty ?? $line['qty']);
        }
        ksort($requirements);
        return $requirements;
    }

    private function lockStock(array $requirements): array
    {
        $locked = [];
        foreach ($requirements as $key => $required) {
            $locked[$key] = $required['variant_id']
                ? ProductVariant::whereKey($required['variant_id'])->where('product_id', $required['product_id'])->lockForUpdate()->first()
                : $this->lockProductForUpdate($required['product_id']);
        }
        return $locked;
    }

    private function assertAvailable(array $requirements, array $locked): void
    {
        if ($this->available($requirements, $locked)) return;
        foreach ($requirements as $key => $required) {
            if (!$locked[$key] || (int) $locked[$key]->stock < $required['qty']) {
                abort(422, "Stok produk {$required['name']} tidak mencukupi.");
            }
        }
    }

    private function available(array $requirements, array $locked): bool
    {
        foreach ($requirements as $key => $required) {
            if (!$locked[$key] || (int) $locked[$key]->stock < $required['qty']) return false;
        }
        return true;
    }
}
