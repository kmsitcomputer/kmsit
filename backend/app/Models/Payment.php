<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['id', 'order_id', 'gateway', 'mode', 'method', 'reference', 'merchant_ref', 'amount', 'fee', 'status', 'signature', 'events'];
    protected function casts(): array { return ['events' => 'array']; }
    public function order(): BelongsTo { return $this->belongsTo(Order::class); }
}
