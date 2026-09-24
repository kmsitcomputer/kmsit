<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Voucher extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['id', 'code', 'type', 'value', 'min_order', 'max_discount', 'usage_limit', 'used_count', 'expires_at', 'active', 'note'];
    protected function casts(): array { return ['expires_at' => 'datetime', 'active' => 'boolean']; }
}
