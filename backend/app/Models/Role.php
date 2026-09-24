<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['id', 'role_key', 'name', 'permissions'])]
class Role extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected function casts(): array
    {
        return ['permissions' => 'array'];
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'role_key', 'role_key');
    }
}
