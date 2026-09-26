import { describe, expect, it } from 'vitest';
import type { User } from '../types';
import { can, hasAny } from '../permissions';

const user = (permissions?: string[]): User => ({
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.test',
  passwordHash: '',
  salt: '',
  roleKey: 'admin',
  status: 'active',
  permissions,
  createdAt: 0,
  updatedAt: 0,
});

describe('UI-only permission helpers', () => {
  it('denies missing users and missing permissions', () => {
    expect(can(null, 'manage_orders')).toBe(false);
    expect(can(user(), 'manage_orders')).toBe(false);
  });

  it('accepts exact and wildcard permissions', () => {
    expect(can(user(['manage_orders']), 'manage_orders')).toBe(true);
    expect(can(user(['manage_orders']), 'manage_users')).toBe(false);
    expect(can(user(['*']), 'manage_users')).toBe(true);
  });

  it('checks representative permission sets with hasAny', () => {
    expect(hasAny(user(['manage_articles']), [])).toBe(true);
    expect(hasAny(user(['manage_articles']), ['manage_orders', 'manage_articles'])).toBe(true);
    expect(hasAny(user(['dashboard']), ['manage_orders', 'manage_articles'])).toBe(false);
    expect(hasAny(null, ['dashboard'])).toBe(false);
  });
});
