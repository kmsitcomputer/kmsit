<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Category extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['id', 'scope', 'name', 'slug'];

    public function courses(): HasMany
    {
        return $this->hasMany(Course::class);
    }
}
