<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuizAttempt extends Model
{
    protected $table = 'quiz_attempts';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['id', 'quiz_id', 'user_id', 'status', 'answers', 'score', 'max_score', 'percent', 'passed', 'started_at', 'submitted_at'];
    protected function casts(): array { return ['answers' => 'array', 'passed' => 'boolean', 'started_at' => 'datetime', 'submitted_at' => 'datetime']; }
    public function quiz(): BelongsTo { return $this->belongsTo(Quiz::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
