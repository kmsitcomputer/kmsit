import { useEffect, useState } from 'react';
import type { RoleKey } from '../../lib/types';
import { fmtDate, roleLabel } from '../../lib/format';
import { api, type ApiAdminUser } from '../../lib/api';
import { useApp } from '../../state/store';
import { Icon } from '../../components/icons';
import { Avatar, Badge, Confirm, Field, IconButton, Modal, PageHeader, Select, Spinner, StatusBadge, TextInput, Toggle } from '../../components/ui';
import { PagedTable, RemoteView, useRemote } from '../../components/remote';
import { DashShell } from '../../components/Shell';

/* ================= user form modal ================= */

function UserModal({ editing, onClose, lockedRole, onSaved }: { editing: ApiAdminUser | 'new' | null; onClose: () => void; lockedRole?: RoleKey; onSaved: () => void }) {
  const { user: actor, toast, refreshUser } = useApp();
  const isNew = editing === 'new';
  const existing = isNew ? null : editing;
  const [f, setF] = useState(() => ({
    name: existing?.name ?? '', email: existing?.email ?? '', password: '',
    roleKey: (existing?.role_key as RoleKey) ?? (lockedRole ?? 'student'), status: (existing?.status as 'active' | 'suspended') ?? 'active',
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const isSuper = actor?.roleKey === 'super_admin';

  const save = () => {
    setErr('');
    if (!f.name.trim() || !/^\S+@\S+\.\S+$/.test(f.email)) { setErr('Nama & email valid wajib diisi.'); return; }
    if (isNew && f.password.length < 8) { setErr('Password minimal 8 karakter.'); return; }
    setBusy(true);
    if (isNew) {
      void api.createUser({
        name: f.name.trim(), email: f.email.trim().toLowerCase(), password: f.password, password_confirmation: f.password,
        role_key: f.roleKey, status: f.status,
      }).then(() => {
        toast('success', `User ${f.roleKey} dibuat.`);
        setBusy(false);
        onSaved();
        onClose();
      }).catch((error) => { setErr(error instanceof Error ? error.message : 'Gagal membuat user.'); setBusy(false); });
    } else if (existing) {
      void api.updateUser(existing.id, {
        name: f.name.trim(), email: f.email.trim().toLowerCase(), role_key: isSuper ? f.roleKey : existing.role_key, status: f.status,
      }).then(() => {
        if (actor!.id === existing.id) refreshUser();
        toast('success', 'User diperbarui.');
        setBusy(false);
        onSaved();
        onClose();
      }).catch((error) => { setErr(error instanceof Error ? error.message : 'Gagal memperbarui user.'); setBusy(false); });
    }
  };

  return (
    <Modal open onClose={onClose} title={isNew ? `Tambah ${lockedRole ? roleLabel(lockedRole) : 'User'}` : `Edit — ${existing?.name}`} footer={
      <><button className="btn-ghost" onClick={onClose}>Batal</button>
        <button className="btn-primary" onClick={save} disabled={busy}>{busy ? <Spinner size={13} /> : <Icon name="check" size={14} />} Simpan</button></>
    }>
      {err && <p className="mb-3 rounded-lg border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm font-semibold text-danger-500">{err}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nama Lengkap" required><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Email" required><TextInput type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        {isNew && <Field label="Password" required hint="Min. 8 karakter"><TextInput type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>}
        {isSuper && !lockedRole && (
          <Field label="Role"><Select value={f.roleKey} onChange={(e) => setF({ ...f, roleKey: e.target.value as RoleKey })}>
            <option value="student">Student</option><option value="instructor">Instructor</option>
            <option value="admin">Admin</option><option value="super_admin">Super Admin</option>
          </Select></Field>
        )}
        {(isSuper || actor?.roleKey === 'admin') && (
          <Field label="Status"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as 'active' | 'suspended' })}>
            <option value="active">Aktif</option><option value="suspended">Ditangguhkan</option>
          </Select></Field>
        )}
      </div>
    </Modal>
  );
}

function ResetPasswordModal({ target, onClose }: { target: ApiAdminUser; onClose: () => void }) {
  const { toast } = useApp();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <Modal open onClose={onClose} title={`Reset Password — ${target.name}`} footer={
      <><button className="btn-ghost" onClick={onClose}>Batal</button>
        <button className="btn-primary" disabled={busy || pw.length < 8} onClick={() => {
          setBusy(true); setErr('');
          void api.updateUser(target.id, { password: pw, password_confirmation: pw }).then(() => {
            setBusy(false); toast('success', 'Password direset.'); onClose();
          }).catch((error) => { setErr(error instanceof Error ? error.message : 'Gagal mereset password.'); setBusy(false); });
        }}>{busy ? <Spinner size={13} /> : <Icon name="key" size={14} />} Reset</button></>
    }>
      {err && <p className="mb-3 rounded-lg border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm font-semibold text-danger-500">{err}</p>}
      <Field label="Password Baru" required hint="Min. 8 karakter"><TextInput type="text" value={pw} onChange={(e) => setPw(e.target.value)} className="font-mono" /></Field>
    </Modal>
  );
}

/* ================= people pages ================= */

export function PeoplePage({ role }: { role: RoleKey | 'all' }) {
  const { user: actor, toast } = useApp();
  const [modal, setModal] = useState<ApiAdminUser | 'new' | null>(null);
  const [resetFor, setResetFor] = useState<ApiAdminUser | null>(null);
  const [del, setDel] = useState<ApiAdminUser | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => { setPage(1); }, [role, q]);
  const users = useRemote(() => api.adminUsers({ page, q, role: role === 'all' ? undefined : role }), [page, q, role, actor?.id]);
  const refresh = users.reload;

  if (!actor) return null;

  const title = role === 'student' ? 'Students' : role === 'instructor' ? 'Instructors' : role === 'admin' ? 'Administrators' : 'Semua User';

  const approveInstructor = (u: ApiAdminUser) => {
    void api.approveInstructor(u.id, true).then(() => {
      toast('success', `${u.name} disetujui sebagai instructor.`);
      refresh();
    }).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal menyetujui instructor.'));
  };

  return (
    <DashShell title={title}>
      <PageHeader title={title} sub={role === 'instructor' ? 'Moderasi approval & kelola akun instructor.' : 'Kelola akun pengguna platform.'}
        actions={<button className="btn-primary" onClick={() => setModal('new')}><Icon name="plus" size={15} /> Tambah {role === 'all' ? 'User' : roleLabel(role === 'admin' ? 'admin' : role)}</button>} />
      <RemoteView remote={users} isEmpty={(p) => p.total === 0 && !q} emptyTitle="Belum ada data" emptySub="Tambahkan pengguna pertama.">
        {(data) => <PagedTable<ApiAdminUser> page={data} onPage={setPage} rowKey={(u) => u.id}
        toolbar={<form className="relative min-w-[200px] flex-1 sm:max-w-xs" onSubmit={(e) => { e.preventDefault(); setQ(search.trim()); }}>
          <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama/email…" className="input pl-9 py-2 text-sm" />
        </form>}
        columns={[
          { key: 'name', label: 'User', render: (u: ApiAdminUser) => (
            <div className="flex items-center gap-3"><Avatar name={u.name} src={u.avatar} size={34} />
              <div><p className="font-bold text-base-900 dark:text-base-100">{u.name}</p><p className="text-xs text-base-400">{u.email}</p></div></div>
          )},
          { key: 'role', label: 'Role', render: (u: ApiAdminUser) => <Badge tone={u.role_key === 'super_admin' ? 'accent' : u.role_key === 'admin' ? 'info' : u.role_key === 'instructor' ? 'brand' : 'neutral'}><span className="normal-case">{roleLabel(u.role_key as RoleKey)}</span></Badge> },
          ...(role === 'instructor' ? [{
            key: 'approved', label: 'Approval', render: (u: ApiAdminUser) => u.instructor_approved
              ? <Badge tone="ok"><Icon name="check" size={10} /> Disetujui</Badge>
              : <button className="btn-outline btn-sm" onClick={() => approveInstructor(u)}><Icon name="user-check" size={12} /> Setujui</button>,
          }] : []),
          { key: 'created', label: 'Bergabung', render: (u: ApiAdminUser) => <span className="font-mono text-[11px] text-base-400">{u.createdAt ? fmtDate(u.createdAt) : '-'}</span> },
          { key: 'status', label: 'Status', render: (u: ApiAdminUser) => <StatusBadge status={u.status as 'active' | 'suspended'} /> },
        ]}
        rowActions={(u: ApiAdminUser) => u.id === actor.id ? <span className="font-mono text-[10px] text-base-400 pr-1">kamu</span> : (
          <div className="flex items-center justify-end gap-1">
            <IconButton icon="pencil" title="Edit" tone="brand" onClick={() => setModal(u)} />
            {(actor.roleKey === 'super_admin' || actor.roleKey === 'admin') && <IconButton icon="key" title="Reset password" onClick={() => setResetFor(u)} />}
            {actor.roleKey === 'super_admin' && <IconButton icon="trash" title="Hapus" tone="danger" onClick={() => setDel(u)} />}
          </div>
        )} />}
      </RemoteView>
      {modal && <UserModal editing={modal} lockedRole={role === 'all' ? undefined : role === 'admin' ? 'admin' : role} onClose={() => setModal(null)} onSaved={refresh} />}
      {resetFor && <ResetPasswordModal target={resetFor} onClose={() => setResetFor(null)} />}
      <Confirm open={!!del} onClose={() => setDel(null)} message={`Hapus user "${del?.name}"? Akun yang masih memiliki order, kelas, sertifikat, atau transaksi keuangan ditolak server — gunakan suspend.`}
        onConfirm={() => {
          if (!del) return;
          void api.deleteUser(del.id).then(() => {
            toast('success', 'User dihapus.');
            refresh();
          }).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal menghapus user.'));
        }} />
    </DashShell>
  );
}

/* ================= contact messages ================= */

type ContactMessage = { id: string; name: string; email: string; subject: string | null; body: string; is_read: boolean; created_at: string; createdAt: number; updatedAt: number };

const toContactMessage = (payload: any): ContactMessage => ({
  id: String(payload.id), name: payload.name || '', email: payload.email || '', subject: payload.subject ?? null,
  body: payload.body || '', is_read: Boolean(payload.is_read), created_at: payload.created_at,
  createdAt: payload.created_at ? Date.parse(payload.created_at) : 0, updatedAt: payload.updated_at ? Date.parse(payload.updated_at) : 0,
});

export function MessagesPage() {
  const { user, toast } = useApp();
  const [page, setPage] = useState(1);
  const [current, setCurrent] = useState<ContactMessage | null>(null);
  const messages = useRemote(() => api.contactMessages({ page }).then((p) => ({ ...p, items: p.items.map(toContactMessage) })), [page, user?.id]);

  if (!user) return null;

  const markRead = (m: ContactMessage) => {
    setCurrent(m);
    if (!m.is_read) {
      void api.updateContactMessage(m.id, true).then(messages.reload).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal menandai pesan.'));
    }
  };

  return (
    <DashShell title="Pesan Masuk">
      <PageHeader title="Pesan Masuk" sub="Pesan dari form kontak website." />
      <RemoteView remote={messages} isEmpty={(p) => p.total === 0} emptyTitle="Belum ada pesan" emptySub="Pesan dari halaman kontak akan masuk ke sini.">
        {(data) => <PagedTable<ContactMessage> page={data} onPage={setPage} rowKey={(m) => m.id}
        columns={[
          { key: 'name', label: 'Dari', render: (m: ContactMessage) => <div><p className="font-bold text-base-900 dark:text-base-100">{m.name}</p><p className="text-xs text-base-400">{m.email}</p></div> },
          { key: 'subject', label: 'Subjek', render: (m: ContactMessage) => <span className="text-sm font-semibold">{m.subject || '(tanpa subjek)'}</span> },
          { key: 'date', label: 'Tanggal', render: (m: ContactMessage) => <span className="font-mono text-[11px] text-base-400">{fmtDate(m.created_at)}</span> },
          { key: 'read', label: 'Status', render: (m: ContactMessage) => m.is_read ? <Badge tone="neutral">Dibaca</Badge> : <Badge tone="brand" dot>Baru</Badge> },
        ]}
        rowActions={(m: ContactMessage) => (
          <IconButton icon="eye" title="Baca" tone="brand" onClick={() => markRead(m)} />
        )} />}
      </RemoteView>
      <Modal open={!!current} onClose={() => setCurrent(null)} title={current?.subject || 'Pesan'}>
        {current && (
          <div className="space-y-3">
            <p className="text-sm"><b>{current.name}</b> · {current.email}</p>
            <p className="rounded-lg bg-base-100 dark:bg-base-850 p-4 text-sm leading-6 text-base-700 dark:text-base-200 whitespace-pre-wrap">{current.body}</p>
            <a className="btn-outline btn-sm inline-flex" href={`mailto:${current.email}`}><Icon name="mail" size={13} /> Balas via Email</a>
          </div>
        )}
      </Modal>
    </DashShell>
  );
}
