<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Voucher;
use App\Support\AdminAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class VoucherController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        AdminAccess::authorize($request->user(), 'manage_vouchers');
        $query = Voucher::query()
            ->when($request->string('q')->trim()->value(), fn ($q, string $search) => $q->where('code', 'like', '%' . addcslashes($search, '%_\\') . '%'))
            ->when($request->has('active'), fn ($q) => $q->where('active', $request->boolean('active')))
            ->when($request->string('state')->trim()->value(), fn ($q, string $state) => match ($state) {
                'active' => $q->where('active', true)->where(fn ($w) => $w->whereNull('expires_at')->orWhere('expires_at', '>', now())),
                'inactive' => $q->where('active', false),
                'expired' => $q->whereNotNull('expires_at')->where('expires_at', '<=', now()),
                default => $q,
            })
            ->latest()->orderByDesc('id');
        return response()->json([
            'vouchers' => \App\Support\Pagination::paginate($query, $request),
            'summary' => [
                'total' => Voucher::count(),
                'active' => Voucher::where('active', true)->count(),
                'used' => (int) Voucher::sum('used_count'),
                'expired' => Voucher::whereNotNull('expires_at')->where('expires_at', '<=', now())->count(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        AdminAccess::authorize($request->user(), 'manage_vouchers');
        $data = $this->validateVoucher($request);
        $voucher = Voucher::create(['id' => Str::lower(Str::random(12)), ...$data]);
        return response()->json(['voucher' => $voucher], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        AdminAccess::authorize($request->user(), 'manage_vouchers');
        $voucher = Voucher::findOrFail($id);
        $voucher->update($this->validateVoucher($request, $id));
        return response()->json(['voucher' => $voucher->fresh()]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        AdminAccess::authorize($request->user(), 'manage_vouchers');
        Voucher::findOrFail($id)->delete();
        return response()->json(['message' => 'Voucher dihapus.']);
    }

    private function validateVoucher(Request $request, ?string $id = null): array
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:60', 'alpha_dash', 'unique:vouchers,code' . ($id ? ",{$id}" : '')],
            'type' => ['required', 'in:percent,fixed'],
            'value' => ['required', 'integer', function ($attribute, $value, $fail) use ($request) {
                if ($request->input('type') === 'percent' && ($value < 1 || $value > 100)) {
                    $fail('Nilai persen voucher harus antara 1 dan 100.');
                }
                if ($request->input('type') === 'fixed' && $value < 1) {
                    $fail('Nilai tetap voucher minimal 1.');
                }
            }],
            'min_order' => ['nullable', 'integer', 'min:0'], 'max_discount' => ['nullable', 'integer', 'min:0'],
            'usage_limit' => ['nullable', 'integer', 'min:0'], 'expires_at' => ['nullable', 'date'],
            'active' => ['sometimes', 'boolean'], 'note' => ['nullable', 'string', 'max:255'],
        ]);
        $data['code'] = Str::upper($data['code']);
        return $data;
    }
}
