<?php

namespace App\Services;

use App\Contracts\RouteProvider;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use InvalidArgumentException;
use RuntimeException;

/**
 * OpenRouteService directions implementation (IMP-005).
 *
 * Contract source: official ORS backend docs —
 * POST /v2/directions/{profile} with JSON body, coordinates as
 * [longitude, latitude] pairs, JSON return with routes[].summary
 * (distance in meters, duration in seconds).
 * Runs backend-only; the API key never leaves the server.
 * No tariff logic lives here — routing only.
 */
class OpenRouteProvider implements RouteProvider
{
    public const PROFILES = ['driving-car', 'driving-hgv', 'cycling-regular', 'foot-walking'];

    public function __construct(
        private readonly string $apiKey,
        private readonly string $baseUrl,
        private readonly int $timeout,
        private readonly int $connectTimeout,
    ) {}

    public static function fromConfig(): self
    {
        $apiKey = (string) config('route.api_key');
        if ($apiKey === '') throw new InvalidArgumentException('OpenRoute belum dikonfigurasi.');
        return new self(
            $apiKey,
            rtrim((string) config('route.base_url', 'https://api.openrouteservice.org'), '/'),
            max(1, (int) config('route.http.timeout', 15)),
            max(1, (int) config('route.http.connect_timeout', 5)),
        );
    }

    public function route(float $fromLat, float $fromLng, float $toLat, float $toLng, string $profile): array
    {
        self::assertCoordinate($fromLat, $fromLng);
        self::assertCoordinate($toLat, $toLng);
        if (!in_array($profile, self::PROFILES, true)) throw new InvalidArgumentException('Profil rute tidak didukung.');
        try {
            $response = Http::withHeaders(['Authorization' => $this->apiKey])
                ->timeout($this->timeout)->connectTimeout($this->connectTimeout)
                ->acceptJson()->post($this->baseUrl . '/v2/directions/' . $profile, [
                    'coordinates' => [[$fromLng, $fromLat], [$toLng, $toLat]],
                ]);
        } catch (ConnectionException $e) {
            throw new RuntimeException('Layanan rute tidak dapat dihubungi. Coba lagi.', previous: $e);
        }
        $status = $response->status();
        if ($status === 401 || $status === 403) throw new RuntimeException('Konfigurasi layanan rute tidak valid.');
        $json = $response->json();
        if (!is_array($json)) throw new RuntimeException('Respons rute tidak valid.');
        $summary = is_array($json['routes'] ?? null) ? ($json['routes'][0]['summary'] ?? null) : null;
        if (!is_array($summary) || !isset($summary['distance']) || !is_numeric($summary['distance'])) {
            $message = is_string($json['error'] ?? null) ? $json['error'] : (is_string($json['message'] ?? null) ? $json['message'] : '');
            throw new RuntimeException($message !== '' && $status < 500 ? $message : 'Rute tidak ditemukan. Coba lokasi lain.');
        }
        $distance = (int) round((float) $summary['distance']);
        if ($distance < 1) throw new RuntimeException('Rute tidak ditemukan. Coba lokasi lain.');
        return [
            'distance_meters' => $distance,
            'duration_seconds' => isset($summary['duration']) && is_numeric($summary['duration']) ? (int) round((float) $summary['duration']) : null,
        ];
    }

    public static function assertCoordinate(float $lat, float $lng): void
    {
        foreach (['lat' => $lat, 'lng' => $lng] as $kind => $value) {
            if (!is_finite($value)) throw new InvalidArgumentException('Koordinat tidak valid.');
        }
        if ($lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) throw new InvalidArgumentException('Koordinat tidak valid.');
    }
}
