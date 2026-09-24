<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;

final class FileSecurity
{
    public static function validateUpload(UploadedFile $file, array $mimeExtensions): string
    {
        $actual = (new \finfo(FILEINFO_MIME_TYPE))->file($file->getRealPath()) ?: 'application/octet-stream';
        $extension = strtolower($file->getClientOriginalExtension());
        if (!isset($mimeExtensions[$actual]) || !in_array($extension, $mimeExtensions[$actual], true)) {
            throw ValidationException::withMessages(['file' => 'Tipe atau ekstensi file tidak diizinkan.']);
        }
        return $actual;
    }

    public static function isPathWithin(string $path, string $directory): bool
    {
        if ($path === '' || str_contains($path, "\0") || str_contains($path, '\\') || str_contains($path, ':')) return false;
        if (str_starts_with($path, '/') || preg_match('#(^|/)\.\.?(/|$)#', $path)) return false;
        return str_starts_with($path, rtrim($directory, '/') . '/') && !str_ends_with($path, '/');
    }

    public static function isPublicPath(string $path): bool
    {
        return self::isPathWithin($path, 'media') || self::isPathWithin($path, 'avatars');
    }
}
