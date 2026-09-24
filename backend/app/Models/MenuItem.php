<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MenuItem extends Model
{
    protected $table = 'menu_items';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['id', 'menu_id', 'parent_id', 'label', 'type', 'target', 'url', 'sort'];
    public function menu(): BelongsTo { return $this->belongsTo(Menu::class); }
    public function parent(): BelongsTo { return $this->belongsTo(MenuItem::class, 'parent_id'); }
}
