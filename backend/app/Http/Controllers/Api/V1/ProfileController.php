<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class ProfileController extends Controller
{
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:120'], 'phone' => ['nullable', 'string', 'max:30'], 'bio' => ['nullable', 'string', 'max:5000'], 'avatar' => ['nullable', 'string', 'max:500'], 'instructor_headline' => ['nullable', 'string', 'max:190']]);
        $request->user()->update(['name' => trim($data['name']), 'phone' => $data['phone'] ?? null, 'bio' => $data['bio'] ?? null, 'avatar' => $data['avatar'] ?? null, 'instructor_headline' => $data['instructor_headline'] ?? null]);
        return response()->json(['user' => $request->user()->fresh()]);
    }

    public function password(Request $request): JsonResponse
    {
        $data = $request->validate(['current_password' => ['required', 'string'], 'password' => ['required', 'confirmed', 'min:8']]);
        if (!Hash::check($data['current_password'], $request->user()->password_hash)) return response()->json(['message' => 'Password saat ini salah.'], 422);
        $request->user()->update(['password_hash' => Hash::make($data['password'])]);
        return response()->json(['message' => 'Password berhasil diperbarui.']);
    }
}
