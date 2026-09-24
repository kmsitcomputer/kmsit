<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Activity;
use App\Models\Article;
use App\Models\News;
use App\Models\Page;
use App\Models\Tutorial;
use App\Support\AdminAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use App\Support\HtmlSanitizer;

class ContentController extends Controller
{
    private const MODELS = ['articles' => Article::class, 'news' => News::class, 'tutorials' => Tutorial::class, 'activities' => Activity::class, 'pages' => Page::class];

    /**
     * The five content types share this one generic controller but do NOT share a schema
     * (e.g. `pages` has no author_id/category_id/excerpt/video_url/published_at column,
     * `activities` has `description`+event fields instead of `excerpt`+`category_id` and
     * has no `published_at`). Their models use `$guarded = []` (CmsContent base) or, for
     * Article, a $fillable that doesn't match this generic field set either — so blindly
     * filling every field on every type previously caused a hard SQL "Unknown column" 500
     * for news/tutorials/activities/pages on every single create/update. Only articles
     * happened to survive, by silently dropping the mismatched keys via $fillable.
     * This map is the single source of truth for which columns each type actually has.
     */
    private const TYPE_PERMISSIONS = [
        'articles' => 'manage_articles', 'news' => 'manage_news', 'tutorials' => 'manage_tutorials',
        'activities' => 'manage_activities', 'pages' => 'manage_pages',
    ];

    private const TYPE_COLUMNS = [
        'articles' => ['title', 'slug', 'excerpt', 'content', 'thumbnail', 'tags', 'category_id', 'status', 'featured', 'author_id', 'published_at'],
        'news' => ['title', 'slug', 'excerpt', 'content', 'thumbnail', 'video_url', 'tags', 'category_id', 'status', 'author_id', 'published_at'],
        'tutorials' => ['title', 'slug', 'excerpt', 'content', 'thumbnail', 'video_url', 'tags', 'category_id', 'status', 'author_id', 'published_at'],
        'activities' => ['title', 'slug', 'description', 'content', 'thumbnail', 'video_url', 'event_date', 'event_time', 'location', 'registration_url', 'gallery', 'status', 'author_id'],
        'pages' => ['title', 'slug', 'content', 'thumbnail', 'status'],
    ];

    public function index(Request $request, string $type): JsonResponse
    {
        $model = new ($this->model($type));
        $query = $model->newQuery()->when($this->supportsCategories($type), fn ($query) => $query->with('category:id,name,slug'))->where('status', 'published');
        if ($request->string('search')->trim()->value()) $query->where('title', 'like', '%' . $request->string('search')->trim()->value() . '%');
        $content = $query->latest($this->hasColumn($type, 'published_at') ? 'published_at' : 'created_at')->paginate(min($request->integer('per_page', 12), 50));
        $content->getCollection()->each(fn ($item) => $item->content = app(HtmlSanitizer::class)->html($item->content));
        return response()->json($content);
    }

    public function adminIndex(Request $request, string $type): JsonResponse
    {
        AdminAccess::authorize($request->user(), self::TYPE_PERMISSIONS[$type] ?? 'manage_articles');
        $query = (new ($this->model($type)))->newQuery()
            ->when($request->string('status')->trim()->value(), fn ($q, string $status) => $q->where('status', $status))
            ->when($request->string('q')->trim()->value(), fn ($q, string $search) => $q->where('title', 'like', '%' . addcslashes($search, '%_\\') . '%'))
            ->latest();
        if ($this->supportsCategories($type)) $query->with('category:id,name,slug');
        return response()->json(['content' => \App\Support\Pagination::paginate($query, $request)]);
    }

    public function show(Request $request, string $slug): JsonResponse
    {
        $type = (string) $request->route('type');
        $query = (new ($this->model($type)))->newQuery();
        if ($this->hasColumn($type, 'author_id')) $query->with('author:id,name');
        if ($this->supportsCategories($type)) $query->with('category:id,name,slug');
        $content = $query->where('status', 'published')->where('slug', $slug)->firstOrFail();
        $content->content = app(HtmlSanitizer::class)->html($content->content);
        return response()->json(['content' => $content]);
    }

    public function store(Request $request, string $type): JsonResponse
    {
        AdminAccess::authorize($request->user(), self::TYPE_PERMISSIONS[$type] ?? 'manage_articles');
        $data = $this->filterForType($type, $this->validateContent($request));
        if (array_key_exists('content', $data)) $data['content'] = app(HtmlSanitizer::class)->html($data['content']);
        $this->validateCategoryScope($data['category_id'] ?? null, $type === 'articles' ? 'article' : $type);
        $model = new ($this->model($type));
        $model->fill([...$data, 'id' => Str::lower(Str::random(12)), 'slug' => $data['slug'] ?? Str::slug($data['title'])]);
        if ($this->hasColumn($type, 'author_id')) $model->author_id = $request->user()->id;
        if ($this->hasColumn($type, 'published_at')) $model->published_at = $data['status'] === 'published' ? now() : null;
        $model->save();
        return response()->json(['content' => $model], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $type = (string) $request->route('type');
        AdminAccess::authorize($request->user(), self::TYPE_PERMISSIONS[$type] ?? 'manage_articles');
        $data = $this->filterForType($type, $this->validateContent($request, true));
        if (array_key_exists('content', $data)) $data['content'] = app(HtmlSanitizer::class)->html($data['content']);
        if (array_key_exists('category_id', $data)) $this->validateCategoryScope($data['category_id'], $type === 'articles' ? 'article' : $type);
        $model = (new ($this->model($type)))->newQuery()->findOrFail($id);
        $model->fill($data);
        if ($this->hasColumn($type, 'published_at') && ($data['status'] ?? $model->status) === 'published' && !$model->published_at) $model->published_at = now();
        $model->save();
        return response()->json(['content' => $model]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $type = (string) $request->route('type');
        AdminAccess::authorize($request->user(), self::TYPE_PERMISSIONS[$type] ?? 'manage_articles');
        (new ($this->model($type)))->newQuery()->findOrFail($id)->delete();
        return response()->json(['message' => 'Content dihapus.']);
    }

    private function filterForType(string $type, array $data): array
    {
        return array_intersect_key($data, array_flip(self::TYPE_COLUMNS[$type] ?? []));
    }

    private function hasColumn(string $type, string $column): bool
    {
        return in_array($column, self::TYPE_COLUMNS[$type] ?? [], true);
    }

    private function validateContent(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';
        return $request->validate([
            'title' => [$required, 'string', 'max:190'], 'slug' => ['nullable', 'string', 'max:140'],
            'excerpt' => ['nullable', 'string'], 'description' => ['nullable', 'string'], 'content' => ['nullable', 'string'],
            'thumbnail' => ['nullable', 'string'], 'tags' => ['nullable', 'array'], 'featured' => ['sometimes', 'boolean'],
            'category_id' => ['nullable', 'string', 'exists:categories,id'],
            'video_url' => ['nullable', 'string', 'max:255', function (string $attribute, mixed $value, \Closure $fail) {
                if ($value !== null && $value !== '' && app(HtmlSanitizer::class)->videoUrl($value) === null) {
                    $fail('URL video harus berupa tautan https dari YouTube atau Vimeo.');
                }
            }],
            'status' => [$required, 'in:draft,published'], 'event_date' => ['nullable', 'date'], 'event_time' => ['nullable', 'string', 'max:30'],
            'location' => ['nullable', 'string', 'max:190'], 'registration_url' => ['nullable', 'url', 'max:255'], 'gallery' => ['nullable', 'array'],
        ]);
    }

    private function model(string $type): string
    {
        abort_unless(isset(self::MODELS[$type]), 404, 'Tipe content tidak tersedia.');
        return self::MODELS[$type];
    }

    private function validateCategoryScope(?string $categoryId, string $scope): void
    {
        if ($categoryId && !\App\Models\Category::whereKey($categoryId)->where('scope', $scope)->exists()) abort(422, 'Kategori tidak sesuai jenis konten.');
    }

    private function supportsCategories(string $type): bool
    {
        return in_array($type, ['articles', 'news', 'tutorials'], true);
    }
}
