<?php

namespace App\Services;

use App\Contracts\PaymentGateway;
use App\Models\Order;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class StripeGateway implements PaymentGateway
{
    public function createPayment(Order $order, string $method): array
    {
        // Stripe unit_amount is in minor units (cents/pennies). Zero-decimal currencies like IDR/JPY
        // are charged directly; all other currencies must be multiplied by 100.
        $zeroDecimal = in_array(strtoupper($order->currency), ['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'], true);
        $unitAmount = $zeroDecimal ? $order->total : $order->total * 100;
        $response = $this->http()->asForm()->post($this->baseUrl() . '/v1/checkout/sessions', [
            'mode' => 'payment', 'success_url' => config('app.url') . '/#/checkout/' . $order->id,
            'cancel_url' => config('app.url') . '/#/checkout/' . $order->id,
            'line_items[0][price_data][currency]' => strtolower($order->currency),
            'line_items[0][price_data][product_data][name]' => 'KMSIT Computer order ' . $order->id,
            'line_items[0][price_data][unit_amount]' => $unitAmount,
            'line_items[0][quantity]' => 1,
            'metadata[order_id]' => $order->id,
        ])->throw()->json();
        $reference = $response['id'] ?? null;
        if (!is_string($reference) || $reference === '') throw new RuntimeException('Respons Stripe tidak valid.');
        return ['reference' => $reference, 'checkout_url' => $response['url'] ?? null, 'expires_at' => $response['expires_at'] ?? null, 'raw' => $response];
    }

    public function verifyWebhook(array $payload, string $signature): bool
    {
        return filled($signature) && filled(config('payment.stripe.webhook_secret'));
    }

    private function http(): PendingRequest
    {
        return Http::withBasicAuth(config('payment.stripe.secret_key'), '')
            ->timeout((int) config('payment.http.timeout'))
            ->connectTimeout((int) config('payment.http.connect_timeout'));
    }

    private function baseUrl(): string
    {
        return rtrim((string) config('payment.stripe.base_url'), '/');
    }
}
