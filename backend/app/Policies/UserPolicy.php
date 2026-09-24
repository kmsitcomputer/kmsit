<?php

namespace App\Policies;

use App\Models\User;
use Illuminate\Auth\Access\Response;

class UserPolicy
{
    public function access(User $actor): Response
    {
        return $this->decision($actor->role_key === 'super_admin'
            || $this->canManageRole($actor, 'student') || $this->canManageRole($actor, 'instructor'));
    }

    public function view(User $actor, User $target): bool
    {
        return $this->access($actor)->allowed() && ($actor->role_key === 'super_admin'
            || $actor->id === $target->id || $this->canManageRole($actor, $target->role_key));
    }

    public function create(User $actor, string $role): Response
    {
        if ($role === 'super_admin' && $actor->role_key !== 'super_admin') {
            return Response::deny('Hanya Super Admin dapat membuat Super Admin lain.');
        }
        return $this->decision($this->canManageRole($actor, $role));
    }

    public function update(User $actor, User $target, array $data): Response
    {
        if (($data['role_key'] ?? null) === 'super_admin' && $actor->role_key !== 'super_admin') {
            return Response::deny('Hanya Super Admin dapat menetapkan role Super Admin.');
        }
        if (!$this->view($actor, $target)) return $this->decision(false);
        // Permission is required for both the source account and its destination role.
        if (isset($data['role_key']) && $data['role_key'] !== $target->role_key) {
            return $this->decision($this->canManageRole($actor, $data['role_key']));
        }
        return Response::allow();
    }

    public function delete(User $actor, User $target): Response
    {
        if ($actor->id === $target->id) {
            return Response::denyWithStatus(422, 'Tidak dapat menghapus akun sendiri.');
        }
        return $this->decision($this->view($actor, $target));
    }

    public function approveInstructor(User $actor, User $target): Response
    {
        return $this->decision($target->role_key === 'instructor' && $this->canManageRole($actor, 'instructor'));
    }

    private function canManageRole(User $actor, string $role): bool
    {
        if ($actor->role_key === 'super_admin') return true;
        if ($actor->role_key !== 'admin') return false;
        $permission = match ($role) {
            'student' => 'manage_students',
            'instructor' => 'manage_instructors',
            default => null, // No existing permission grants admins management of staff accounts.
        };
        $permissions = $actor->role?->permissions ?? [];
        return $permission !== null && (in_array($permission, $permissions, true) || in_array('*', $permissions, true));
    }

    private function decision(bool $allowed): Response
    {
        return $allowed ? Response::allow() : Response::deny('Tidak memiliki permission.');
    }
}
