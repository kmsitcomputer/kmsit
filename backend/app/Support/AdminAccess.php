<?php

namespace App\Support;

use App\Models\User;

class AdminAccess
{
    public static function authorize(User $user, string $permission): void
    {
        abort_unless(self::allows($user, $permission), 403, 'Tidak memiliki permission.');
    }

    /** Staff check without aborting: super_admin, or admin holding the permission (or '*'). */
    public static function allows(User $user, string $permission): bool
    {
        if ($user->role_key === 'super_admin') return true;
        $permissions = $user->role?->permissions ?? [];
        return $user->role_key === 'admin' && (in_array($permission, $permissions, true) || in_array('*', $permissions, true));
    }
}
