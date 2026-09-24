<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Withdrawal extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['id', 'user_id', 'amount', 'bank_name', 'account_name', 'account_number', 'notes', 'status', 'processed_by', 'processed_at', 'admin_note'];
    protected function casts(): array { return ['processed_at' => 'datetime']; }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function processor(): BelongsTo { return $this->belongsTo(User::class, 'processed_by'); }
}
