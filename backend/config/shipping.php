<?php

return [
    // RajaOngkir Shipping Cost V2 (Komerce). Backend-only: the key must never
    // reach the browser. Docs: https://rajaongkir.com/docs (base URL + `key:` header).
    // Static deployment config only — admin-managed origin/couriers resolve at
    // runtime in ShippingService so config:cache never freezes dashboard edits.
    'api_key' => env('RAJAONGKIR_API_KEY'),
    'base_url' => env('RAJAONGKIR_BASE_URL', 'https://rajaongkir.komerce.id/api/v1'),

    // Environment fallbacks for the server-controlled shipping origin
    // (sub-district ID from the region API) and enabled couriers
    // (colon-separated, e.g. "jne:jnt:sicepat"). Persisted admin settings win
    // at runtime; the customer can never override these via request data.
    'origin_subdistrict_id' => env('SHIPPING_ORIGIN_SUBDISTRICT_ID'),
    'couriers' => env('SHIPPING_COURIERS', 'jne:jnt:sicepat'),

    // Outbound call limits for provider HTTP calls. Quotes/checkout revalidation
    // never retry automatically inside the request; these caps only bound how
    // long a single attempt may block the request.
    'http' => [
        'timeout' => (int) env('SHIPPING_HTTP_TIMEOUT', 15),
        'connect_timeout' => (int) env('SHIPPING_HTTP_CONNECT_TIMEOUT', 5),
    ],

    // Region reference cache TTL in seconds (provider docs recommend caching
    // static province/courier data; cost responses are never cached as prices).
    'region_cache_ttl' => (int) env('SHIPPING_REGION_CACHE_TTL', 86400),
];
