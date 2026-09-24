<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use App\Support\FileSecurity;
use App\Support\SessionRevoker;

class ProfileController extends Controller
{
    public function update(Request $request): JsonResponse
    {
        // "avatar" is intentionally "sometimes", not "nullable"-and-always-applied: the
        // dashboard's main profile form never sends it (avatar has its own dedicated
        // /profile/avatar upload endpoint below), so unconditionally writing
        // `$data['avatar'] ?? null` here wiped out the user's photo to null on every single
        // ordinary "Simpan" of name/phone/bio — exactly the "foto hilang setelah simpan" bug.
        $data = $request->validate(['name' => ['required', 'string', 'max:120'], 'phone' => ['nullable', 'string', 'max:30'], 'bio' => ['nullable', 'string', 'max:5000'], 'avatar' => ['sometimes', 'nullable', 'string', 'max:500'], 'instructor_headline' => ['nullable', 'string', 'max:190']]);
        $request->user()->update([
            'name' => trim($data['name']), 'phone' => $data['phone'] ?? null, 'bio' => $data['bio'] ?? null,
            'instructor_headline' => $data['instructor_headline'] ?? null,
            ...(array_key_exists('avatar', $data) ? ['avatar' => $data['avatar']] : []),
        ]);
        return response()->json(['user' => $request->user()->fresh()]);
    }

    /**
     * Self-service avatar upload for any authenticated user (including students), separate
     * from MediaController::upload which is intentionally restricted to admin/instructor
     * for the shared CMS media library.
     */
    public function avatar(Request $request): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'max:5120', 'mimetypes:image/jpeg,image/png,image/webp']]);
        $file = $request->file('file');
        FileSecurity::validateUpload($file, ['image/jpeg' => ['jpg', 'jpeg'], 'image/png' => ['png'], 'image/webp' => ['webp']]);
        $path = $file->store('avatars', 'public');
        $oldAvatar = $request->user()->avatar;
        $request->user()->update(['avatar' => asset('storage/' . $path)]);
        if ($oldAvatar && str_starts_with($oldAvatar, asset('storage/avatars/'))) {
            $oldPath = Str::after($oldAvatar, asset('storage') . '/');
            if (FileSecurity::isPathWithin($oldPath, 'avatars')) Storage::disk('public')->delete($oldPath);
        }
        return response()->json(['user' => $request->user()->fresh()]);
    }

    public function password(Request $request): JsonResponse
    {
        $data = $request->validate(['current_password' => ['required', 'string'], 'password' => ['required', 'confirmed', 'min:8']]);
        if (!Hash::check($data['current_password'], $request->user()->password_hash)) return response()->json(['message' => 'Password saat ini salah.'], 422);
        $request->user()->update(['password_hash' => Hash::make($data['password'])]);
        // Revoke all other sessions and API tokens (current request session stays active)
        SessionRevoker::revokeOtherSessions($request->user(), $request);
        return response()->json(['message' => 'Password berhasil diperbarui.']);
    }
}
