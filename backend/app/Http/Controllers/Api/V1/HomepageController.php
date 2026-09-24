<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\HomepageBlock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class HomepageController extends Controller
{
    public function admin(): JsonResponse
    {
        return response()->json(['blocks' => HomepageBlock::orderBy('sort')->get()]);
    }
    public function index(): JsonResponse
    {
        return response()->json(['blocks' => HomepageBlock::where('enabled', true)->orderBy('sort')->get()]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        abort_unless(in_array($request->user()->role_key, ['admin', 'super_admin'], true), 403, 'Tidak memiliki permission.');
        $data = $request->validate(['type' => ['sometimes', 'string', 'max:40'], 'title' => ['nullable', 'string', 'max:190'], 'sub' => ['nullable', 'string', 'max:255'], 'content' => ['nullable', 'array'], 'enabled' => ['sometimes', 'boolean'], 'sort' => ['sometimes', 'integer', 'min:0']]);
        $block = HomepageBlock::findOrFail($id);
        $block->update($data);
        return response()->json(['block' => $block]);
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless(in_array($request->user()->role_key, ['admin', 'super_admin'], true), 403, 'Tidak memiliki permission.');
        $data = $request->validate(['type' => ['required', 'string', 'max:40'], 'title' => ['nullable', 'string', 'max:190'], 'sub' => ['nullable', 'string', 'max:255'], 'content' => ['nullable', 'array'], 'sort' => ['nullable', 'integer', 'min:0']]);
        return response()->json(['block' => HomepageBlock::create(['id' => Str::lower(Str::random(12)), ...$data])], 201);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        abort_unless(in_array($request->user()->role_key, ['admin', 'super_admin'], true), 403, 'Tidak memiliki permission.');
        HomepageBlock::findOrFail($id)->delete();
        return response()->json(['message' => 'Block dihapus.']);
    }
}
