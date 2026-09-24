<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Menu;
use App\Models\MenuItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class MenuController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json(['menus' => Menu::with('items')->whereIn('location', [$request->string('location', 'header')->value(), 'both'])->get()]);
    }

    public function storeItem(Request $request): JsonResponse
    {
        abort_unless(in_array($request->user()->role_key, ['admin', 'super_admin'], true), 403, 'Tidak memiliki permission.');
        $data = $request->validate(['menu_id' => ['required', 'exists:menus,id'], 'parent_id' => ['nullable', 'exists:menu_items,id'], 'label' => ['required', 'string', 'max:120'], 'type' => ['required', 'string', 'max:30'], 'target' => ['nullable', 'string', 'max:12'], 'url' => ['nullable', 'url', 'max:255'], 'sort' => ['nullable', 'integer', 'min:0']]);
        return response()->json(['item' => MenuItem::create(['id' => Str::lower(Str::random(12)), ...$data])], 201);
    }

    public function updateItem(Request $request, string $id): JsonResponse
    {
        abort_unless(in_array($request->user()->role_key, ['admin', 'super_admin'], true), 403, 'Tidak memiliki permission.');
        $data = $request->validate(['label' => ['sometimes', 'string', 'max:120'], 'type' => ['sometimes', 'string', 'max:30'], 'target' => ['nullable', 'string', 'max:12'], 'url' => ['nullable', 'url', 'max:255'], 'parent_id' => ['nullable', 'exists:menu_items,id'], 'sort' => ['sometimes', 'integer', 'min:0']]);
        $item = MenuItem::findOrFail($id);
        if (($data['parent_id'] ?? null) === $item->id) abort(422, 'Item tidak dapat menjadi parent dirinya sendiri.');
        $item->update($data);
        return response()->json(['item' => $item]);
    }

    public function destroyItem(Request $request, string $id): JsonResponse
    {
        abort_unless(in_array($request->user()->role_key, ['admin', 'super_admin'], true), 403, 'Tidak memiliki permission.');
        $item = MenuItem::findOrFail($id);
        MenuItem::where('parent_id', $item->id)->update(['parent_id' => null]);
        $item->delete();
        return response()->json(['message' => 'Item menu dihapus.']);
    }
}
