<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    protected $table = 'audit_logs';
    protected $fillable = ['user_id', 'user_name', 'action', 'model', 'model_id', 'detail', 'ip', 'ua'];
}
