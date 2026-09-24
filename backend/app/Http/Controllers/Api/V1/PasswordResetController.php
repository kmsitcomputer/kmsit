<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Mail\PasswordResetMail;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class PasswordResetController extends Controller
{
    public function request(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email:rfc']]);
        $user = User::where('email', Str::lower(trim($data['email'])))->first();
        if ($user) {
            $plain = Str::random(64);
            DB::table('password_reset_tokens')->updateOrInsert(['email' => $user->email], ['token' => Hash::make($plain), 'created_at' => now()]);
            $url = config('app.url') . '/reset-password?email=' . urlencode($user->email) . '&token=' . urlencode($plain);
            Mail::to($user->email)->queue(new PasswordResetMail($url));
        }
        return response()->json(['message' => 'Jika email terdaftar, tautan reset telah dikirim.']);
    }

    public function reset(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email:rfc'], 'token' => ['required', 'string'], 'password' => ['required', 'confirmed', 'min:8']]);
        $record = DB::table('password_reset_tokens')->where('email', Str::lower(trim($data['email'])))->first();
        if (!$record || now()->parse($record->created_at)->addMinutes(60)->isPast() || !Hash::check($data['token'], $record->token)) return response()->json(['message' => 'Token reset tidak valid atau sudah kedaluwarsa.'], 422);
        User::where('email', Str::lower(trim($data['email'])))->update(['password_hash' => Hash::make($data['password'])]);
        DB::table('password_reset_tokens')->where('email', $record->email)->delete();
        return response()->json(['message' => 'Password berhasil direset.']);
    }
}
