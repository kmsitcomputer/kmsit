<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LiveClass extends Model
{
    protected $table = 'live_classes';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['id', 'course_id', 'created_by', 'provider', 'provider_meeting_id', 'title', 'scheduled_at', 'duration_minutes', 'timezone', 'join_url', 'status'];
    protected function casts(): array { return ['scheduled_at' => 'datetime']; }
    public function course(): BelongsTo { return $this->belongsTo(Course::class); }
    public function creator(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }
}
