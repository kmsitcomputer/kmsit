<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class PasswordResetMail extends Mailable implements ShouldQueue
{
    use Queueable;

    public function __construct(public string $url) {}

    public function envelope(): Envelope { return new Envelope(subject: 'Reset Password - KMSIT Computer'); }
    public function content(): Content { return new Content(view: 'emails.password-reset', with: ['url' => $this->url]); }
}
