<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Certificate extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = ['id', 'number', 'user_id', 'course_id', 'template_id', 'issued_at', 'status', 'views', 'revoked_at', 'revoked_by'];
    protected function casts(): array { return ['issued_at' => 'datetime', 'revoked_at' => 'datetime']; }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function course(): BelongsTo { return $this->belongsTo(Course::class); }
    public function template(): BelongsTo { return $this->belongsTo(CertificateTemplate::class, 'template_id'); }
}
