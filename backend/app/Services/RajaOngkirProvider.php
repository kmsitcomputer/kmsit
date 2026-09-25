<?php

namespace App\Services;

use App\Contracts\ShippingProvider;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use InvalidArgumentException;
use RuntimeException;

/**
 * RajaOngkir Shipping Cost V2 (Komerce) implementation.
 *
 * Contract source: https://rajaongkir.com/docs (base URL, `key:` header,
 * destination hierarchy, district domestic-cost endpoint). Runs backend-only;
 * the API key never leaves the server.
 */
class RajaOngkirProvider implements ShippingProvider
{
    public function __construct(
        private readonly string $apiKey,
        private readonly string $baseUrl,
        private readonly int $timeout,
        private readonly int $connectTimeout,
    ) {}

    public static function fromConfig(): self
    {
        $apiKey = (string) config('shipping.api_key');
        if ($apiKey === '') throw new InvalidArgumentException('RajaOngkir belum dikonfigurasi.');
        return new self(
            $apiKey,
            rtrim((string) config('shipping.base_url', 'https://rajaongkir.komerce.id/api/v1'), '/'),
            max(1, (int) config('shipping.http.timeout', 15)),
            max(1, (int) config('shipping.http.connect_timeout', 5)),
        );
    }

    public function provinces(): array
    {
        return $this->list('destination/province');
    }

    public function cities(int|string $provinceId): array
    {
        return $this->list('destination/city/' . urlencode((string) $provinceId));
    }

    public function districts(int|string $cityId): array
    {
        return $this->list('destination/district/' . urlencode((string) $cityId));
    }

    public function subdistricts(int|string $districtId): array
    {
        return $this->list('destination/sub-district/' . urlencode((string) $districtId));
    }

    public function costs(int|string $originSubdistrictId, int|string $destinationSubdistrictId, int $weightGrams, string $couriers): array
    {
        if ($weightGrams < 1) throw new InvalidArgumentException('Berat paket tidak valid.');
        if (trim($couriers) === '') throw new InvalidArgumentException('Kurir belum dipilih.');
        $payload = $this->post('calculate/district/domestic-cost', [
            'origin' => (string) $originSubdistrictId,
            'destination' => (string) $destinationSubdistrictId,
            'weight' => $weightGrams,
            'courier' => $couriers,
            'price' => 'lowest',
        ]);
        $rows = is_array($payload) ? $payload : [];
        $services = [];
        foreach ($rows as $row) {
            if (!is_array($row)) continue;
            $cost = isset($row['cost']) ? (int) $row['cost'] : 0;
            if ($cost < 1) continue;
            $services[] = [
                'courier' => strtolower(trim((string) ($row['code'] ?? ''))),
                'courier_name' => trim((string) ($row['name'] ?? '')),
                'service' => trim((string) ($row['service'] ?? '')),
                'service_name' => trim((string) ($row['service'] ?? '')),
                'description' => isset($row['description']) && $row['description'] !== '' ? (string) $row['description'] : null,
                'cost' => $cost,
                'etd' => isset($row['etd']) && $row['etd'] !== '' ? (string) $row['etd'] : null,
            ];
        }
        return array_values(array_filter($services, fn (array $service) => $service['courier'] !== '' && $service['service'] !== ''));
    }

    /** @return array<int, mixed> */
    private function list(string $path): array
    {
        $payload = $this->get($path);
        if (!is_array($payload)) throw new RuntimeException('Respons wilayah tidak valid.');
        return array_values($payload);
    }

    private function get(string $path): mixed
    {
        try {
            $response = Http::withHeaders(['key' => $this->apiKey])
                ->timeout($this->timeout)->connectTimeout($this->connectTimeout)
                ->acceptJson()->get($this->baseUrl . '/' . $path);
        } catch (ConnectionException $e) {
            throw new RuntimeException('Layanan wilayah/ongkir tidak dapat dihubungi. Coba lagi.', previous: $e);
        }
        return $this->data($response->status(), $response->json());
    }

    private function post(string $path, array $form): mixed
    {
        try {
            $response = Http::withHeaders(['key' => $this->apiKey])
                ->timeout($this->timeout)->connectTimeout($this->connectTimeout)
                ->acceptJson()->asForm()->post($this->baseUrl . '/' . $path, $form);
        } catch (ConnectionException $e) {
            throw new RuntimeException('Layanan wilayah/ongkir tidak dapat dihubungi. Coba lagi.', previous: $e);
        }
        return $this->data($response->status(), $response->json());
    }

    private function data(int $status, mixed $json): mixed
    {
        if ($status === 401) throw new RuntimeException('Konfigurasi layanan ongkir tidak valid.');
        if (!is_array($json) || ($json['meta']['status'] ?? null) !== 'success') {
            $message = is_array($json) ? (string) ($json['meta']['message'] ?? '') : '';
            throw new RuntimeException($message !== '' && $status < 500 ? $message : 'Layanan wilayah/ongkir tidak dapat dihubungi. Coba lagi.');
        }
        return $json['data'] ?? [];
    }
}
