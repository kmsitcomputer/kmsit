import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Course, LessonType } from '../../lib/types';
import { fmtMoney, fmtDate } from '../../lib/format';
import { api, type ApiAdminCourse } from '../../lib/api';
import { useApp } from '../../state/store';
import { Icon } from '../../components/icons';
import RichText from '../../components/RichText';
import { Badge, Confirm, Field, IconButton, MediaPicker, Modal, PageHeader, Select, Spinner, StatusBadge, Tabs, TextArea, TextInput, Toggle } from '../../components/ui';
import { DashShell } from '../../components/Shell';
import { LiveClassManager } from '../../components/LiveClass';
import { PagedTable, RemoteView, useRemote } from '../../components/remote';

/* ================= local (unsaved) curriculum model ================= */
/* The backend does a FULL REPLACE of sections/lessons on every save, so the editor
   keeps the whole curriculum in local state and only sends it to the server when the
   course itself is saved. Items without an `id` are new and will be created; items
   with an `id` are existing rows and will be updated. */

let clientKeySeq = 0;
const newKey = () => `tmp-${Date.now()}-${clientKeySeq++}`;

interface LocalLesson {
  id?: string; key: string; title: string; type: LessonType; content: string; mediaUrl: string;
  durationMin: number; preview: boolean; status: 'draft' | 'published';
}
interface LocalSection { id?: string; key: string; title: string; lessons: LocalLesson[]; }

function sectionsFromApi(sections?: ApiAdminCourse['sections']): LocalSection[] {
  return (sections ?? []).slice().sort((a, b) => a.sort - b.sort).map((s) => ({
    id: s.id, key: s.id, title: s.title,
    lessons: (s.lessons ?? []).slice().sort((a, b) => a.sort - b.sort).map((l) => ({
      id: l.id, key: l.id, title: l.title, type: l.type as LessonType, content: l.content ?? '',
      mediaUrl: l.media_url ?? '', durationMin: l.duration_min, preview: l.preview, status: l.status as 'draft' | 'published',
    })),
  }));
}

function sectionsToPayload(sections: LocalSection[]) {
  return sections.map((s, si) => ({
    ...(s.id ? { id: s.id } : {}),
    title: s.title, sort: si,
    lessons: s.lessons.map((l, li) => ({
      ...(l.id ? { id: l.id } : {}),
      title: l.title, type: l.type, content: l.content, media_url: l.mediaUrl,
      duration_min: l.durationMin, preview: l.preview, status: l.status, sort: li,
    })),
  }));
}

/* ================= lesson editor ================= */

const LESSON_TYPES: { k: LessonType; label: string }[] = [
  { k: 'text', label: 'Teks / Artikel' }, { k: 'youtube', label: 'YouTube' }, { k: 'video', label: 'Video (URL)' },
  { k: 'pdf', label: 'PDF' }, { k: 'file', label: 'File' }, { k: 'image', label: 'Gambar' },
  { k: 'url', label: 'Link Eksternal' }, { k: 'embed', label: 'Embed (YouTube/Vimeo)' },
];

function LessonEditor({ lesson, onSave, onClose }: { lesson: LocalLesson | null; onSave: (data: LocalLesson) => void; onClose: () => void }) {
  const { toast } = useApp();
  const [f, setF] = useState({
    title: lesson?.title ?? '', type: lesson?.type ?? 'text' as LessonType, content: lesson?.content ?? '',
    mediaUrl: lesson?.mediaUrl ?? '', durationMin: lesson?.durationMin ?? 5, preview: lesson?.preview ?? false,
    status: lesson?.status ?? 'published' as LocalLesson['status'],
  });
  const [mediaOpen, setMediaOpen] = useState(false);
  const needsUrl = f.type !== 'text';
  const save = () => {
    if (!f.title.trim()) { toast('error', 'Judul materi wajib diisi.'); return; }
    onSave({ id: lesson?.id, key: lesson?.key ?? newKey(), ...f, title: f.title.trim(), durationMin: Number(f.durationMin) || 0 });
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
        <Field label="Status"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as LocalLesson['status'] })}>
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

export function CourseEditor({ courseId, onClose }: { courseId: string | 'new' | null; onClose: (saved?: boolean) => void }) {
  const { user, toast } = useApp();
  const isInstructor = user?.roleKey === 'instructor';
  const isNew = courseId === 'new';
  const [loading, setLoading] = useState(!isNew);
  const [existing, setExisting] = useState<ApiAdminCourse | null>(null);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [f, setF] = useState({
    title: '', shortDescription: '', description: '', thumbnail: null as string | null, categoryId: null as string | null,
    price: 100000, discountPrice: 0, isFree: false, level: 'beginner' as Course['level'], language: 'Indonesia',
    featured: false, requirements: '', outcomes: '', tags: '',
  });
  const [sections, setSections] = useState<LocalSection[]>([]);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [lessonModal, setLessonModal] = useState<{ sectionKey: string; lesson: LocalLesson | null } | null>(null);
  const [confirmDel, setConfirmDel] = useState<{ kind: 'section' | 'lesson'; sectionKey: string; key: string; label: string } | null>(null);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { void api.categories('course').then((items) => setCategories(items as Array<{ id: string; name: string }>)).catch(() => setCategories([])); }, []);

  useEffect(() => {
    if (isNew || !courseId) return;
    setLoading(true);
    void api.adminCourse(courseId).then((c) => {
      setExisting(c);
      setF({
        title: c.title, shortDescription: c.shortDescription, description: c.description, thumbnail: c.thumbnail ?? null,
        categoryId: c.categoryId, price: c.price, discountPrice: c.discountPrice, isFree: c.isFree, level: c.level,
        language: c.language, featured: c.featured, requirements: c.requirements.join('\n'), outcomes: c.outcomes.join('\n'),
        tags: c.tags.join(', '),
      });
      setSections(sectionsFromApi(c.sections));
    }).catch((error) => {
      toast('error', error instanceof Error ? error.message : 'Gagal memuat kelas.');
      onClose();
    }).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  if (!user) return null;

  const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

  const save = async (andSubmit = false): Promise<ApiAdminCourse | null> => {
    if (!f.title.trim()) { toast('error', 'Judul kelas wajib diisi.'); return null; }
    if (!f.isFree && (!f.price || f.price <= 0)) { toast('error', 'Harga kelas berbayar wajib > 0.'); return null; }
    const payload: Record<string, unknown> = {
      title: f.title.trim(), short_description: f.shortDescription, description: f.description, thumbnail: f.thumbnail,
      category_id: f.categoryId, price: f.isFree ? 0 : Number(f.price), discount_price: f.isFree ? 0 : Number(f.discountPrice),
      is_free: f.isFree, level: f.level, language: f.language, featured: f.featured,
      requirements: lines(f.requirements), outcomes: lines(f.outcomes),
      tags: f.tags.split(',').map((x) => x.trim()).filter(Boolean),
    };
    if (existing) payload.sections = sectionsToPayload(sections);
    setErr(''); setSaving(true);
    try {
      let c: ApiAdminCourse;
      if (existing) c = await api.updateCourse(existing.id, payload);
      else c = await api.createCourse(payload);
      if (andSubmit) c = await api.submitCourse(c.id);
      toast('success', andSubmit ? 'Kelas diajukan untuk review.' : 'Kelas disimpan.');
      return c;
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Gagal menyimpan kelas.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const saveAndClose = () => { void save().then((c) => { if (c) onClose(true); }); };
  const saveAndSubmit = () => { void save(true).then((c) => { if (c) onClose(true); }); };

  const addSection = () => setSections((prev) => [...prev, { key: newKey(), title: `Section ${prev.length + 1}`, lessons: [] }]);
  const renameSection = (key: string, title: string) => setSections((prev) => prev.map((s) => (s.key === key ? { ...s, title } : s)));
  const moveSection = (key: string, dir: -1 | 1) => setSections((prev) => {
    const i = prev.findIndex((s) => s.key === key); const j = i + dir;
    if (i < 0 || j < 0 || j >= prev.length) return prev;
    const next = prev.slice(); [next[i], next[j]] = [next[j], next[i]]; return next;
  });
  const removeSection = (key: string) => setSections((prev) => prev.filter((s) => s.key !== key));

  const saveLesson = (sectionKey: string, data: LocalLesson) => setSections((prev) => prev.map((s) => {
    if (s.key !== sectionKey) return s;
    const exists = s.lessons.some((l) => l.key === data.key);
    return { ...s, lessons: exists ? s.lessons.map((l) => (l.key === data.key ? data : l)) : [...s.lessons, data] };
  }));
  const moveLesson = (sectionKey: string, key: string, dir: -1 | 1) => setSections((prev) => prev.map((s) => {
    if (s.key !== sectionKey) return s;
    const i = s.lessons.findIndex((l) => l.key === key); const j = i + dir;
    if (i < 0 || j < 0 || j >= s.lessons.length) return s;
    const next = s.lessons.slice(); [next[i], next[j]] = [next[j], next[i]]; return { ...s, lessons: next };
  }));
  const removeLesson = (sectionKey: string, key: string) => setSections((prev) => prev.map((s) => (s.key === sectionKey ? { ...s, lessons: s.lessons.filter((l) => l.key !== key) } : s)));

  const lessonCount = sections.reduce((a, s) => a + s.lessons.length, 0);

  return (
    <Modal open onClose={() => onClose()} title={existing ? `Edit Kelas — ${existing.title}` : 'Buat Kelas Baru'} wide footer={loading ? undefined : (
      <>
        <button className="btn-ghost" onClick={() => onClose()}>Tutup</button>
        <button className="btn-outline" disabled={saving} onClick={saveAndClose}>{saving ? <Spinner size={13} /> : <Icon name="check" size={14} />} Simpan</button>
        {!existing && <button className="btn-primary" disabled={saving} onClick={saveAndSubmit} title="Simpan lalu ajukan review">{saving ? <Spinner size={13} /> : <Icon name="send" size={14} />} Simpan & Ajukan Review</button>}
        {existing && isInstructor && existing.status !== 'published' && existing.status !== 'pending' && (
          <button className="btn-primary" disabled={saving} onClick={saveAndSubmit}>{saving ? <Spinner size={13} /> : <Icon name="send" size={14} />} Ajukan Review</button>
        )}
      </>
    )}>
      {loading ? (
        <div className="flex items-center justify-center py-16"><Spinner size={22} /></div>
      ) : (
        <div className="space-y-5">
          {err && <p className="rounded-lg border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm font-semibold text-danger-500">{err}</p>}
          <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
            <div className="space-y-4">
              <Field label="Judul Kelas" required><TextInput value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="cth: Microsoft Excel dari Nol sampai Mahir" /></Field>
              <Field label="Deskripsi Singkat" required hint="Tampil di kartu kelas & header."><TextArea rows={2} value={f.shortDescription} onChange={(e) => setF({ ...f, shortDescription: e.target.value })} /></Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Kategori"><Select value={f.categoryId ?? ''} onChange={(e) => setF({ ...f, categoryId: e.target.value || null })}>
                  <option value="">— Tanpa Kategori —</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
              {existing && (
                <Field label="Status"><div className="pt-1"><StatusBadge status={existing.status} /></div></Field>
              )}
            </div>
          </div>

          {existing && (
            <div className="rounded-xl border border-base-200 dark:border-base-800">
              <div className="flex items-center justify-between border-b border-base-200 dark:border-base-800 px-4 py-3">
                <div>
                  <p className="font-display text-sm font-bold text-base-900 dark:text-base-50">Kurikulum</p>
                  <p className="font-mono text-[10px] text-base-400">{sections.length} section · {lessonCount} materi · perubahan tersimpan saat kelas disimpan</p>
                </div>
                <button className="btn-primary btn-sm" onClick={addSection}><Icon name="plus" size={13} /> Section</button>
              </div>
              {sections.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-base-400">Belum ada section — tambahkan untuk mulai menyusun materi.</p>
              ) : sections.map((sec, si) => (
                <div key={sec.key} className="border-b border-base-100 dark:border-base-800/70 last:border-0">
                  <div className="flex items-center gap-2 bg-base-50 dark:bg-base-850/60 px-4 py-2">
                    <span className="font-mono text-[10px] font-bold text-brand-500">{String(si + 1).padStart(2, '0')}</span>
                    <input defaultValue={sec.title} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== sec.title) renameSection(sec.key, e.target.value.trim()); }}
                      className="flex-1 bg-transparent text-sm font-bold text-base-800 dark:text-base-100 focus:outline-none" />
                    <IconButton icon="arrow-up" title="Naik" onClick={() => moveSection(sec.key, -1)} />
                    <IconButton icon="arrow-down" title="Turun" onClick={() => moveSection(sec.key, 1)} />
                    <IconButton icon="plus" title="Tambah materi" tone="brand" onClick={() => setLessonModal({ sectionKey: sec.key, lesson: null })} />
                    <IconButton icon="trash" title="Hapus section" tone="danger" onClick={() => setConfirmDel({ kind: 'section', sectionKey: sec.key, key: sec.key, label: sec.title })} />
                  </div>
                  {sec.lessons.map((l) => (
                    <div key={l.key} className="flex items-center gap-2 px-4 py-1.5 pl-10 text-sm text-base-600 dark:text-base-300 hover:bg-brand-500/[0.04]">
                      <Icon name={l.type === 'youtube' || l.type === 'video' ? 'play' : l.type === 'text' ? 'file-text' : 'file'} size={13} className="text-base-400" />
                      <span className="flex-1 truncate font-semibold">{l.title}</span>
                      {l.preview && <Badge tone="brand">preview</Badge>}
                      {l.status === 'draft' && <Badge tone="neutral">draft</Badge>}
                      <span className="font-mono text-[10px] text-base-400">{l.durationMin}m</span>
                      <IconButton icon="arrow-up" title="Naik" onClick={() => moveLesson(sec.key, l.key, -1)} />
                      <IconButton icon="arrow-down" title="Turun" onClick={() => moveLesson(sec.key, l.key, 1)} />
                      <IconButton icon="pencil" title="Edit" tone="brand" onClick={() => setLessonModal({ sectionKey: sec.key, lesson: l })} />
                      <IconButton icon="trash" title="Hapus" tone="danger" onClick={() => setConfirmDel({ kind: 'lesson', sectionKey: sec.key, key: l.key, label: l.title })} />
                    </div>
                  ))}
                  {sec.lessons.length === 0 && <p className="px-4 py-2 pl-10 text-xs text-base-400">Belum ada materi.</p>}
                </div>
              ))}
            </div>
          )}
          {existing && existing.id && (
            <div className="rounded-xl border border-base-200 dark:border-base-800 p-4">
              <LiveClassManager courseId={existing.id} />
            </div>
          )}
        </div>
      )}
      <MediaPicker open={mediaOpen} onClose={() => setMediaOpen(false)} onPick={(url) => setF({ ...f, thumbnail: url })} />
      {lessonModal && (
        <LessonEditor lesson={lessonModal.lesson} onClose={() => setLessonModal(null)} onSave={(data) => saveLesson(lessonModal.sectionKey, data)} />
      )}
      <Confirm open={!!confirmDel} onClose={() => setConfirmDel(null)} message={`Hapus ${confirmDel?.kind === 'section' ? 'section' : 'materi'} "${confirmDel?.label}"?`}
        onConfirm={() => {
          if (!confirmDel) return;
          if (confirmDel.kind === 'section') removeSection(confirmDel.sectionKey); else removeLesson(confirmDel.sectionKey, confirmDel.key);
          toast('success', 'Dihapus.');
        }} />
    </Modal>
  );
}

/* ================= courses list page ================= */

export default function CoursesAdmin() {
  const { user, toast } = useApp();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const [editorFor, setEditorFor] = useState<string | 'new' | null>(null);
  const [confirmDel, setConfirmDel] = useState<ApiAdminCourse | null>(null);
  const [rejectFor, setRejectFor] = useState<ApiAdminCourse | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const courses = useRemote(() => api.adminCourses({ page, status, q: query }), [page, status, query, user?.id]);
  const refresh = courses.reload;
  useEffect(() => { setPage(1); }, [status, query]);

  if (!user) return null;

  const isInstructor = user.roleKey === 'instructor';
  const isStaff = user.roleKey === 'super_admin' || user.roleKey === 'admin';

  const tabs = isInstructor
    ? [{ key: '', label: 'Semua' }, { key: 'draft', label: 'Draft' }, { key: 'pending', label: 'Pending' }, { key: 'published', label: 'Terbit' }, { key: 'rejected', label: 'Ditolak' }]
    : [{ key: '', label: 'Semua' }, { key: 'published', label: 'Terbit' }, { key: 'pending', label: 'Pending' }, { key: 'draft', label: 'Draft' }, { key: 'rejected', label: 'Ditolak' }, { key: 'archived', label: 'Arsip' }];

  const closeEditor = (saved?: boolean) => { setEditorFor(null); if (saved) refresh(); };

  const moderate = (c: ApiAdminCourse, action: 'approve' | 'reject' | 'archive', note?: string) => {
    setBusy(true);
    void api.moderateCourse(c.id, action, note).then(() => {
      toast('success', action === 'approve' ? 'Kelas disetujui & dipublikasikan.' : action === 'reject' ? 'Kelas ditolak & instructor dinotifikasi.' : 'Kelas diarsipkan.');
      refresh();
    }).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal memperbarui status kelas.'))
      .finally(() => { setBusy(false); setRejectFor(null); });
  };

  return (
    <DashShell title="Kelas">
      <PageHeader title={isInstructor ? 'Kelas Saya' : 'Manajemen Kelas'} sub={isInstructor ? 'Kelola kelas, kurikulum, dan ajukan untuk review.' : 'Moderasi & kelola seluruh kelas platform.'}
        actions={<button className="btn-primary" onClick={() => setEditorFor('new')}><Icon name="plus" size={15} /> Buat Kelas</button>} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={tabs} active={status} onChange={(k) => setParams((p) => { if (k) p.set('status', k); else p.delete('status'); return p; }, { replace: true })} />
        <span className="font-mono text-xs text-base-400">{courses.data ? `${courses.data.total} kelas` : ''}</span>
      </div>
      <RemoteView remote={courses} isEmpty={(p) => p.total === 0 && !query && !status} emptyTitle="Belum ada kelas" emptySub="Buat kelas pertamamu dan mulai berbagi ilmu.">
        {(data) => <PagedTable page={data} onPage={setPage} rowKey={(c) => c.id}
        toolbar={<form className="relative min-w-[200px] flex-1 sm:max-w-xs" onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); }}>
          <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari judul kelas…" className="input pl-9 py-2 text-sm" />
        </form>}
        columns={[
          { key: 'title', label: 'Kelas', render: (c: ApiAdminCourse) => (
            <div className="flex items-center gap-3">
              {c.thumbnail ? <img src={c.thumbnail} alt="" className="h-10 w-16 rounded-md object-cover" /> : <span className="flex h-10 w-16 items-center justify-center rounded-md bg-base-100 dark:bg-base-800 text-base-400"><Icon name="book" size={16} /></span>}
              <div className="min-w-0">
                <p className="truncate font-bold text-base-900 dark:text-base-100 max-w-56">{c.title}{c.featured && <Icon name="star" size={11} className="ml-1.5 inline text-accent-400" />}</p>
                <p className="font-mono text-[10px] text-base-400">{c.categoryName ?? '—'}</p>
              </div>
            </div>
          )},
          { key: 'instructor', label: 'Instructor', render: (c: ApiAdminCourse) => <span className="text-xs font-semibold text-base-600 dark:text-base-300">{c.instructorName ?? (isInstructor ? user.name : '—')}</span> },
          { key: 'price', label: 'Harga', render: (c: ApiAdminCourse) => <span className="font-display text-sm font-bold">{c.isFree ? <Badge tone="brand">Gratis</Badge> : fmtMoney(c.discountPrice > 0 && c.discountPrice < c.price ? c.discountPrice : c.price)}</span> },
          { key: 'students', label: 'Student', render: (c: ApiAdminCourse) => <span className="font-mono text-xs font-bold">{c.enrollments_count ?? '—'}</span> },
          { key: 'date', label: 'Dibuat', render: (c: ApiAdminCourse) => <span className="font-mono text-[11px] text-base-400">{fmtDate(c.createdAt)}</span> },
          { key: 'status', label: 'Status', render: (c: ApiAdminCourse) => <StatusBadge status={c.status} /> },
        ]}
        rowActions={(c: ApiAdminCourse) => (
          <>
            {c.status === 'published' && <Link to={`/courses/${c.slug}`} target="_blank" title="Lihat halaman publik"><IconButton icon="eye" title="Lihat publik" onClick={() => {}} /></Link>}
            <IconButton icon="pencil" title="Edit" tone="brand" onClick={() => setEditorFor(c.id)} />
            {isStaff && c.status === 'pending' && (
              <>
                <IconButton icon="check-circle" title="Setujui" tone="brand" onClick={() => moderate(c, 'approve')} />
                <IconButton icon="x" title="Tolak" tone="danger" onClick={() => { setRejectFor(c); setRejectNote(''); }} />
              </>
            )}
            {isStaff && c.status !== 'pending' && c.status !== 'archived' && (
              <IconButton icon="lock" title="Arsipkan" onClick={() => moderate(c, 'archive')} />
            )}
            <IconButton icon="trash" title="Hapus" tone="danger" onClick={() => setConfirmDel(c)} />
          </>
        )}
      />}
      </RemoteView>
      {editorFor && <CourseEditor courseId={editorFor} onClose={closeEditor} />}
      <Confirm open={!!confirmDel} onClose={() => setConfirmDel(null)} message={`Hapus kelas "${confirmDel?.title}" beserta seluruh materi, enrollment, dan quiz-nya?`}
        onConfirm={() => {
          if (!confirmDel) return;
          void api.deleteCourse(confirmDel.id).then(() => {
            toast('success', 'Kelas dihapus.');
            refresh();
          }).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal menghapus kelas.'));
        }} />
      <Modal open={!!rejectFor} onClose={() => setRejectFor(null)} title="Tolak Kelas" footer={
        <>
          <button className="btn-ghost" onClick={() => setRejectFor(null)}>Batal</button>
          <button className="btn-danger" disabled={busy} onClick={() => {
            if (!rejectFor) return;
            moderate(rejectFor, 'reject', rejectNote || 'Tidak memenuhi standar kualitas.');
          }}>{busy ? <Spinner size={13} /> : <Icon name="x" size={13} />} Tolak Kelas</button>
        </>
      }>
        <p className="mb-3 text-sm text-base-500">Kirim catatan moderasi ke instructor <b>{rejectFor?.instructorName ?? '—'}</b>:</p>
        <TextArea rows={3} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="cth: Thumbnail belum sesuai, deskripsi terlalu singkat…" />
      </Modal>
    </DashShell>
  );
}
