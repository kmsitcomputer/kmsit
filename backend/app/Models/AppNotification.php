<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AppNotification extends Model
{
    protected $table = 'notifications';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['id', 'user_id', 'title', 'body', 'link', 'kind', 'is_read'];
    protected function casts(): array { return ['is_read' => 'boolean']; }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
