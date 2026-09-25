<?php

namespace Tests\Feature;

use App\Models\{AuditLog, CartItem, DigitalDelivery, Order, Payment, Product, ProductVariant, User};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class StockReservationApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['payment.mode' => 'sandbox']);
        $this->seed();
    }

    public function test_checkout_reserves_and_paid_only_confirms_once(): void
    {
        [$user, $product] = $this->fixture('stock-a@example.test', 'stockprod001', 2);
        $order = $this->checkout($user, $product, 1);
        $this->assertSame(1, $product->fresh()->stock);
        $this->assertSame('reserved', $order->fresh()->stock_reservation_status);

        $payment = $this->payment($user, $order);
        $this->webhook($payment, 'paid')->assertOk()->assertJsonPath('result', 'processed');
        $this->assertSame(1, $product->fresh()->stock);
        $this->assertSame('confirmed', $order->fresh()->stock_reservation_status);
        $this->webhook($payment, 'paid')->assertOk()->assertJsonPath('result', 'duplicate');
        $this->assertSame(1, $product->fresh()->stock);
    }

    public function test_failed_and_cancelled_orders_release_stock_once(): void
    {
        [$user, $product] = $this->fixture('stock-b@example.test', 'stockprod002', 2);
        $failed = $this->checkout($user, $product, 1);
        $payment = $this->payment($user, $failed);
        $this->webhook($payment, 'failed')->assertOk();
        $this->assertSame(2, $product->fresh()->stock);
        $this->webhook($payment, 'failed')->assertOk()->assertJsonPath('result', 'duplicate');
        $this->assertSame(2, $product->fresh()->stock);

        $cancelled = $this->checkout($user, $product, 2);
        $this->actingAs($user, 'sanctum')->postJson("/api/v1/orders/{$cancelled->id}/cancel")->assertOk();
        $this->assertSame(2, $product->fresh()->stock);
        $this->actingAs($user, 'sanctum')->postJson("/api/v1/orders/{$cancelled->id}/cancel")->assertStatus(409);
        $this->assertSame(2, $product->fresh()->stock);
    }

    public function test_late_payment_is_recorded_but_shortage_blocks_fulfillment_once(): void
    {
        [$first, $product] = $this->fixture('stock-c1@example.test', 'stockprod003', 1, true);
        $firstOrder = $this->checkout($first, $product, 1);
        $firstPayment = $this->payment($first, $firstOrder);
        $this->webhook($firstPayment, 'expired')->assertOk();
        $this->assertSame(1, $product->fresh()->stock);

        $second = $this->user('stock-c2@example.test');
        CartItem::create(['id' => 'stockcart002', 'user_id' => $second->id, 'product_id' => $product->id, 'qty' => 1]);
        $secondOrder = $this->checkout($second, $product, 1, false);
        $this->assertSame(0, $product->fresh()->stock);

        $this->webhook($firstPayment, 'paid')->assertOk()->assertJsonPath('result', 'processed');
        $this->assertSame('paid', $firstOrder->fresh()->status);
        $this->assertSame('paid', $firstPayment->fresh()->status);
        $this->assertSame('shortage', $firstOrder->fresh()->stock_reservation_status);
        $this->assertSame(0, $product->fresh()->stock);
        $this->assertDatabaseCount('digital_deliveries', 0);
        $this->assertSame(1, AuditLog::where('action', 'stock_fulfillment_shortage')->where('model_id', $firstOrder->id)->count());

        $this->webhook($firstPayment, 'paid')->assertOk()->assertJsonPath('result', 'duplicate');
        $this->assertSame(0, $product->fresh()->stock);
        $this->assertSame(1, AuditLog::where('action', 'stock_fulfillment_shortage')->where('model_id', $firstOrder->id)->count());
        $this->actingAs($second, 'sanctum')->postJson("/api/v1/orders/{$secondOrder->id}/cancel")->assertOk();
        $this->assertSame(1, $product->fresh()->stock);
    }

    public function test_admin_updates_product_stock_and_checkout_uses_latest_value(): void
    {
        $admin = $this->user('stock-admin-a@example.test', 'admin');
        [$buyer, $product] = $this->fixture('stock-buyer-a@example.test', 'stockprod004', 1);

        $this->actingAs($admin, 'sanctum')->putJson("/api/v1/admin/products/{$product->id}", ['stock' => 3])
            ->assertOk()->assertJsonPath('product.stock', 3);
        $this->checkout($buyer, $product->fresh(), 3);
        $this->assertSame(0, $product->fresh()->stock);
    }

    public function test_admin_variant_update_preserves_unchanged_variant(): void
    {
        $admin = $this->user('stock-admin-b@example.test', 'admin');
        $product = Product::create(['id' => 'stockprod005', 'slug' => 'stockprod005', 'name' => 'Variants',
            'price' => 10000, 'stock' => 5, 'status' => 'published']);
        $red = ProductVariant::create(['id' => 'stockvar0001', 'product_id' => $product->id, 'label' => 'Red', 'price' => 10000, 'stock' => 2, 'sort' => 0]);
        $blue = ProductVariant::create(['id' => 'stockvar0002', 'product_id' => $product->id, 'label' => 'Blue', 'price' => 10000, 'stock' => 3, 'sort' => 1]);
        $blueUpdatedAt = $blue->updated_at;

        $this->actingAs($admin, 'sanctum')->putJson("/api/v1/admin/products/{$product->id}", ['variants' => [
            ['label' => 'Red', 'price' => 10000, 'stock' => 4],
            ['label' => 'Blue', 'price' => 10000, 'stock' => 3],
        ]])->assertOk()->assertJsonPath('product.stock', 7);

        $this->assertSame(4, $red->fresh()->stock);
        $this->assertSame(3, $blue->fresh()->stock);
        $this->assertSame($blueUpdatedAt->toISOString(), $blue->fresh()->updated_at->toISOString());
        $this->assertDatabaseHas('product_variants', ['id' => 'stockvar0001', 'product_id' => $product->id]);
        $this->assertDatabaseHas('product_variants', ['id' => 'stockvar0002', 'product_id' => $product->id]);
    }

    public function test_admin_rejects_negative_product_and_variant_stock(): void
    {
        $admin = $this->user('stock-admin-c@example.test', 'admin');
        $product = Product::create(['id' => 'stockprod006', 'slug' => 'stockprod006', 'name' => 'Nonnegative',
            'price' => 10000, 'stock' => 2, 'status' => 'published']);

        $this->actingAs($admin, 'sanctum')->putJson("/api/v1/admin/products/{$product->id}", ['stock' => -1])
            ->assertStatus(422)->assertJsonValidationErrors('stock');
        $this->actingAs($admin, 'sanctum')->putJson("/api/v1/admin/products/{$product->id}", ['variants' => [
            ['label' => 'Invalid', 'price' => 10000, 'stock' => -1],
        ]])->assertStatus(422)->assertJsonValidationErrors('variants.0.stock');
        $this->assertSame(2, $product->fresh()->stock);
    }

    public function test_admin_non_stock_update_does_not_change_product_or_variant_stock(): void
    {
        $admin = $this->user('stock-admin-d@example.test', 'admin');
        $product = Product::create(['id' => 'stockprod007', 'slug' => 'stockprod007', 'name' => 'Original',
            'price' => 10000, 'stock' => 6, 'status' => 'draft']);
        $variant = ProductVariant::create(['id' => 'stockvar0003', 'product_id' => $product->id, 'label' => 'Only',
            'price' => 10000, 'stock' => 6, 'sort' => 0]);

        $this->actingAs($admin, 'sanctum')->putJson("/api/v1/admin/products/{$product->id}", ['status' => 'published'])
            ->assertOk()->assertJsonPath('product.stock', 6);
        $this->assertSame(6, $product->fresh()->stock);
        $this->assertSame(6, $variant->fresh()->stock);
    }

    private function fixture(string $email, string $productId, int $stock, bool $digital = true): array
    {
        // Stock reservation is shipping-agnostic; digital fixtures keep these
        // tests independent of the RajaOngkir checkout contract.
        $user = $this->user($email);
        $product = Product::create(['id' => $productId, 'slug' => $productId, 'name' => 'Stock item',
            'price' => 10000, 'stock' => $stock, 'status' => 'published', 'is_digital' => $digital,
            'digital_file_url' => $digital ? 'https://example.test/file' : null]);
        CartItem::create(['id' => 'cart' . substr($productId, -7), 'user_id' => $user->id, 'product_id' => $product->id, 'qty' => 1]);
        return [$user, $product];
    }

    private function user(string $email, string $role = 'student'): User
    {
        return User::create(['id' => strtolower(substr(md5($email), 0, 12)), 'role_key' => $role, 'name' => 'Buyer',
            'email' => $email, 'password_hash' => Hash::make('password'), 'status' => 'active']);
    }

    private function checkout(User $user, Product $product, int $qty, bool $updateCart = true): Order
    {
        if ($updateCart) CartItem::where('user_id', $user->id)->where('product_id', $product->id)->update(['qty' => $qty]);
        $id = $this->actingAs($user, 'sanctum')->postJson('/api/v1/orders/shop', [
            'shipping' => $product->is_digital ? null : ['name' => 'Buyer', 'address' => 'Test Street', 'phone' => '0800'],
        ])->assertCreated()->json('order.id');
        return Order::findOrFail($id);
    }

    private function payment(User $user, Order $order): Payment
    {
        $id = $this->actingAs($user, 'sanctum')->postJson("/api/v1/orders/{$order->id}/payment", [
            'gateway' => 'tripay', 'method' => 'QRIS',
        ])->assertCreated()->json('payment.id');
        return Payment::findOrFail($id);
    }

    private function webhook(Payment $payment, string $status): \Illuminate\Testing\TestResponse
    {
        $privateKey = (string) config('payment.tripay.private_key');
        $signature = hash_hmac('sha256', implode('|', [$payment->reference, $payment->amount, $status]), $privateKey);
        return $this->postJson('/api/v1/payments/webhook/tripay', [
            'reference' => $payment->reference, 'amount' => $payment->amount, 'status' => $status, 'signature' => $signature,
        ]);
    }
}
