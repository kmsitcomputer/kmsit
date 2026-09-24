<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\WalletTransaction;
use App\Models\Withdrawal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class WalletController extends Controller
{
    public function withdrawals(Request $request): JsonResponse
    {
        abort_unless(in_array($request->user()->role_key, ['admin', 'super_admin'], true), 403, 'Tidak memiliki permission.');
        return response()->json(['withdrawals' => Withdrawal::with('user:id,name,email')->latest()->get()]);
    }

    public function summary(Request $request): JsonResponse
    {
        $userId = $request->user()->id;
        return response()->json(['summary' => $this->summaryFor($userId), 'ledger' => WalletTransaction::where('user_id', $userId)->latest()->get(), 'withdrawals' => Withdrawal::where('user_id', $userId)->latest()->get()]);
    }

    public function requestWithdrawal(Request $request): JsonResponse
    {
        abort_unless($request->user()->role_key === 'instructor', 403, 'Hanya instructor yang dapat mengajukan withdrawal.');
        $data = $request->validate(['amount' => ['required', 'integer', 'min:25000'], 'bank_name' => ['required', 'string', 'max:80'], 'account_name' => ['required', 'string', 'max:120'], 'account_number' => ['required', 'string', 'max:40'], 'notes' => ['nullable', 'string', 'max:2000']]);
        $withdrawal = DB::transaction(function () use ($request, $data) {
            $summary = $this->summaryFor($request->user()->id);
            abort_if($data['amount'] > $summary['available'], 422, 'Saldo tersedia tidak mencukupi.');
            $withdrawal = Withdrawal::create(['id' => Str::lower(Str::random(12)), 'user_id' => $request->user()->id, 'amount' => $data['amount'], 'bank_name' => trim($data['bank_name']), 'account_name' => trim($data['account_name']), 'account_number' => trim($data['account_number']), 'notes' => $data['notes'] ?? null, 'status' => 'pending']);
            WalletTransaction::create(['id' => Str::lower(Str::random(12)), 'user_id' => $request->user()->id, 'type' => 'withdrawal', 'ref_id' => $withdrawal->id, 'amount' => -$data['amount'], 'gross' => $data['amount'], 'status' => 'pending', 'note' => 'Withdrawal request']);
            return $withdrawal;
        });
        return response()->json(['withdrawal' => $withdrawal], 201);
    }

    public function setStatus(Request $request, string $withdrawalId): JsonResponse
    {
        abort_unless(in_array($request->user()->role_key, ['admin', 'super_admin'], true), 403, 'Tidak memiliki permission.');
        $data = $request->validate(['status' => ['required', 'in:approved,processing,completed,rejected'], 'admin_note' => ['nullable', 'string', 'max:500']]);
        $withdrawal = DB::transaction(function () use ($request, $withdrawalId, $data) {
            $withdrawal = Withdrawal::lockForUpdate()->findOrFail($withdrawalId);
            if ($withdrawal->status === 'completed' || $withdrawal->status === 'rejected') abort(422, 'Withdrawal sudah final.');
            $withdrawal->update(['status' => $data['status'], 'processed_by' => $request->user()->id, 'processed_at' => now(), 'admin_note' => $data['admin_note'] ?? null]);
            WalletTransaction::where('ref_id', $withdrawal->id)->where('type', 'withdrawal')->update(['status' => $data['status'] === 'rejected' ? 'rejected' : ($data['status'] === 'completed' ? 'completed' : 'pending')]);
            return $withdrawal;
        });
        return response()->json(['withdrawal' => $withdrawal]);
    }

    private function summaryFor(string $userId): array
    {
        $earning = WalletTransaction::where('user_id', $userId)->where('type', 'earning')->where('status', 'completed')->sum('amount');
        $reserved = Withdrawal::where('user_id', $userId)->whereIn('status', ['pending', 'approved', 'processing', 'completed'])->sum('amount');
        return ['earned' => (int) $earning, 'reserved' => (int) $reserved, 'available' => max(0, (int) $earning - (int) $reserved)];
    }
}
