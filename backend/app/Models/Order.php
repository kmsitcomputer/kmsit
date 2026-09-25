<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['id', 'user_id', 'type', 'status', 'subtotal', 'discount_amount', 'shipping_cost', 'voucher_code', 'gateway_fee', 'total', 'currency', 'paid_at', 'needs_shipping', 'delivery_method', 'shipping_name', 'shipping_address', 'shipping_phone', 'shipping_weight_grams', 'shipping_courier', 'shipping_courier_name', 'shipping_service', 'shipping_service_name', 'shipping_etd', 'shipping_province_id', 'shipping_province_name', 'shipping_city_id', 'shipping_city_name', 'shipping_district_id', 'shipping_district_name', 'shipping_subdistrict_id', 'shipping_subdistrict_name', 'shipping_postal_code', 'shipping_note', 'delivery_latitude', 'delivery_longitude', 'delivery_distance_meters'];
    // Reservation bookkeeping is internal; keep existing response fields unchanged.
    protected $hidden = ['voucher_id', 'voucher_reservation_status', 'voucher_reserved_until', 'stock_reservation_status'];
    protected function casts(): array { return ['paid_at' => 'datetime', 'voucher_reserved_until' => 'datetime', 'needs_shipping' => 'boolean']; }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function items(): HasMany { return $this->hasMany(OrderItem::class); }
    public function payments(): HasMany { return $this->hasMany(Payment::class); }
}
