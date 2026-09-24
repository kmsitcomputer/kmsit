<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ProductController extends Controller
{
    public function adminIndex(): JsonResponse
    {
        $this->authorizeAdmin(request());
        return response()->json(['products' => Product::with('variants')->latest()->paginate(100)]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);
        $data = $this->validateProduct($request);
        $product = DB::transaction(function () use ($data) {
            $variants = $data['variants'] ?? [];
            unset($data['variants']);
            $product = Product::create(['id' => Str::lower(Str::random(12)), ...$data, 'stock' => collect($variants)->isNotEmpty() ? collect($variants)->sum('stock') : $data['stock']]);
            foreach ($variants as $index => $variant) ProductVariant::create(['id' => Str::lower(Str::random(12)), 'product_id' => $product->id, 'label' => $variant['label'], 'price' => $variant['price'], 'stock' => $variant['stock'], 'sort' => $index]);
            return $product->load('variants');
        });
        return response()->json(['product' => $product], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $this->authorizeAdmin($request);
        $data = $this->validateProduct($request, $id);
        $product = DB::transaction(function () use ($data, $id) {
            $variants = $data['variants'] ?? [];
            unset($data['variants']);
            $product = Product::findOrFail($id);
            $product->update([...$data, 'stock' => collect($variants)->isNotEmpty() ? collect($variants)->sum('stock') : $data['stock']]);
            $product->variants()->delete();
            foreach ($variants as $index => $variant) ProductVariant::create(['id' => Str::lower(Str::random(12)), 'product_id' => $product->id, 'label' => $variant['label'], 'price' => $variant['price'], 'stock' => $variant['stock'], 'sort' => $index]);
            return $product->load('variants');
        });
        return response()->json(['product' => $product]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->authorizeAdmin($request);
        Product::findOrFail($id)->delete();
        return response()->json(['message' => 'Produk dihapus.']);
    }

    private function validateProduct(Request $request, ?string $id = null): array
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:190'], 'slug' => ['nullable', 'string', 'max:140'], 'description' => ['nullable', 'string'], 'thumbnail' => ['nullable', 'string'], 'price' => ['required', 'integer', 'min:0'], 'discount_price' => ['nullable', 'integer', 'min:0'], 'stock' => ['required', 'integer', 'min:0'], 'category_id' => ['nullable', 'string', 'exists:categories,id'], 'status' => ['required', 'in:draft,published'], 'featured' => ['sometimes', 'boolean'], 'is_digital' => ['sometimes', 'boolean'], 'digital_file_url' => ['nullable', 'string'], 'variants' => ['nullable', 'array'], 'variants.*.label' => ['required', 'string', 'max:120'], 'variants.*.price' => ['required', 'integer', 'min:0'], 'variants.*.stock' => ['required', 'integer', 'min:0']]);
        $data['slug'] = $data['slug'] ?? Str::slug($data['name']);
        return $data;
    }

    private function authorizeAdmin(Request $request): void
    {
        abort_unless(in_array($request->user()->role_key, ['admin', 'super_admin'], true), 403, 'Tidak memiliki permission.');
    }
}
