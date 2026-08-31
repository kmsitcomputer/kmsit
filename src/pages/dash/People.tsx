import { useState } from 'react';
import { db, type User, type RoleKey, type ID } from '../../lib/db';
import { fmtDate, UsersService, resetPasswordByAdmin, audit, roleLabel } from '../../lib/services';
import { CourseService } from '../../lib/lms';
import { useApp, useDB } from '../../state/store';
import { Icon } from '../../components/icons';
import { Avatar, Badge, Confirm, DataTable, Field, IconButton, Modal, PageHeader, Select, Spinner, StatusBadge, TextArea, TextInput, Toggle } from '../../components/ui';
import { DashShell } from '../../components/Shell';

/* ================= user form modal ================= */

function UserModal({ editing, onClose, lockedRole }: { editing: User | 'new' | null; onClose: () => void; lockedRole?: RoleKey }) {
  const { user: actor, toast, refreshUser } = useApp();
  const isNew = editing === 'new';
  const existing = isNew ? null : editing;
  const [f, setF] = useState(() => ({
    name: existing?.name ?? '', email: existing?.email ?? '', password: '',
    roleKey: existing?.roleKey ?? (lockedRole ?? 'student') as RoleKey, status: existing?.status ?? 'active' as User['status'],
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const isSuper = actor?.roleKey === 'super_admin';

  const save = async () => {
    setErr('');
    if (!f.name.trim() || !/^\S+@\S+\.\S+$/.test(f.email)) { setErr('Nama & email valid wajib diisi.'); return; }
    if (isNew && f.password.length < 8) { setErr('Password minimal 8 karakter.'); return; }
    setBusy(true);
    if (isNew) {
      const res = await UsersService.create(f);
      if (!res.ok) { setErr(res.error ?? 'Gagal'); setBusy(false); return; }
      audit(actor!.id, actor!.name, 'create', 'user', res.user!.id, `Membuat user ${res.user!.name} (${f.roleKey})`);
      toast('success', `User ${f.roleKey} dibuat.`);
    } else if (existing) {
      UsersService.update(existing.id, { name: f.name.trim(), email: f.email.trim().toLowerCase(), roleKey: isSuper ? f.roleKey : existing.roleKey, status: f.status });
      audit(actor!.id, actor!.name, 'update', 'user', existing.id, `Memperbarui user ${f.name}`);
      if (actor!.id === existing.id) refreshUser();
      toast('success', 'User diperbarui.');
    }
    setBusy(false);
    onClose();
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
          <Field label="Status"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as User['status'] })}>
            <option value="active">Aktif</option><option value="suspended">Ditangguhkan</option>
          </Select></Field>
        )}
      </div>
    </Modal>
  );
}

function ResetPasswordModal({ target, onClose }: { target: User; onClose: () => void }) {
  const { user: actor, toast } = useApp();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal open onClose={onClose} title={`Reset Password — ${target.name}`} footer={
      <><button className="btn-ghost" onClick={onClose}>Batal</button>
        <button className="btn-primary" disabled={busy || pw.length < 8} onClick={async () => {
          setBusy(true); await resetPasswordByAdmin(target.id, pw);
          audit(actor!.id, actor!.name, 'reset_password', 'user', target.id, `Reset password ${target.name}`);
          setBusy(false); toast('success', 'Password direset.'); onClose();
        }}>{busy ? <Spinner size={13} /> : <Icon name="key" size={14} />} Reset</button></>
    }>
      <Field label="Password Baru" required hint="Min. 8 karakter"><TextInput type="text" value={pw} onChange={(e) => setPw(e.target.value)} className="font-mono" /></Field>
    </Modal>
  );
}

/* ================= people pages ================= */

export function PeoplePage({ role }: { role: RoleKey | 'all' }) {
  useDB();
  const { user: actor, toast } = useApp();
  const [modal, setModal] = useState<User | 'new' | null>(null);
  const [resetFor, setResetFor] = useState<User | null>(null);
  const [del, setDel] = useState<User | null>(null);
  if (!actor) return null;

  const title = role === 'student' ? 'Students' : role === 'instructor' ? 'Instructors' : role === 'admin' ? 'Administrators' : 'Semua User';
  let rows = role === 'all' ? UsersService.list() : UsersService.list().filter((u) => u.roleKey === role);
  rows = rows.slice().sort((a, b) => b.createdAt - a.createdAt);

  return (
    <DashShell title={title}>
      <PageHeader title={title} sub={role === 'instructor' ? 'Moderasi approval & kelola akun instructor.' : 'Kelola akun pengguna platform.'}
        actions={<button className="btn-primary" onClick={() => setModal('new')}><Icon name="plus" size={15} /> Tambah {role === 'all' ? 'User' : roleLabel(role === 'admin' ? 'admin' : role)}</button>} />
      <DataTable rows={rows} pageSize={9} searchKeys={(u: User) => `${u.name} ${u.email}`}
        emptyTitle="Belum ada data" emptySub="Tambahkan pengguna pertama."
        columns={[
          { key: 'name', label: 'User', render: (u: User) => (
            <div className="flex items-center gap-3"><Avatar name={u.name} src={u.avatar} size={34} />
              <div><p className="font-bold text-base-900 dark:text-base-100">{u.name}</p><p className="text-xs text-base-400">{u.email}</p></div></div>
          )},
          { key: 'role', label: 'Role', render: (u: User) => <Badge tone={u.roleKey === 'super_admin' ? 'accent' : u.roleKey === 'admin' ? 'info' : u.roleKey === 'instructor' ? 'brand' : 'neutral'}><span className="normal-case">{roleLabel(u.roleKey)}</span></Badge> },
          ...(role === 'instructor' ? [{
            key: 'courses', label: 'Kelas', render: (u: User) => <span className="font-mono text-xs font-bold">{CourseService.ofInstructor(u.id).length}</span>,
          }, {
            key: 'approved', label: 'Approval', render: (u: User) => u.instructorApproved
              ? <Badge tone="ok"><Icon name="check" size={10} /> Disetujui</Badge>
              : <button className="btn-outline btn-sm" onClick={() => { db.update('users', u.id, { instructorApproved: true }); audit(actor.id, actor.name, 'approve', 'user', u.id, `Approve instructor ${u.name}`); toast('success', `${u.name} disetujui sebagai instructor.`); }}><Icon name="user-check" size={12} /> Setujui</button>,
          }] : []),
          { key: 'last', label: 'Login Terakhir', render: (u: User) => <span className="font-mono text-[11px] text-base-400">{u.lastLoginAt ? fmtDate(u.lastLoginAt) : 'belum pernah'}</span> },
          { key: 'status', label: 'Status', render: (u: User) => <StatusBadge status={u.status} /> },
        ]}
        rowActions={(u: User) => u.id === actor.id ? <span className="font-mono text-[10px] text-base-400 pr-1">kamu</span> : (
          <>
            <IconButton icon="pencil" title="Edit" tone="brand" onClick={() => setModal(u)} />
            {(actor.roleKey === 'super_admin' || actor.roleKey === 'admin') && <IconButton icon="key" title="Reset password" onClick={() => setResetFor(u)} />}
            {actor.roleKey === 'super_admin' && <IconButton icon="trash" title="Hapus" tone="danger" onClick={() => setDel(u)} />}
          </>
        )} />
      {modal && <UserModal editing={modal} lockedRole={role === 'all' ? undefined : role === 'admin' ? 'admin' : role} onClose={() => setModal(null)} />}
      {resetFor && <ResetPasswordModal target={resetFor} onClose={() => setResetFor(null)} />}
      <Confirm open={!!del} onClose={() => setDel(null)} message={`Hapus user "${del?.name}"? Enrollment & sesi mereka juga dihapus.`}
        onConfirm={() => { if (del) { UsersService.remove(del.id, actor); toast('success', 'User dihapus.'); } }} />
    </DashShell>
  );
}

/* ================= contact messages ================= */

export function MessagesPage() {
  useDB();
  const { user, toast } = useApp();
  const [open, setOpen] = useState<ID | null>(null);
  const [del, setDel] = useState<ID | null>(null);
  if (!user) return null;
  const rows = db.all('contactMessages').slice().reverse();
  const current = open ? db.byId('contactMessages', open) : null;
  return (
    <DashShell title="Pesan Masuk">
      <PageHeader title="Pesan Masuk" sub="Pesan dari form kontak website." />
      <DataTable rows={rows} pageSize={9} searchKeys={(m) => `${m.name} ${m.email} ${m.subject}`}
        emptyTitle="Belum ada pesan" emptySub="Pesan dari halaman kontak akan masuk ke sini."
        columns={[
          { key: 'name', label: 'Dari', render: (m) => <div><p className="font-bold text-base-900 dark:text-base-100">{m.name}</p><p className="text-xs text-base-400">{m.email}</p></div> },
          { key: 'subject', label: 'Subjek', render: (m) => <span className="text-sm font-semibold">{m.subject || '(tanpa subjek)'}</span> },
          { key: 'date', label: 'Tanggal', render: (m) => <span className="font-mono text-[11px] text-base-400">{fmtDate(m.createdAt)}</span> },
          { key: 'read', label: 'Status', render: (m) => m.read ? <Badge tone="neutral">Dibaca</Badge> : <Badge tone="brand" dot>Baru</Badge> },
        ]}
        rowActions={(m) => (
          <>
            <IconButton icon="eye" title="Baca" tone="brand" onClick={() => { setOpen(m.id); if (!m.read) db.update('contactMessages', m.id, { read: true }); }} />
            <IconButton icon="trash" title="Hapus" tone="danger" onClick={() => setDel(m.id)} />
          </>
        )} />
      <Modal open={!!current} onClose={() => setOpen(null)} title={current?.subject || 'Pesan'}>
        {current && (
          <div className="space-y-3">
            <p className="text-sm"><b>{current.name}</b> · {current.email}</p>
            <p className="rounded-lg bg-base-100 dark:bg-base-850 p-4 text-sm leading-6 text-base-700 dark:text-base-200 whitespace-pre-wrap">{current.body}</p>
            <a className="btn-outline btn-sm inline-flex" href={`mailto:${current.email}`}><Icon name="mail" size={13} /> Balas via Email</a>
          </div>
        )}
      </Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} message="Hapus pesan ini?" onConfirm={() => { if (del) { db.remove('contactMessages', del); toast('success', 'Pesan dihapus.'); } }} />
    </DashShell>
  );
}
