<?php

namespace App\Services;

use App\Contracts\PaymentGateway;
use App\Models\Order;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class XenditGateway implements PaymentGateway
{
    public function createPayment(Order $order, string $method): array
    {
        $response = $this->http()->post($this->baseUrl() . '/v2/invoices', [
            'external_id' => $order->id, 'amount' => $order->total,
            'payer_email' => $order->user?->email, 'description' => 'KMSIT Computer order ' . $order->id,
        ])->throw()->json();
        $reference = $response['id'] ?? null;
        if (!is_string($reference) || $reference === '') throw new RuntimeException('Respons Xendit tidak valid.');
        return ['reference' => $reference, 'checkout_url' => $response['invoice_url'] ?? null, 'expires_at' => $response['expiry_date'] ?? null, 'raw' => $response];
    }

    public function verifyWebhook(array $payload, string $signature): bool
    {
        return hash_equals((string) config('payment.xendit.callback_token'), $signature);
    }

    private function http(): PendingRequest
    {
        return Http::withBasicAuth(config('payment.xendit.api_key'), '')
            ->timeout((int) config('payment.http.timeout'))
            ->connectTimeout((int) config('payment.http.connect_timeout'));
    }

    private function baseUrl(): string
    {
        return rtrim((string) config('payment.xendit.base_url'), '/');
    }
}
