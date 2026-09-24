<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderItem extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['id', 'order_id', 'kind', 'ref_id', 'title', 'price', 'qty', 'instructor_id', 'thumbnail', 'variant_id', 'variant_label', 'is_digital'];
    protected function casts(): array { return ['is_digital' => 'boolean']; }
    public function order(): BelongsTo { return $this->belongsTo(Order::class); }
    public function instructor(): BelongsTo { return $this->belongsTo(User::class, 'instructor_id'); }
}
