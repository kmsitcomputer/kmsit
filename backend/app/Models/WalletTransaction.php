<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WalletTransaction extends Model
{
    protected $table = 'instructor_wallet_transactions';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['id', 'user_id', 'type', 'ref_id', 'order_id', 'amount', 'gross', 'platform_fee', 'payment_fee', 'status', 'note'];
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
