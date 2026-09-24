import type { IconName } from '../components/icons';
import type { TKey } from './i18n';
import type { RoleKey, User } from './types';
import { hasAny } from './permissions';

/**
 * Single source of truth for dashboard navigation AND route guards.
 * An entry is visible when the user's role is listed (if `roles` is set) and the user holds
 * at least one of `permissions` (empty = any signed-in user). Permissions come from the
 * server (`/auth/me`); the backend still authorizes every request.
 */
export type SectionKey = 'root' | 'sec_learning' | 'sec_teaching' | 'sec_finance' | 'sec_academic' | 'sec_content'
  | 'sec_commerce' | 'sec_people' | 'sec_website' | 'sec_settings' | 'sec_platform' | 'sec_account';

export interface MenuEntry {
  id: string; labelKey: TKey; route: string; icon: IconName; permissions: string[]; roles?: RoleKey[]; section: SectionKey;
  end?: boolean; status?: 'not_active';
}

const STAFF: RoleKey[] = ['admin', 'super_admin'];

export const MENU: MenuEntry[] = [
  { id: 'dashboard', labelKey: 'dashboard', route: '/dashboard', icon: 'grid', permissions: [], section: 'root', end: true },

  // student
  { id: 'my-learning', labelKey: 'my_learning', route: '/dashboard/my-learning', icon: 'grad-cap', permissions: ['learn'], roles: ['student'], section: 'sec_learning' },
  { id: 'my-quizzes', labelKey: 'nav_my_quizzes', route: '/dashboard/my-quizzes', icon: 'target', permissions: ['learn'], roles: ['student'], section: 'sec_learning' },
  { id: 'my-certificates', labelKey: 'nav_my_certificates', route: '/dashboard/certificates', icon: 'award', permissions: ['student_certificates'], roles: ['student'], section: 'sec_learning' },
  { id: 'my-orders', labelKey: 'nav_my_orders', route: '/dashboard/orders', icon: 'receipt', permissions: ['student_orders'], roles: ['student'], section: 'sec_learning' },
  { id: 'my-digital', labelKey: 'nav_digital', route: '/dashboard/digital', icon: 'download', permissions: ['shop'], roles: ['student'], section: 'sec_learning' },

  // instructor
  { id: 'teach-courses', labelKey: 'my_courses', route: '/dashboard/courses', icon: 'book', permissions: ['instructor_courses'], roles: ['instructor'], section: 'sec_teaching' },
  { id: 'teach-students', labelKey: 'nav_my_students', route: '/dashboard/students', icon: 'users', permissions: ['instructor_students'], roles: ['instructor'], section: 'sec_teaching' },
  { id: 'teach-quizzes', labelKey: 'quizzes', route: '/dashboard/quizzes', icon: 'target', permissions: ['instructor_quizzes'], roles: ['instructor'], section: 'sec_teaching' },
  { id: 'teach-quiz-results', labelKey: 'nav_quiz_attempts', route: '/dashboard/quiz-results', icon: 'check-circle', permissions: ['instructor_quizzes'], roles: ['instructor'], section: 'sec_teaching' },
  { id: 'teach-certificates', labelKey: 'certificates', route: '/dashboard/certificates', icon: 'award', permissions: ['instructor_certificates'], roles: ['instructor'], section: 'sec_teaching' },
  { id: 'teach-sales', labelKey: 'nav_sales', route: '/dashboard/sales', icon: 'banknote', permissions: ['instructor_wallet'], roles: ['instructor'], section: 'sec_finance' },
  { id: 'teach-wallet', labelKey: 'wallet', route: '/dashboard/wallet', icon: 'wallet', permissions: ['instructor_wallet'], roles: ['instructor'], section: 'sec_finance' },
  { id: 'teach-withdrawals', labelKey: 'withdrawals', route: '/dashboard/withdrawals', icon: 'card', permissions: ['instructor_withdrawals'], roles: ['instructor'], section: 'sec_finance' },

  // staff (admin by permission, super_admin via '*')
  { id: 'courses', labelKey: 'courses', route: '/dashboard/courses', icon: 'book', permissions: ['manage_courses'], roles: STAFF, section: 'sec_academic' },
  { id: 'categories', labelKey: 'categories_m', route: '/dashboard/categories', icon: 'tag', permissions: ['manage_categories'], roles: STAFF, section: 'sec_academic' },
  { id: 'quizzes', labelKey: 'quizzes', route: '/dashboard/quizzes', icon: 'target', permissions: ['manage_quizzes'], roles: STAFF, section: 'sec_academic' },
  { id: 'certificates', labelKey: 'certificates', route: '/dashboard/certificates', icon: 'award', permissions: ['manage_certificates'], roles: STAFF, section: 'sec_academic' },
  { id: 'certificate-templates', labelKey: 'nav_certificate_templates', route: '/dashboard/certificate-templates', icon: 'palette', permissions: ['manage_certificates'], roles: STAFF, section: 'sec_academic' },
  { id: 'articles', labelKey: 'articles', route: '/dashboard/articles', icon: 'file-text', permissions: ['manage_articles'], roles: STAFF, section: 'sec_content' },
  { id: 'news', labelKey: 'news', route: '/dashboard/news', icon: 'news', permissions: ['manage_news'], roles: STAFF, section: 'sec_content' },
  { id: 'tutorials', labelKey: 'tutorials', route: '/dashboard/tutorials', icon: 'book-open', permissions: ['manage_tutorials'], roles: STAFF, section: 'sec_content' },
  { id: 'activities', labelKey: 'activities', route: '/dashboard/activities', icon: 'calendar', permissions: ['manage_activities'], roles: STAFF, section: 'sec_content' },
  { id: 'products', labelKey: 'nav_products', route: '/dashboard/products', icon: 'bag', permissions: ['manage_shop'], roles: STAFF, section: 'sec_commerce' },
  { id: 'vouchers', labelKey: 'nav_vouchers', route: '/dashboard/vouchers', icon: 'tag', permissions: ['manage_vouchers'], roles: STAFF, section: 'sec_commerce' },
  { id: 'orders', labelKey: 'orders', route: '/dashboard/orders', icon: 'receipt', permissions: ['manage_orders'], roles: STAFF, section: 'sec_commerce' },
  { id: 'payments', labelKey: 'payments', route: '/dashboard/payments', icon: 'card', permissions: ['view_payments'], roles: STAFF, section: 'sec_commerce' },
  { id: 'withdrawals', labelKey: 'withdrawals', route: '/dashboard/withdrawals', icon: 'banknote', permissions: ['process_withdrawals'], roles: STAFF, section: 'sec_finance' },
  { id: 'students', labelKey: 'nav_students_admin', route: '/dashboard/students', icon: 'users', permissions: ['manage_students'], roles: STAFF, section: 'sec_people' },
  { id: 'instructors', labelKey: 'instructors', route: '/dashboard/instructors', icon: 'grad-cap', permissions: ['manage_instructors'], roles: STAFF, section: 'sec_people' },
  { id: 'users', labelKey: 'nav_all_users', route: '/dashboard/users', icon: 'shield', permissions: ['*'], roles: ['super_admin'], section: 'sec_people' },
  { id: 'admins', labelKey: 'nav_admins', route: '/dashboard/admins', icon: 'shield', permissions: ['*'], roles: ['super_admin'], section: 'sec_people' },
  { id: 'messages', labelKey: 'nav_messages', route: '/dashboard/messages', icon: 'chat', permissions: ['view_messages'], roles: STAFF, section: 'sec_people' },
  { id: 'homepage', labelKey: 'homepage', route: '/dashboard/homepage', icon: 'layout', permissions: ['manage_homepage'], roles: STAFF, section: 'sec_website' },
  { id: 'menus', labelKey: 'menus', route: '/dashboard/menus', icon: 'list', permissions: ['manage_menus'], roles: STAFF, section: 'sec_website' },
  { id: 'pages', labelKey: 'pages', route: '/dashboard/pages', icon: 'file', permissions: ['manage_pages'], roles: STAFF, section: 'sec_website' },
  { id: 'about', labelKey: 'nav_about', route: '/dashboard/about', icon: 'info', permissions: ['manage_about'], roles: STAFF, section: 'sec_website' },
  { id: 'media', labelKey: 'media', route: '/dashboard/media', icon: 'image', permissions: ['manage_media'], roles: STAFF, section: 'sec_website' },

  // super admin platform
  { id: 'operations', labelKey: 'nav_operations', route: '/dashboard/operations', icon: 'server', permissions: ['*'], roles: ['super_admin'], section: 'sec_platform' },
  { id: 'settings', labelKey: 'general', route: '/dashboard/settings', icon: 'gear', permissions: ['manage_settings'], roles: STAFF, section: 'sec_platform' },
  { id: 'settings-payments', labelKey: 'payment_gateway', route: '/dashboard/settings-payments', icon: 'card', permissions: ['manage_settings'], roles: STAFF, section: 'sec_platform' },
  { id: 'integrations', labelKey: 'nav_integrations', route: '/dashboard/integrations', icon: 'layers', permissions: ['manage_settings'], roles: STAFF, section: 'sec_platform' },
  { id: 'settings-theme', labelKey: 'nav_theme', route: '/dashboard/settings-theme', icon: 'palette', permissions: ['manage_settings'], roles: STAFF, section: 'sec_platform' },
  { id: 'settings-language', labelKey: 'language', route: '/dashboard/settings-language', icon: 'globe', permissions: ['manage_settings'], roles: STAFF, section: 'sec_platform' },
  { id: 'settings-system', labelKey: 'nav_audit', route: '/dashboard/settings-system', icon: 'file-text', permissions: ['view_audit'], roles: STAFF, section: 'sec_platform' },

  // everyone
  { id: 'notifications', labelKey: 'notifications', route: '/dashboard/notifications', icon: 'bell', permissions: [], section: 'sec_account' },
  { id: 'profile', labelKey: 'profile', route: '/dashboard/profile', icon: 'user', permissions: [], section: 'sec_account' },
];

export const SECTION_ORDER: SectionKey[] = ['root', 'sec_learning', 'sec_teaching', 'sec_finance', 'sec_academic', 'sec_content',
  'sec_commerce', 'sec_people', 'sec_website', 'sec_platform', 'sec_account'];

export function canSeeEntry(user: User | null, entry: MenuEntry): boolean {
  if (!user) return false;
  if (entry.roles && !entry.roles.includes(user.roleKey)) return false;
  return hasAny(user, entry.permissions);
}

export const visibleMenu = (user: User | null): MenuEntry[] => MENU.filter((entry) => canSeeEntry(user, entry));

/** Route guard: a dashboard path is reachable when any visible entry points at it. */
export function canAccessRoute(user: User | null, route: string): boolean {
  return MENU.some((entry) => entry.route === route && canSeeEntry(user, entry));
}

export function groupedMenu(user: User | null): Array<{ section: SectionKey; items: MenuEntry[] }> {
  const visible = visibleMenu(user);
  return SECTION_ORDER.map((section) => ({ section, items: visible.filter((entry) => entry.section === section) }))
    .filter((group) => group.items.length > 0);
}
