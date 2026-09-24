<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Media extends Model
{
    protected $table = 'media';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['id', 'name', 'mime', 'size', 'path', 'uploaded_by'];
    public function uploader(): BelongsTo { return $this->belongsTo(User::class, 'uploaded_by'); }
}
