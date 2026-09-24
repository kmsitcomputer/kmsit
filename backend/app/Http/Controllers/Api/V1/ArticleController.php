<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Article;
use App\Support\AdminAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use App\Support\HtmlSanitizer;

class ArticleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $articles = Article::with('category:id,name,slug')->where('status', 'published')->latest('published_at')->paginate(min($request->integer('per_page', 12), 50));
        $articles->getCollection()->each(fn (Article $article) => $article->content = app(HtmlSanitizer::class)->html($article->content));
        return response()->json($articles);
    }

    public function show(string $slug): JsonResponse
    {
        $article = Article::with(['author:id,name', 'category:id,name'])->where('status', 'published')->where('slug', $slug)->firstOrFail();
        $article->content = app(HtmlSanitizer::class)->html($article->content);
        return response()->json(['article' => $article]);
    }

    public function store(Request $request): JsonResponse
    {
        AdminAccess::authorize($request->user(), 'manage_articles');
        $data = $request->validate(['title' => ['required', 'string', 'max:190'], 'slug' => ['nullable', 'string', 'max:140', 'unique:articles,slug'], 'excerpt' => ['nullable', 'string'], 'content' => ['nullable', 'string'], 'category_id' => ['nullable', 'string', 'exists:categories,id'], 'status' => ['required', 'in:draft,published']]);
        $data['content'] = app(HtmlSanitizer::class)->html($data['content'] ?? null);
        $this->validateCategoryScope($data['category_id'] ?? null, 'article');
        $article = Article::create(['id' => Str::lower(Str::random(12)), 'title' => trim($data['title']), 'slug' => $data['slug'] ?? Str::slug($data['title']), 'excerpt' => $data['excerpt'] ?? null, 'content' => $data['content'] ?? null, 'category_id' => $data['category_id'] ?? null, 'status' => $data['status'], 'published_at' => $data['status'] === 'published' ? now() : null, 'author_id' => $request->user()->id]);
        return response()->json(['article' => $article], 201);
    }

    private function validateCategoryScope(?string $categoryId, string $scope): void
    {
        if ($categoryId && !\App\Models\Category::whereKey($categoryId)->where('scope', $scope)->exists()) abort(422, 'Kategori tidak sesuai jenis konten.');
    }
}
