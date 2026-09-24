<?php

return [
    'mode' => env('PAYMENT_MODE', 'sandbox'),
    'active' => env('PAYMENT_GATEWAY', 'tripay'),

    // Outbound call limits for provider HTTP calls. Create-payment is never retried
    // automatically (a retry can book a duplicate transaction); these caps only bound
    // how long a single attempt may block the request.
    'http' => [
        'timeout' => (int) env('PAYMENT_HTTP_TIMEOUT', 15),
        'connect_timeout' => (int) env('PAYMENT_HTTP_CONNECT_TIMEOUT', 5),
    ],

    // Checkout methods shown to buyers per provider (key => label). Keys are sent to the provider
    // unchanged; no fee is shown because the charged amount is always the server order total.
    'methods' => [
        'tripay' => ['QRIS' => 'QRIS', 'BRIVA' => 'Virtual Account BRI', 'MANDIRIVA' => 'Virtual Account Mandiri', 'DANA' => 'DANA', 'OVO' => 'OVO'],
        'xendit' => ['BCAVA' => 'Virtual Account BCA', 'BNCVA' => 'Virtual Account BNC', 'LALAI' => 'LinkAja', 'CREDIT_CARD' => 'Kartu Kredit'],
        'stripe' => ['CARD' => 'Kartu Kredit / Debit', 'LINK' => 'Stripe Link'],
    ],

    'tripay' => [
        'api_key' => env('TRIPAY_API_KEY'),
        'private_key' => env('TRIPAY_PRIVATE_KEY'),
        'merchant_code' => env('TRIPAY_MERCHANT_CODE'),
        'webhook_secret' => env('TRIPAY_WEBHOOK_SECRET'),
        'base_url' => env('TRIPAY_BASE_URL', 'https://tripay.co.id/api'),
    ],
    'xendit' => [
        'api_key' => env('XENDIT_API_KEY'),
        'callback_token' => env('XENDIT_CALLBACK_TOKEN'),
        'base_url' => env('XENDIT_BASE_URL', 'https://api.xendit.co'),
    ],
    'stripe' => [
        'publishable_key' => env('STRIPE_PUBLISHABLE_KEY'),
        'secret_key' => env('STRIPE_SECRET_KEY'),
        'webhook_secret' => env('STRIPE_WEBHOOK_SECRET'),
        'base_url' => env('STRIPE_BASE_URL', 'https://api.stripe.com'),
    ],
];
