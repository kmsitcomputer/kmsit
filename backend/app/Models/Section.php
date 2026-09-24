<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Section extends Model
{
    protected $table = 'course_sections';

    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['id', 'course_id', 'title', 'sort'];

    public function course(): BelongsTo { return $this->belongsTo(Course::class); }
    public function lessons(): HasMany { return $this->hasMany(Lesson::class)->orderBy('sort'); }
}
