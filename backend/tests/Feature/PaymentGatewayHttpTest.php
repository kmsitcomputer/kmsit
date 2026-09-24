<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Provider-level regression tests for the three implemented gateways. Every request is faked
 * (Http::preventStrayRequests in setUp) so no real provider is contacted and no credential leaks.
 * Payment initiation now selects the provider from admin settings, never from the request payload.
 */
class PaymentGatewayHttpTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        config([
            'payment.mode' => 'live',
            'payment.active' => 'tripay',
            'payment.http.timeout' => 15,
            'payment.http.connect_timeout' => 5,
            'payment.tripay.api_key' => 'tripay-api-key-secret',
            'payment.tripay.private_key' => 'tripay-private-key-secret',
            'payment.tripay.merchant_code' => 'T12345',
            'payment.tripay.webhook_secret' => null,
            'payment.tripay.base_url' => 'https://tripay.co.id/api',
            'payment.xendit.api_key' => 'xendit-api-key-secret',
            'payment.xendit.callback_token' => 'xendit-callback-token-secret',
            'payment.xendit.base_url' => 'https://api.xendit.co',
            'payment.stripe.secret_key' => 'stripe-secret-key-value',
            'payment.stripe.webhook_secret' => 'stripe-webhook-secret-value',
            'payment.stripe.base_url' => 'https://api.stripe.com',
        ]);
        $this->seed();
    }

    public function test_tripay_create_payment_uses_backend_amount_and_returns_checkout_url(): void
    {
        $this->selectGateway('tripay');
        Http::fake(['tripay.co.id/*' => Http::response([
            'data' => ['reference' => 'TRI-REF-1', 'checkout_url' => 'https://tripay.co.id/checkout/TRI-REF-1', 'expired_time' => now()->addHour()->timestamp],
        ], 200)]);
        $order = $this->order(25000);

        $response = $this->initiate($order)
            ->assertCreated()
            ->assertJsonPath('checkout_url', 'https://tripay.co.id/checkout/TRI-REF-1')
            ->assertJsonPath('payment.gateway', 'tripay')
            ->assertJsonPath('payment.mode', 'live')
            ->assertJsonPath('payment.status', 'pending');

        $this->assertSame('TRI-REF-1', Payment::where('order_id', $order->id)->first()->reference);
        $this->assertStringNotContainsString('tripay-private-key-secret', $response->getContent());
        $this->assertStringNotContainsString('tripay-api-key-secret', $response->getContent());
        Http::assertSentCount(1);
        Http::assertSent(fn ($request) => $request->url() === 'https://tripay.co.id/api/merchant/transaction/create'
            && (int) $request['amount'] === $order->total
            && $request['merchant_ref'] === $order->id
            && $request->hasHeader('Authorization'));
    }

    public function test_xendit_create_payment_maps_invoice_id_to_reference(): void
    {
        $this->selectGateway('xendit');
        Http::fake(['api.xendit.co/*' => Http::response([
            'id' => 'inv_123', 'invoice_url' => 'https://checkout.xendit.co/inv_123', 'expiry_date' => now()->addDay()->toISOString(),
        ], 200)]);
        $order = $this->order(15000);

        $this->initiate($order)
            ->assertCreated()
            ->assertJsonPath('checkout_url', 'https://checkout.xendit.co/inv_123')
            ->assertJsonPath('payment.gateway', 'xendit');

        $this->assertSame('inv_123', Payment::where('order_id', $order->id)->first()->reference);
        Http::assertSentCount(1);
        Http::assertSent(fn ($request) => $request->url() === 'https://api.xendit.co/v2/invoices'
            && (int) $request['amount'] === $order->total
            && $request['external_id'] === $order->id);
    }

    public function test_stripe_create_payment_sends_lowercase_currency_and_zero_decimal_amount(): void
    {
        // Explicitly set gateway+mode BEFORE faking HTTP
        $this->selectGateway('stripe', 'live');
        $order = $this->order(30000, 'IDR');

        // Full URL pattern matching to ensure Laravel Http client matches
        Http::fake([
            rtrim(config('payment.stripe.base_url', 'https://api.stripe.com'), '/') . '/v1/checkout/sessions' => Http::response([
                'id' => 'cs_test_123', 'url' => 'https://checkout.stripe.com/cs_test_123', 'expires_at' => now()->addHour()->timestamp,
            ], 200),
        ]);

        $this->initiate($order)
            ->assertCreated()
            ->assertJsonPath('checkout_url', 'https://checkout.stripe.com/cs_test_123')
            ->assertJsonPath('payment.gateway', 'stripe');

        $this->assertSame('cs_test_123', Payment::where('order_id', $order->id)->first()->reference);
        Http::assertSentCount(1);
        Http::assertSent(fn ($request) => str_contains($request->url(), 'api.stripe.com/v1/checkout/sessions'));
    }

    public function test_client_gateway_payload_is_ignored_and_admin_gateway_wins(): void
    {
        $this->selectGateway('xendit');
        Http::fake(['api.xendit.co/*' => Http::response(['id' => 'inv_admin', 'invoice_url' => 'https://checkout.xendit.co/inv_admin'], 200)]);
        $order = $this->order();

        // The buyer asks for stripe; the server must keep using the admin-selected xendit.
        $this->actingAs($order->user, 'sanctum')
            ->postJson('/api/v1/orders/' . $order->id . '/payment', ['gateway' => 'stripe', 'method' => 'QRIS'])
            ->assertCreated()
            ->assertJsonPath('payment.gateway', 'xendit');

        $this->assertSame('xendit', Payment::where('order_id', $order->id)->first()->gateway);
        Http::assertSentCount(1);
        Http::assertSent(fn ($request) => str_contains($request->url(), 'api.xendit.co'));
    }

    public function test_invalid_gateway_setting_fails_safe_without_calling_any_provider(): void
    {
        Setting::updateOrCreate(['setting_key' => 'gateway_active'], ['setting_value' => 'paypal']);
        Http::fake();
        $order = $this->order();

        $response = $this->initiate($order)
            ->assertStatus(503)
            ->assertJsonPath('message', 'Konfigurasi payment gateway tidak valid.');

        $this->assertStringNotContainsString('tripay-private-key-secret', $response->getContent());
        Http::assertNothingSent();
        $this->assertDatabaseCount('payments', 0);
    }

    public function test_invalid_mode_setting_fails_safe_and_does_not_fall_back_to_client_choice(): void
    {
        $this->selectGateway('tripay', 'production');
        Http::fake();
        $order = $this->order();

        $this->initiate($order)->assertStatus(503)->assertJsonPath('message', 'Konfigurasi payment gateway tidak valid.');
        Http::assertNothingSent();
        $this->assertDatabaseCount('payments', 0);
    }

    public function test_settings_absent_falls_back_to_environment_config(): void
    {
        config(['payment.active' => 'xendit', 'payment.mode' => 'live']);
        $this->assertDatabaseCount('settings', 0);
        Http::fake(['api.xendit.co/*' => Http::response(['id' => 'inv_env', 'invoice_url' => 'https://checkout.xendit.co/inv_env'], 200)]);
        $order = $this->order();

        $this->initiate($order)->assertCreated()->assertJsonPath('payment.gateway', 'xendit');
        Http::assertSentCount(1);
        Http::assertSent(fn ($request) => str_contains($request->url(), 'api.xendit.co'));
    }

    public function test_network_timeout_maps_to_generic_gateway_error_without_leaking_secrets(): void
    {
        $this->selectGateway('tripay');
        Log::spy();
        Http::fake(['tripay.co.id/*' => Http::failedConnection('Connection timed out')]);
        $order = $this->order();

        $response = $this->initiate($order)
            ->assertStatus(502)
            ->assertJsonPath('message', 'Payment gateway gagal dihubungi.');

        $this->assertStringNotContainsString('tripay-private-key-secret', $response->getContent());
        $this->assertStringNotContainsString('tripay-api-key-secret', $response->getContent());
        $this->assertSame('failed', Payment::where('order_id', $order->id)->first()->status);
        Http::assertSentCount(1);
        Log::shouldHaveReceived('warning')->withArgs(fn ($message, $context = []) => !str_contains(json_encode($context), 'tripay-private-key-secret')
            && ($context['gateway'] ?? null) === 'tripay');
    }

    public function test_invalid_provider_response_is_treated_as_failure_and_not_retried(): void
    {
        $this->selectGateway('stripe');
        Http::fake(['api.stripe.com/*' => Http::response(['unexpected' => 'shape'], 200)]);
        $order = $this->order();

        $this->initiate($order)->assertStatus(502);
        $this->assertSame('failed', Payment::where('order_id', $order->id)->first()->status);
        Http::assertSentCount(1);
    }

    public function test_provider_error_status_does_not_echo_provider_payload_to_client_or_log(): void
    {
        $this->selectGateway('tripay');
        Log::spy();
        Http::fake(['tripay.co.id/*' => Http::response(['data' => ['leak' => 'PROVIDER-CANARY-PAYLOAD']], 500)]);
        $order = $this->order();

        $response = $this->initiate($order)->assertStatus(502);
        $this->assertStringNotContainsString('PROVIDER-CANARY-PAYLOAD', $response->getContent());
        Http::assertSentCount(1);
        Log::shouldHaveReceived('warning')->withArgs(fn ($message, $context = []) => !str_contains(json_encode($context), 'PROVIDER-CANARY-PAYLOAD'));
    }

    public function test_sandbox_mode_never_contacts_the_provider(): void
    {
        $this->selectGateway('tripay', 'sandbox');
        Http::fake();
        $order = $this->order();

        $this->initiate($order)->assertCreated()->assertJsonPath('payment.mode', 'sandbox');
        Http::assertNothingSent();
    }

    public function test_gateway_posts_to_the_configured_base_url(): void
    {
        $this->selectGateway('tripay');
        config(['payment.tripay.base_url' => 'https://sandbox.tripay.test/api']);
        Http::fake(['sandbox.tripay.test/*' => Http::response(['data' => ['reference' => 'SBX-1', 'checkout_url' => 'https://sandbox.tripay.test/pay/SBX-1']], 200)]);
        $order = $this->order();

        $this->initiate($order)->assertCreated();
        Http::assertSent(fn ($request) => $request->url() === 'https://sandbox.tripay.test/api/merchant/transaction/create');
    }

    public function test_legacy_payment_from_previously_active_gateway_still_settles(): void
    {
        // Current active gateway is stripe, but an older payment was created against xendit.
        $this->selectGateway('stripe');
        $order = $this->order(15000);
        $payment = $this->paymentRecord($order, 'xendit', 'inv_legacy', 15000);

        $this->postJson('/api/v1/payments/webhook/xendit', [
            'id' => 'inv_legacy', 'external_id' => $order->id, 'paid_amount' => 15000, 'status' => 'PAID',
        ], ['X-Callback-Token' => 'xendit-callback-token-secret'])->assertOk()->assertJsonPath('result', 'processed');

        $this->assertSame('paid', $payment->fresh()->status);
        $this->assertSame('paid', $order->fresh()->status);
    }

    public function test_xendit_webhook_rejects_wrong_token_and_dedupes_replay(): void
    {
        $order = $this->order(15000);
        $payment = $this->paymentRecord($order, 'xendit', 'inv_abc', 15000);
        $payload = ['id' => 'inv_abc', 'external_id' => $order->id, 'paid_amount' => 15000, 'status' => 'PAID'];

        $this->postJson('/api/v1/payments/webhook/xendit', $payload, ['X-Callback-Token' => 'wrong-token'])
            ->assertStatus(422)->assertJsonPath('result', 'invalid');
        $this->assertSame('pending', $payment->fresh()->status);

        $this->postJson('/api/v1/payments/webhook/xendit', $payload, ['X-Callback-Token' => 'xendit-callback-token-secret'])
            ->assertOk()->assertJsonPath('result', 'processed');
        $this->assertSame('paid', $payment->fresh()->status);

        $this->postJson('/api/v1/payments/webhook/xendit', $payload, ['X-Callback-Token' => 'xendit-callback-token-secret'])
            ->assertOk()->assertJsonPath('result', 'duplicate');
        $this->assertDatabaseCount('webhook_logs', 1);
    }

    public function test_stripe_webhook_verifies_signature_and_rejects_unknown_reference(): void
    {
        $order = $this->order(20000);
        $payment = $this->paymentRecord($order, 'stripe', 'cs_test_abc', 20000);
        $payload = ['type' => 'checkout.session.completed', 'data' => ['object' => ['id' => 'cs_test_abc', 'amount_total' => 20000, 'payment_status' => 'paid']]];
        $raw = json_encode($payload);

        $this->stripeWebhook($raw, 't=1,v1=deadbeef')->assertStatus(422)->assertJsonPath('result', 'invalid');
        $this->assertSame('pending', $payment->fresh()->status);

        $timestamp = time();
        $signature = hash_hmac('sha256', $timestamp . '.' . $raw, 'stripe-webhook-secret-value');
        $this->stripeWebhook($raw, "t={$timestamp},v1={$signature}")->assertOk()->assertJsonPath('result', 'processed');
        $this->assertSame('paid', $payment->fresh()->status);

        // A valid signature whose session id matches no payment attempt must not be guessed.
        $unknown = json_encode(['type' => 'checkout.session.completed', 'data' => ['object' => ['id' => 'cs_unknown', 'amount_total' => 20000, 'payment_status' => 'paid']]]);
        $timestamp = time();
        $signature = hash_hmac('sha256', $timestamp . '.' . $unknown, 'stripe-webhook-secret-value');
        $this->stripeWebhook($unknown, "t={$timestamp},v1={$signature}")->assertStatus(422)->assertJsonPath('result', 'invalid');
    }

    private function selectGateway(string $gateway, ?string $mode = null): void
    {
        Setting::updateOrCreate(['setting_key' => 'gateway_active'], ['setting_value' => $gateway]);
        if ($mode !== null) Setting::updateOrCreate(['setting_key' => 'gateway_mode'], ['setting_value' => $mode]);
    }

    private function order(int $total = 10000, string $currency = 'IDR'): Order
    {
        $user = User::create(['id' => 'payuser00001', 'role_key' => 'student', 'name' => 'Buyer',
            'email' => 'pay-buyer@example.test', 'password_hash' => Hash::make('password'), 'status' => 'active']);
        Course::create(['id' => 'paycourse01', 'slug' => 'pay-course', 'instructor_id' => $user->id,
            'title' => 'Course', 'price' => $total, 'status' => 'published']);
        $order = Order::create(['id' => 'payorder0001', 'user_id' => $user->id, 'type' => 'course',
            'status' => 'pending', 'subtotal' => $total, 'total' => $total, 'currency' => $currency]);
        OrderItem::create(['id' => 'payitem00001', 'order_id' => $order->id, 'kind' => 'course',
            'ref_id' => 'paycourse01', 'title' => 'Course', 'price' => $total, 'qty' => 1]);
        return $order;
    }

    private function paymentRecord(Order $order, string $gateway, string $reference, int $amount): Payment
    {
        return Payment::create(['id' => Str::lower(Str::random(12)), 'order_id' => $order->id, 'gateway' => $gateway,
            'mode' => 'live', 'method' => 'QRIS', 'reference' => $reference, 'merchant_ref' => $order->id,
            'amount' => $amount, 'fee' => 0, 'status' => 'pending', 'signature' => 'recorded', 'events' => []]);
    }

    private function initiate(Order $order, string $method = 'QRIS')
    {
        return $this->actingAs($order->user, 'sanctum')
            ->postJson('/api/v1/orders/' . $order->id . '/payment', ['method' => $method]);
    }

    private function stripeWebhook(string $raw, string $signature)
    {
        return $this->call('POST', '/api/v1/payments/webhook/stripe', [], [], [], [
            'CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json',
            'HTTP_STRIPE_SIGNATURE' => $signature,
        ], $raw);
    }
}
