<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductVariant extends Model
{
    protected $table = 'product_variants';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['id', 'product_id', 'label', 'price', 'stock', 'sort'];
    public function product(): BelongsTo { return $this->belongsTo(Product::class); }
}
