<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Quiz extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['id', 'course_id', 'creator_id', 'title', 'description', 'time_limit_min', 'passing_score', 'max_attempts', 'randomize', 'active'];
    protected function casts(): array { return ['randomize' => 'boolean', 'active' => 'boolean']; }
    public function course(): BelongsTo { return $this->belongsTo(Course::class); }
    public function creator(): BelongsTo { return $this->belongsTo(User::class, 'creator_id'); }
    public function questions(): HasMany { return $this->hasMany(Question::class)->orderBy('sort'); }
    public function attempts(): HasMany { return $this->hasMany(QuizAttempt::class); }
}
