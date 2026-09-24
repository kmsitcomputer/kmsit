<?php

namespace App\Services;

use App\Contracts\PaymentGateway;
use App\Models\Order;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class TripayGateway implements PaymentGateway
{
    public function createPayment(Order $order, string $method): array
    {
        $merchantRef = $order->id;
        $signature = hash_hmac('sha256', config('payment.tripay.merchant_code') . $merchantRef . $order->total, config('payment.tripay.private_key'));
        $response = $this->http()->asForm()->post($this->baseUrl() . '/merchant/transaction/create', [
            'method' => $method, 'merchant_ref' => $merchantRef, 'amount' => $order->total,
            'customer_name' => $order->user?->name, 'customer_email' => $order->user?->email,
            'order_items' => $order->items->map(fn ($item) => ['sku' => $item->ref_id, 'name' => $item->title, 'price' => $item->price, 'quantity' => $item->qty])->values()->all(),
            'signature' => $signature,
        ])->throw()->json();
        $reference = $response['data']['reference'] ?? null;
        if (!is_string($reference) || $reference === '') throw new RuntimeException('Respons Tripay tidak valid.');
        return ['reference' => $reference, 'checkout_url' => $response['data']['checkout_url'] ?? null, 'expires_at' => $response['data']['expired_time'] ?? null, 'raw' => $response];
    }

    public function verifyWebhook(array $payload, string $signature): bool
    {
        $expected = hash_hmac('sha256', ($payload['merchant_ref'] ?? '') . ($payload['amount'] ?? '') . ($payload['status'] ?? ''), config('payment.tripay.private_key'));
        return hash_equals($expected, $signature);
    }

    private function http(): PendingRequest
    {
        return Http::withToken(config('payment.tripay.api_key'))
            ->timeout((int) config('payment.http.timeout'))
            ->connectTimeout((int) config('payment.http.connect_timeout'));
    }

    private function baseUrl(): string
    {
        return rtrim((string) config('payment.tripay.base_url'), '/');
    }
}
