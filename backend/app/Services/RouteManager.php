<?php

namespace App\Services;

use App\Contracts\RouteProvider;

/**
 * Route manager (IMP-005). Resolves the routing provider behind the
 * RouteProvider contract, mirroring the PaymentGatewayManager pattern.
 */
class RouteManager
{
    public function __construct(private readonly RouteProvider $provider) {}

    public static function make(): self
    {
        return new self(OpenRouteProvider::fromConfig());
    }

    /** @return array{distance_meters: int, duration_seconds: int|null} */
    public function route(float $fromLat, float $fromLng, float $toLat, float $toLng, ?string $profile = null): array
    {
        OpenRouteProvider::assertCoordinate($fromLat, $fromLng);
        OpenRouteProvider::assertCoordinate($toLat, $toLng);
        return $this->provider->route($fromLat, $fromLng, $toLat, $toLng, $profile ?: (string) config('route.profile', 'driving-car'));
    }

    /** @return array{distance_meters: int, duration_seconds: int|null} */
    public function localDelivery(float $fromLat, float $fromLng, float $toLat, float $toLng): array
    {
        $profile = $this->localProfile();
        if (!in_array($profile, OpenRouteProvider::PROFILES, true)) $profile = (string) config('route.profile', 'driving-car');
        return $this->route($fromLat, $fromLng, $toLat, $toLng, $profile);
    }

    /** Dashboard-configurable safe profile; static config is the fallback. */
    public function localProfile(): string
    {
        try {
            if (\Illuminate\Support\Facades\Schema::hasTable('settings')) {
                $value = \App\Models\Setting::where('setting_key', 'local_delivery_profile')->value('setting_value');
                if (is_string($value) && trim($value) !== '') return trim($value);
            }
        } catch (\Throwable) {
        }
        return (string) config('route.profile', 'driving-car');
    }
}
