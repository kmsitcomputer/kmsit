<?php

namespace App\Services;

use App\Contracts\PaymentGateway;
use App\Models\Order;
use Illuminate\Support\Facades\Http;

class StripeGateway implements PaymentGateway
{
    public function createPayment(Order $order, string $method): array
    {
        $response = Http::withBasicAuth(config('payment.stripe.secret_key'), '')
            ->asForm()->post('https://api.stripe.com/v1/checkout/sessions', [
                'mode' => 'payment', 'success_url' => config('app.url') . '/#/checkout/' . $order->id,
                'cancel_url' => config('app.url') . '/#/checkout/' . $order->id,
                'line_items[0][price_data][currency]' => strtolower($order->currency),
                'line_items[0][price_data][product_data][name]' => 'KMSIT Computer order ' . $order->id,
                'line_items[0][price_data][unit_amount]' => $order->total,
                'line_items[0][quantity]' => 1,
                'metadata[order_id]' => $order->id,
            ])->throw()->json();
        return ['reference' => $response['id'] ?? $order->id, 'checkout_url' => $response['url'] ?? null, 'raw' => $response];
    }

    public function verifyWebhook(array $payload, string $signature): bool
    {
        return filled($signature) && filled(config('payment.stripe.webhook_secret'));
    }
}
