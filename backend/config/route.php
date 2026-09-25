<?php

return [
    // OpenRouteService (HeiGIT). Backend-only: the key must never reach the
    // browser. Docs: POST /v2/directions/{profile}, coordinates [lng, lat].
    // Static deployment config only — Local Delivery tariffs resolve at
    // runtime from persisted Dashboard settings (never config:cache frozen).
    'api_key' => env('OPENROUTE_API_KEY'),
    'base_url' => env('OPENROUTE_BASE_URL', 'https://api.openrouteservice.org'),

    // Safe default routing profile; the customer can never override this
    // via request data.
    'profile' => env('OPENROUTE_PROFILE', 'driving-car'),

    // Outbound call limits for provider HTTP calls. Route lookups never
    // retry automatically inside the request; these caps only bound how
    // long a single attempt may block the request.
    'http' => [
        'timeout' => (int) env('OPENROUTE_HTTP_TIMEOUT', 15),
        'connect_timeout' => (int) env('OPENROUTE_HTTP_CONNECT_TIMEOUT', 5),
    ],
];
