<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Article;
use App\Models\Course;
use App\Models\News;
use App\Models\Product;
use App\Models\Tutorial;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $query = trim((string) $request->query('q', ''));
        if (mb_strlen($query) < 2) return response()->json(['results' => []]);
        $like = '%' . addcslashes($query, '%_\\') . '%';
        $results = collect()
            ->merge(Course::where('status', 'published')->where(fn ($q) => $q->where('title', 'like', $like)->orWhere('short_description', 'like', $like))->limit(4)->get(['title', 'slug'])->map(fn ($item) => ['group' => 'Kelas', 'label' => $item->title, 'to' => '/courses/' . $item->slug]))
            ->merge(Article::where('status', 'published')->where('title', 'like', $like)->limit(3)->get(['title', 'slug'])->map(fn ($item) => ['group' => 'Artikel', 'label' => $item->title, 'to' => '/articles/' . $item->slug]))
            ->merge(News::where('status', 'published')->where('title', 'like', $like)->limit(3)->get(['title', 'slug'])->map(fn ($item) => ['group' => 'Berita', 'label' => $item->title, 'to' => '/news/' . $item->slug]))
            ->merge(Tutorial::where('status', 'published')->where('title', 'like', $like)->limit(3)->get(['title', 'slug'])->map(fn ($item) => ['group' => 'Tutorial', 'label' => $item->title, 'to' => '/tutorials/' . $item->slug]))
            ->merge(Product::where('status', 'published')->where('name', 'like', $like)->limit(3)->get(['name'])->map(fn ($item) => ['group' => 'Produk', 'label' => $item->name, 'to' => '/shop']))
            ->take(10)->values();
        return response()->json(['results' => $results]);
    }
}
