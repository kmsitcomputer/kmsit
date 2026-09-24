<?php

namespace Tests\Feature;

use App\Contracts\PaymentGateway;
use App\Models\{Course, DigitalDelivery, Order, OrderItem, Payment, Product, ProductVariant, Setting, User};
use App\Services\PaymentGatewayManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{Http, Hash};
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Mockery;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class WebhookFulfillmentApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        config(['payment.mode' => 'live', 'payment.tripay.private_key' => 'test-callback-secret',
            'payment.xendit.callback_token' => 'test-xendit-token']);
        $provider = Mockery::mock(PaymentGateway::class);
        $provider->shouldReceive('createPayment')->andReturnUsing(fn () => [
            'reference' => 'MOCK-' . Str::random(16), 'checkout_url' => 'https://example.test/pay',
        ]);
        $manager = Mockery::mock(PaymentGatewayManager::class);
        $manager->shouldReceive('resolve')->withArgs(fn ($gateway) => in_array($gateway, ['tripay', 'xendit'], true))->andReturn($provider);
        $this->app->instance(PaymentGatewayManager::class, $manager);
        $this->seed(); // Only the isolated test database.
    }

    public static function terminalFailures(): array
    {
        return [['failed'], ['expired']];
    }

    #[DataProvider('terminalFailures')]
    public function test_other_payment_failure_preserves_paid_order(string $status): void
    {
        [$order, $product, $variant] = $this->fixture();
        $a = $this->initiate($order);
        $b = $this->initiate($order);
        $this->sendWebhook($a, 'paid')->assertOk()->assertJsonPath('result', 'processed');
        $paidAt = $order->fresh()->paid_at->toISOString();
        $this->travel(5)->minutes();
        $this->sendWebhook($b, $status)->assertOk()->assertJsonPath('result', 'processed');
        $this->assertSame('paid', $a->fresh()->status);
        $this->assertSame($status, $b->fresh()->status);
        $this->assertSame('webhook:' . $status, collect($b->fresh()->events)->last()['event']);
        $this->assertSame('paid', $order->fresh()->status);
        $this->assertSame($paidAt, $order->fresh()->paid_at->toISOString());
        $this->assertFulfilledOnce($product, $variant);
        $this->assertDatabaseCount('webhook_logs', 2);
    }

    public function test_two_paid_payments_are_recorded_but_fulfill_only_once(): void
    {
        [$order, $product, $variant] = $this->fixture();
        $a = $this->initiate($order);
        $b = $this->initiate($order);
        $this->sendWebhook($a, 'paid')->assertOk()->assertJsonPath('result', 'processed');
        $paidAt = $order->fresh()->paid_at->toISOString();
        $delivery = DigitalDelivery::firstOrFail()->toArray();
        $this->travel(5)->minutes();
        $this->sendWebhook($b, 'paid')->assertOk()->assertJsonPath('result', 'processed');
        $this->assertSame(2, Payment::where('order_id', $order->id)->where('status', 'paid')->count());
        $this->assertSame($paidAt, $order->fresh()->paid_at->toISOString());
        $this->assertSame($delivery, DigitalDelivery::firstOrFail()->toArray());
        $this->assertFulfilledOnce($product, $variant);
        $this->assertDatabaseCount('webhook_logs', 2);
    }

    public function test_paid_replay_with_different_reference_payload_does_not_fulfill_again(): void
    {
        [$order, $product, $variant] = $this->fixture();
        $payment = $this->initiate($order);
        $this->sendWebhook($payment, 'paid')->assertOk()->assertJsonPath('result', 'processed');
        $events = $payment->fresh()->events;
        // A merchant reference produces a different dedupe hash for the same payment.
        $this->sendWebhook($payment, 'paid', $payment->merchant_ref)->assertOk()->assertJsonPath('result', 'duplicate');
        $this->sendWebhook($payment, 'paid')->assertOk()->assertJsonPath('result', 'duplicate');
        $this->sendWebhook($payment, 'expired')->assertOk()->assertJsonPath('result', 'duplicate');
        $this->assertSame($events, $payment->fresh()->events);
        $this->assertSame('paid', $payment->fresh()->status);
        $this->assertSame('paid', $order->fresh()->status);
        $this->assertFulfilledOnce($product, $variant);
        $this->assertDatabaseCount('webhook_logs', 1);
    }

    public function test_failure_during_fulfillment_rolls_back_and_can_be_retried(): void
    {
        [$order, $product, $variant] = $this->fixture();
        $payment = $this->initiate($order);
        $events = $payment->fresh()->events;
        $fail = true;
        DigitalDelivery::created(function () use (&$fail, $product) {
            if ($fail) {
                $this->assertSame(8, $product->fresh()->stock);
                $this->assertDatabaseCount('digital_deliveries', 1);
                throw new \RuntimeException('Injected fulfillment failure');
            }
        });
        $this->withoutExceptionHandling();
        try {
            $this->sendWebhook($payment, 'paid');
            $this->fail('Expected injected fulfillment failure');
        } catch (\RuntimeException $error) {
            $this->assertSame('Injected fulfillment failure', $error->getMessage());
        } finally {
            $fail = false;
        }
        $this->assertSame('pending', $order->fresh()->status);
        $this->assertNull($order->fresh()->paid_at);
        $this->assertSame('pending', $payment->fresh()->status);
        $this->assertSame($events, $payment->fresh()->events);
        $this->assertSame(10, $product->fresh()->stock);
        $this->assertSame(10, $variant->fresh()->stock);
        $this->assertDatabaseCount('enrollments', 0);
        $this->assertDatabaseCount('digital_deliveries', 0);
        $this->assertDatabaseCount('webhook_logs', 0);
        $this->assertDatabaseCount('instructor_wallet_transactions', 0);
        $this->sendWebhook($payment, 'paid')->assertOk()->assertJsonPath('result', 'processed');
        $this->assertFulfilledOnce($product, $variant);
        $this->assertDatabaseCount('webhook_logs', 1);
    }

    public function test_normal_payment_rejects_bad_signature_and_amount_then_succeeds(): void
    {
        [$order, $product, $variant] = $this->fixture();
        $payment = $this->initiate($order);
        $this->postJson('/api/v1/payments/webhook/tripay', [
            'reference' => $payment->reference, 'amount' => $payment->amount, 'status' => 'paid',
        ], ['X-Callback-Signature' => 'invalid'])->assertStatus(422);
        $this->sendWebhook($payment, 'paid', null, $payment->amount + 1)->assertStatus(422);
        $this->assertSame('pending', $payment->fresh()->status);
        $this->assertDatabaseCount('webhook_logs', 0);
        $this->sendWebhook($payment, 'paid')->assertOk()->assertJsonPath('result', 'processed');
        $this->assertSame('paid', $order->fresh()->status);
        $this->assertNotNull($order->fresh()->paid_at);
        $this->assertFulfilledOnce($product, $variant);
    }

    public function test_xendit_invoice_ids_distinguish_payments_with_the_same_external_id(): void
    {
        [$order, $product, $variant] = $this->fixture();
        $a = $this->initiate($order, 'xendit');
        $b = $this->initiate($order, 'xendit');
        foreach ([$a, $b] as $payment) {
            $this->postJson('/api/v1/payments/webhook/xendit', [
                'id' => $payment->reference, 'external_id' => $order->id,
                'paid_amount' => $payment->amount, 'status' => 'PAID',
            ], ['X-Callback-Token' => 'test-xendit-token'])->assertOk()->assertJsonPath('result', 'processed');
        }
        $this->assertSame('paid', $a->fresh()->status);
        $this->assertSame('paid', $b->fresh()->status);
        $this->assertDatabaseCount('webhook_logs', 2);
        $this->assertFulfilledOnce($product, $variant);
    }

    public function test_ambiguous_merchant_reference_does_not_guess_a_payment(): void
    {
        [$order, $product, $variant] = $this->fixture();
        $a = $this->initiate($order);
        $b = $this->initiate($order);
        $this->sendWebhook($a, 'paid', $order->id)->assertStatus(422)->assertJsonPath('result', 'invalid');
        $this->assertSame('pending', $a->fresh()->status);
        $this->assertSame('pending', $b->fresh()->status);
        $this->assertSame('pending', $order->fresh()->status);
        $this->assertSame(10, $product->fresh()->stock);
        $this->assertSame(10, $variant->fresh()->stock);
        $this->assertDatabaseCount('webhook_logs', 0);
        $this->assertDatabaseCount('enrollments', 0);
        $this->assertDatabaseCount('digital_deliveries', 0);
    }

    private function fixture(): array
    {
        $user = User::create(['id' => 'whuser000001', 'role_key' => 'student', 'name' => 'Buyer',
            'email' => 'webhook@example.test', 'password_hash' => Hash::make('password'), 'status' => 'active']);
        $course = Course::create(['id' => 'whcourse0001', 'slug' => 'webhook-course', 'instructor_id' => $user->id,
            'title' => 'Course', 'price' => 10000, 'status' => 'published']);
        $product = Product::create(['id' => 'whproduct001', 'slug' => 'webhook-digital', 'name' => 'Digital',
            'price' => 10000, 'stock' => 10, 'status' => 'published', 'is_digital' => true,
            'digital_file_url' => 'https://example.test/file']);
        $variant = ProductVariant::create(['id' => 'whvariant001', 'product_id' => $product->id,
            'label' => 'Variant', 'price' => 10000, 'stock' => 10]);
        $order = Order::create(['id' => 'whorder00001', 'user_id' => $user->id, 'type' => 'shop',
            'status' => 'pending', 'subtotal' => 50000, 'total' => 50000, 'currency' => 'IDR']);
        // Mixed fixture exercises every existing fulfillment branch in one transaction.
        foreach ([
            ['id' => 'whitem000001', 'kind' => 'course', 'ref_id' => $course->id, 'qty' => 1],
            ['id' => 'whitem000002', 'kind' => 'product', 'ref_id' => $product->id, 'qty' => 2, 'variant_id' => $variant->id],
            ['id' => 'whitem000003', 'kind' => 'product', 'ref_id' => $product->id, 'qty' => 2, 'is_digital' => true],
        ] as $item) {
            OrderItem::create($item + ['order_id' => $order->id, 'title' => 'Item', 'price' => 10000]);
        }
        $this->actingAs($user, 'sanctum');
        return [$order, $product, $variant];
    }

    private function initiate(Order $order, string $gateway = 'tripay'): Payment
    {
        // The provider is now chosen server-side from the admin setting.
        Setting::updateOrCreate(['setting_key' => 'gateway_active'], ['setting_value' => $gateway]);
        $id = $this->postJson('/api/v1/orders/' . $order->id . '/payment', ['gateway' => $gateway, 'method' => 'QRIS'])
            ->assertCreated()->json('payment.id');
        return Payment::findOrFail($id);
    }

    private function sendWebhook(Payment $payment, string $status, ?string $reference = null, ?int $amount = null): TestResponse
    {
        $payload = ['reference' => $reference ?? $payment->reference, 'amount' => $amount ?? $payment->amount, 'status' => $status];
        $raw = json_encode($payload);
        return $this->call('POST', '/api/v1/payments/webhook/tripay', [], [], [], [
            'CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json',
            'HTTP_X_CALLBACK_SIGNATURE' => hash_hmac('sha256', $raw, 'test-callback-secret'),
        ], $raw);
    }

    private function assertFulfilledOnce(Product $product, ProductVariant $variant): void
    {
        $this->assertSame(8, $product->fresh()->stock);
        $this->assertSame(8, $variant->fresh()->stock);
        $this->assertDatabaseCount('enrollments', 1);
        $this->assertDatabaseCount('digital_deliveries', 1);
        // The current backend fulfillment does not create a wallet earning.
        $this->assertDatabaseCount('instructor_wallet_transactions', 0);
    }
}
