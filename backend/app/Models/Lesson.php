<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Lesson extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['id', 'course_id', 'section_id', 'title', 'type', 'content', 'media_url', 'duration_min', 'preview', 'status', 'sort'];

    protected function casts(): array { return ['preview' => 'boolean']; }
    public function course(): BelongsTo { return $this->belongsTo(Course::class); }
    public function section(): BelongsTo { return $this->belongsTo(Section::class); }
    public function progress(): HasMany { return $this->hasMany(LessonProgress::class); }
}
