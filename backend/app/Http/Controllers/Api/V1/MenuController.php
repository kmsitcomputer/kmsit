<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Menu;
use App\Models\MenuItem;
use App\Support\AdminAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class MenuController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json(['menus' => Menu::with('items')->whereIn('location', [$request->string('location', 'header')->value(), 'both'])->get()]);
    }

    public function adminIndex(Request $request): JsonResponse
    {
        AdminAccess::authorize($request->user(), 'manage_menus');
        return response()->json(['menus' => Menu::with('items')->orderBy('location')->get()]);
    }

    /**
     * Creates the menu "container" (e.g. a Header or Footer menu). Without this, a fresh
     * install (or any site whose `menus` table is empty) has no way to ever add a menu
     * item at all — storeItem() requires an existing menu_id, and the dashboard's "Item
     * Menu" button stays disabled with no menu present, with no path to create one.
     */
    public function storeMenu(Request $request): JsonResponse
    {
        AdminAccess::authorize($request->user(), 'manage_menus');
        $data = $request->validate(['name' => ['required', 'string', 'max:120'], 'location' => ['required', 'in:header,footer,both']]);
        $menu = Menu::firstOrCreate(['location' => $data['location']], ['id' => Str::lower(Str::random(12)), 'name' => $data['name']]);
        return response()->json(['menu' => $menu->load('items')], 201);
    }

    public function storeItem(Request $request): JsonResponse
    {
        AdminAccess::authorize($request->user(), 'manage_menus');
        $data = $request->validate(['menu_id' => ['required', 'exists:menus,id'], 'parent_id' => ['nullable', 'exists:menu_items,id'], 'label' => ['required', 'string', 'max:120'], 'type' => ['required', 'string', 'max:30'], 'target' => ['nullable', 'string', 'max:12'], 'url' => ['nullable', 'string', 'max:255'], 'sort' => ['nullable', 'integer', 'min:0']]);
        return response()->json(['item' => MenuItem::create(['id' => Str::lower(Str::random(12)), ...$data])], 201);
    }

    public function updateItem(Request $request, string $id): JsonResponse
    {
        AdminAccess::authorize($request->user(), 'manage_menus');
        $data = $request->validate(['label' => ['sometimes', 'string', 'max:120'], 'type' => ['sometimes', 'string', 'max:30'], 'target' => ['nullable', 'string', 'max:12'], 'url' => ['nullable', 'string', 'max:255'], 'parent_id' => ['nullable', 'exists:menu_items,id'], 'sort' => ['sometimes', 'integer', 'min:0']]);
        $item = MenuItem::findOrFail($id);
        if (($data['parent_id'] ?? null) === $item->id) abort(422, 'Item tidak dapat menjadi parent dirinya sendiri.');
        $item->update($data);
        return response()->json(['item' => $item]);
    }

    public function destroyItem(Request $request, string $id): JsonResponse
    {
        AdminAccess::authorize($request->user(), 'manage_menus');
        $item = MenuItem::findOrFail($id);
        MenuItem::where('parent_id', $item->id)->update(['parent_id' => null]);
        $item->delete();
        return response()->json(['message' => 'Item menu dihapus.']);
    }
}
