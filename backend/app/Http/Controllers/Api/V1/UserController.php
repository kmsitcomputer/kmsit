<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Order;
use App\Models\QuizAttempt;
use App\Models\User;
use App\Models\WalletTransaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use App\Support\SessionRevoker;
use App\Support\AdminAccess;
use App\Support\Pagination;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);
        $actor = $request->user();
        $query = User::query()
            ->when($request->string('role')->trim()->value(), fn ($q, string $role) => $q->where('role_key', $role))
            ->when($request->string('status')->trim()->value(), fn ($q, string $status) => $q->where('status', $status))
            ->when($request->string('q')->trim()->value(), fn ($q, string $search) => $q->where(fn ($w) => $w
                ->where('name', 'like', '%' . addcslashes($search, '%_\\') . '%')->orWhere('email', 'like', '%' . addcslashes($search, '%_\\') . '%')))
            ->latest()->orderByDesc('id');
        // Query-level equivalent of UserPolicy::view so pagination totals stay correct.
        if ($actor->role_key !== 'super_admin') {
            $roles = array_values(array_filter([
                AdminAccess::allows($actor, 'manage_students') ? 'student' : null,
                AdminAccess::allows($actor, 'manage_instructors') ? 'instructor' : null,
            ]));
            $query->where(fn ($q) => $q->whereIn('role_key', $roles)->orWhere('id', $actor->id));
        }
        return response()->json(['users' => Pagination::paginate($query, $request)->through(fn (User $user) => $this->present($user))]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'], 'email' => ['required', 'email:rfc', 'max:190', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::defaults()], 'role_key' => ['required', 'in:student,instructor,admin,super_admin'],
            'phone' => ['nullable', 'string', 'max:40'], 'status' => ['sometimes', 'in:active,suspended'],
        ]);
        Gate::forUser($request->user())->authorize('create', [User::class, $data['role_key']]);
        $user = User::create([
            'id' => Str::lower(Str::random(12)), 'role_key' => $data['role_key'], 'name' => trim($data['name']),
            'email' => Str::lower(trim($data['email'])), 'password_hash' => Hash::make($data['password']),
            'phone' => $data['phone'] ?? null, 'status' => $data['status'] ?? 'active',
            'instructor_approved' => $data['role_key'] !== 'instructor',
        ]);
        return response()->json(['user' => $this->present($user)], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $this->authorizeAdmin($request);
        $user = User::findOrFail($id);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'], 'email' => ['sometimes', 'email:rfc', 'max:190', 'unique:users,email,' . $id],
            'role_key' => ['sometimes', 'in:student,instructor,admin,super_admin'], 'phone' => ['nullable', 'string', 'max:40'],
            'status' => ['sometimes', 'in:active,suspended'], 'password' => ['nullable', 'confirmed', Password::defaults()],
        ]);
        if (!empty($data['password'])) $data['password_hash'] = Hash::make($data['password']);
        unset($data['password'], $data['password_confirmation']);
        $needsRevoke = isset($data['password_hash']) || ($user->status !== 'suspended' && ($data['status'] ?? null) === 'suspended');
        $revoked = false;
        // Resolve sessions connection outside the transaction so it's available inside the closure.
        $sessionConn = $needsRevoke ? DB::connection(config('session.connection')) : null;
        if ($needsRevoke && $sessionConn) {
            // Fail closed rather than partially revoke across independent databases.
            if ($sessionConn !== $user->getConnection() || $user->tokens()->getRelated()->getConnection() !== $user->getConnection()) {
                throw new \LogicException('Authentication revocation requires the same database connection as users.');
            }
        }
        $user = $user->getConnection()->transaction(function () use ($request, $user, $data, &$revoked, $needsRevoke, $sessionConn) {
            $user = User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            Gate::forUser($request->user())->authorize('update', [$user, $data]);
            $revoked = $user->status !== 'suspended' && ($data['status'] ?? null) === 'suspended';
            if ($needsRevoke && $sessionConn) {
                $user->setRememberToken(Str::random(60));
                $user->tokens()->delete();
                $sessionConn->table(config('session.table', 'sessions'))->where('user_id', $user->id)->delete();
            }
            $user->update($data);
            return $user;
        });
        if ($revoked && $request->user()->id === $user->id && $request->hasSession()) {
            // Do not let StartSession save the self-suspended admin's login again.
            Auth::guard('web')->logoutCurrentDevice();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }
        return response()->json(['user' => $this->present($user->fresh())]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->authorizeAdmin($request);
        $user = User::whereKey($id)->lockForUpdate()->firstOrFail();
        Gate::forUser($request->user())->authorize('delete', $user);

        // Block hard delete on users with any significant data — use suspend/anonymize instead (A-11).
        $hasRelations = false;
        $reasons = [];
        if (Course::where('instructor_id', $user->id)->exists()) { $hasRelations = true; $reasons[] = 'mempunyai course'; }
        if (Enrollment::where('user_id', $user->id)->exists()) { $hasRelations = true; $reasons[] = 'ter-enroll di course'; }
        if (Order::where('user_id', $user->id)->exists()) { $hasRelations = true; $reasons[] = 'mempunyai order'; }
        if (WalletTransaction::where('user_id', $user->id)->exists()) { $hasRelations = true; $reasons[] = 'mempunyai riwayat dompet'; }
        if (QuizAttempt::where('user_id', $user->id)->exists()) { $hasRelations = true; $reasons[] = 'mempunyai attempt quiz'; }

        if ($hasRelations) {
            abort(422, 'Tidak dapat menghapus user yang ' . implode(', ', $reasons) . '. Gunakan suspend jika diperlukan.');
        }

        DB::transaction(function () use ($user) {
            $user->delete();
        });
        return response()->json(['message' => 'User dihapus.']);
    }

    public function approveInstructor(Request $request, string $id): JsonResponse
    {
        $this->authorizeAdmin($request);
        $data = $request->validate(['approved' => ['required', 'boolean']]);
        $user = DB::transaction(function () use ($request, $id, $data) {
            $user = User::where('id', $id)->where('role_key', 'instructor')->lockForUpdate()->firstOrFail();
            Gate::forUser($request->user())->authorize('approveInstructor', $user);
            $user->update(['instructor_approved' => $data['approved']]);
            return $user;
        });
        return response()->json(['user' => $this->present($user->fresh())]);
    }

    private function present(User $user): array
    {
        return $user->only(['id', 'name', 'email', 'role_key', 'status', 'avatar', 'bio', 'phone', 'instructor_approved', 'instructor_headline', 'created_at']);
    }

    private function authorizeAdmin(Request $request): void
    {
        Gate::forUser($request->user())->authorize('access', User::class);
    }
}
