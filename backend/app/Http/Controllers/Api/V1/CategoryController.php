<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CategoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $scope = $request->query('scope');
        $query = Category::query()->when($scope, fn ($q) => $q->where('scope', $scope))->orderBy('name');
        return response()->json(['categories' => $query->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->admin($request);
        $data = $request->validate(['scope' => ['required', 'in:course,article,news,tutorial,product'], 'name' => ['required', 'string', 'max:120']]);
        $base = Str::slug($data['name']);
        $slug = $base; $index = 2;
        while (Category::where('scope', $data['scope'])->where('slug', $slug)->exists()) $slug = $base . '-' . $index++;
        return response()->json(['category' => Category::create(['id' => Str::lower(Str::random(12)), 'scope' => $data['scope'], 'name' => trim($data['name']), 'slug' => $slug])], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $this->admin($request);
        $data = $request->validate(['name' => ['required', 'string', 'max:120']]);
        $category = Category::findOrFail($id); $category->update(['name' => trim($data['name']), 'slug' => Str::slug($data['name'])]);
        return response()->json(['category' => $category]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->admin($request); Category::findOrFail($id)->delete();
        return response()->json(['message' => 'Kategori dihapus.']);
    }

    private function admin(Request $request): void { abort_unless(in_array($request->user()->role_key, ['admin', 'super_admin'], true), 403, 'Tidak memiliki permission.'); }
}
