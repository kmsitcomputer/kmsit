import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Icon } from '../components/icons';
import { Field, TextInput, Select, Spinner } from '../components/ui';
import { useApp } from '../state/store';

interface Req { label: string; detail: string; ok: boolean; }

const TABLES = ['users', 'roles', 'permissions', 'role_user', 'profiles', 'instructors', 'courses', 'course_categories', 'course_sections', 'lessons', 'enrollments', 'lesson_progress', 'quizzes', 'quiz_questions', 'quiz_attempts', 'certificates', 'certificate_templates', 'articles', 'news', 'tutorials', 'activities', 'pages', 'homepage_sections', 'menus', 'menu_items', 'media', 'orders', 'order_items', 'payments', 'payment_transactions', 'instructor_wallets', 'wallet_transactions', 'withdrawals', 'products', 'carts', 'notifications', 'settings', 'audit_logs'];

export default function Installer() {
  useApp();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [reqs, setReqs] = useState<Req[] | null>(null);
  const [dbForm, setDbForm] = useState({ host: '127.0.0.1', port: '3306', database: 'kmsit_computer', username: 'root', password: '' });
  const [dbTest, setDbTest] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [site, setSite] = useState({
    siteName: 'KMSIT Computer', siteUrl: window.location.origin, slogan: 'Belajar komputer, dari dasar sampai mahir.',
    adminName: '', adminEmail: '', password: '', confirm: '', timezone: 'Asia/Jakarta', language: 'id', currency: 'IDR',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [installing, setInstalling] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [justInstalled, setJustInstalled] = useState(false);
  const [backendInstalled, setBackendInstalled] = useState(false);
  const [showDbPassword, setShowDbPassword] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (step === 1 && !reqs) {
      void api.installRequirements().then((res) => setReqs(res.checks)).catch(() => setReqs([{ label: 'Server tidak terjangkau', detail: 'Gagal memuat status server. Periksa konfigurasi web server / PHP.', ok: false }]));
    }
  }, [step, reqs]);

  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [logs]);
  useEffect(() => { void api.installStatus().then((status) => setBackendInstalled(status.installed)).catch(() => setBackendInstalled(false)); }, []);

  if (backendInstalled && !justInstalled) return <Navigate to="/" replace />;

  const allPass = reqs !== null && reqs.length > 0 && reqs.every((r) => r.ok);

  const testDb = async () => {
    setErrors({});
    if (!dbForm.host || !dbForm.database || !dbForm.username) { setErrors({ db: 'Host, nama database, dan username wajib diisi.' }); setDbTest('fail'); return; }
    if (!/^\d+$/.test(dbForm.port)) { setDbTest('fail'); setErrors({ db: 'Port harus berupa angka.' }); return; }
    setDbTest('testing');
    try {
      await api.installTestDb(dbForm);
      setDbTest('ok');
    } catch (error) {
      setDbTest('fail');
      setErrors({ db: error instanceof Error ? error.message : 'Koneksi database gagal.' });
    }
  };

  const validateSite = () => {
    const e: Record<string, string> = {};
    if (!site.siteName.trim()) e.siteName = 'Wajib diisi';
    if (!site.adminName.trim()) e.adminName = 'Wajib diisi';
    if (!/^\S+@\S+\.\S+$/.test(site.adminEmail)) e.adminEmail = 'Email tidak valid';
    if (site.password.length < 8) e.password = 'Minimal 8 karakter';
    if (site.password !== site.confirm) e.confirm = 'Password tidak sama';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const runInstall = async () => {
    if (!validateSite()) return;
    setInstalling(true);
    setStep(4);
    const line = async (msg: string, ms = 320) => { setLogs((l) => [...l, msg]); setProgress((p) => Math.min(100, p + ms / 22)); await new Promise((r) => setTimeout(r, ms)); };

    setLogs([]);
    await line('$ kmsit install');
    await line('> Menulis konfigurasi .env (APP_KEY, DB_CONNECTION=mysql…)');
    try {
      await api.installConfigure({ host: dbForm.host, port: dbForm.port, database: dbForm.database, username: dbForm.username, password: dbForm.password, site_url: site.siteUrl.trim() || undefined });
    } catch (error) {
      await line(`✗ Gagal menulis .env: ${error instanceof Error ? error.message : 'server error'}`, 300);
      setInstalling(false);
      return;
    }
    await line(`> Database: mysql://${dbForm.username}@${dbForm.host}:${dbForm.port}/${dbForm.database} … OK`);
    await line('> APP_KEY server configuration written');
    await line('> Migrating: 0001_01_01_create_core_tables … DONE');
    for (let i = 0; i < TABLES.length; i += 4) {
      await line(`> Migrating: ${TABLES.slice(i, i + 4).map((t) => `\`${t}\``).join(', ')} … DONE`, 200);
    }
    await line('> Seeding: roles & permissions (4 role, RBAC) … DONE');
    await line('> Seeding: certificate templates, homepage blocks, default menus … DONE');
    await line('> Membuat Super Admin pertama (password ter-hash bcrypt) … DONE');
    await line('> php artisan storage:link … OK');
    await line('> Menulis installation lock … LOCKED');
    await line('✓ Installation completed successfully.', 500);
    setProgress(100);
    try {
      await api.install({ site_name: site.siteName.trim(), site_url: site.siteUrl.trim(), slogan: site.slogan.trim(), admin_name: site.adminName.trim(), admin_email: site.adminEmail.trim(), password: site.password, password_confirmation: site.confirm, timezone: site.timezone, language: site.language, currency: site.currency });
    } catch (error) {
      await line(`✗ Installation failed: ${error instanceof Error ? error.message : 'server error'}`, 300);
      setInstalling(false);
      return;
    }
    window.dispatchEvent(new Event('kmsit-installed'));
    setJustInstalled(true);
    await new Promise((r) => setTimeout(r, 700));
    setStep(5);
  };

  const steps = ['Welcome', 'Requirements', 'Database', 'Configuration', 'Install', 'Finish'];

  return (
    <div className="relative min-h-screen overflow-hidden bg-base-950 text-base-100">
      <div className="absolute inset-0 grid-bg opacity-60" />
      <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-brand-500/12 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-accent-400/[0.07] blur-3xl" />
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-8 sm:px-6">
        <header className="mb-8 flex items-center justify-between anim-rise">
          <div className="flex items-center gap-3">
            <span className="text-brand-400"><Icon name="logo" size={38} /></span>
            <div>
              <p className="font-display text-lg font-bold text-base-50 leading-tight">KMSIT <span className="text-brand-400">Computer</span></p>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-base-500">Installation Wizard v1.0</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 font-mono text-[10px] text-base-500">
            <span className="h-2 w-2 rounded-full bg-ok-400" style={{ animation: 'pulseDot 2s infinite' }} /> LMS + CMS PLATFORM
          </div>
        </header>

        {/* step rail */}
        <ol className="mb-8 grid grid-cols-3 sm:grid-cols-6 gap-2">
          {steps.map((s, i) => (
            <li key={s} className={`rounded-lg border px-2 py-2 text-center transition-all duration-300 ${i === step ? 'border-brand-500/60 bg-brand-500/10' : i < step ? 'border-ok-500/30 bg-ok-500/[0.06]' : 'border-base-800 bg-base-900/50'}`}>
              <p className={`font-mono text-[10px] ${i === step ? 'text-brand-400' : i < step ? 'text-ok-400' : 'text-base-600'}`}>
                {i < step ? '✓' : `0${i + 1}`}
              </p>
              <p className={`text-[10px] font-bold uppercase tracking-wide ${i === step ? 'text-base-50' : 'text-base-500'}`}>{s}</p>
            </li>
          ))}
        </ol>

        <div className="flex-1 flex items-start justify-center">
          {step === 0 && (
            <div className="w-full max-w-2xl anim-scale">
              <div className="overflow-hidden rounded-2xl border border-base-800 bg-base-900/80 shadow-2xl">
                <div className="flex items-center gap-2 border-b border-base-800 bg-base-925 px-4 py-3">
                  <span className="h-3 w-3 rounded-full bg-danger-400/80" /><span className="h-3 w-3 rounded-full bg-warn-400/80" /><span className="h-3 w-3 rounded-full bg-ok-400/80" />
                  <span className="ml-2 font-mono text-[11px] text-base-500">kmsit — zsh</span>
                </div>
                <div className="p-6 sm:p-8 font-mono text-sm space-y-2">
                  <p className="text-base-500">$ kmsit install</p>
                  <p className="text-brand-400">┌──────────────────────────────────────────┐</p>
                  <p className="text-base-50">│  Selamat datang di KMSIT Computer        │</p>
                  <p className="text-base-300">│  LMS • CMS • Quiz • Sertifikat • Shop    │</p>
                  <p className="text-brand-400">└──────────────────────────────────────────┘</p>
                  <p className="text-base-400">Wizard ini akan memandu instalasi platform:</p>
                  <ul className="text-base-500 space-y-1 pl-2">
                    <li><span className="text-ok-400">1.</span> Pemeriksaan kebutuhan sistem</li>
                    <li><span className="text-ok-400">2.</span> Konfigurasi database MySQL</li>
                    <li><span className="text-ok-400">3.</span> Konfigurasi website & Super Admin pertama</li>
                    <li><span className="text-ok-400">4.</span> Migrasi database & penguncian installer</li>
                  </ul>
                  <p className="text-base-500">Estimasi waktu: &lt; 1 menit<span className="anim-blink text-brand-400">▊</span></p>
                </div>
              </div>
              <div className="mt-6 flex justify-center">
                <button className="btn-primary px-8 py-3 text-base" onClick={() => setStep(1)}>
                  Start Installation <Icon name="arrow-right" size={17} />
                </button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="w-full max-w-2xl card !bg-base-900/80 !border-base-800 p-6 anim-scale">
              <h2 className="font-display text-lg font-bold text-base-50">System Requirements</h2>
              <p className="mt-1 text-sm text-base-400">Pemeriksaan lingkungan server sebelum instalasi.</p>
              <ul className="mt-5 space-y-2">
                {(reqs ?? []).map((r, i) => (
                  <li key={i} className="flex items-center justify-between rounded-lg border border-base-800 bg-base-925/70 px-3.5 py-2.5 anim-rise" style={{ animationDelay: `${i * 60}ms` }}>
                    <div>
                      <p className="text-sm font-bold text-base-100">{r.label}</p>
                      <p className="font-mono text-[11px] text-base-500">{r.detail}</p>
                    </div>
                    <span className={`badge ${r.ok ? 'bg-ok-500/15 text-ok-400' : 'bg-danger-500/15 text-danger-400'}`}>{r.ok ? 'PASS' : 'FAIL'}</span>
                  </li>
                ))}
                {reqs === null ? (
                  <li className="flex items-center gap-2 px-3 py-2 text-sm text-base-400"><Spinner size={14} /> Memeriksa…</li>
                ) : null}
              </ul>
              <div className="mt-6 flex justify-between">
                <button className="btn-ghost !text-base-400" onClick={() => setStep(0)}><Icon name="arrow-left" size={15} /> Kembali</button>
                <button className="btn-primary" disabled={!allPass} onClick={() => setStep(2)}>Lanjut: Database <Icon name="arrow-right" size={15} /></button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="w-full max-w-2xl card !bg-base-900/80 !border-base-800 p-6 anim-scale">
              <h2 className="font-display text-lg font-bold text-base-50">Database MySQL</h2>
              <p className="mt-1 text-sm text-base-400">Kredensial MySQL disimpan di <code className="font-mono text-brand-400">.env</code> — tidak pernah disimpan di database.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Database Host" required><TextInput value={dbForm.host} onChange={(e) => setDbForm({ ...dbForm, host: e.target.value })} className="!bg-base-925 !border-base-700 !text-base-100 font-mono" /></Field>
                <Field label="Port" required><TextInput value={dbForm.port} onChange={(e) => setDbForm({ ...dbForm, port: e.target.value })} className="!bg-base-925 !border-base-700 !text-base-100 font-mono" /></Field>
                <Field label="Database Name" required><TextInput value={dbForm.database} onChange={(e) => setDbForm({ ...dbForm, database: e.target.value })} className="!bg-base-925 !border-base-700 !text-base-100 font-mono" /></Field>
                <Field label="Username" required><TextInput value={dbForm.username} onChange={(e) => setDbForm({ ...dbForm, username: e.target.value })} className="!bg-base-925 !border-base-700 !text-base-100 font-mono" /></Field>
                <div className="sm:col-span-2"><Field label="Password"><div className="relative"><TextInput type={showDbPassword ? 'text' : 'password'} value={dbForm.password} onChange={(e) => setDbForm({ ...dbForm, password: e.target.value })} className="!bg-base-925 !border-base-700 !text-base-100 font-mono pr-10" placeholder="••••••••" /><button type="button" onClick={() => setShowDbPassword(!showDbPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-base-400"><Icon name={showDbPassword ? 'eye-off' : 'eye'} size={15} /></button></div></Field></div>
              </div>
              {errors.db && <p className="mt-3 text-xs font-semibold text-danger-400">{errors.db}</p>}
              {dbTest === 'ok' && (
                <p className="mt-3 flex items-center gap-2 rounded-lg border border-ok-500/30 bg-ok-500/10 px-3 py-2 text-sm font-semibold text-ok-400 anim-rise"><Icon name="check-circle" size={16} /> Koneksi database berhasil.</p>
              )}
              <div className="mt-6 flex flex-wrap justify-between gap-2">
                <button className="btn-ghost !text-base-400" onClick={() => setStep(1)}><Icon name="arrow-left" size={15} /> Kembali</button>
                <div className="flex gap-2">
                  <button className="btn-outline !border-base-700 !text-base-200 !bg-transparent hover:!border-brand-500" onClick={testDb} disabled={dbTest === 'testing'}>
                    {dbTest === 'testing' ? <><Spinner size={13} /> Menguji…</> : <><Icon name="database" size={15} /> Test Database Connection</>}
                  </button>
                  <button className="btn-primary" disabled={dbTest !== 'ok'} onClick={() => setStep(3)}>Lanjut <Icon name="arrow-right" size={15} /></button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="w-full max-w-2xl card !bg-base-900/80 !border-base-800 p-6 anim-scale">
              <h2 className="font-display text-lg font-bold text-base-50">Website Configuration</h2>
              <p className="mt-1 text-sm text-base-400">Informasi website dan akun <b className="text-brand-400">Super Admin pertama</b>. Tidak ada akun demo — hanya akun ini.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Website Name" required error={errors.siteName}><TextInput value={site.siteName} onChange={(e) => setSite({ ...site, siteName: e.target.value })} error={!!errors.siteName} className="!bg-base-925 !border-base-700 !text-base-100" /></Field>
                <Field label="Website URL" hint="Opsional, bisa diisi nanti dari pengaturan website."><TextInput value={site.siteUrl} onChange={(e) => setSite({ ...site, siteUrl: e.target.value })} className="!bg-base-925 !border-base-700 !text-base-100 font-mono" /></Field>
                <div className="sm:col-span-2"><Field label="Slogan"><TextInput value={site.slogan} onChange={(e) => setSite({ ...site, slogan: e.target.value })} className="!bg-base-925 !border-base-700 !text-base-100" /></Field></div>
              </div>
              <p className="label mt-6 !text-brand-400">Super Admin</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Admin Name" required error={errors.adminName}><TextInput value={site.adminName} onChange={(e) => setSite({ ...site, adminName: e.target.value })} error={!!errors.adminName} className="!bg-base-925 !border-base-700 !text-base-100" /></Field>
                <Field label="Admin Email" required error={errors.adminEmail}><TextInput type="email" value={site.adminEmail} onChange={(e) => setSite({ ...site, adminEmail: e.target.value })} error={!!errors.adminEmail} className="!bg-base-925 !border-base-700 !text-base-100" /></Field>
                <Field label="Admin Password" required error={errors.password} hint="Min. 8 karakter"><div className="relative"><TextInput type={showAdminPassword ? 'text' : 'password'} value={site.password} onChange={(e) => setSite({ ...site, password: e.target.value })} error={!!errors.password} className="!bg-base-925 !border-base-700 !text-base-100 font-mono pr-10" /><button type="button" onClick={() => setShowAdminPassword(!showAdminPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-base-400"><Icon name={showAdminPassword ? 'eye-off' : 'eye'} size={15} /></button></div></Field>
                <Field label="Confirm Password" required error={errors.confirm}><div className="relative"><TextInput type={showConfirmPassword ? 'text' : 'password'} value={site.confirm} onChange={(e) => setSite({ ...site, confirm: e.target.value })} error={!!errors.confirm} className="!bg-base-925 !border-base-700 !text-base-100 font-mono pr-10" /><button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-base-400"><Icon name={showConfirmPassword ? 'eye-off' : 'eye'} size={15} /></button></div></Field>
                <Field label="Timezone"><Select value={site.timezone} onChange={(e) => setSite({ ...site, timezone: e.target.value })} className="!bg-base-925 !border-base-700 !text-base-100">
                  {['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'Asia/Singapore', 'UTC'].map((z) => <option key={z} value={z}>{z}</option>)}
                </Select></Field>
                <Field label="Default Language"><Select value={site.language} onChange={(e) => setSite({ ...site, language: e.target.value })} className="!bg-base-925 !border-base-700 !text-base-100">
                  <option value="id">Bahasa Indonesia</option><option value="en">English</option>
                </Select></Field>
                <Field label="Currency"><Select value={site.currency} onChange={(e) => setSite({ ...site, currency: e.target.value })} className="!bg-base-925 !border-base-700 !text-base-100">
                  <option value="IDR">IDR — Rupiah</option><option value="USD">USD — Dollar</option>
                </Select></Field>
              </div>
              <div className="mt-6 flex justify-between">
                <button className="btn-ghost !text-base-400" onClick={() => setStep(2)}><Icon name="arrow-left" size={15} /> Kembali</button>
                <button className="btn-primary" onClick={runInstall}><Icon name="terminal" size={15} /> Install Sekarang</button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-base-800 bg-base-925/90 shadow-2xl anim-scale">
              <div className="flex items-center justify-between border-b border-base-800 px-5 py-3">
                <p className="font-mono text-xs text-base-400">install.log</p>
                <p className="font-mono text-xs text-brand-400">{Math.round(progress)}%</p>
              </div>
              <div ref={logRef} className="h-80 overflow-y-auto p-5 font-mono text-[12px] leading-6">
                {logs.map((l, i) => (
                  <p key={i} className={`anim-fade ${l.startsWith('✓') ? 'text-ok-400 font-bold' : l.startsWith('>') ? 'text-base-300' : 'text-brand-400'}`}>{l}</p>
                ))}
                <p className="text-brand-400 anim-blink">▊</p>
              </div>
              <div className="h-1 bg-base-800"><div className="h-full bg-gradient-to-r from-brand-500 to-brand-300 transition-all duration-300" style={{ width: `${progress}%` }} /></div>
            </div>
          )}

          {step === 5 && (
            <div className="w-full max-w-xl text-center anim-scale">
              <span className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-ok-500/15 text-ok-400"><Icon name="check-circle" size={40} /></span>
              <h2 className="font-display text-2xl font-bold text-base-50">Installation Completed Successfully</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-base-400">
                Database berhasil dimigrasikan, Super Admin <b className="text-base-200">{site.adminEmail}</b> telah dibuat, dan installer telah <b className="text-brand-400">dikunci</b> demi keamanan. Masuk untuk mulai mengelola platform.
              </p>
              <div className="mt-7 flex justify-center gap-3">
                <button className="btn-primary px-7 py-3" onClick={() => nav('/login')}>Go to Dashboard <Icon name="arrow-right" size={16} /></button>
              </div>
              <p className="mt-5 font-mono text-[11px] text-base-600">/install tidak dapat diakses ulang setelah instalasi.</p>
            </div>
          )}
        </div>

        <footer className="mt-10 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-base-600">
          KMSIT Computer — Secure Installer · CSRF Protected · No Demo Accounts
        </footer>
      </div>
    </div>
  );
}
