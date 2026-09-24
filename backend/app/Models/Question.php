<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Question extends Model
{
    protected $table = 'quiz_questions';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['id', 'quiz_id', 'type', 'text', 'points', 'sort'];
    public function quiz(): BelongsTo { return $this->belongsTo(Quiz::class); }
    public function options(): HasMany { return $this->hasMany(QuizOption::class)->orderBy('sort'); }
}
