<?php

namespace App\Services;

use App\Contracts\PaymentGateway;
use App\Services\StripeGateway;
use App\Services\TripayGateway;
use App\Services\XenditGateway;
use InvalidArgumentException;

class PaymentGatewayManager
{
    public function resolve(string $gateway): PaymentGateway
    {
        return match ($gateway) {
            'tripay' => $this->tripay(),
            'xendit' => $this->xendit(),
            'stripe' => $this->stripe(),
            default => throw new InvalidArgumentException('Gateway payment tidak didukung.'),
        };
    }

    private function tripay(): PaymentGateway
    {
        if (!config('payment.tripay.api_key') || !config('payment.tripay.private_key') || !config('payment.tripay.merchant_code')) throw new InvalidArgumentException('Tripay belum dikonfigurasi.');
        return new TripayGateway();
    }

    private function xendit(): PaymentGateway
    {
        if (!config('payment.xendit.api_key') || !config('payment.xendit.callback_token')) throw new InvalidArgumentException('Xendit belum dikonfigurasi.');
        return new XenditGateway();
    }

    private function stripe(): PaymentGateway
    {
        if (!config('payment.stripe.secret_key') || !config('payment.stripe.webhook_secret')) throw new InvalidArgumentException('Stripe belum dikonfigurasi.');
        return new StripeGateway();
    }
}
