<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\SoftDeletable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable(['id', 'slug', 'instructor_id', 'category_id', 'title', 'short_description', 'description', 'thumbnail', 'price', 'discount_price', 'is_free', 'level', 'language', 'status', 'featured', 'requirements', 'outcomes', 'tags', 'reject_note', 'published_at'])]
#[SoftDeletable]
class Course extends Model
{
    use SoftDeletes;

    public $incrementing = false;
    protected $keyType = 'string';

    protected function casts(): array
    {
        return ['is_free' => 'boolean', 'featured' => 'boolean', 'requirements' => 'array', 'outcomes' => 'array', 'tags' => 'array', 'published_at' => 'datetime'];
    }

    public function instructor(): BelongsTo { return $this->belongsTo(User::class, 'instructor_id'); }
    public function category(): BelongsTo { return $this->belongsTo(Category::class); }
    public function sections(): HasMany { return $this->hasMany(Section::class)->orderBy('sort'); }
    public function lessons(): HasMany { return $this->hasMany(Lesson::class)->orderBy('sort'); }
    public function enrollments(): HasMany { return $this->hasMany(Enrollment::class); }
}
