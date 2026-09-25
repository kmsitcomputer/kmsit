<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\StockReservation;
use App\Support\AdminAccess;
use App\Support\FileSecurity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ProductController extends Controller
{
    public function adminIndex(): JsonResponse
    {
        AdminAccess::authorize(request()->user(), 'manage_shop');
        $request = request();
        $query = Product::with(['variants', 'category:id,name,slug'])
            ->when($request->string('status')->trim()->value(), fn ($q, string $status) => $q->where('status', $status))
            ->when($request->string('q')->trim()->value(), fn ($q, string $search) => $q->where('name', 'like', '%' . addcslashes($search, '%_\\') . '%'))
            ->latest();
        return response()->json(['products' => \App\Support\Pagination::paginate($query, $request)]);
    }

    public function store(Request $request): JsonResponse
    {
        AdminAccess::authorize($request->user(), 'manage_shop');
        $data = $this->validateProduct($request);
        $data['slug'] = $data['slug'] ?? Str::slug($data['name']);
        $product = DB::transaction(function () use ($data) {
            $variants = $data['variants'] ?? [];
            unset($data['variants']);
            $product = Product::create(['id' => Str::lower(Str::random(12)), ...$data, 'stock' => collect($variants)->isNotEmpty() ? collect($variants)->sum('stock') : $data['stock']]);
            foreach ($variants as $index => $variant) ProductVariant::create(['id' => Str::lower(Str::random(12)), 'product_id' => $product->id, 'label' => $variant['label'], 'price' => $variant['price'], 'stock' => $variant['stock'], 'sort' => $index]);
            return $product->load(['variants', 'category:id,name,slug']);
        });
        return response()->json(['product' => $product], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        AdminAccess::authorize($request->user(), 'manage_shop');
        // Partial updates (e.g. the dashboard's quick publish/unpublish toggle, which only
        // sends {status}) must work without being forced to resend the whole product —
        // requiring name/price/stock unconditionally previously made that toggle 422 and
        // silently fail, and treating a missing "variants" key as "clear the variants"
        // would have wiped them out on every such partial save too.
        $data = $this->validateProduct($request, true);
        $hasVariants = array_key_exists('variants', $data);
        $variants = $data['variants'] ?? [];
        unset($data['variants']);
        if (array_key_exists('name', $data) && !array_key_exists('slug', $data)) $data['slug'] = Str::slug($data['name']);

        $product = DB::transaction(function () use ($data, $hasVariants, $variants, $id) {
            $stock = app(StockReservation::class);
            $product = $stock->lockProductForUpdate($id) ?? abort(404);
            $lockedVariants = collect();
            if ($hasVariants) {
                $lockedVariants = $stock->lockVariantsForUpdate($product->id)->keyBy('label');
                $data['stock'] = collect($variants)->isNotEmpty() ? collect($variants)->sum('stock') : ($data['stock'] ?? $product->stock);
            }
            $product->update($data);
            if ($hasVariants) {
                $kept = [];
                foreach ($variants as $index => $variant) {
                    $attributes = ['price' => $variant['price'], 'stock' => $variant['stock'], 'sort' => $index];
                    $existing = $lockedVariants->get($variant['label']);
                    if ($existing) {
                        if ($existing->fill($attributes)->isDirty()) $existing->save();
                        $kept[] = $existing->id;
                    } else {
                        $kept[] = ProductVariant::create(['id' => Str::lower(Str::random(12)), 'product_id' => $product->id, 'label' => $variant['label'], ...$attributes])->id;
                    }
                }
                $lockedVariants->whereNotIn('id', $kept)->each->delete();
            }
            return $product->load(['variants', 'category:id,name,slug']);
        });
        return response()->json(['product' => $product]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        AdminAccess::authorize($request->user(), 'manage_shop');
        DB::transaction(function () use ($id) {
            $stock = app(StockReservation::class);
            $product = $stock->lockProductForUpdate($id) ?? abort(404);
            $stock->lockVariantsForUpdate($product->id);
            $product->delete();
        });
        return response()->json(['message' => 'Produk dihapus.']);
    }

    private function validateProduct(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';
        $data = $request->validate([
            'name' => [$required, 'string', 'max:190'], 'slug' => ['nullable', 'string', 'max:140'], 'description' => ['nullable', 'string'],
            'thumbnail' => ['nullable', 'string'], 'price' => [$required, 'integer', 'min:0'], 'discount_price' => ['nullable', 'integer', 'min:0'],
            'stock' => [$required, 'integer', 'min:0'], 'category_id' => ['nullable', 'string', 'exists:categories,id'],
            'status' => [$required, 'in:draft,published'], 'featured' => ['sometimes', 'boolean'], 'is_digital' => ['sometimes', 'boolean'],
            'digital_file_url' => ['nullable', 'string'], 'variants' => ['sometimes', 'array'], 'variants.*.label' => ['required', 'string', 'max:120'],
            'variants.*.price' => ['required', 'integer', 'min:0'], 'variants.*.stock' => ['required', 'integer', 'min:0'],
        ]);
        if (!empty($data['category_id']) && !\App\Models\Category::whereKey($data['category_id'])->where('scope', 'product')->exists()) abort(422, 'Kategori tidak sesuai jenis produk.');
        if (!empty($data['digital_file_url']) && !FileSecurity::isPathWithin($data['digital_file_url'], 'digital')) abort(422, 'Path file digital tidak valid.');
        return $data;
    }
}
