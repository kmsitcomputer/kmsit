<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CartItem;
use App\Services\ShippingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;
use RuntimeException;

/**
 * Region reference + shipping quote endpoints (IMP-004). All data comes from
 * the backend provider boundary; the API key never reaches the browser.
 */
class ShippingController extends Controller
{
    public function provinces(): JsonResponse
    {
        try {
            return response()->json(['provinces' => $this->shipping()->provinces()]);
        } catch (RuntimeException|InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }
    }

    public function cities(int|string $provinceId): JsonResponse
    {
        try {
            return response()->json(['cities' => $this->shipping()->cities($provinceId)]);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }
    }

    public function districts(int|string $cityId): JsonResponse
    {
        try {
            return response()->json(['districts' => $this->shipping()->districts($cityId)]);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }
    }

    public function subdistricts(int|string $districtId): JsonResponse
    {
        try {
            return response()->json(['subdistricts' => $this->shipping()->subdistricts($districtId)]);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }
    }

    public function quote(Request $request): JsonResponse
    {
        $data = $request->validate([
            'province_id' => ['required'], 'city_id' => ['required'],
            'district_id' => ['required'], 'subdistrict_id' => ['required'],
        ]);
        try {
            $shipping = $this->shipping();
            $items = CartItem::with(['product', 'variant'])->where('user_id', $request->user()->id)->get();
            if ($items->isEmpty()) abort(422, 'Keranjang kosong.');
            if (!$shipping->needsShipping(ShippingService::cartLines($items))) {
                return response()->json(['weight_grams' => 0, 'services' => [], 'message' => 'Keranjang digital tidak memerlukan pengiriman.']);
            }
            $quote = $shipping->quote(ShippingService::cartLines($items),
                $data['province_id'], $data['city_id'], $data['district_id'], $data['subdistrict_id']);
            return response()->json($quote);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }
    }

    private function shipping(): ShippingService
    {
        return ShippingService::make();
    }
}
