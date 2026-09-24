<?php

namespace App\Support;

use App\Models\User;

/**
 * Ownership-scoped instructor endpoints: only the instructor role, with the matching
 * instructor permission. Staff use the admin endpoints instead (AdminAccess).
 */
class InstructorAccess
{
    public static function authorize(User $user, string $permission): void
    {
        $permissions = $user->role?->permissions ?? [];
        abort_unless($user->role_key === 'instructor'
            && (in_array($permission, $permissions, true) || in_array('*', $permissions, true)), 403, 'Tidak memiliki permission.');
    }
}
