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

    public function articles(): HasMany { return $this->hasMany(Article::class); }
    public function news(): HasMany { return $this->hasMany(News::class); }
    public function tutorials(): HasMany { return $this->hasMany(Tutorial::class); }
    public function products(): HasMany { return $this->hasMany(Product::class); }
}
