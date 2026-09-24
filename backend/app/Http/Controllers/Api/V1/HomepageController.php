<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\HomepageBlock;
use App\Support\AdminAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use App\Support\HtmlSanitizer;

class HomepageController extends Controller
{
    public function admin(Request $request): JsonResponse
    {
        AdminAccess::authorize($request->user(), 'manage_homepage');
        return response()->json(['blocks' => HomepageBlock::orderBy('sort')->get()]);
    }
    public function index(): JsonResponse
    {
        $blocks = HomepageBlock::where('enabled', true)->orderBy('sort')->get();
        $blocks->each(fn (HomepageBlock $block) => $block->content = app(HtmlSanitizer::class)->payload($block->content));
        return response()->json(['blocks' => $blocks]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        AdminAccess::authorize($request->user(), 'manage_homepage');
        $data = $request->validate(['type' => ['sometimes', 'string', 'max:40'], 'title' => ['nullable', 'string', 'max:190'], 'sub' => ['nullable', 'string', 'max:255'], 'content' => ['nullable', 'array'], 'enabled' => ['sometimes', 'boolean'], 'sort' => ['sometimes', 'integer', 'min:0']]);
        if (array_key_exists('content', $data)) $data['content'] = app(HtmlSanitizer::class)->payload($data['content']);
        $block = HomepageBlock::findOrFail($id);
        $block->update($data);
        return response()->json(['block' => $block]);
    }

    public function store(Request $request): JsonResponse
    {
        AdminAccess::authorize($request->user(), 'manage_homepage');
        $data = $request->validate(['type' => ['required', 'string', 'max:40'], 'title' => ['nullable', 'string', 'max:190'], 'sub' => ['nullable', 'string', 'max:255'], 'content' => ['nullable', 'array'], 'sort' => ['nullable', 'integer', 'min:0']]);
        if (array_key_exists('content', $data)) $data['content'] = app(HtmlSanitizer::class)->payload($data['content']);
        return response()->json(['block' => HomepageBlock::create(['id' => Str::lower(Str::random(12)), ...$data])], 201);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        AdminAccess::authorize($request->user(), 'manage_homepage');
        HomepageBlock::findOrFail($id)->delete();
        return response()->json(['message' => 'Block dihapus.']);
    }
}
