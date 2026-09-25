<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Schema;
use InvalidArgumentException;

/**
 * Local Delivery pricing + eligibility (IMP-005). Keeps tariff logic out of
 * OpenRouteProvider. All business settings resolve at runtime from persisted
 * Dashboard settings (never config:cache frozen, never customer input).
 *
 * Locked contract: actual_km = meters/1000; cost = min_fee when actual <=
 * min_km, else min_fee + halfUp(excess_km) * rate (integer money math).
 * Maximum gate uses ACTUAL distance before tariff rounding.
 */
class LocalDeliveryService
{
    public function __construct(private readonly RouteManager $routes) {}

    public static function make(): self
    {
        return new self(RouteManager::make());
    }

    public function enabled(): bool
    {
        return $this->setting('local_delivery_enabled') === '1';
    }

    /**
     * Quote a Local Delivery option. Throws InvalidArgumentException for
     * configuration/customer errors, RuntimeException for provider failures.
     *
     * @return array{eligible: bool, distance_meters: int, duration_seconds: int|null,
     *     actual_km: float, shipping_cost: int, store: array{name: string|null, latitude: float, longitude: float}}
     */
    public function quote(float $toLat, float $toLng): array
    {
        $config = $this->config();
        OpenRouteProvider::assertCoordinate($toLat, $toLng);
        $route = $this->routes->localDelivery($config['store_latitude'], $config['store_longitude'], $toLat, $toLng);
        $actualKm = $route['distance_meters'] / 1000;
        if ($actualKm > $config['maximum_distance_km']) {
            throw new InvalidArgumentException('Lokasi di luar jangkauan Local Delivery.');
        }
        return [
            'eligible' => true,
            'distance_meters' => $route['distance_meters'],
            'duration_seconds' => $route['duration_seconds'],
            'actual_km' => round($actualKm, 3),
            'shipping_cost' => self::price($route['distance_meters'], $config['minimum_distance_km'], $config['minimum_fee'], $config['rate_per_km']),
            'store' => ['name' => $config['store_name'], 'latitude' => $config['store_latitude'], 'longitude' => $config['store_longitude']],
        ];
    }

    /**
     * Locked tariff in deterministic integer meters (never binary float):
     * minimum km → meters, excess meters split into whole km + remainder,
     * remainder < 500 down else up. Money stays integer.
     *
     * Minimum below 1 meter is treated as 0 (free-pickup window), matching
     * the previous float behavior where min 0 meant actual <= 0 → min fee.
     */
    public static function price(int $distanceMeters, float $minKm, int $minFee, int $ratePerKm): int
    {
        $minMeters = self::kmToMeters($minKm);
        if ($distanceMeters <= $minMeters) return $minFee;
        $excess = $distanceMeters - $minMeters;
        $rounded = intdiv($excess, 1000) + ($excess % 1000 >= 500 ? 1 : 0);
        return $minFee + $rounded * $ratePerKm;
    }

    /**
     * Deterministic km→meters for dashboard decimals (0.1 km steps per the
     * settings form): round half up to the nearest meter, no float residue.
     */
    public static function kmToMeters(float $km): int
    {
        if ($km <= 0) return 0;
        return (int) round($km * 1000, 0, PHP_ROUND_HALF_UP);
    }

    /**
     * @return array{enabled: bool, store_name: string|null, store_latitude: float, store_longitude: float,
     *     minimum_distance_km: float, minimum_fee: int, rate_per_km: int, maximum_distance_km: float}
     */
    public function config(): array
    {
        if ($this->setting('local_delivery_enabled') !== '1') {
            throw new InvalidArgumentException('Local Delivery belum diaktifkan.');
        }
        $storeLat = $this->float('local_delivery_store_latitude');
        $storeLng = $this->float('local_delivery_store_longitude');
        if ($storeLat === null || $storeLng === null) throw new InvalidArgumentException('Lokasi toko belum dikonfigurasi.');
        OpenRouteProvider::assertCoordinate($storeLat, $storeLng);
        $minKm = $this->float('local_delivery_minimum_distance_km') ?? 0;
        $minFee = $this->int('local_delivery_minimum_fee') ?? 0;
        $rate = $this->int('local_delivery_rate_per_km') ?? 0;
        $maxKm = $this->float('local_delivery_maximum_distance_km');
        if ($minKm < 0 || $minFee < 0 || $rate < 0 || $maxKm === null || $maxKm <= 0) {
            throw new InvalidArgumentException('Konfigurasi tarif Local Delivery belum lengkap.');
        }
        return [
            'enabled' => true,
            'store_name' => $this->setting('local_delivery_store_name'),
            'store_latitude' => $storeLat, 'store_longitude' => $storeLng,
            'minimum_distance_km' => $minKm, 'minimum_fee' => $minFee,
            'rate_per_km' => $rate, 'maximum_distance_km' => $maxKm,
        ];
    }

    private function setting(string $key): ?string
    {
        try {
            if (!Schema::hasTable('settings')) return null;
            $value = Setting::where('setting_key', $key)->value('setting_value');
            return is_string($value) ? $value : null;
        } catch (\Throwable) {
            return null;
        }
    }

    private function float(string $key): ?float
    {
        $raw = $this->setting($key);
        if ($raw === null || trim($raw) === '' || !is_numeric($raw)) return null;
        $value = (float) $raw;
        return is_finite($value) ? $value : null;
    }

    private function int(string $key): ?int
    {
        $raw = $this->setting($key);
        if ($raw === null || trim($raw) === '' || !is_numeric($raw)) return null;
        return (int) round((float) $raw);
    }
}
