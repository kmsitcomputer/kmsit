<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DigitalDelivery extends Model
{
    protected $table = 'digital_deliveries';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['id', 'user_id', 'product_id', 'order_item_id', 'license_key', 'download_url', 'downloads', 'status'];
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function product(): BelongsTo { return $this->belongsTo(Product::class); }
    public function orderItem(): BelongsTo { return $this->belongsTo(OrderItem::class); }
}
