<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\LocalDeliveryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;
use RuntimeException;

/**
 * Local Delivery endpoints (IMP-005). Destination coordinates come from the
 * Google Maps picker; route distance, eligibility and price are backend
 * authoritative. Client-supplied distance/cost/eligibility is never trusted.
 */
class LocalDeliveryController extends Controller
{
    public function config(): JsonResponse
    {
        try {
            $config = app(LocalDeliveryService::class)->config();
        } catch (InvalidArgumentException $e) {
            return response()->json(['enabled' => false, 'message' => $e->getMessage()]);
        }
        return response()->json([
            'enabled' => true,
            'store_name' => $config['store_name'],
            'minimum_distance_km' => $config['minimum_distance_km'],
            'minimum_fee' => $config['minimum_fee'],
            'rate_per_km' => $config['rate_per_km'],
            'maximum_distance_km' => $config['maximum_distance_km'],
        ]);
    }

    public function quote(Request $request): JsonResponse
    {
        $data = $request->validate([
            'latitude' => ['required', 'numeric'],
            'longitude' => ['required', 'numeric'],
        ]);
        $lat = (float) $data['latitude'];
        $lng = (float) $data['longitude'];
        if (!is_finite($lat) || !is_finite($lng)) return response()->json(['message' => 'Koordinat tidak valid.'], 422);
        try {
            $quote = app(LocalDeliveryService::class)->quote($lat, $lng);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }
        return response()->json($quote);
    }
}
