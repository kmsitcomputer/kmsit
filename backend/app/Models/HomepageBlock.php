<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HomepageBlock extends Model
{
    protected $table = 'homepage_blocks';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['id', 'type', 'title', 'sub', 'content', 'enabled', 'sort'];
    protected function casts(): array { return ['content' => 'array', 'enabled' => 'boolean']; }
}
