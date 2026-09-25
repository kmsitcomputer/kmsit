<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Product extends Model
{
    use SoftDeletes;
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['id', 'slug', 'name', 'description', 'thumbnail', 'price', 'discount_price', 'stock', 'weight_grams', 'category_id', 'status', 'featured', 'is_digital', 'digital_file_url'];
    protected function casts(): array { return ['featured' => 'boolean', 'is_digital' => 'boolean']; }
    public function category(): BelongsTo { return $this->belongsTo(Category::class); }
    public function variants(): HasMany { return $this->hasMany(ProductVariant::class)->orderBy('sort'); }
}
