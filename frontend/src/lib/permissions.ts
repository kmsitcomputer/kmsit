import type { User } from './types';

/**
 * UI-only permission check from the permissions the server returned in `/auth/me`.
 * No local fallback: without server permissions nothing is shown. The backend
 * remains the enforcing authority for every request.
 */
export function can(user: User | null, perm: string): boolean {
  if (!user) return false;
  const permissions = user.permissions ?? [];
  return permissions.includes('*') || permissions.includes(perm);
}

export const hasAny = (user: User | null, perms: string[]) => perms.length === 0 || perms.some((p) => can(user, p));
