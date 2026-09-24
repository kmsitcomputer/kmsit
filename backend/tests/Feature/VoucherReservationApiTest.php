<?php

namespace Tests\Feature;

use App\Contracts\PaymentGateway;
use App\Models\{AuditLog, CartItem, DigitalDelivery, Order, OrderItem, Payment, Product, Role, User, Voucher};
use App\Services\PaymentGatewayManager;
use App\Services\VoucherReservation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{Hash, Http};
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Mockery;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class VoucherReservationApiTest extends TestCase
{
    use RefreshDatabase;

    private Voucher $voucher;

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        config(['payment.mode' => 'live', 'payment.tripay.private_key' => 'reservation-test']);
        $provider = Mockery::mock(PaymentGateway::class);
        $provider->shouldReceive('createPayment')->andReturnUsing(fn () => ['reference' => 'MOCK-' . Str::random(16)]);
        $manager = Mockery::mock(PaymentGatewayManager::class);
        $manager->shouldReceive('resolve')->with('tripay')->andReturn($provider);
        $this->app->instance(PaymentGatewayManager::class, $manager);
        Role::firstOrCreate(['role_key' => 'student'], ['id' => 'resrole00001', 'name' => 'Student', 'permissions' => ['shop']]);
        $user = User::create(['id' => 'resuser00001', 'role_key' => 'student', 'name' => 'Buyer',
            'email' => 'reservation@example.test', 'password_hash' => Hash::make('password'), 'status' => 'active']);
        Product::create(['id' => 'resproduct01', 'slug' => 'reservation', 'name' => 'Digital', 'price' => 50000,
            'stock' => 10, 'status' => 'published', 'is_digital' => true]);
        CartItem::create(['id' => 'rescart00001', 'user_id' => $user->id, 'product_id' => 'resproduct01', 'qty' => 1]);
        $this->voucher = Voucher::create(['id' => 'resvoucher01', 'code' => 'RESERVE', 'type' => 'fixed',
            'value' => 5000, 'usage_limit' => 1, 'active' => true]);
        $this->actingAs($user, 'sanctum');
    }

    public function test_reservation_blocks_second_checkout_and_internal_fields_stay_hidden(): void
    {
        $response = $this->checkout()->assertCreated();
        $order = Order::findOrFail($response->json('order.id'));
        $this->assertSame('reserved', $order->voucher_reservation_status);
        $this->assertSame($this->voucher->id, $order->voucher_id);
        $this->assertArrayNotHasKey('voucher_reservation_status', $response->json('order'));
        $this->checkout()->assertStatus(422)->assertJsonPath('message', 'Voucher tidak valid.');
        $this->assertSame(1, $this->voucher->fresh()->used_count);
        $this->assertDatabaseCount('orders', 1);
    }

    public function test_order_item_failure_rolls_back_reservation_and_retry_succeeds(): void
    {
        $fail = true;
        OrderItem::creating(function () use (&$fail) {
            if ($fail) {
                $this->assertSame(1, $this->voucher->fresh()->used_count);
                throw new \RuntimeException('Injected item failure');
            }
        });
        $this->withoutExceptionHandling();
        try {
            $this->checkout();
            $this->fail('Expected failure');
        } catch (\RuntimeException $e) {
            $this->assertSame('Injected item failure', $e->getMessage());
        } finally {
            $fail = false;
        }
        $this->assertSame(0, $this->voucher->fresh()->used_count);
        $this->assertDatabaseCount('orders', 0);
        $this->checkout()->assertCreated();
        $this->assertSame(1, $this->voucher->fresh()->used_count);
    }

    public static function releaseStatuses(): array
    {
        return [['failed'], ['expired'], ['cancelled']];
    }

    #[DataProvider('releaseStatuses')]
    public function test_terminal_order_releases_once_and_frees_quota(string $status): void
    {
        $order = $this->order();
        $a = $this->payment($order);
        $b = $this->payment($order);
        if ($status === 'cancelled') {
            $this->postJson('/api/v1/orders/' . $order->id . '/cancel')->assertOk();
            $this->postJson('/api/v1/orders/' . $order->id . '/cancel')->assertStatus(409);
        } else {
            $this->sendWebhook($a, $status)->assertOk()->assertJsonPath('result', 'processed');
            $this->sendWebhook($a, $status)->assertOk()->assertJsonPath('result', 'duplicate');
        }
        $this->assertSame($status, $order->fresh()->status);
        $this->assertSame('released', $order->fresh()->voucher_reservation_status);
        $this->assertSame(0, $this->voucher->fresh()->used_count);
        $this->sendWebhook($b, 'expired')->assertOk();
        $this->assertSame(0, $this->voucher->fresh()->used_count);
        $this->checkout()->assertCreated();
        $this->assertSame(1, $this->voucher->fresh()->used_count);
    }

    public function test_paid_consumes_without_second_increment_and_stale_failures_cannot_release(): void
    {
        $order = $this->order();
        $a = $this->payment($order);
        $b = $this->payment($order);
        $c = $this->payment($order);
        $this->sendWebhook($a, 'paid')->assertOk();
        $paidAt = $order->fresh()->paid_at->toISOString();
        $this->assertSame('consumed', $order->fresh()->voucher_reservation_status);
        $this->sendWebhook($a, 'paid', $order->id)->assertStatus(422); // Ambiguous legacy reference.
        $this->sendWebhook($a, 'paid')->assertOk()->assertJsonPath('result', 'duplicate');
        $this->sendWebhook($b, 'failed')->assertOk();
        $this->sendWebhook($c, 'expired')->assertOk();
        $this->postJson('/api/v1/orders/' . $order->id . '/cancel')->assertStatus(422);
        $this->assertSame(1, $this->voucher->fresh()->used_count);
        $this->assertSame('consumed', $order->fresh()->voucher_reservation_status);
        $this->assertSame('paid', $order->fresh()->status);
        $this->assertSame($paidAt, $order->fresh()->paid_at->toISOString());
        $this->assertDatabaseCount('digital_deliveries', 1);
    }

    public function test_fulfillment_failure_rolls_back_confirmation_then_retry_consumes_once(): void
    {
        $order = $this->order();
        $payment = $this->payment($order);
        $fail = true;
        DigitalDelivery::created(function () use (&$fail) {
            if ($fail) throw new \RuntimeException('Injected fulfillment failure');
        });
        $this->withoutExceptionHandling();
        try {
            $this->sendWebhook($payment, 'paid');
            $this->fail('Expected failure');
        } catch (\RuntimeException $e) {
            $this->assertSame('Injected fulfillment failure', $e->getMessage());
        } finally {
            $fail = false;
        }
        $this->assertSame('reserved', $order->fresh()->voucher_reservation_status);
        $this->assertSame('pending', $payment->fresh()->status);
        $this->assertSame(1, $this->voucher->fresh()->used_count);
        $this->assertDatabaseCount('webhook_logs', 0);
        $this->assertDatabaseCount('digital_deliveries', 0);
        $this->sendWebhook($payment, 'paid')->assertOk();
        $this->assertSame('consumed', $order->fresh()->voucher_reservation_status);
        $this->assertSame(1, $this->voucher->fresh()->used_count);
    }

    public function test_deleted_and_recreated_voucher_is_not_decremented_by_old_order(): void
    {
        $order = $this->order();
        $payment = $this->payment($order);
        $this->voucher->delete();
        $replacement = Voucher::create(['id' => 'resvoucher02', 'code' => 'RESERVE', 'type' => 'fixed', 'value' => 5000,
            'usage_limit' => 1, 'used_count' => 1, 'active' => true]);
        $this->sendWebhook($payment, 'expired')->assertOk();
        $this->assertSame(1, $replacement->fresh()->used_count);
        $this->assertSame('released', $order->fresh()->voucher_reservation_status);
    }

    public function test_order_without_voucher_does_not_change_counter(): void
    {
        $order = Order::findOrFail($this->checkout(false)->assertCreated()->json('order.id'));
        $this->sendWebhook($this->payment($order), 'paid')->assertOk();
        $this->assertNull($order->fresh()->voucher_reservation_status);
        $this->assertSame('paid', $order->fresh()->status);
        $this->assertSame(0, $this->voucher->fresh()->used_count);
    }

    public function test_abandoned_order_expires_lazily_and_late_paid_is_counted_once(): void
    {
        $old = $this->order();
        $payment = $this->payment($old);
        $this->travel(25)->hours();
        $new = $this->order();
        $this->assertSame('expired', $old->fresh()->status);
        $this->assertSame('released', $old->fresh()->voucher_reservation_status);
        $this->assertSame('reserved', $new->voucher_reservation_status);
        $this->assertSame(1, $this->voucher->fresh()->used_count);
        $this->sendWebhook($payment, 'paid')->assertOk();
        $this->sendWebhook($payment, 'paid')->assertOk()->assertJsonPath('result', 'duplicate');
        $this->assertSame('paid', $old->fresh()->status);
        $this->assertSame('consumed', $old->fresh()->voucher_reservation_status);
        $this->assertSame(2, $this->voucher->fresh()->used_count);
        $this->assertDatabaseCount('audit_logs', 1);
        $log = AuditLog::firstOrFail();
        $this->assertSame('voucher_over_limit', $log->action);
        $this->assertSame($old->id, $log->model_id);
        $this->assertStringContainsString('usage_limit=1', $log->detail);
        $this->assertStringContainsString('used_count=2', $log->detail);
        $this->checkout()->assertStatus(422);
    }

    public function test_no_payment_order_expires_and_renamed_voucher_releases_by_identity(): void
    {
        $old = $this->order();
        $this->travel(25)->hours();
        $this->postJson('/api/v1/shop/voucher/validate', ['code' => 'RESERVE', 'subtotal' => 50000])->assertOk();
        $this->assertSame(0, $this->voucher->fresh()->used_count);
        $this->checkout()->assertCreated();
        $this->assertSame('released', $old->fresh()->voucher_reservation_status);
        $current = Order::where('voucher_reservation_status', 'reserved')->firstOrFail();
        $this->voucher->update(['code' => 'RENAMED']);
        $this->postJson('/api/v1/orders/' . $current->id . '/cancel')->assertOk();
        $this->assertSame(0, $this->voucher->fresh()->used_count);
    }

    public function test_cannot_cancel_someone_elses_order(): void
    {
        $order = $this->order();
        $other = User::create(['id' => 'resuser00002', 'role_key' => 'student', 'name' => 'Other',
            'email' => 'other@example.test', 'password_hash' => Hash::make('password'), 'status' => 'active']);
        $this->actingAs($other, 'sanctum')->postJson('/api/v1/orders/' . $order->id . '/cancel')->assertNotFound();
        $this->assertSame('reserved', $order->fresh()->voucher_reservation_status);
        $this->assertSame(1, $this->voucher->fresh()->used_count);
    }

    public function test_legacy_order_with_only_code_does_not_release_an_unproven_reservation(): void
    {
        $order = Order::create(['id' => 'legacyorder1', 'user_id' => 'resuser00001', 'type' => 'shop',
            'status' => 'pending', 'total' => 45000, 'voucher_code' => 'RESERVE']);
        $this->voucher->update(['used_count' => 1]);
        $this->sendWebhook($this->payment($order), 'expired')->assertOk();
        $this->assertNull($order->fresh()->voucher_reservation_status);
        $this->assertSame(1, $this->voucher->fresh()->used_count);
    }

    public function test_release_failure_rolls_back_counter_payment_and_log_then_retry_succeeds(): void
    {
        $order = $this->order();
        $payment = $this->payment($order);
        $fail = true;
        Order::updating(function (Order $updating) use (&$fail) {
            if ($fail && $updating->voucher_reservation_status === 'released') {
                $this->assertSame(0, $this->voucher->fresh()->used_count);
                throw new \RuntimeException('Injected release failure');
            }
        });
        $this->withoutExceptionHandling();
        try {
            $this->sendWebhook($payment, 'expired');
            $this->fail('Expected failure');
        } catch (\RuntimeException $e) {
            $this->assertSame('Injected release failure', $e->getMessage());
        } finally {
            $fail = false;
        }
        $this->assertSame(1, $this->voucher->fresh()->used_count);
        $this->assertSame('reserved', $order->fresh()->voucher_reservation_status);
        $this->assertSame('pending', $payment->fresh()->status);
        $this->assertDatabaseCount('webhook_logs', 0);
        $this->sendWebhook($payment, 'expired')->assertOk();
        $this->assertSame(0, $this->voucher->fresh()->used_count);
    }

    public function test_provider_expiry_aligns_reservation_beyond_default_ttl(): void
    {
        $order = $this->order();
        $expiry = now()->addHours(48);
        $this->bindProvider(['reference' => 'MOCK-GATEWAY-EXP', 'checkout_url' => 'https://example.test/pay', 'expires_at' => $expiry->getTimestamp()]);

        $this->payment($order);

        $reservedUntil = $order->fresh()->voucher_reserved_until;
        $this->assertNotNull($reservedUntil);
        $this->assertLessThanOrEqual(2, abs($reservedUntil->getTimestamp() - $expiry->getTimestamp()));
        $this->assertTrue($reservedUntil->greaterThan(now()->addHours(24)));
    }

    public function test_provider_utc_expiry_is_stored_as_the_same_instant_in_app_timezone(): void
    {
        $order = $this->order();
        $expiry = now()->addHours(30);
        // Providers such as Xendit send UTC ("...Z") while the app runs in Asia/Jakarta.
        $this->bindProvider(['reference' => 'MOCK-GATEWAY-UTC', 'expires_at' => $expiry->copy()->utc()->format('Y-m-d\TH:i:s.v\Z')]);

        $this->payment($order);

        $reservedUntil = $order->fresh()->voucher_reserved_until;
        $this->assertNotNull($reservedUntil);
        $this->assertLessThanOrEqual(2, abs($reservedUntil->getTimestamp() - $expiry->getTimestamp()));
    }

    public function test_provider_expiry_accepts_iso_string(): void
    {
        $order = $this->order();
        $expiry = now()->addHours(30);
        $this->bindProvider(['reference' => 'MOCK-GATEWAY-ISO', 'expires_at' => $expiry->toIso8601String()]);

        $this->payment($order);

        $reservedUntil = $order->fresh()->voucher_reserved_until;
        $this->assertNotNull($reservedUntil);
        $this->assertLessThanOrEqual(2, abs($reservedUntil->getTimestamp() - $expiry->getTimestamp()));
    }

    public function test_missing_provider_expiry_keeps_ttl_fallback(): void
    {
        $order = $this->order();

        $this->payment($order);

        $reservedUntil = $order->fresh()->voucher_reserved_until;
        $this->assertNotNull($reservedUntil);
        $this->assertLessThanOrEqual(2, abs($reservedUntil->getTimestamp() - now()->addMinutes(1440)->getTimestamp()));
    }

    public function test_scheduled_reclaim_releases_reserved_once_by_voucher_id(): void
    {
        $order = $this->order();
        $this->travel(25)->hours();

        $this->assertSame(1, app(VoucherReservation::class)->reclaimDue());
        $this->assertSame('expired', $order->fresh()->status);
        $this->assertSame('released', $order->fresh()->voucher_reservation_status);
        $this->assertSame(0, $this->voucher->fresh()->used_count);

        $this->assertSame(0, app(VoucherReservation::class)->reclaimDue());
        $this->assertSame(0, $this->voucher->fresh()->used_count);
    }

    public function test_reclaim_uses_voucher_id_even_when_code_changed(): void
    {
        $order = $this->order();
        $this->voucher->update(['code' => 'RENAMED-RESERVE']);
        $this->travel(25)->hours();

        $this->assertSame(1, app(VoucherReservation::class)->reclaimDue());
        $this->assertSame('released', $order->fresh()->voucher_reservation_status);
        $this->assertSame(0, $this->voucher->fresh()->used_count);
    }

    public function test_reclaim_never_releases_a_paid_order(): void
    {
        $order = $this->order();
        $this->sendWebhook($this->payment($order), 'paid')->assertOk();
        $this->travel(72)->hours();

        $this->assertSame(0, app(VoucherReservation::class)->reclaimDue());
        $this->assertSame('paid', $order->fresh()->status);
        $this->assertSame('consumed', $order->fresh()->voucher_reservation_status);
        $this->assertSame(1, $this->voucher->fresh()->used_count);
    }

    public function test_reclaim_command_wrapper_runs_and_releases(): void
    {
        $order = $this->order();
        $this->travel(25)->hours();

        $this->artisan('vouchers:reclaim-reservations')->assertExitCode(0);

        $this->assertSame('released', $order->fresh()->voucher_reservation_status);
        $this->assertSame(0, $this->voucher->fresh()->used_count);
    }

    public function test_cancel_terminal_state_returns_conflict_without_mutation(): void
    {
        $order = $this->order();
        $this->sendWebhook($this->payment($order), 'failed')->assertOk();

        $this->postJson('/api/v1/orders/' . $order->id . '/cancel')->assertStatus(409);
        $this->assertSame('failed', $order->fresh()->status);
        $this->assertSame('released', $order->fresh()->voucher_reservation_status);
        $this->assertSame(0, $this->voucher->fresh()->used_count);
    }

    private function bindProvider(array $payment): void
    {
        $provider = Mockery::mock(PaymentGateway::class);
        $provider->shouldReceive('createPayment')->andReturnUsing(fn () => $payment);
        $manager = Mockery::mock(PaymentGatewayManager::class);
        $manager->shouldReceive('resolve')->with('tripay')->andReturn($provider);
        $this->app->instance(PaymentGatewayManager::class, $manager);
    }

    private function checkout(bool $withVoucher = true): TestResponse
    {
        return $this->postJson('/api/v1/orders/shop', $withVoucher ? ['voucher_code' => 'RESERVE'] : []);
    }

    private function order(): Order
    {
        return Order::findOrFail($this->checkout()->assertCreated()->json('order.id'));
    }

    private function payment(Order $order): Payment
    {
        return Payment::findOrFail($this->postJson('/api/v1/orders/' . $order->id . '/payment',
            ['gateway' => 'tripay', 'method' => 'QRIS'])->assertCreated()->json('payment.id'));
    }

    private function sendWebhook(Payment $payment, string $status, ?string $reference = null): TestResponse
    {
        $raw = json_encode(['reference' => $reference ?? $payment->reference, 'amount' => $payment->amount, 'status' => $status]);
        return $this->call('POST', '/api/v1/payments/webhook/tripay', [], [], [], [
            'CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json',
            'HTTP_X_CALLBACK_SIGNATURE' => hash_hmac('sha256', $raw, 'reservation-test'),
        ], $raw);
    }
}
