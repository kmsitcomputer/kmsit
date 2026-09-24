<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use App\Models\WalletTransaction;
use App\Models\Withdrawal;
use App\Services\NotificationService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class WalletController extends Controller
{
    /**
     * Allowed withdrawal lifecycle, matching the dashboard actions plus the existing
     * approved -> completed shortcut: pending -> approved|rejected, approved -> processing|completed|rejected,
     * processing -> completed|rejected. completed/rejected are final and absent here, so they can never
     * transition again, and backward/skipping moves (e.g. pending -> completed, processing -> approved) are rejected.
     */
    private const TRANSITIONS = [
        'pending' => ['approved', 'rejected'],
        'approved' => ['processing', 'completed', 'rejected'],
        'processing' => ['completed', 'rejected'],
    ];

    public function withdrawals(Request $request): JsonResponse
    {
        $this->authorizeWithdrawals($request);
        $query = Withdrawal::with('user:id,name,email')
            ->when($request->string('status')->trim()->value(), fn ($q, string $status) => $q->where('status', $status))
            ->latest()->orderByDesc('id');
        return response()->json(['withdrawals' => Pagination::paginate($query, $request)]);
    }

    /** Summary plus the 20 most recent ledger rows / withdrawals; full history via the paginated endpoints. */
    public function summary(Request $request): JsonResponse
    {
        $userId = $request->user()->id;
        return response()->json([
            'summary' => $this->summaryFor($userId),
            'ledger' => WalletTransaction::where('user_id', $userId)->latest()->orderByDesc('id')->limit(20)->get(),
            'withdrawals' => Withdrawal::where('user_id', $userId)->latest()->orderByDesc('id')->limit(20)->get(),
        ]);
    }

    public function ledger(Request $request): JsonResponse
    {
        $query = WalletTransaction::where('user_id', $request->user()->id)
            ->when($request->string('type')->trim()->value(), fn ($q, string $type) => $q->where('type', $type))
            ->latest()->orderByDesc('id');
        return response()->json(['ledger' => Pagination::paginate($query, $request)]);
    }

    public function myWithdrawals(Request $request): JsonResponse
    {
        $query = Withdrawal::where('user_id', $request->user()->id)
            ->when($request->string('status')->trim()->value(), fn ($q, string $status) => $q->where('status', $status))
            ->latest()->orderByDesc('id');
        return response()->json(['withdrawals' => Pagination::paginate($query, $request)]);
    }

    public function requestWithdrawal(Request $request): JsonResponse
    {
        abort_unless($request->user()->role_key === 'instructor', 403, 'Hanya instructor yang dapat mengajukan withdrawal.');
        $data = $request->validate(['amount' => ['required', 'integer', 'min:25000'], 'bank_name' => ['required', 'string', 'max:80'], 'account_name' => ['required', 'string', 'max:120'], 'account_number' => ['required', 'string', 'max:40'], 'notes' => ['nullable', 'string', 'max:2000']]);
        $withdrawal = DB::transaction(function () use ($request, $data) {
            // Lock the instructor row so two concurrent requests cannot both spend the same
            // available balance (real serialization on MySQL; a no-op on SQLite).
            User::whereKey($request->user()->id)->lockForUpdate()->first();
            $summary = $this->summaryFor($request->user()->id);
            abort_if($data['amount'] > $summary['available'], 422, 'Saldo tersedia tidak mencukupi.');
            $withdrawal = Withdrawal::create(['id' => Str::lower(Str::random(12)), 'user_id' => $request->user()->id, 'amount' => $data['amount'], 'bank_name' => trim($data['bank_name']), 'account_name' => trim($data['account_name']), 'account_number' => trim($data['account_number']), 'notes' => $data['notes'] ?? null, 'status' => 'pending']);
            WalletTransaction::create(['id' => Str::lower(Str::random(12)), 'user_id' => $request->user()->id, 'type' => 'withdrawal', 'ref_id' => $withdrawal->id, 'amount' => -$data['amount'], 'gross' => $data['amount'], 'status' => 'pending', 'note' => 'Withdrawal request']);
            $this->audit($request->user(), 'withdrawal_request', $withdrawal, sprintf('amount=%d bank=%s', $data['amount'], $withdrawal->bank_name));
            app(NotificationService::class)->notifyStaff('process_withdrawals', "withdrawal:{$withdrawal->id}:requested",
                'Pengajuan withdrawal baru', "{$request->user()->name} mengajukan " . NotificationService::money((int) $data['amount']) . '.', '/dashboard/withdrawals', 'info');
            return $withdrawal;
        });
        return response()->json(['withdrawal' => $withdrawal], 201);
    }

    public function setStatus(Request $request, string $withdrawalId): JsonResponse
    {
        $this->authorizeWithdrawals($request);
        $data = $request->validate(['status' => ['required', 'in:approved,processing,completed,rejected'], 'admin_note' => ['nullable', 'string', 'max:500']]);
        $withdrawal = DB::transaction(function () use ($request, $withdrawalId, $data) {
            $withdrawal = Withdrawal::lockForUpdate()->findOrFail($withdrawalId);
            $allowed = self::TRANSITIONS[$withdrawal->status] ?? [];
            abort_unless(in_array($data['status'], $allowed, true), 422, 'Transisi status withdrawal tidak valid.');
            $from = $withdrawal->status;
            $withdrawal->update(['status' => $data['status'], 'processed_by' => $request->user()->id, 'processed_at' => now(), 'admin_note' => $data['admin_note'] ?? null]);
            WalletTransaction::where('ref_id', $withdrawal->id)->where('type', 'withdrawal')->update(['status' => $data['status'] === 'rejected' ? 'rejected' : ($data['status'] === 'completed' ? 'completed' : 'pending')]);
            $this->audit($request->user(), 'withdrawal_status', $withdrawal, sprintf('%s -> %s', $from, $data['status']));
            $labels = ['approved' => 'disetujui', 'processing' => 'sedang diproses', 'completed' => 'selesai ditransfer', 'rejected' => 'ditolak'];
            app(NotificationService::class)->notify($withdrawal->user_id, "withdrawal:{$withdrawal->id}:{$data['status']}",
                'Status withdrawal: ' . $labels[$data['status']], 'Withdrawal ' . NotificationService::money((int) $withdrawal->amount) . ' ' . $labels[$data['status']] . ($withdrawal->admin_note ? '. Catatan: ' . $withdrawal->admin_note : '.'),
                '/dashboard/withdrawals', $data['status'] === 'rejected' ? 'danger' : ($data['status'] === 'completed' ? 'success' : 'info'));
            return $withdrawal;
        });
        return response()->json(['withdrawal' => $withdrawal]);
    }

    private function authorizeWithdrawals(Request $request): void
    {
        $user = $request->user();
        if ($user->role_key === 'super_admin') return;
        $permissions = $user->role?->permissions ?? [];
        abort_unless($user->role_key === 'admin' && (in_array('process_withdrawals', $permissions, true) || in_array('*', $permissions, true)), 403, 'Tidak memiliki permission.');
    }

    private function audit(User $actor, string $action, Withdrawal $withdrawal, string $detail): void
    {
        AuditLog::create(['user_id' => $actor->id, 'user_name' => $actor->name, 'action' => $action, 'model' => 'Withdrawal', 'model_id' => $withdrawal->id, 'detail' => $detail]);
    }

    private function summaryFor(string $userId): array
    {
        $earnings = WalletTransaction::where('user_id', $userId)->where('type', 'earning')->where('status', 'completed');
        $earning = (clone $earnings)->sum('amount');
        $gross = (clone $earnings)->sum('gross');
        $platformFee = (clone $earnings)->sum('platform_fee');
        $reserved = Withdrawal::where('user_id', $userId)->whereIn('status', ['pending', 'approved', 'processing', 'completed'])->sum('amount');
        return ['earned' => (int) $earning, 'gross' => (int) $gross, 'platform_fee' => (int) $platformFee, 'reserved' => (int) $reserved, 'available' => max(0, (int) $earning - (int) $reserved)];
    }
}
