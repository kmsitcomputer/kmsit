<?php

namespace App\Contracts;

/**
 * Shipping provider boundary (IMP-004). Provider-specific payloads are
 * normalized by the implementation; callers only see application shapes.
 */
interface ShippingProvider
{
    /** @return array<int, array{id: int|string, name: string}> */
    public function provinces(): array;

    /** @return array<int, array{id: int|string, name: string, zip_code?: string|null}> */
    public function cities(int|string $provinceId): array;

    /** @return array<int, array{id: int|string, name: string, zip_code?: string|null}> */
    public function districts(int|string $cityId): array;

    /** @return array<int, array{id: int|string, name: string, zip_code?: string|null}> */
    public function subdistricts(int|string $districtId): array;

    /**
     * @return array<int, array{courier: string, courier_name: string, service: string,
     *     service_name: string, description: string|null, cost: int, etd: string|null}>
     */
    public function costs(int|string $originSubdistrictId, int|string $destinationSubdistrictId, int $weightGrams, string $couriers): array;
}
