<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

abstract class CmsContent extends Model
{
    use SoftDeletes;
    public $incrementing = false;
    protected $keyType = 'string';
    protected $guarded = [];
    protected function casts(): array { return ['tags' => 'array', 'gallery' => 'array', 'published_at' => 'datetime']; }
    public function author(): BelongsTo { return $this->belongsTo(User::class, 'author_id'); }
    public function category(): BelongsTo { return $this->belongsTo(Category::class); }
}
