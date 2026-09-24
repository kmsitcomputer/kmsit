<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuizOption extends Model
{
    protected $table = 'quiz_options';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['id', 'question_id', 'text', 'is_correct', 'sort'];
    protected function casts(): array { return ['is_correct' => 'boolean']; }
    public function question(): BelongsTo { return $this->belongsTo(Question::class); }
}
