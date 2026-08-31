import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { db, type Course, type Lesson, type Section, type ID, type LessonType } from '../../lib/db';
import { fmtMoney, fmtDate, audit } from '../../lib/services';
import { CourseService, CategoryService, CurriculumService } from '../../lib/lms';
import { useApp, useDB } from '../../state/store';
import { Icon } from '../../components/icons';
import RichText from '../../components/RichText';
import { Badge, Confirm, DataTable, EmptyState, Field, IconButton, MediaPicker, Modal, PageHeader, Select, Spinner, StatusBadge, Tabs, TextArea, TextInput, Toggle } from '../../components/ui';
import { DashShell } from '../../components/Shell';

/* ================= lesson editor ================= */

const LESSON_TYPES: { k: LessonType; label: string }[] = [
  { k: 'text', label: 'Teks / Artikel' }, { k: 'youtube', label: 'YouTube' }, { k: 'video', label: 'Video (URL)' },
  { k: 'pdf', label: 'PDF' }, { k: 'file', label: 'File' }, { k: 'image', label: 'Gambar' },
  { k: 'url', label: 'Link Eksternal' }, { k: 'embed', label: 'Embed (YouTube/Vimeo)' },
];

function LessonEditor({ lesson, courseId, sectionId, onClose }: { lesson: Lesson | null; courseId: ID; sectionId: ID; onClose: () => void }) {
  const { toast } = useApp();
  const [f, setF] = useState({
    title: lesson?.title ?? '', type: lesson?.type ?? 'text' as LessonType, content: lesson?.content ?? '',
    mediaUrl: lesson?.mediaUrl ?? '', durationMin: lesson?.durationMin ?? 5, preview: lesson?.preview ?? false,
    status: lesson?.status ?? 'published' as Lesson['status'],
  });
  const [mediaOpen, setMediaOpen] = useState(false);
  const needsUrl = f.type !== 'text';
  const save = () => {
    if (!f.title.trim()) { toast('error', 'Judul materi wajib diisi.'); return; }
    if (lesson) CurriculumService.updateLesson(lesson.id, { ...f, durationMin: Number(f.durationMin) || 0 });
    else CurriculumService.addLesson(courseId, sectionId, { ...f, durationMin: Number(f.durationMin) || 0 });
    toast('success', 'Materi disimpan.');
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={lesson ? 'Edit Materi' : 'Tambah Materi'} wide footer={
      <><button className="btn-ghost" onClick={onClose}>Batal</button><button className="btn-primary" onClick={save}><Icon name="check" size={14} /> Simpan</button></>
    }>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Judul Materi" required><TextInput value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Tipe"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as LessonType })}>
          {LESSON_TYPES.map((t) => <option key={t.k} value={t.k}>{t.label}</option>)}
        </Select></Field>
      </div>
      {needsUrl && (
        <div className="mt-4">
          <Field label={f.type === 'youtube' ? 'URL YouTube' : f.type === 'pdf' || f.type === 'file' || f.type === 'image' ? 'File / Media' : 'URL'} required hint={f.type === 'youtube' ? 'https://www.youtube.com/watch?v=…' : undefined}>
            <div className="flex gap-2">
              <TextInput value={f.mediaUrl} onChange={(e) => setF({ ...f, mediaUrl: e.target.value })} placeholder="https://…" className="font-mono text-xs" />
              {(f.type === 'pdf' || f.type === 'file' || f.type === 'image') && (
                <button className="btn-outline btn-sm shrink-0" onClick={() => setMediaOpen(true)}><Icon name="image" size={13} /> Media</button>
              )}
            </div>
          </Field>
        </div>
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Field label="Durasi (menit)"><TextInput type="number" min={0} value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: Number(e.target.value) })} /></Field>
        <Field label="Status"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Lesson['status'] })}>
          <option value="published">Published</option><option value="draft">Draft</option>
        </Select></Field>
        <div className="flex items-end pb-2"><Toggle checked={f.preview} onChange={(v) => setF({ ...f, preview: v })} label="Preview (bisa dilihat sebelum beli)" /></div>
      </div>
      <div className="mt-4"><Field label="Konten / Deskripsi Materi"><RichText value={f.content} onChange={(html) => setF({ ...f, content: html })} placeholder="Tulis materi di sini…" /></Field></div>
      <MediaPicker open={mediaOpen} onClose={() => setMediaOpen(false)} onPick={(url) => setF({ ...f, mediaUrl: url })} />
    </Modal>
  );
}

/* ================= course editor (full) ================= */

export function CourseEditor({ courseId, onClose }: { courseId: ID | 'new' | null; onClose: () => void }) {
  useDB();
  const { user, toast } = useApp();
  const existing = courseId && courseId !== 'new' ? CourseService.byId(courseId) : undefined;
  const isInstructor = user?.roleKey === 'instructor';
  const [f, setF] = useState(() => ({
    title: existing?.title ?? '', shortDescription: existing?.shortDescription ?? '', description: existing?.description ?? '',
    thumbnail: existing?.thumbnail ?? null as string | null, categoryId: existing?.categoryId ?? null as ID | null,
    price: existing?.price ?? 100000, discountPrice: existing?.discountPrice ?? 0, isFree: existing?.isFree ?? false,
    level: existing?.level ?? 'beginner' as Course['level'], language: existing?.language ?? 'Indonesia',
    status: existing?.status ?? 'draft' as Course['status'], featured: existing?.featured ?? false,
    requirements: existing?.requirements.join('\n') ?? '', outcomes: existing?.outcomes.join('\n') ?? '',
    tags: existing?.tags.join(', ') ?? '',
  }));
  const [mediaOpen, setMediaOpen] = useState(false);
  const [lessonModal, setLessonModal] = useState<{ sectionId: ID; lesson: Lesson | null } | null>(null);
  const [confirmDel, setConfirmDel] = useState<{ kind: 'section' | 'lesson'; id: ID; label: string } | null>(null);
  if (!user) return null;

  const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

  const save = (andSubmit = false): Course | null => {
    if (!f.title.trim()) { toast('error', 'Judul kelas wajib diisi.'); return null; }
    if (!f.isFree && (!f.price || f.price <= 0)) { toast('error', 'Harga kelas berbayar wajib > 0.'); return null; }
    const data = {
      title: f.title.trim(), shortDescription: f.shortDescription, description: f.description, thumbnail: f.thumbnail,
      categoryId: f.categoryId, price: f.isFree ? 0 : Number(f.price), discountPrice: f.isFree ? 0 : Number(f.discountPrice),
      isFree: f.isFree, level: f.level, language: f.language, status: andSubmit ? 'pending' as Course['status'] : f.status,
      featured: f.featured, requirements: lines(f.requirements), outcomes: lines(f.outcomes),
      tags: f.tags.split(',').map((x) => x.trim()).filter(Boolean),
    };
    let c: Course;
    if (existing) c = CourseService.update(existing.id, data, user)!;
    else c = CourseService.create(user.id, data, user);
    toast('success', andSubmit ? 'Kelas diajukan untuk review.' : 'Kelas disimpan.');
    return c;
  };

  const saveAndClose = () => { if (save()) onClose(); };
  const saveAndSubmit = () => { const c = save(true); if (c) onClose(); };

  const sections = existing ? CurriculumService.sections(existing.id) : [];

  return (
    <Modal open onClose={onClose} title={existing ? `Edit Kelas — ${existing.title}` : 'Buat Kelas Baru'} wide footer={
      <>
        <button className="btn-ghost" onClick={onClose}>Tutup</button>
        <button className="btn-outline" onClick={saveAndClose}><Icon name="check" size={14} /> Simpan</button>
        {!existing && <button className="btn-primary" onClick={saveAndSubmit} title="Simpan lalu ajukan review"><Icon name="send" size={14} /> Simpan & Ajukan Review</button>}
        {existing && isInstructor && existing.status !== 'published' && (
          <button className="btn-primary" onClick={saveAndSubmit}><Icon name="send" size={14} /> Ajukan Review</button>
        )}
      </>
    }>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
          <div className="space-y-4">
            <Field label="Judul Kelas" required><TextInput value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="cth: Microsoft Excel dari Nol sampai Mahir" /></Field>
            <Field label="Deskripsi Singkat" required hint="Tampil di kartu kelas & header."><TextArea rows={2} value={f.shortDescription} onChange={(e) => setF({ ...f, shortDescription: e.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Kategori"><Select value={f.categoryId ?? ''} onChange={(e) => setF({ ...f, categoryId: e.target.value || null })}>
                <option value="">— Tanpa Kategori —</option>
                {CategoryService.byScope('course').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select></Field>
              <Field label="Level"><Select value={f.level} onChange={(e) => setF({ ...f, level: e.target.value as Course['level'] })}>
                <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
              </Select></Field>
              <Field label="Bahasa"><TextInput value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })} /></Field>
            </div>
          </div>
          <div>
            <Field label="Thumbnail">
              <button className="group relative block w-full overflow-hidden rounded-lg border-2 border-dashed border-base-300 dark:border-base-700 transition-colors hover:border-brand-500 cursor-pointer" onClick={() => setMediaOpen(true)}>
                {f.thumbnail ? (
                  <img src={f.thumbnail} alt="Thumbnail" className="aspect-video w-full object-cover" />
                ) : (
                  <span className="flex aspect-video flex-col items-center justify-center gap-1 text-base-400"><Icon name="image" size={20} /><span className="text-[10px] font-bold uppercase">Pilih Media</span></span>
                )}
              </button>
            </Field>
            {f.thumbnail && <button className="btn-ghost btn-sm mt-1.5 w-full" onClick={() => setF({ ...f, thumbnail: null })}>Hapus Thumbnail</button>}
          </div>
        </div>

        <div className="rounded-xl border border-base-200 dark:border-base-800 p-4">
          <p className="label mb-3">Harga & Tipe</p>
          <div className="flex flex-wrap items-center gap-5">
            <Toggle checked={f.isFree} onChange={(v) => setF({ ...f, isFree: v, price: v ? 0 : f.price || 100000 })} label="Kelas Gratis" />
            {!f.isFree && (
              <>
                <Field label="Harga (Rp)"><TextInput type="number" min={0} value={f.price} onChange={(e) => setF({ ...f, price: Number(e.target.value) })} className="w-36" /></Field>
                <Field label="Harga Diskon" hint="0 = tanpa diskon"><TextInput type="number" min={0} value={f.discountPrice} onChange={(e) => setF({ ...f, discountPrice: Number(e.target.value) })} className="w-36" /></Field>
                <div className="pb-1 text-sm text-base-500">Efektif: <b className="font-display text-base-900 dark:text-base-50">{fmtMoney(f.isFree ? 0 : f.discountPrice > 0 && f.discountPrice < f.price ? f.discountPrice : f.price)}</b></div>
              </>
            )}
            {(user.roleKey === 'super_admin' || user.roleKey === 'admin') && <Toggle checked={f.featured} onChange={(v) => setF({ ...f, featured: v })} label="Featured" />}
          </div>
        </div>

        <Field label="Deskripsi Lengkap"><RichText value={f.description} onChange={(html) => setF({ ...f, description: html })} placeholder="Jelaskan isi kelas, metode belajar, dll." /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Persyaratan" hint="Satu per baris"><TextArea rows={3} value={f.requirements} onChange={(e) => setF({ ...f, requirements: e.target.value })} placeholder={'Laptop / komputer\nKoneksi internet'} /></Field>
          <Field label="Learning Outcomes" hint="Satu per baris"><TextArea rows={3} value={f.outcomes} onChange={(e) => setF({ ...f, outcomes: e.target.value })} placeholder={'Menguasai formula Excel\nMembuat dashboard'} /></Field>
          <div className="space-y-4">
            <Field label="Tags" hint="Pisah dengan koma"><TextInput value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} placeholder="excel, kantor, data" /></Field>
            {!isInstructor && (
              <Field label="Status"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Course['status'] })}>
                <option value="draft">Draft</option><option value="pending">Pending Review</option><option value="published">Published</option><option value="rejected">Rejected</option><option value="archived">Archived</option>
              </Select></Field>
            )}
          </div>
        </div>

        {existing && (
          <div className="rounded-xl border border-base-200 dark:border-base-800">
            <div className="flex items-center justify-between border-b border-base-200 dark:border-base-800 px-4 py-3">
              <div>
                <p className="font-display text-sm font-bold text-base-900 dark:text-base-50">Kurikulum</p>
                <p className="font-mono text-[10px] text-base-400">{sections.length} section · {CurriculumService.lessons(existing.id).length} materi</p>
              </div>
              <button className="btn-primary btn-sm" onClick={() => { const s = CurriculumService.addSection(existing.id, `Section ${sections.length + 1}`); toast('success', 'Section ditambahkan.'); void s; }}>
                <Icon name="plus" size={13} /> Section
              </button>
            </div>
            {sections.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-base-400">Belum ada section — tambahkan untuk mulai menyusun materi.</p>
            ) : sections.map((sec: Section, si: number) => {
              const lessons = CurriculumService.lessonsOf(sec.id);
              return (
                <div key={sec.id} className="border-b border-base-100 dark:border-base-800/70 last:border-0">
                  <div className="flex items-center gap-2 bg-base-50 dark:bg-base-850/60 px-4 py-2">
                    <span className="font-mono text-[10px] font-bold text-brand-500">{String(si + 1).padStart(2, '0')}</span>
                    <input defaultValue={sec.title} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== sec.title) { CurriculumService.updateSection(sec.id, e.target.value.trim()); toast('success', 'Section diperbarui.'); } }}
                      className="flex-1 bg-transparent text-sm font-bold text-base-800 dark:text-base-100 focus:outline-none" />
                    <IconButton icon="arrow-up" title="Naik" onClick={() => CurriculumService.moveSection(sec.id, -1)} />
                    <IconButton icon="arrow-down" title="Turun" onClick={() => CurriculumService.moveSection(sec.id, 1)} />
                    <IconButton icon="plus" title="Tambah materi" tone="brand" onClick={() => setLessonModal({ sectionId: sec.id, lesson: null })} />
                    <IconButton icon="trash" title="Hapus section" tone="danger" onClick={() => setConfirmDel({ kind: 'section', id: sec.id, label: sec.title })} />
                  </div>
                  {lessons.map((l: Lesson) => (
                    <div key={l.id} className="flex items-center gap-2 px-4 py-1.5 pl-10 text-sm text-base-600 dark:text-base-300 hover:bg-brand-500/[0.04]">
                      <Icon name={l.type === 'youtube' || l.type === 'video' ? 'play' : l.type === 'text' ? 'file-text' : 'file'} size={13} className="text-base-400" />
                      <span className="flex-1 truncate font-semibold">{l.title}</span>
                      {l.preview && <Badge tone="brand">preview</Badge>}
                      {l.status === 'draft' && <Badge tone="neutral">draft</Badge>}
                      <span className="font-mono text-[10px] text-base-400">{l.durationMin}m</span>
                      <IconButton icon="arrow-up" title="Naik" onClick={() => CurriculumService.moveLesson(l.id, -1)} />
                      <IconButton icon="arrow-down" title="Turun" onClick={() => CurriculumService.moveLesson(l.id, 1)} />
                      <IconButton icon="pencil" title="Edit" tone="brand" onClick={() => setLessonModal({ sectionId: sec.id, lesson: l })} />
                      <IconButton icon="trash" title="Hapus" tone="danger" onClick={() => setConfirmDel({ kind: 'lesson', id: l.id, label: l.title })} />
                    </div>
                  ))}
                  {lessons.length === 0 && <p className="px-4 py-2 pl-10 text-xs text-base-400">Belum ada materi.</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <MediaPicker open={mediaOpen} onClose={() => setMediaOpen(false)} onPick={(url) => setF({ ...f, thumbnail: url })} />
      {lessonModal && existing && <LessonEditor courseId={existing.id} sectionId={lessonModal.sectionId} lesson={lessonModal.lesson} onClose={() => setLessonModal(null)} />}
      <Confirm open={!!confirmDel} onClose={() => setConfirmDel(null)} message={`Hapus ${confirmDel?.kind === 'section' ? 'section' : 'materi'} "${confirmDel?.label}"?`}
        onConfirm={() => { if (confirmDel?.kind === 'section') CurriculumService.removeSection(confirmDel.id); else if (confirmDel) CurriculumService.removeLesson(confirmDel.id); toast('success', 'Dihapus.'); }} />
    </Modal>
  );
}

/* ================= courses list page ================= */

export default function CoursesAdmin() {
  useDB();
  const { user, toast } = useApp();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const [editorFor, setEditorFor] = useState<ID | 'new' | null>(null);
  const [confirmDel, setConfirmDel] = useState<Course | null>(null);
  const [rejectFor, setRejectFor] = useState<Course | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const isInstructor = user.roleKey === 'instructor';
  const isStaff = user.roleKey === 'super_admin' || user.roleKey === 'admin';

  let rows = isInstructor ? CourseService.ofInstructor(user.id) : CourseService.list();
  if (status) rows = rows.filter((c) => c.status === status);
  rows = rows.sort((a, b) => b.createdAt - a.createdAt);

  const tabs = isInstructor
    ? [{ key: '', label: 'Semua' }, { key: 'draft', label: 'Draft' }, { key: 'pending', label: 'Pending' }, { key: 'published', label: 'Terbit' }, { key: 'rejected', label: 'Ditolak' }]
    : [{ key: '', label: 'Semua' }, { key: 'published', label: 'Terbit' }, { key: 'pending', label: 'Pending' }, { key: 'draft', label: 'Draft' }, { key: 'rejected', label: 'Ditolak' }, { key: 'archived', label: 'Arsip' }];

  return (
    <DashShell title="Kelas">
      <PageHeader title={isInstructor ? 'Kelas Saya' : 'Manajemen Kelas'} sub={isInstructor ? 'Kelola kelas, kurikulum, dan ajukan untuk review.' : 'Moderasi & kelola seluruh kelas platform.'}
        actions={<button className="btn-primary" onClick={() => setEditorFor('new')}><Icon name="plus" size={15} /> Buat Kelas</button>} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={tabs} active={status} onChange={(k) => setParams((p) => { if (k) p.set('status', k); else p.delete('status'); return p; }, { replace: true })} />
        <span className="font-mono text-xs text-base-400">{rows.length} kelas</span>
      </div>
      <DataTable rows={rows} pageSize={8}
        searchKeys={(c) => `${c.title} ${c.shortDescription} ${c.tags.join(' ')}`}
        emptyTitle="Belum ada kelas" emptySub="Buat kelas pertamamu dan mulai berbagi ilmu."
        emptyAction={<button className="btn-primary" onClick={() => setEditorFor('new')}><Icon name="plus" size={14} /> Create New</button>}
        columns={[
          { key: 'title', label: 'Kelas', render: (c: Course) => (
            <div className="flex items-center gap-3">
              {c.thumbnail ? <img src={c.thumbnail} alt="" className="h-10 w-16 rounded-md object-cover" /> : <span className="flex h-10 w-16 items-center justify-center rounded-md bg-base-100 dark:bg-base-800 text-base-400"><Icon name="book" size={16} /></span>}
              <div className="min-w-0">
                <p className="truncate font-bold text-base-900 dark:text-base-100 max-w-56">{c.title}{c.featured && <Icon name="star" size={11} className="ml-1.5 inline text-accent-400" />}</p>
                <p className="font-mono text-[10px] text-base-400">{CategoryService.name(c.categoryId)} · {CurriculumService.lessons(c.id).length} materi</p>
              </div>
            </div>
          )},
          { key: 'instructor', label: 'Instructor', render: (c: Course) => <span className="text-xs font-semibold text-base-600 dark:text-base-300">{db.byId('users', c.instructorId)?.name ?? '—'}</span> },
          { key: 'price', label: 'Harga', render: (c: Course) => <span className="font-display text-sm font-bold">{c.isFree ? <Badge tone="brand">Gratis</Badge> : fmtMoney(CourseService.effectivePrice(c))}</span> },
          { key: 'students', label: 'Student', render: (c: Course) => <span className="font-mono text-xs font-bold">{CourseService.studentsCount(c.id)}</span> },
          { key: 'date', label: 'Dibuat', render: (c: Course) => <span className="font-mono text-[11px] text-base-400">{fmtDate(c.createdAt)}</span> },
          { key: 'status', label: 'Status', render: (c: Course) => <StatusBadge status={c.status} /> },
        ]}
        rowActions={(c: Course) => (
          <>
            {c.status === 'published' && <Link to={`/courses/${c.slug}`} target="_blank" title="Lihat halaman publik"><IconButton icon="eye" title="Lihat publik" onClick={() => {}} /></Link>}
            <IconButton icon="pencil" title="Edit" tone="brand" onClick={() => setEditorFor(c.id)} />
            {isStaff && c.status === 'pending' && (
              <>
                <IconButton icon="check-circle" title="Setujui" tone="brand" onClick={() => { CourseService.approve(c.id, user); toast('success', 'Kelas disetujui & dipublikasikan.'); }} />
                <IconButton icon="x" title="Tolak" tone="danger" onClick={() => { setRejectFor(c); setRejectNote(''); }} />
              </>
            )}
            <IconButton icon="trash" title="Hapus" tone="danger" onClick={() => setConfirmDel(c)} />
          </>
        )}
      />
      {editorFor && <CourseEditor courseId={editorFor} onClose={() => setEditorFor(null)} />}
      <Confirm open={!!confirmDel} onClose={() => setConfirmDel(null)} message={`Hapus kelas "${confirmDel?.title}" beserta seluruh materi, enrollment, dan quiz-nya?`}
        onConfirm={() => { if (confirmDel) { CourseService.remove(confirmDel.id, user); toast('success', 'Kelas dihapus.'); } }} />
      <Modal open={!!rejectFor} onClose={() => setRejectFor(null)} title="Tolak Kelas" footer={
        <>
          <button className="btn-ghost" onClick={() => setRejectFor(null)}>Batal</button>
          <button className="btn-danger" disabled={busy} onClick={async () => {
            if (!rejectFor) return;
            setBusy(true);
            await new Promise((r) => setTimeout(r, 250));
            CourseService.reject(rejectFor.id, rejectNote || 'Tidak memenuhi standar kualitas.', user);
            audit(user.id, user.name, 'reject', 'course', rejectFor.id, rejectNote);
            setBusy(false); setRejectFor(null);
            toast('success', 'Kelas ditolak & instructor dinotifikasi.');
          }}>{busy ? <Spinner size={13} /> : <Icon name="x" size={13} />} Tolak Kelas</button>
        </>
      }>
        <p className="mb-3 text-sm text-base-500">Kirim catatan moderasi ke instructor <b>{db.byId('users', rejectFor?.instructorId ?? '')?.name}</b>:</p>
        <TextArea rows={3} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="cth: Thumbnail belum sesuai, deskripsi terlalu singkat…" />
      </Modal>
    </DashShell>
  );
}
