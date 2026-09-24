<?php

namespace App\Services;

use App\Contracts\PaymentGateway;
use App\Models\Order;
use Illuminate\Support\Facades\Http;

class XenditGateway implements PaymentGateway
{
    public function createPayment(Order $order, string $method): array
    {
        $response = Http::withBasicAuth(config('payment.xendit.api_key'), '')
            ->post(rtrim(config('payment.xendit.base_url'), '/') . '/v2/invoices', [
                'external_id' => $order->id, 'amount' => $order->total,
                'payer_email' => $order->user?->email, 'description' => 'KMSIT Computer order ' . $order->id,
            ])->throw()->json();
        return ['reference' => $response['id'] ?? $order->id, 'checkout_url' => $response['invoice_url'] ?? null, 'raw' => $response];
    }

    public function verifyWebhook(array $payload, string $signature): bool
    {
        return hash_equals((string) config('payment.xendit.callback_token'), $signature);
    }
}
