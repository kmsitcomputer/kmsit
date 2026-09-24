import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { getSetting } from '../lib/settings';
import { api } from '../lib/api';
import { useApp } from '../state/store';
import { Icon } from '../components/icons';
import { Avatar, Badge, Field, TextInput, TextArea, Spinner } from '../components/ui';
import { Logo } from '../components/Shell';

function AuthFrame({ children, title, sub }: { children: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="relative min-h-screen overflow-hidden grid-bg flex items-center justify-center p-4">
      <div className="absolute -top-24 right-0 h-80 w-80 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -left-24 h-72 w-72 rounded-full bg-accent-400/[0.08] blur-3xl pointer-events-none" />
      <div className="relative w-full max-w-md anim-scale">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <div className="card p-7">
          <h1 className="font-display text-xl font-bold text-base-900 dark:text-base-50">{title}</h1>
          <p className="mt-1 text-sm text-base-500 dark:text-base-400">{sub}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { user, setUser, toast, t } = useApp();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    void remember;
    try {
      const loggedIn = await api.login(email, password);
      setUser(loggedIn);
      toast('success', `${t('welcome_back')}, ${loggedIn.name.split(' ')[0]}!`);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Login gagal.');
      return;
    } finally {
      setBusy(false);
    }
    nav(params.get('next') || '/dashboard');
  };

  return (
    <AuthFrame title={t('login_title')} sub={t('login_sub')}>
      {params.get('registered') && <p className="mb-4 rounded-lg border border-ok-500/30 bg-ok-500/10 px-3 py-2 text-sm font-semibold text-ok-500 anim-rise">Akun berhasil dibuat. Silakan masuk.</p>}
      {params.get('installed') && <p className="mb-4 rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-sm font-semibold text-brand-600 dark:text-brand-400 anim-rise">Instalasi selesai — masuk dengan akun Super Admin.</p>}
      <form onSubmit={submit} className="space-y-4">
        {err && <p className="flex items-center gap-2 rounded-lg border border-danger-500/30 bg-danger-500/10 px-3 py-2.5 text-sm font-semibold text-danger-500 anim-rise"><Icon name="alert-circle" size={15} />{err}</p>}
        <Field label={t('email')} required><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus placeholder="nama@email.com" /></Field>
        <Field label={t('password')} required><TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" /></Field>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-base-600 dark:text-base-300 cursor-pointer select-none">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-brand-500" />
            {t('remember_me')}
          </label>
          <Link to="/forgot" className="text-sm font-semibold text-brand-600 dark:text-brand-400 hover:underline">{t('forgot_password')}</Link>
        </div>
        <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
          {busy ? <Spinner size={15} /> : <Icon name="logout" size={15} className="rotate-180" />} {t('login')}
        </button>
      </form>
      {getSetting('allow_registration') === '1' && (
        <p className="mt-5 text-center text-sm text-base-500 dark:text-base-400">{t('no_account')} <Link to="/register" className="font-bold text-brand-600 dark:text-brand-400 hover:underline">{t('register')}</Link></p>
      )}
    </AuthFrame>
  );
}

export function RegisterPage() {
  const { setUser, toast, t } = useApp();
  const nav = useNavigate();
  const [role, setRole] = useState<'student' | 'instructor'>('student');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (getSetting('allow_registration') !== '1') {
    return (
      <AuthFrame title="Pendaftaran Ditutup" sub="Registrasi publik dinonaktifkan oleh administrator.">
        <p className="text-sm text-base-500">Hubungi administrator untuk membuat akun, atau <Link to="/login" className="font-bold text-brand-600 dark:text-brand-400 hover:underline">masuk di sini</Link>.</p>
      </AuthFrame>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (form.password.length < 8) { setErr('Password minimal 8 karakter.'); return; }
    if (form.password !== form.confirm) { setErr('Konfirmasi password tidak sama.'); return; }
    setBusy(true);
    try {
      const registered = await api.register({ name: form.name, email: form.email, password: form.password, role: role === 'instructor' ? 'instructor' : 'student' });
      setUser(registered);
      toast('success', `Selamat datang, ${registered.name.split(' ')[0]}!`);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Registrasi gagal.');
      return;
    } finally {
      setBusy(false);
    }
    nav('/dashboard');
  };

  return (
    <AuthFrame title={t('register_title')} sub={role === 'instructor' ? 'Akun instructor memerlukan approval admin sebelum tampil di publik.' : 'Akses kelas gratis & berbayar dengan sertifikat digital.'}>
      <form onSubmit={submit} className="space-y-4">
        {err && <p className="flex items-center gap-2 rounded-lg border border-danger-500/30 bg-danger-500/10 px-3 py-2.5 text-sm font-semibold text-danger-500 anim-rise"><Icon name="alert-circle" size={15} />{err}</p>}
        <div>
          <label className="label">{t('register_as')}</label>
          <div className="grid grid-cols-2 gap-2">
            {(['student', 'instructor'] as const).map((r) => (
              <button type="button" key={r} onClick={() => setRole(r)}
                className={`rounded-lg border-2 px-3 py-3 text-sm font-bold transition-all cursor-pointer ${role === r ? 'border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300' : 'border-base-200 dark:border-base-700 text-base-500 hover:border-base-300 dark:hover:border-base-600'}`}>
                <Icon name={r === 'student' ? 'grad-cap' : 'briefcase'} size={17} className="mx-auto mb-1" />
                {r === 'student' ? 'Student' : 'Instructor'}
              </button>
            ))}
          </div>
        </div>
        <Field label={t('name')} required><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus /></Field>
        <Field label={t('email')} required><TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('password')} required hint="Min. 8 karakter"><TextInput type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></Field>
          <Field label="Konfirmasi" required><TextInput type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required /></Field>
        </div>
        <button type="submit" className="btn-primary w-full py-3" disabled={busy}>{busy ? <Spinner size={15} /> : <Icon name="user-check" size={15} />} {t('register')}</button>
      </form>
      <p className="mt-5 text-center text-sm text-base-500 dark:text-base-400">{t('already_have')} <Link to="/login" className="font-bold text-brand-600 dark:text-brand-400 hover:underline">{t('login')}</Link></p>
    </AuthFrame>
  );
}

export function ForgotPage() {
  const { toast, t } = useApp();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  return (
    <AuthFrame title="Reset Password" sub="Masukkan email terdaftar untuk menerima tautan reset.">
      {sent ? (
        <div className="rounded-lg border border-ok-500/30 bg-ok-500/10 p-4 text-sm font-semibold text-ok-500 anim-rise">
          <Icon name="mail" size={18} className="mb-2" />
          {t('reset_sent')} <Link to="/login" className="underline">Kembali ke login</Link>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (/^\S+@\S+\.\S+$/.test(email)) void api.forgotPassword(email).then(() => { setSent(true); toast('info', t('reset_sent')); }).catch(() => toast('error', 'Gagal mengirim tautan reset.')); }}>
          <Field label={t('email')} required><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></Field>
          <button className="btn-primary w-full py-3"><Icon name="send" size={15} /> Kirim Tautan Reset</button>
        </form>
      )}
    </AuthFrame>
  );
}

export function ProfilePage() {
  const { user, refreshUser, toast } = useApp();
  const [form, setForm] = useState({ name: user?.name ?? '', phone: user?.phone ?? '', bio: user?.bio ?? '', headline: user?.instructorHeadline ?? '' });
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  const fileInput = document.getElementById('avatar-upload') as HTMLInputElement | null;

  const save = () => {
    if (!form.name.trim()) { toast('error', 'Nama wajib diisi.'); return; }
    void api.updateProfile({ name: form.name.trim(), phone: form.phone, bio: form.bio, instructor_headline: form.headline }).then(() => { refreshUser(); toast('success', 'Profil diperbarui.'); }).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal memperbarui profil.'));
  };

  const savePw = async () => {
    if (pw.next.length < 8) { toast('error', 'Password baru minimal 8 karakter.'); return; }
    if (pw.next !== pw.confirm) { toast('error', 'Konfirmasi password tidak sama.'); return; }
    setBusy(true);
    try { await api.updatePassword(pw.current, pw.next); } catch (error) { setBusy(false); toast('error', error instanceof Error ? error.message : 'Gagal mengganti password.'); return; }
    setBusy(false);
    setPw({ current: '', next: '', confirm: '' });
    toast('success', 'Password berhasil diganti.');
  };

  const uploadAvatar = async (f: File) => {
    try { await api.uploadAvatar(f); refreshUser(); toast('success', 'Foto profil diperbarui.'); }
    catch (error) { toast('error', error instanceof Error ? error.message : 'Gagal mengunggah foto.'); }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
      <div className="card p-6 anim-rise">
        <div className="flex flex-col items-center text-center">
          <Avatar name={form.name || user.name} src={user.avatar} size={88} />
          <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = ''; }} />
          <button className="btn-outline btn-sm mt-4" onClick={() => fileInput?.click()}><Icon name="camera" size={13} /> Ganti Foto</button>
          <h2 className="mt-4 font-display text-lg font-bold text-base-900 dark:text-base-50">{user.name}</h2>
          <p className="text-sm text-base-400">{user.email}</p>
          <Badge tone="brand"><span className="normal-case">{user.roleKey === 'super_admin' ? 'Super Admin' : user.roleKey === 'admin' ? 'Admin' : user.roleKey === 'instructor' ? 'Instructor' : 'Student'}</span></Badge>
          {user.roleKey === 'instructor' && (
            <p className="mt-3 text-xs text-base-400">Status approval: {user.instructorApproved ? <span className="font-bold text-ok-500">Disetujui</span> : <span className="font-bold text-warn-400">Menunggu approval admin</span>}</p>
          )}
          <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-base-400">Terdaftar {new Date(user.createdAt).toLocaleDateString('id-ID')}</p>
        </div>
      </div>
      <div className="space-y-5">
        <div className="card p-6 anim-rise">
          <h3 className="mb-4 font-display text-base font-bold text-base-900 dark:text-base-50">Informasi Profil</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama Lengkap" required><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Telepon"><TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            {user.roleKey === 'instructor' && (
              <div className="sm:col-span-2"><Field label="Headline Instructor" hint="Tampil di halaman publik instructor."><TextInput value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} placeholder="cth: Praktisi Digital Marketing 8 tahun" /></Field></div>
            )}
            <div className="sm:col-span-2"><Field label="Bio"><TextArea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></Field></div>
          </div>
          <button className="btn-primary mt-4" onClick={save}><Icon name="check" size={15} /> Simpan Profil</button>
        </div>
        <div className="card p-6 anim-rise">
          <h3 className="mb-4 font-display text-base font-bold text-base-900 dark:text-base-50">Ganti Password</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Password Saat Ini" required><TextInput type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
            <Field label="Password Baru" required><TextInput type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
            <Field label="Konfirmasi" required><TextInput type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
          </div>
          <button className="btn-outline mt-4" onClick={savePw} disabled={busy}>{busy ? <Spinner size={14} /> : <Icon name="key" size={15} />} Ganti Password</button>
        </div>
      </div>
    </div>
  );
}

export function ResetPasswordPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [pw, setPw] = useState({ password: '', confirm: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.password.length < 8) { setError('Password minimal 8 karakter.'); return; }
    if (pw.password !== pw.confirm) { setError('Konfirmasi password tidak sama.'); return; }
    const email = params.get('email');
    const token = params.get('token');
    if (!email || !token) { setError('Link reset tidak valid.'); return; }
    setBusy(true); setError('');
    try {
      await api.resetPassword(email, token, pw.password);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mereset password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden grid-bg flex items-center justify-center p-4">
      <div className="absolute -top-24 right-0 h-80 w-80 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />
      <div className="relative w-full max-w-md anim-scale">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <div className="card p-7">
          {success ? (
            <div className="rounded-lg border border-ok-500/30 bg-ok-500/10 p-4 text-sm font-semibold text-ok-500">
              Password berhasil diubah. <Link to="/login" className="underline">Kembali ke login</Link>
            </div>
          ) : (
            <>
              <h1 className="font-display text-xl font-bold text-base-900 dark:text-base-50">Reset Password</h1>
              <p className="mt-1 text-sm text-base-500 dark:text-base-400">Masukkan password baru Anda.</p>
              {error && <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">{error}</div>}
              <form className="mt-6 space-y-4" onSubmit={submit}>
                <Field label="Password Baru" required><TextInput type="password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} required autoFocus /></Field>
                <Field label="Konfirmasi" required><TextInput type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required /></Field>
                <button disabled={busy} className="btn-primary w-full py-3">{busy ? <Spinner size={15} /> : 'Simpan Password Baru'}</button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
