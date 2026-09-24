<?php

namespace App\Services;

use App\Contracts\PaymentGateway;
use App\Models\Order;
use Illuminate\Support\Facades\Http;

class TripayGateway implements PaymentGateway
{
    public function createPayment(Order $order, string $method): array
    {
        $merchantRef = $order->id;
        $signature = hash_hmac('sha256', config('payment.tripay.merchant_code') . $merchantRef . $order->total, config('payment.tripay.private_key'));
        $response = Http::withToken(config('payment.tripay.api_key'))->asForm()->post(rtrim(config('payment.tripay.base_url'), '/') . '/merchant/transaction/create', [
            'method' => $method, 'merchant_ref' => $merchantRef, 'amount' => $order->total,
            'customer_name' => $order->user?->name, 'customer_email' => $order->user?->email,
            'order_items' => $order->items->map(fn ($item) => ['sku' => $item->ref_id, 'name' => $item->title, 'price' => $item->price, 'quantity' => $item->qty])->values()->all(),
            'signature' => $signature,
        ])->throw()->json();
        return ['reference' => $response['data']['reference'] ?? $merchantRef, 'checkout_url' => $response['data']['checkout_url'] ?? null, 'raw' => $response];
    }

    public function verifyWebhook(array $payload, string $signature): bool
    {
        $expected = hash_hmac('sha256', ($payload['merchant_ref'] ?? '') . ($payload['amount'] ?? '') . ($payload['status'] ?? ''), config('payment.tripay.private_key'));
        return hash_equals($expected, $signature);
    }
}
