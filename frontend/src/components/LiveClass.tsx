import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { ID, LiveClass } from '../lib/types';
import { useApp } from '../state/store';
import { Confirm, EmptyState, Field, IconButton, Modal, PageHeader, Select, TextInput } from './ui';
import { Icon } from './icons';
import { fmtDateTime } from '../lib/format';

const STATE_LABEL: Record<LiveClass['displayState'], string> = {
  upcoming: 'Akan datang', in_session_window: 'Berlangsung', ended: 'Selesai', cancelled: 'Dibatalkan',
};

/**
 * Instructor/staff live-class manager for one course (IMP-006). Lists
 * sessions and supports create/edit/cancel through the existing admin
 * endpoints. No credentials are ever requested or displayed here.
 */
export function LiveClassManager({ courseId }: { courseId: ID }) {
  const { toast } = useApp();
  const [rows, setRows] = useState<LiveClass[]>([]);
  const [editing, setEditing] = useState<LiveClass | 'new' | null>(null);
  const [del, setDel] = useState<LiveClass | null>(null);
  const refresh = () => { void api.manageLiveClasses(courseId).then(setRows).catch(() => setRows([])); };
  useEffect(refresh, [courseId]);

  return (
    <div>
      <PageHeader title="Live Class" sub="Jadwal sesi live untuk kelas ini."
        actions={<button className="btn-primary btn-sm" onClick={() => setEditing('new')}><Icon name="plus" size={13} /> Sesi Baru</button>} />
      {rows.length === 0 ? <EmptyState icon="play" title="Belum ada sesi live" sub="Buat sesi Zoom atau Google Meet untuk kelas ini." />
        : (
          <div className="space-y-2.5">
            {rows.map((s) => (
              <div key={s.id} className="card flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-base-900 dark:text-base-50">{s.title}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-base-400">
                    {s.provider === 'zoom' ? 'Zoom' : 'Google Meet'} · {s.scheduledAt ? fmtDateTime(Date.parse(s.scheduledAt)) : '—'} · {s.durationMinutes} mnt · {STATE_LABEL[s.displayState]}
                  </p>
                </div>
                {s.status === 'scheduled' && (
                  <>
                    <IconButton icon="pencil" title="Edit" tone="brand" onClick={() => setEditing(s)} />
                    <IconButton icon="trash" title="Batalkan" tone="danger" onClick={() => setDel(s)} />
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      {editing && <LiveClassEditor courseId={courseId} session={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
      <Confirm open={!!del} onClose={() => setDel(null)} message={`Batalkan sesi "${del?.title}"?`}
        onConfirm={() => { if (del) void api.cancelLiveClass(del.id).then(() => { toast('success', 'Sesi dibatalkan.'); refresh(); setDel(null); }).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal membatalkan.')); }} />
    </div>
  );
}

function LiveClassEditor({ courseId, session, onClose, onSaved }: { courseId: ID; session: LiveClass | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useApp();
  const [provider, setProvider] = useState<'zoom' | 'google_meet'>(session?.provider ?? 'zoom');
  const [title, setTitle] = useState(session?.title ?? '');
  const [scheduled, setScheduled] = useState(session?.scheduledAt ? session.scheduledAt.slice(0, 16) : '');
  const [duration, setDuration] = useState(String(session?.durationMinutes ?? 60));
  const [joinUrl, setJoinUrl] = useState(session?.joinUrl ?? '');
  const save = () => {
    if (!title.trim() || !scheduled) { toast('error', 'Judul dan jadwal wajib diisi.'); return; }
    const payload: Record<string, unknown> = { provider, title: title.trim(), scheduled_at: new Date(scheduled).toISOString(), duration_minutes: Number(duration) || 60 };
    if (provider === 'google_meet') payload.join_url = joinUrl.trim();
    const request = session ? api.updateLiveClass(session.id, payload) : api.createLiveClass(courseId, payload);
    void request.then(() => { toast('success', 'Sesi disimpan.'); onSaved(); }).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal menyimpan sesi.'));
  };
  return (
    <Modal open onClose={onClose} title={session ? 'Edit Sesi Live' : 'Sesi Live Baru'} footer={
      <><button className="btn-ghost" onClick={onClose}>Batal</button><button className="btn-primary" onClick={save}><Icon name="check" size={14} /> Simpan</button></>
    }>
      <div className="space-y-4">
        <Field label="Provider" required>
          <Select value={provider} onChange={(e) => setProvider(e.target.value as 'zoom' | 'google_meet')}>
            <option value="zoom">Zoom Meeting</option>
            <option value="google_meet">Google Meet</option>
          </Select>
        </Field>
        <Field label="Judul Sesi" required><TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="cth: Live Q&A Modul 3" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Jadwal" required><TextInput type="datetime-local" value={scheduled} onChange={(e) => setScheduled(e.target.value)} /></Field>
          <Field label="Durasi (menit)" required><TextInput type="number" min={1} max={1440} value={duration} onChange={(e) => setDuration(e.target.value)} className="font-mono" /></Field>
        </div>
        {provider === 'google_meet' && (
          <Field label="Link Google Meet" required hint="Link meet.google.com yang sudah dibuat."><TextInput value={joinUrl} onChange={(e) => setJoinUrl(e.target.value)} placeholder="https://meet.google.com/abc-defg-hij" className="font-mono text-xs" /></Field>
        )}
      </div>
    </Modal>
  );
}
