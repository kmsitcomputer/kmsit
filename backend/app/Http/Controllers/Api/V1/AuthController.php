<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        // A-17: Respect allow_registration setting. Only installer/super_admin can create first user.
        if (Setting::where('setting_key', 'allow_registration')->value('setting_value') === '0') {
            return response()->json(['message' => 'Registrasi ditutup saat ini.'], 403);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email:rfc', 'max:190', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::defaults()],
            'role' => ['sometimes', 'in:student,instructor'],
        ]);

        $role = $data['role'] ?? 'student';
        $user = User::create([
            'id' => Str::lower(Str::random(12)),
            'role_key' => $role,
            'name' => trim($data['name']),
            'email' => Str::lower(trim($data['email'])),
            'password_hash' => Hash::make($data['password']),
            'status' => 'active',
            'instructor_approved' => $role !== 'instructor',
        ]);

        Auth::login($user, true);
        $request->session()->regenerate();
        // Store auth_epoch in session for epoch validation on subsequent requests (A-16).
        $request->session()->put('auth_epoch', (int) ($user->auth_epoch ?? 0));

        return response()->json(['user' => $this->userPayload($user)], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email:rfc'],
            'password' => ['required', 'string'],
        ]);

        $email = Str::lower(trim($data['email']));
        $user = User::where('email', $email)->first();
        if (!$user) {
            // Admin updates/legacy records may retain mixed-case email on case-sensitive databases.
            $matches = User::whereRaw('LOWER(email) = ?', [$email])->limit(2)->get();
            $user = $matches->count() === 1 ? $matches->first() : null;
        }
        if (!$user || $user->status !== 'active' || !Hash::check($data['password'], $user->password_hash)) {
            return response()->json(['message' => 'Email atau password tidak valid.'], 422);
        }

        $user->forceFill(['last_login_at' => now()])->save();

        Auth::login($user, true);
        $request->session()->regenerate();
        // Store auth_epoch in session for epoch validation on subsequent requests (A-16).
        $request->session()->put('auth_epoch', (int) ($user->auth_epoch ?? 0));

        return response()->json(['user' => $this->userPayload($user)]);
    }

    public function me(Request $request): JsonResponse
    {
        if ($request->user()->status !== 'active') {
            Auth::logout();
            $request->session()->invalidate();
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        return response()->json(['user' => $this->userPayload($request->user())]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Logout berhasil.']);
    }

    private function userPayload(User $user): array
    {
        return [...$user->only(['id', 'name', 'email', 'role_key', 'status', 'avatar', 'bio', 'phone', 'instructor_approved', 'instructor_headline']), 'permissions' => $user->role?->permissions ?? []];
    }
}
