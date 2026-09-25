<?php

namespace App\Contracts;

/**
 * Route provider boundary (IMP-005). Implementations return normalized
 * application shapes; callers never see raw provider payloads.
 */
interface RouteProvider
{
    /**
     * @return array{distance_meters: int, duration_seconds: int|null}
     */
    public function route(float $fromLat, float $fromLng, float $toLat, float $toLng, string $profile): array;
}
