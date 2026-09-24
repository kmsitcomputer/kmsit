<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CartItem;
use App\Models\Product;
use App\Models\Voucher;
use App\Models\DigitalDelivery;
use Illuminate\Support\Facades\Storage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use App\Support\FileSecurity;

class ShopController extends Controller
{
    public function digitalDeliveries(Request $request): JsonResponse
    {
        $query = DigitalDelivery::with('product:id,name,slug')->where('user_id', $request->user()->id)->latest()->orderByDesc('id');
        return response()->json(['deliveries' => \App\Support\Pagination::paginate($query, $request)]);
    }

    public function download(Request $request, string $deliveryId)
    {
        $delivery = DigitalDelivery::where('id', $deliveryId)->where('user_id', $request->user()->id)->where('status', 'active')->firstOrFail();
        if (!$delivery->download_url || !FileSecurity::isPathWithin($delivery->download_url, 'digital') || !Storage::disk('local')->exists($delivery->download_url)) abort(404, 'File digital tidak tersedia.');
        $delivery->increment('downloads');
        return Storage::disk('local')->download($delivery->download_url);
    }

    public function validateVoucher(Request $request): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'string', 'max:40'], 'subtotal' => ['required', 'integer', 'min:0']]);
        app(\App\Services\VoucherReservation::class)->expireDue(Str::upper(trim($data['code'])));
        $voucher = Voucher::where('code', Str::upper(trim($data['code'])))->where('active', true)->first();
        if (!$voucher || ($voucher->expires_at && $voucher->expires_at->isPast()) || ($voucher->usage_limit > 0 && $voucher->used_count >= $voucher->usage_limit)) {
            return response()->json(['message' => 'Voucher tidak valid atau sudah tidak tersedia.'], 422);
        }
        if ($data['subtotal'] < $voucher->min_order) return response()->json(['message' => "Minimum order voucher adalah {$voucher->min_order}."], 422);
        $discount = $voucher->type === 'percent' ? (int) round($data['subtotal'] * $voucher->value / 100) : $voucher->value;
        if ($voucher->max_discount > 0) $discount = min($discount, $voucher->max_discount);
        return response()->json(['code' => $voucher->code, 'discount' => min($discount, $data['subtotal'])]);
    }

    public function products(Request $request): JsonResponse
    {
        $products = Product::with(['variants', 'category:id,name,slug'])
            ->where('status', 'published')
            ->when($request->string('search')->trim()->value(), fn ($query, string $search) => $query->where('name', 'like', '%' . addcslashes($search, '%_\\') . '%'))
            ->when($request->string('category_id')->trim()->value(), fn ($query, string $categoryId) => $query->where('category_id', $categoryId))
            ->when($request->string('kind')->trim()->value(), fn ($query, string $kind) => $kind === 'digital' ? $query->where('is_digital', true) : ($kind === 'physical' ? $query->where('is_digital', false) : $query))
            ->latest()->orderByDesc('id');
        $products = \App\Support\Pagination::paginate($products, $request, 12);

        return response()->json($products);
    }

    public function cart(Request $request): JsonResponse
    {
        $items = CartItem::with(['product', 'variant'])->where('user_id', $request->user()->id)->get();

        return response()->json(['items' => $items->map(fn ($item) => [
            'id' => $item->id, 'qty' => $item->qty, 'product' => $item->product,
            'variant' => $item->variant, 'unit_price' => $item->variant?->price ?: ($item->product->discount_price > 0 && $item->product->discount_price < $item->product->price ? $item->product->discount_price : $item->product->price),
            'stock' => $item->variant?->stock ?? $item->product->stock,
        ])->values()]);
    }

    public function add(Request $request): JsonResponse
    {
        $data = $request->validate(['product_id' => ['required', 'string', 'exists:products,id'], 'variant_id' => ['nullable', 'string', 'exists:product_variants,id'], 'qty' => ['required', 'integer', 'min:1', 'max:100']]);
        $product = Product::with('variants')->where('id', $data['product_id'])->where('status', 'published')->firstOrFail();
        $variant = !empty($data['variant_id']) ? $product->variants->firstWhere('id', $data['variant_id']) : null;
        if ($product->variants->isNotEmpty() && !$variant) return response()->json(['message' => 'Variant wajib dipilih.'], 422);
        if (!empty($data['variant_id']) && !$variant) return response()->json(['message' => 'Variant tidak sesuai produk.'], 422);
        $stock = $variant?->stock ?? $product->stock;
        $item = CartItem::firstOrNew(['user_id' => $request->user()->id, 'product_id' => $product->id, 'variant_id' => $variant?->id]);
        $item->id ??= Str::lower(Str::random(12));
        $item->qty = min($stock, $item->exists ? $item->qty + $data['qty'] : $data['qty']);
        if ($item->qty < 1) return response()->json(['message' => 'Stok produk habis.'], 422);
        $item->save();

        return response()->json(['item' => $item->load(['product', 'variant'])], 201);
    }

    public function remove(Request $request, string $itemId): JsonResponse
    {
        $item = CartItem::where('id', $itemId)->where('user_id', $request->user()->id)->firstOrFail();
        $item->delete();
        return response()->json(['message' => 'Item dihapus.']);
    }

    public function update(Request $request, string $itemId): JsonResponse
    {
        $data = $request->validate(['qty' => ['required', 'integer', 'min:1', 'max:100']]);
        $item = CartItem::with(['product', 'variant'])->where('id', $itemId)->where('user_id', $request->user()->id)->firstOrFail();
        $stock = $item->variant?->stock ?? $item->product->stock;
        $item->qty = min($data['qty'], $stock);
        if ($item->qty < 1) return response()->json(['message' => 'Stok produk habis.'], 422);
        $item->save();
        return response()->json(['item' => $item]);
    }
}
