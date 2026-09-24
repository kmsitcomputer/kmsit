<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContactMessage extends Model
{
    protected $table = 'contact_messages';
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['id', 'name', 'email', 'subject', 'body', 'is_read'];
    protected function casts(): array { return ['is_read' => 'boolean']; }
}
