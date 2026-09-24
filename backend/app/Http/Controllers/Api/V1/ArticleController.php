<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Article;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ArticleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json(Article::where('status', 'published')->latest('published_at')->paginate(min($request->integer('per_page', 12), 50)));
    }

    public function show(string $slug): JsonResponse
    {
        return response()->json(['article' => Article::with(['author:id,name', 'category:id,name'])->where('status', 'published')->where('slug', $slug)->firstOrFail()]);
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless(in_array($request->user()->role_key, ['admin', 'super_admin'], true), 403, 'Tidak memiliki permission.');
        $data = $request->validate(['title' => ['required', 'string', 'max:190'], 'slug' => ['nullable', 'string', 'max:140', 'unique:articles,slug'], 'excerpt' => ['nullable', 'string'], 'content' => ['nullable', 'string'], 'status' => ['required', 'in:draft,published']]);
        $article = Article::create(['id' => Str::lower(Str::random(12)), 'title' => trim($data['title']), 'slug' => $data['slug'] ?? Str::slug($data['title']), 'excerpt' => $data['excerpt'] ?? null, 'content' => $data['content'] ?? null, 'status' => $data['status'], 'published_at' => $data['status'] === 'published' ? now() : null, 'author_id' => $request->user()->id]);
        return response()->json(['article' => $article], 201);
    }
}
