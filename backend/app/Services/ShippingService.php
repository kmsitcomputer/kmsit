<?php

namespace App\Services;

use App\Contracts\ShippingProvider;
use App\Models\Setting;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;
use InvalidArgumentException;

/**
 * Application shipping service (IMP-004). Owns server-authoritative weight,
 * destination-hierarchy validation, region caching (reference data only —
 * never prices), quote normalization, and checkout revalidation.
 */
class ShippingService
{
    public function __construct(private readonly ShippingProvider $provider) {}

    public static function make(): self
    {
        return new self(RajaOngkirProvider::fromConfig());
    }

    /** @return array<int, array{id: int|string, name: string}> */
    public function provinces(): array
    {
        return Cache::remember('shipping:provinces', (int) config('shipping.region_cache_ttl', 86400), fn () => $this->provider->provinces());
    }

    /** @return array<int, array{id: int|string, name: string, zip_code?: string|null}> */
    public function cities(int|string $provinceId): array
    {
        $this->assertId($provinceId);
        return Cache::remember("shipping:cities:{$provinceId}", (int) config('shipping.region_cache_ttl', 86400), fn () => $this->provider->cities($provinceId));
    }

    /** @return array<int, array{id: int|string, name: string, zip_code?: string|null}> */
    public function districts(int|string $cityId): array
    {
        $this->assertId($cityId);
        return Cache::remember("shipping:districts:{$cityId}", (int) config('shipping.region_cache_ttl', 86400), fn () => $this->provider->districts($cityId));
    }

    /** @return array<int, array{id: int|string, name: string, zip_code?: string|null}> */
    public function subdistricts(int|string $districtId): array
    {
        $this->assertId($districtId);
        return Cache::remember("shipping:subdistricts:{$districtId}", (int) config('shipping.region_cache_ttl', 86400), fn () => $this->provider->subdistricts($districtId));
    }

    /**
     * Total authoritative physical weight in grams for cart/order lines.
     * Each line: ['product' => Product, 'variant' => ProductVariant|null, 'qty' => int].
     */
    public function weightGrams(iterable $lines): int
    {
        $total = 0;
        foreach ($lines as $line) {
            $product = is_array($line) ? ($line['product'] ?? null) : ($line->product ?? null);
            $variant = is_array($line) ? ($line['variant'] ?? null) : ($line->variant ?? null);
            $qty = (int) (is_array($line) ? ($line['qty'] ?? $line['cart']->qty ?? 1) : ($line->qty ?? 1));
            if (!$product || (bool) $product->is_digital) continue;
            $grams = (int) ($variant?->weight_grams ?? $product->weight_grams ?? 0);
            if ($grams < 1) throw new InvalidArgumentException("Berat produk {$product->name} belum dikonfigurasi.");
            $total += $grams * max(1, $qty);
        }
        return $total;
    }

    public function needsShipping(iterable $lines): bool
    {
        foreach ($lines as $line) {
            $product = is_array($line) ? ($line['product'] ?? null) : ($line->product ?? null);
            if ($product && !(bool) $product->is_digital) return true;
        }
        return false;
    }

    /**
     * Validate destination hierarchy against provider relationships and
     * resolve human-readable names. Returns id+name snapshot pairs.
     */
    public function resolveDestination(int|string $provinceId, int|string $cityId, int|string $districtId, int|string $subdistrictId): array
    {
        $province = $this->find($this->provinces(), $provinceId, 'Provinsi');
        $city = $this->findChild($this->cities($province['id']), $cityId, 'Kabupaten/kota', 'provinsi');
        $district = $this->findChild($this->districts($city['id']), $districtId, 'Kecamatan', 'kabupaten/kota');
        $subdistrict = $this->findChild($this->subdistricts($district['id']), $subdistrictId, 'Kelurahan/desa', 'kecamatan');
        return [
            'province_id' => (string) $province['id'], 'province_name' => (string) $province['name'],
            'city_id' => (string) $city['id'], 'city_name' => (string) $city['name'],
            'district_id' => (string) $district['id'], 'district_name' => (string) $district['name'],
            'subdistrict_id' => (string) $subdistrict['id'], 'subdistrict_name' => (string) $subdistrict['name'],
            'postal_code' => isset($subdistrict['zip_code']) && (string) $subdistrict['zip_code'] !== '' && (string) $subdistrict['zip_code'] !== '0'
                ? (string) $subdistrict['zip_code'] : null,
        ];
    }

    /**
     * Build a normalized quote: authoritative weight + server origin +
     * validated destination + enabled couriers only.
     */
    public function quote(iterable $lines, int|string $provinceId, int|string $cityId, int|string $districtId, int|string $subdistrictId): array
    {
        $weight = $this->weightGrams($lines);
        if ($weight < 1) throw new InvalidArgumentException('Berat paket tidak valid.');
        $destination = $this->resolveDestination($provinceId, $cityId, $districtId, $subdistrictId);
        $origin = $this->originSubdistrictId();
        if ($origin === '') throw new InvalidArgumentException('Konfigurasi lokasi toko belum lengkap.');
        $couriers = implode(':', $this->enabledCouriers());
        if ($couriers === '') throw new InvalidArgumentException('Tidak ada kurir yang diaktifkan.');
        $services = $this->provider->costs($origin, $destination['subdistrict_id'], $weight, $couriers);
        return ['weight_grams' => $weight, 'destination' => $destination, 'services' => $services];
    }

    /**
     * Revalidate a customer-selected courier/service at checkout and return
     * the authoritative option (cost included). Never trusts frontend price.
     */
    public function revalidate(iterable $lines, int|string $provinceId, int|string $cityId, int|string $districtId, int|string $subdistrictId, string $courier, string $service): array
    {
        $quote = $this->quote($lines, $provinceId, $cityId, $districtId, $subdistrictId);
        foreach ($quote['services'] as $option) {
            if ($option['courier'] === strtolower(trim($courier)) && $option['service'] === trim($service)) {
                return ['weight_grams' => $quote['weight_grams'], 'destination' => $quote['destination'], 'option' => $option];
            }
        }
        throw new InvalidArgumentException('Layanan pengiriman yang dipilih tidak tersedia.');
    }

    /**
     * Server-controlled origin: persisted admin setting wins, environment/
     * static config is the fallback. Resolved at runtime (never frozen by
     * config:cache) and never from customer request data.
     */
    public function originSubdistrictId(): string
    {
        return trim((string) ($this->adminSetting('shipping_origin_subdistrict_id') ?? config('shipping.origin_subdistrict_id') ?? ''));
    }

    /** @return array<int, string> */
    public function enabledCouriers(): array
    {
        $raw = $this->adminSetting('shipping_couriers') ?? config('shipping.couriers', '');
        $list = is_array($raw) ? $raw : explode(':', (string) $raw);
        return array_values(array_filter(array_map(fn ($code) => strtolower(trim((string) $code)), $list)));
    }

    public function courierName(string $courier): ?string
    {
        foreach ($this->enabledCouriers() as $code) {
            if ($code === strtolower(trim($courier))) return strtoupper($code);
        }
        return null;
    }

    public static function cartLines(Collection $items): array
    {
        return $items->map(fn ($cartItem) => ['product' => $cartItem->product, 'variant' => $cartItem->variant, 'qty' => $cartItem->qty])->all();
    }

    private function assertId(int|string $id): void
    {
        if (trim((string) $id) === '') throw new InvalidArgumentException('ID wilayah tidak valid.');
    }

    /** Persisted admin setting lookup; null when absent so static config wins. */
    private function adminSetting(string $key): ?string
    {
        try {
            if (!Schema::hasTable('settings')) return null;
            $value = Setting::where('setting_key', $key)->value('setting_value');
            return is_string($value) && $value !== '' ? $value : null;
        } catch (\Throwable) {
            return null;
        }
    }

    private function find(array $rows, int|string $id, string $label): array
    {
        foreach ($rows as $row) {
            if (is_array($row) && (string) ($row['id'] ?? '') === (string) $id) return $row;
        }
        throw new InvalidArgumentException("{$label} tidak valid.");
    }

    private function findChild(array $rows, int|string $id, string $label, string $parentLabel): array
    {
        foreach ($rows as $row) {
            if (is_array($row) && (string) ($row['id'] ?? '') === (string) $id) return $row;
        }
        throw new InvalidArgumentException("{$label} tidak sesuai dengan {$parentLabel} yang dipilih.");
    }
}
