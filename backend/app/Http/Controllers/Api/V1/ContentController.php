<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\Article;
use App\Models\News;
use App\Models\Page;
use App\Models\Tutorial;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ContentController extends Controller
{
    private const MODELS = ['articles' => Article::class, 'news' => News::class, 'tutorials' => Tutorial::class, 'activities' => Activity::class, 'pages' => Page::class];

    public function index(Request $request, string $type): JsonResponse
    {
        $model = new ($this->model($type));
        $query = $model->newQuery()->where('status', 'published');
        if ($request->string('search')->trim()->value()) $query->where('title', 'like', '%' . $request->string('search')->trim()->value() . '%');
        return response()->json($query->latest('published_at')->paginate(min($request->integer('per_page', 12), 50)));
    }

    public function adminIndex(Request $request, string $type): JsonResponse
    {
        abort_unless(in_array($request->user()->role_key, ['admin', 'super_admin'], true), 403, 'Tidak memiliki permission.');
        return response()->json(['content' => (new ($this->model($type)))->newQuery()->latest()->paginate(min($request->integer('per_page', 50), 100))]);
    }

    public function show(string $type, string $slug): JsonResponse
    {
        return response()->json(['content' => (new ($this->model($type)))->newQuery()->with(['author:id,name', 'category:id,name'])->where('status', 'published')->where('slug', $slug)->firstOrFail()]);
    }

    public function store(Request $request, string $type): JsonResponse
    {
        abort_unless(in_array($request->user()->role_key, ['admin', 'super_admin'], true), 403, 'Tidak memiliki permission.');
        $data = $request->validate(['title' => ['required', 'string', 'max:190'], 'slug' => ['nullable', 'string', 'max:140'], 'excerpt' => ['nullable', 'string'], 'description' => ['nullable', 'string'], 'content' => ['nullable', 'string'], 'video_url' => ['nullable', 'url', 'max:255'], 'status' => ['required', 'in:draft,published']]);
        $model = new ($this->model($type));
        $model->fill(['id' => Str::lower(Str::random(12)), 'title' => trim($data['title']), 'slug' => $data['slug'] ?? Str::slug($data['title']), 'excerpt' => $data['excerpt'] ?? null, 'description' => $data['description'] ?? null, 'content' => $data['content'] ?? null, 'video_url' => $data['video_url'] ?? null, 'status' => $data['status'], 'published_at' => $data['status'] === 'published' ? now() : null, 'author_id' => $request->user()->id]);
        $model->save();
        return response()->json(['content' => $model], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $type = (string) $request->route('type');
        abort_unless(in_array($request->user()->role_key, ['admin', 'super_admin'], true), 403, 'Tidak memiliki permission.');
        $data = $request->validate(['title' => ['sometimes', 'string', 'max:190'], 'slug' => ['sometimes', 'string', 'max:140'], 'excerpt' => ['nullable', 'string'], 'description' => ['nullable', 'string'], 'content' => ['nullable', 'string'], 'video_url' => ['nullable', 'url', 'max:255'], 'status' => ['sometimes', 'in:draft,published']]);
        $model = (new ($this->model($type)))->newQuery()->findOrFail($id);
        $model->fill($data);
        if (($data['status'] ?? $model->status) === 'published' && !$model->published_at) $model->published_at = now();
        $model->save();
        return response()->json(['content' => $model]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $type = (string) $request->route('type');
        abort_unless(in_array($request->user()->role_key, ['admin', 'super_admin'], true), 403, 'Tidak memiliki permission.');
        (new ($this->model($type)))->newQuery()->findOrFail($id)->delete();
        return response()->json(['message' => 'Content dihapus.']);
    }

    private function model(string $type): string
    {
        abort_unless(isset(self::MODELS[$type]), 404, 'Tipe content tidak tersedia.');
        return self::MODELS[$type];
    }
}
