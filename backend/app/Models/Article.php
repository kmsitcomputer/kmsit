<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Article extends Model
{
    use SoftDeletes;
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['id', 'slug', 'title', 'author_id', 'category_id', 'excerpt', 'content', 'thumbnail', 'tags', 'status', 'featured', 'published_at', 'seo_title', 'seo_description'];
    protected function casts(): array { return ['tags' => 'array', 'featured' => 'boolean', 'published_at' => 'datetime']; }
    public function author(): BelongsTo { return $this->belongsTo(User::class, 'author_id'); }
    public function category(): BelongsTo { return $this->belongsTo(Category::class); }
}
