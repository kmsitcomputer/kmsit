<?php

return [
    'mode' => env('PAYMENT_MODE', 'sandbox'),
    'active' => env('PAYMENT_GATEWAY', 'tripay'),
    'tripay' => [
        'api_key' => env('TRIPAY_API_KEY'),
        'private_key' => env('TRIPAY_PRIVATE_KEY'),
        'merchant_code' => env('TRIPAY_MERCHANT_CODE'),
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
    ],
];
