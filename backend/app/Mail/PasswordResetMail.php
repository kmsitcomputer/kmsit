<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Queued and encrypted: the payload carries a live reset link. Safe to retry — a retry only
 * delivers while this exact token is still the current, unexpired one, and at most once.
 */
class PasswordResetMail extends Mailable implements ShouldQueue, ShouldBeEncrypted
{
    use Queueable;

    public const TOKEN_TTL_MINUTES = 60;

    public int $tries = 5;
    public int $timeout = 30; // must stay below the queue connection's retry_after (90s)

    public function __construct(public string $url, private string $email, private string $tokenHash) {}

    public function backoff(): array { return [10, 60, 300, 900]; }

    public function envelope(): Envelope { return new Envelope(subject: 'Reset Password - KMSIT Computer'); }
    public function content(): Content { return new Content(view: 'emails.password-reset', with: ['url' => $this->url]); }

    public function send($mailer)
    {
        if (!$this->tokenIsCurrent() || Cache::has($this->sentKey())) return null;

        $sent = parent::send($mailer);
        Cache::put($this->sentKey(), true, now()->addMinutes(self::TOKEN_TTL_MINUTES + 1));
        return $sent;
    }

    /** Called by the queue once retries are exhausted; the job itself lands in failed_jobs. */
    public function failed(\Throwable $e): void
    {
        Log::warning('Password reset mail failed permanently', [
            'recipient_hash' => hash('sha256', $this->email),
            'exception' => $e::class,
            'error' => $e->getMessage(),
        ]);
    }

    private function tokenIsCurrent(): bool
    {
        $record = DB::table('password_reset_tokens')->where('email', $this->email)->first();
        return $record && hash_equals((string) $record->token, $this->tokenHash)
            && now()->parse($record->created_at)->addMinutes(self::TOKEN_TTL_MINUTES)->isFuture();
    }

    private function sentKey(): string
    {
        return 'password-reset-mail:sent:' . hash('sha256', $this->tokenHash);
    }
}
