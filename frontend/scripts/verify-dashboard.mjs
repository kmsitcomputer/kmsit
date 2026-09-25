// Frontend verification without extra dependencies (no network needed):
//   node scripts/verify-dashboard.mjs
// Transpiles the pure modules with the project's TypeScript compiler, then checks the per-role
// menu matrix, route mapping, i18n coverage, the pagination adapter and that no runtime code
// imports the removed localStorage business modules.
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const out = mkdtempSync(join(tmpdir(), 'kms-verify-'));

const transpile = (file) => {
  const code = readFileSync(join(src, file), 'utf8');
  const js = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const target = join(out, file.replace(/\.tsx?$/, '.js'));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, js);
};
['lib/menu.ts', 'lib/permissions.ts', 'lib/pagination.ts', 'lib/i18n.ts'].forEach(transpile);

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log(`  ok  ${name}`); };

try {
  const { MENU, visibleMenu, canAccessRoute, groupedMenu } = require(join(out, 'lib/menu.js'));
  const { toPage, emptyPage, pageQuery } = require(join(out, 'lib/pagination.js'));
  const { translate } = require(join(out, 'lib/i18n.js'));

  // Permissions exactly as the seeded roles / installer grant them (backend is the source).
  const perms = {
    student: ['dashboard', 'learn', 'student_orders', 'student_certificates', 'edit_own_profile', 'shop'],
    instructor: ['dashboard', 'instructor_courses', 'instructor_quizzes', 'instructor_students', 'instructor_wallet', 'instructor_withdrawals', 'instructor_certificates', 'edit_own_profile'],
    admin: ['dashboard', 'manage_articles', 'manage_news', 'manage_tutorials', 'manage_activities', 'manage_pages', 'manage_media', 'manage_menus', 'manage_homepage', 'manage_about', 'manage_courses', 'moderate_courses', 'manage_categories', 'manage_quizzes', 'manage_certificates', 'manage_students', 'manage_instructors', 'manage_orders', 'view_payments', 'process_withdrawals', 'manage_shop', 'manage_vouchers', 'view_reports', 'view_messages'],
    limitedAdmin: ['dashboard', 'manage_articles'],
    super_admin: ['*'],
  };
  const user = (roleKey, permissions) => ({ id: roleKey, roleKey: roleKey === 'limitedAdmin' ? 'admin' : roleKey, permissions });
  const ids = (u) => visibleMenu(u).map((e) => e.id).sort();

  check('student menu', () => assert.deepEqual(ids(user('student', perms.student)),
    ['dashboard', 'my-certificates', 'my-digital', 'my-learning', 'my-orders', 'my-quizzes', 'notifications', 'profile'].sort()));
  check('instructor menu', () => assert.deepEqual(ids(user('instructor', perms.instructor)),
    ['dashboard', 'notifications', 'profile', 'teach-certificates', 'teach-courses', 'teach-quiz-results', 'teach-quizzes', 'teach-sales', 'teach-students', 'teach-wallet', 'teach-withdrawals'].sort()));
  check('limited admin menu shows only permitted work', () => assert.deepEqual(ids(user('limitedAdmin', perms.limitedAdmin)), ['articles', 'dashboard', 'notifications', 'profile']));
  check('default admin has no platform/settings/users entries', () => {
    const got = ids(user('admin', perms.admin));
    for (const hidden of ['operations', 'settings', 'settings-payments', 'integrations', 'settings-system', 'users', 'admins']) assert.ok(!got.includes(hidden), hidden);
    for (const shown of ['courses', 'orders', 'payments', 'withdrawals', 'students', 'messages', 'certificate-templates']) assert.ok(got.includes(shown), shown);
  });
  check('super admin sees platform entries', () => {
    const got = ids(user('super_admin', perms.super_admin));
    for (const shown of ['operations', 'settings', 'settings-payments', 'integrations', 'settings-system', 'users', 'admins']) assert.ok(got.includes(shown), shown);
    for (const hidden of ['my-learning', 'teach-sales']) assert.ok(!got.includes(hidden), hidden);
  });
  check('no role sees duplicate routes', () => {
    for (const [role, p] of Object.entries(perms)) {
      const routes = visibleMenu(user(role, p)).map((e) => e.route);
      assert.equal(new Set(routes).size, routes.length, role);
    }
  });
  check('route guard mirrors the menu', () => {
    assert.equal(canAccessRoute(user('student', perms.student), '/dashboard/settings'), false);
    assert.equal(canAccessRoute(user('student', perms.student), '/dashboard/my-learning'), true);
    assert.equal(canAccessRoute(user('limitedAdmin', perms.limitedAdmin), '/dashboard/payments'), false);
    assert.equal(canAccessRoute(user('instructor', perms.instructor), '/dashboard/sales'), true);
    assert.equal(canAccessRoute(user('instructor', perms.instructor), '/dashboard/orders'), false);
    assert.equal(canAccessRoute(null, '/dashboard'), false);
    assert.equal(canAccessRoute(user('student', []), '/dashboard/my-learning'), false, 'no server permissions => nothing');
  });
  check('every menu route is registered in App.tsx', () => {
    const app = readFileSync(join(src, 'App.tsx'), 'utf8');
    for (const entry of MENU) assert.ok(app.includes(`path="${entry.route}"`), entry.route);
  });
  check('every menu/section label exists in ID and EN', () => {
    const i18nSource = readFileSync(join(src, 'lib/i18n.ts'), 'utf8');
    const labels = [...new Set([...MENU.map((e) => e.labelKey), ...groupedMenu(user('super_admin', ['*'])).map((g) => g.section).filter((s) => s !== 'root'), 'sec_learning', 'sec_teaching'])];
    for (const key of labels) {
      assert.notEqual(translate('id', key), key, `id:${key}`);
      assert.notEqual(translate('en', key), key, `en:${key}`);
    }
    assert.ok(i18nSource.includes('const en: typeof id'), 'EN dictionary must be typed against ID');
  });
  check('pagination adapter', () => {
    const page = toPage({ data: [{ a: 1 }, { a: 2 }], current_page: 2, per_page: 2, total: 5, last_page: 3 }, (r) => r.a);
    assert.deepEqual(page, { items: [1, 2], page: 2, perPage: 2, total: 5, lastPage: 3 });
    assert.deepEqual(toPage(undefined, (r) => r).items, []);
    assert.equal(emptyPage().total, 0);
    assert.equal(pageQuery({ page: 2, q: '', course_id: undefined, passed: false }), '?page=2&passed=0');
  });

  // Static runtime checks over the source tree.
  const files = [];
  const walk = (dir) => readdirSync(dir).forEach((name) => { const p = join(dir, name); statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(name) && files.push(p); });
  walk(src);
  check('legacy localStorage business modules are gone and unimported', () => {
    for (const legacy of ['lib/db.ts', 'lib/lms.ts', 'lib/commerce.ts', 'lib/services.ts']) assert.ok(!files.some((f) => relative(src, f).replace(/\\/g, '/') === legacy), legacy);
    for (const f of files) assert.ok(!/from ['"][./]*(lib\/)?(db|lms|commerce|services)['"]/.test(readFileSync(f, 'utf8')), relative(src, f));
  });
  check('browser storage only for UI preferences / legacy cleanup', () => {
    const allowed = new Set(['main.tsx', 'pages/dash/SettingsTheme.tsx']);
    for (const f of files) {
      if (/localStorage|sessionStorage|indexedDB/.test(readFileSync(f, 'utf8'))) assert.ok(allowed.has(relative(src, f).replace(/\\/g, '/')), relative(src, f));
    }
  });
  check('remote states surface 401/403/5xx instead of empty lists', () => {
    const remote = readFileSync(join(src, 'components/remote.tsx'), 'utf8');
    assert.ok(/status === 401 \|\| status === 403 \? 'forbidden' : 'error'/.test(remote));
    assert.ok(remote.includes("remote.status === 'forbidden'") && remote.includes("remote.status === 'error'"));
  });
  check('instructor pages never call admin user/order listings', () => {
    const page = readFileSync(join(src, 'pages/dash/Instructor.tsx'), 'utf8');
    assert.ok(!/adminUsers|api\.orders\(/.test(page));
    assert.ok(/instructorStudents|instructorSales|instructorEarnings|instructorQuizzes|instructorQuizAttempts|instructorCourseProgress/.test(page));
  });
  check('homepage block editor converts items JSON to arrays before save', () => {
    const editor = readFileSync(join(src, 'pages/dash/Cms.tsx'), 'utf8');
    assert.ok(editor.includes("kind: 'json'"), 'items fields must use the json kind');
    assert.ok(/JSON\.parse\(raw\)/.test(editor), 'save must JSON.parse items strings');
    assert.ok(/!Array\.isArray\(parsed\)/.test(editor), 'save must reject non-array JSON');
    const apiSource = readFileSync(join(src, 'lib/api.ts'), 'utf8');
    assert.ok(apiSource.includes("'/admin/homepage/blocks'"), 'management listing must use the distinct admin endpoint');
  });
  check('shipping checkout never trusts frontend price and uses backend regions', () => {
    const apiSource = readFileSync(join(src, 'lib/api.ts'), 'utf8');
    assert.ok(apiSource.includes("'/shipping/provinces'"), 'region lookup must go through the backend');
    assert.ok(apiSource.includes("'/shipping/quote'"), 'quote must go through the backend');
    assert.ok(!/rajaongkir\.komerce\.id/.test(apiSource), 'provider host must never appear in frontend code');
    assert.ok(/function toRegions/.test(apiSource), 'region IDs must be normalized at the API boundary');
    const form = readFileSync(join(src, 'components/ShippingForm.tsx'), 'utf8');
    assert.ok(/api\.shippingProvinces\(\)/.test(form), 'province list must come from the backend');
    assert.ok(/courier.*service/.test(form), 'courier/service must come from the backend quote');
    assert.ok(/String\(s\.id\) === String\(value\.subdistrict_id\)/.test(form), 'postal assist must compare normalized IDs');
    assert.ok(/cartSignature/.test(form), 'quote must invalidate when the physical cart signature changes');
    const shop = readFileSync(join(src, 'pages/public/Public.tsx'), 'utf8');
    assert.ok(!/shipping_cost/.test(shop), 'frontend must never submit a shipping cost');
    assert.ok(/cartSignature=\{cart\.items/.test(shop), 'shop must pass a physical-cart signature to the shipping form');
  });

  console.log(`\nverify-dashboard: ${passed} checks passed`);
} finally {
  rmSync(out, { recursive: true, force: true });
}
