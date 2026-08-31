import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { db, uid, now, type Row, type ID, type Category, type Certificate } from '../../lib/db';
import { fmtDate, MediaService, uniqueSlug, audit } from '../../lib/services';
import { CategoryService, CertificateService } from '../../lib/lms';
import { CertificateModal } from '../public/Certificates';
import { useApp, useDB } from '../../state/store';
import { Icon, type IconName } from '../../components/icons';
import RichText from '../../components/RichText';
import { Badge, Confirm, CopyButton, DataTable, EmptyState, Field, IconButton, MediaPicker, Modal, PageHeader, Select, StatusBadge, Tabs, TextArea, TextInput, Toggle } from '../../components/ui';
import { DashShell } from '../../components/Shell';

/* ================= generic content module ================= */

type FieldType = 'text' | 'textarea' | 'richtext' | 'media' | 'category' | 'tags' | 'lines' | 'date' | 'time' | 'number' | 'url' | 'toggle';
interface FieldDef { name: string; label: string; type: FieldType; required?: boolean; hint?: string; span2?: boolean; scope?: Category['scope']; }
export interface ModuleDef {
  key: string; table: 'articles' | 'news' | 'tutorials' | 'activities' | 'pages' | 'products';
  title: string; icon: IconName; perm: string; publicPath?: string; nameField: string;
  fields: FieldDef[]; defaults: Record<string, unknown>;
}

const seoFields: FieldDef[] = [
  { name: 'seoTitle', label: 'SEO Title', type: 'text' },
  { name: 'seoDescription', label: 'SEO Description', type: 'textarea' },
];

export const MODULES: Record<string, ModuleDef> = {
  articles: {
    key: 'articles', table: 'articles', title: 'Artikel', icon: 'file-text', perm: 'manage_articles', publicPath: '/articles', nameField: 'title',
    fields: [
      { name: 'title', label: 'Judul', type: 'text', required: true },
      { name: 'categoryId', label: 'Kategori', type: 'category', scope: 'article' },
      { name: 'excerpt', label: 'Ringkasan', type: 'textarea', span2: true },
      { name: 'content', label: 'Konten', type: 'richtext', span2: true },
      { name: 'thumbnail', label: 'Featured Image', type: 'media' },
      { name: 'tags', label: 'Tags', type: 'tags', hint: 'Pisah dengan koma' },
      ...seoFields,
    ],
    defaults: { title: '', excerpt: '', content: '', thumbnail: null, categoryId: null, tags: [], status: 'draft', seoTitle: '', seoDescription: '', featured: false },
  },
  news: {
    key: 'news', table: 'news', title: 'Berita', icon: 'news', perm: 'manage_news', publicPath: '/news', nameField: 'title',
    fields: [
      { name: 'title', label: 'Judul Berita', type: 'text', required: true },
      { name: 'categoryId', label: 'Kategori', type: 'category', scope: 'news' },
      { name: 'excerpt', label: 'Ringkasan', type: 'textarea', span2: true },
      { name: 'content', label: 'Konten', type: 'richtext', span2: true },
      { name: 'thumbnail', label: 'Thumbnail', type: 'media' },
      { name: 'videoUrl', label: 'Video YouTube', type: 'url', hint: 'https://www.youtube.com/watch?v=…' },
      ...seoFields,
    ],
    defaults: { title: '', excerpt: '', content: '', thumbnail: null, categoryId: null, videoUrl: '', status: 'draft', seoTitle: '', seoDescription: '' },
  },
  tutorials: {
    key: 'tutorials', table: 'tutorials', title: 'Tutorial', icon: 'book-open', perm: 'manage_tutorials', publicPath: '/tutorials', nameField: 'title',
    fields: [
      { name: 'title', label: 'Judul Tutorial', type: 'text', required: true },
      { name: 'categoryId', label: 'Kategori', type: 'category', scope: 'tutorial' },
      { name: 'excerpt', label: 'Ringkasan', type: 'textarea', span2: true },
      { name: 'content', label: 'Konten', type: 'richtext', span2: true },
      { name: 'thumbnail', label: 'Thumbnail', type: 'media' },
      { name: 'videoUrl', label: 'Video YouTube', type: 'url' },
      { name: 'tags', label: 'Tags', type: 'tags' },
      ...seoFields,
    ],
    defaults: { title: '', excerpt: '', content: '', thumbnail: null, categoryId: null, videoUrl: '', tags: [], status: 'draft', seoTitle: '', seoDescription: '' },
  },
  activities: {
    key: 'activities', table: 'activities', title: 'Kegiatan', icon: 'calendar', perm: 'manage_activities', publicPath: '/activities', nameField: 'title',
    fields: [
      { name: 'title', label: 'Judul Kegiatan', type: 'text', required: true },
      { name: 'description', label: 'Deskripsi Singkat', type: 'textarea' },
      { name: 'eventDate', label: 'Tanggal', type: 'date' },
      { name: 'eventTime', label: 'Waktu', type: 'time' },
      { name: 'location', label: 'Lokasi', type: 'text' },
      { name: 'registrationUrl', label: 'URL Pendaftaran', type: 'url' },
      { name: 'content', label: 'Detail Kegiatan', type: 'richtext', span2: true },
      { name: 'thumbnail', label: 'Gambar Utama', type: 'media' },
      { name: 'videoUrl', label: 'Video YouTube', type: 'url' },
      { name: 'galleryLines', label: 'Galeri', type: 'lines', hint: 'Satu URL gambar per baris (gunakan Media Library)' },
    ],
    defaults: { title: '', description: '', content: '', thumbnail: null, eventDate: '', eventTime: '', location: '', videoUrl: '', registrationUrl: '', gallery: [], status: 'draft' },
  },
  pages: {
    key: 'pages', table: 'pages', title: 'Halaman', icon: 'file', perm: 'manage_pages', publicPath: '/page', nameField: 'title',
    fields: [
      { name: 'title', label: 'Judul Halaman', type: 'text', required: true },
      { name: 'content', label: 'Konten', type: 'richtext', span2: true },
      ...seoFields,
    ],
    defaults: { title: '', content: '', thumbnail: null, status: 'draft', seoTitle: '', seoDescription: '' },
  },
  products: {
    key: 'products', table: 'products', title: 'Produk', icon: 'bag', perm: 'manage_shop', publicPath: '/shop', nameField: 'name',
    fields: [
      { name: 'name', label: 'Nama Produk', type: 'text', required: true },
      { name: 'categoryId', label: 'Kategori', type: 'category', scope: 'product' },
      { name: 'description', label: 'Deskripsi', type: 'richtext', span2: true },
      { name: 'thumbnail', label: 'Foto Produk', type: 'media' },
      { name: 'price', label: 'Harga', type: 'number', required: true },
      { name: 'discountPrice', label: 'Harga Diskon', type: 'number', hint: '0 = tanpa diskon' },
      { name: 'stock', label: 'Stok', type: 'number' },
    ],
    defaults: { name: '', description: '', thumbnail: null, price: 0, discountPrice: 0, stock: 10, categoryId: null, status: 'draft', featured: false },
  },
};

function toFormValue(def: ModuleDef, row: Row | null): Record<string, unknown> {
  const base: Record<string, unknown> = { ...(def.defaults as object), status: 'draft' };
  if (!row) return base;
  const r = row as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = { ...base };
  def.fields.forEach((fd) => {
    if (fd.type === 'tags') out[fd.name] = Array.isArray(r[fd.name]) ? (r[fd.name] as string[]).join(', ') : r[fd.name] ?? '';
    else if (fd.name === 'galleryLines') out.galleryLines = Array.isArray(r.gallery) ? (r.gallery as string[]).join('\n') : '';
    else out[fd.name] = r[fd.name] ?? base[fd.name];
  });
  out.status = r.status ?? 'draft';
  if ('featured' in r) out.featured = r.featured;
  return out;
}

function FieldInput({ fd, value, onChange }: { fd: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  const [mediaOpen, setMediaOpen] = useState(false);
  switch (fd.type) {
    case 'text': return <TextInput value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
    case 'textarea': return <TextArea rows={3} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
    case 'richtext': return <RichText value={String(value ?? '')} onChange={(html) => onChange(html)} />;
    case 'number': return <TextInput type="number" min={0} value={String(value ?? 0)} onChange={(e) => onChange(Number(e.target.value))} />;
    case 'url': return <TextInput value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} placeholder="https://…" className="font-mono text-xs" />;
    case 'date': return <TextInput type="date" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
    case 'time': return <TextInput type="time" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
    case 'tags': return <TextInput value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} placeholder="tag1, tag2" />;
    case 'lines': return <TextArea rows={3} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className="font-mono text-xs" />;
    case 'toggle': return <Toggle checked={!!value} onChange={onChange} label={fd.hint} />;
    case 'category': return (
      <Select value={String(value ?? '')} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">— Tanpa Kategori —</option>
        {CategoryService.byScope(fd.scope ?? 'article').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>
    );
    case 'media': return (
      <>
        <button type="button" className="group block w-full overflow-hidden rounded-lg border-2 border-dashed border-base-300 dark:border-base-700 hover:border-brand-500 transition-colors cursor-pointer" onClick={() => setMediaOpen(true)}>
          {value ? <img src={String(value)} alt="" className="aspect-video w-full object-cover" /> : (
            <span className="flex aspect-[3/1.4] flex-col items-center justify-center gap-1 text-base-400"><Icon name="image" size={20} /><span className="text-[10px] font-bold uppercase">Pilih dari Media</span></span>
          )}
        </button>
        <div className="mt-1.5 flex gap-2">
          <button type="button" className="btn-outline btn-sm" onClick={() => setMediaOpen(true)}><Icon name="upload" size={12} /> Media Library</button>
          {value ? <button type="button" className="btn-ghost btn-sm" onClick={() => onChange(null)}>Hapus</button> : null}
        </div>
        <MediaPicker open={mediaOpen} onClose={() => setMediaOpen(false)} onPick={(url) => { onChange(url); setMediaOpen(false); }} />
      </>
    );
  }
}

export function ContentModule({ def }: { def: ModuleDef }) {
  useDB();
  const { user, toast } = useApp();
  const [statusFilter, setStatusFilter] = useState('');
  const [editing, setEditing] = useState<Row | 'new' | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [del, setDel] = useState<Row | null>(null);
  if (!user) return null;

  const openEditor = (row: Row | 'new') => { setEditing(row); setForm(toFormValue(def, row === 'new' ? null : row)); };

  const save = () => {
    for (const fd of def.fields) {
      if (fd.required && !String(form[fd.name] ?? '').trim()) { toast('error', `"${fd.label}" wajib diisi.`); return; }
    }
    const name = String(form[def.nameField] ?? '').trim();
    const slugField = def.table === 'products' ? 'name' : 'title';
    const status = form.status === 'published' ? 'published' : 'draft';
    const patch: Record<string, unknown> = { ...form, status };
    patch[slugField] = name;
    patch.slug = uniqueSlug(def.table, name, editing !== 'new' ? (editing as Row).id : undefined);
    if ('tags' in patch) patch.tags = String(patch.tags ?? '').split(',').map((s: string) => s.trim()).filter(Boolean);
    if ('galleryLines' in patch) { patch.gallery = String(patch.galleryLines ?? '').split('\n').map((s: string) => s.trim()).filter(Boolean); delete patch.galleryLines; }
    delete patch.lines;
    if (status === 'published' && !(editing !== 'new' && (editing as { publishedAt?: number | null }).publishedAt)) patch.publishedAt = now();
    if (def.table === 'products') { patch.price = Number(patch.price) || 0; patch.discountPrice = Number(patch.discountPrice) || 0; patch.stock = Number(patch.stock) || 0; }
    if (editing === 'new') {
      patch.authorId = user.id;
      db.insert(def.table, patch as never);
      audit(user.id, user.name, 'create', def.table.slice(0, -1), null, `Membuat ${def.title.toLowerCase()} "${name}"`);
    } else {
      db.update(def.table, (editing as Row).id, patch as never);
      audit(user.id, user.name, 'update', def.table.slice(0, -1), (editing as Row).id, `Memperbarui "${name}"`);
    }
    toast('success', `${def.title} disimpan${status === 'published' ? ' & dipublikasikan' : ''}.`);
    setEditing(null);
  };

  let rows = db.all(def.table) as Row[];
  if (statusFilter) rows = rows.filter((r) => (r as { status?: string }).status === statusFilter);
  rows = rows.sort((a, b) => b.createdAt - a.createdAt);

  return (
    <DashShell title={def.title}>
      <PageHeader title={def.title} sub={`Kelola ${def.title.toLowerCase()} platform — tersimpan di database & tampil di website.`}
        actions={<button className="btn-primary" onClick={() => openEditor('new')}><Icon name="plus" size={15} /> {`Buat ${def.title}`}</button>} />
      <div className="mb-4 flex items-center justify-between gap-3">
        <Tabs tabs={[{ key: '', label: 'Semua' }, { key: 'published', label: 'Terbit' }, { key: 'draft', label: 'Draft' }]} active={statusFilter} onChange={setStatusFilter} />
        <span className="font-mono text-xs text-base-400">{rows.length} entri</span>
      </div>
      <DataTable rows={rows} pageSize={8}
        searchKeys={(r) => String((r as unknown as Record<string, unknown>)[def.nameField] ?? '')}
        emptyTitle="Belum ada data" emptySub={`Belum ada ${def.title.toLowerCase()} — buat yang pertama.`}
        emptyAction={<button className="btn-primary" onClick={() => openEditor('new')}><Icon name="plus" size={14} /> Create New</button>}
        columns={[
          { key: 'name', label: def.title, render: (r: Row) => {
            const rec = r as unknown as Record<string, unknown>;
            return (
              <div className="flex items-center gap-3">
                {rec.thumbnail ? <img src={String(rec.thumbnail)} alt="" className="h-10 w-16 rounded-md object-cover" /> : <span className="flex h-10 w-16 items-center justify-center rounded-md bg-base-100 dark:bg-base-800 text-base-400"><Icon name={def.icon} size={15} /></span>}
                <div className="min-w-0">
                  <p className="truncate font-bold text-base-900 dark:text-base-100 max-w-64">{String(rec[def.nameField])}</p>
                  <p className="font-mono text-[10px] text-base-400">/{String(rec.slug)}{rec.eventDate ? ` · ${fmtDate(String(rec.eventDate))}` : ''}</p>
                </div>
              </div>
            );
          }},
          { key: 'cat', label: 'Kategori', render: (r: Row) => <span className="text-xs font-semibold text-base-500">{CategoryService.name((r as { categoryId?: ID | null }).categoryId ?? null)}</span> },
          ...(def.table === 'products' ? [{ key: 'price', label: 'Harga', render: (r: Row) => <span className="font-display text-sm font-bold">{Number((r as { price?: number }).price ?? 0).toLocaleString('id-ID')}</span> }] : []),
          { key: 'date', label: 'Tanggal', render: (r: Row) => <span className="font-mono text-[11px] text-base-400">{fmtDate(r.createdAt)}</span> },
          { key: 'status', label: 'Status', render: (r: Row) => <StatusBadge status={String((r as { status?: string }).status ?? 'draft')} /> },
        ]}
        rowActions={(r: Row) => (
          <>
            {def.publicPath && (r as { status?: string }).status === 'published' && (
              <Link to={`${def.publicPath}/${(r as { slug?: string }).slug}`} target="_blank"><IconButton icon="eye" title="Lihat publik" onClick={() => {}} /></Link>
            )}
            <IconButton icon={(r as { status?: string }).status === 'published' ? 'eye-off' : 'check-circle'} title={(r as { status?: string }).status === 'published' ? 'Tarik (draft)' : 'Publikasikan'} tone="brand"
              onClick={() => {
                const next = (r as { status?: string }).status === 'published' ? 'draft' : 'published';
                db.update(def.table, r.id, { status: next, ...(next === 'published' && !(r as { publishedAt?: number | null }).publishedAt ? { publishedAt: now() } : {}) } as never);
                toast('success', next === 'published' ? 'Dipublikasikan.' : 'Ditarik ke draft.');
              }} />
            <IconButton icon="pencil" title="Edit" tone="brand" onClick={() => openEditor(r)} />
            <IconButton icon="trash" title="Hapus" tone="danger" onClick={() => setDel(r)} />
          </>
        )} />

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? `Buat ${def.title}` : `Edit ${def.title}`} wide footer={
        <>
          <div className="mr-auto flex items-center gap-2.5">
            <Toggle checked={form.status === 'published'} onChange={(v) => setForm({ ...form, status: v ? 'published' : 'draft' })} label="Publikasikan" />
          </div>
          <button className="btn-ghost" onClick={() => setEditing(null)}>Batal</button>
          <button className="btn-primary" onClick={save}><Icon name="check" size={14} /> Simpan</button>
        </>
      }>
        <div className="grid gap-4 sm:grid-cols-2">
          {def.fields.map((fd) => (
            <div key={fd.name} className={fd.span2 ? 'sm:col-span-2' : ''}>
              <Field label={fd.label} required={fd.required} hint={fd.hint}>
                <FieldInput fd={fd} value={form[fd.name]} onChange={(v) => setForm({ ...form, [fd.name]: v })} />
              </Field>
            </div>
          ))}
        </div>
      </Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} message={`Hapus "${String((del as unknown as Record<string, unknown> | null)?.[def.nameField] ?? '')}"?`}
        onConfirm={() => { if (del) { db.remove(def.table, del.id); audit(user.id, user.name, 'delete', def.table.slice(0, -1), del.id, 'Menghapus entri'); toast('success', 'Dihapus.'); } }} />
    </DashShell>
  );
}

/* ================= categories ================= */

export function CategoriesPage() {
  useDB();
  const { user, toast } = useApp();
  const [scope, setScope] = useState<Category['scope']>('course');
  const [name, setName] = useState('');
  const [editId, setEditId] = useState<ID | null>(null);
  const [del, setDel] = useState<Category | null>(null);
  if (!user) return null;
  const scopes: { k: Category['scope']; l: string }[] = [
    { k: 'course', l: 'Kelas' }, { k: 'article', l: 'Artikel' }, { k: 'news', l: 'Berita' }, { k: 'tutorial', l: 'Tutorial' }, { k: 'product', l: 'Produk' },
  ];
  const cats = CategoryService.byScope(scope);
  const submit = () => {
    if (!name.trim()) { toast('error', 'Nama kategori wajib diisi.'); return; }
    if (editId) { CategoryService.update(editId, name.trim()); toast('success', 'Kategori diperbarui.'); }
    else { CategoryService.create(scope, name.trim()); toast('success', 'Kategori ditambahkan.'); }
    setName(''); setEditId(null);
  };
  return (
    <DashShell title="Kategori">
      <PageHeader title="Kategori" sub="Kategori untuk kelas, artikel, berita, tutorial, dan produk." />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="card overflow-hidden anim-rise">
          <div className="border-b border-base-200 dark:border-base-800 px-4 py-3"><Tabs tabs={scopes.map((s) => ({ key: s.k, label: s.l }))} active={scope} onChange={(k) => setScope(k as Category['scope'])} /></div>
          {cats.length === 0 ? <div className="p-6"><EmptyState icon="tag" title="Belum ada kategori" sub={`Tambahkan kategori ${scope} di panel kanan.`} /></div> : (
            <ul>
              {cats.map((c) => (
                <li key={c.id} className="flex items-center gap-3 border-b border-base-100 dark:border-base-800 px-4 py-3 last:border-0">
                  <Icon name="tag" size={15} className="text-brand-500" />
                  <span className="flex-1 text-sm font-bold text-base-800 dark:text-base-100">{c.name}</span>
                  <span className="font-mono text-[10px] text-base-400">{db.count(scope === 'course' ? 'courses' : scope === 'article' ? 'articles' : scope === 'news' ? 'news' : scope === 'tutorial' ? 'tutorials' : 'products', (r) => (r as { categoryId?: ID | null }).categoryId === c.id)} item</span>
                  <IconButton icon="pencil" title="Edit" tone="brand" onClick={() => { setEditId(c.id); setName(c.name); }} />
                  <IconButton icon="trash" title="Hapus" tone="danger" onClick={() => setDel(c)} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card h-fit p-5 anim-rise">
          <p className="label">{editId ? 'Edit Kategori' : `Kategori ${scope} Baru`}</p>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama kategori…" onKeyDown={(e) => e.key === 'Enter' && submit()} />
          <div className="mt-3 flex gap-2">
            <button className="btn-primary flex-1" onClick={submit}><Icon name={editId ? 'check' : 'plus'} size={14} /> {editId ? 'Simpan' : 'Tambah'}</button>
            {editId && <button className="btn-ghost" onClick={() => { setEditId(null); setName(''); }}>Batal</button>}
          </div>
        </div>
      </div>
      <Confirm open={!!del} onClose={() => setDel(null)} message={`Hapus kategori "${del?.name}"? Item di dalamnya menjadi tanpa kategori.`}
        onConfirm={() => { if (del) { CategoryService.remove(del.id); toast('success', 'Kategori dihapus.'); } }} />
    </DashShell>
  );
}

/* ================= media library page ================= */

export function MediaPage() {
  useDB();
  const { user, toast } = useApp();
  const [q, setQ] = useState('');
  const [del, setDel] = useState<ID | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!user) return null;
  const items = db.all('media').slice().reverse().filter((m) => !q || m.name.toLowerCase().includes(q.toLowerCase()));
  const upload = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) {
      const res = await MediaService.add(f, user.id);
      if ('error' in res) toast('error', `${f.name}: ${res.error}`);
    }
    toast('success', 'Unggahan selesai.');
  };
  return (
    <DashShell title="Media Library">
      <PageHeader title="Media Library" sub="File disimpan di storage — database hanya menyimpan path & metadata."
        actions={<>
          <input ref={fileRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
          <button className="btn-primary" onClick={() => fileRef.current?.click()}><Icon name="upload" size={15} /> Unggah File</button>
        </>} />
      <div className="mb-4 max-w-xs relative">
        <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari file…" className="input pl-9" />
      </div>
      {items.length === 0 ? <EmptyState icon="image" title="Belum ada media" sub="Unggah gambar atau PDF untuk digunakan di konten." /> : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((m, i) => (
            <div key={m.id} className="card card-hover group overflow-hidden anim-rise" style={{ animationDelay: `${(i % 6) * 40}ms` }}>
              <div className="relative">
                {m.mime.startsWith('image/') ? <img src={m.url} alt={m.name} className="aspect-square w-full object-cover" /> : (
                  <span className="flex aspect-square items-center justify-center bg-base-100 dark:bg-base-850 text-base-400"><Icon name="file" size={26} /></span>
                )}
                <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-base-950/60 opacity-0 transition-opacity group-hover:opacity-100">
                  <CopyButton text={m.url} label="" />
                  <button className="btn-danger btn-sm" onClick={() => setDel(m.id)}><Icon name="trash" size={12} /></button>
                </div>
              </div>
              <div className="px-2.5 py-2">
                <p className="truncate text-[11px] font-bold text-base-700 dark:text-base-200">{m.name}</p>
                <p className="font-mono text-[9px] text-base-400">{(m.size / 1024).toFixed(0)} KB · {m.mime.split('/')[1]}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <Confirm open={!!del} onClose={() => setDel(null)} message="Hapus file ini dari media library?" onConfirm={() => { if (del) { MediaService.remove(del); toast('success', 'File dihapus.'); } }} />
    </DashShell>
  );
}

/* ================= certificate templates ================= */

export function CertificateTemplatesPage() {
  useDB();
  const { user, toast } = useApp();
  const [editing, setEditing] = useState<ID | 'new' | null>(null);
  const [del, setDel] = useState<ID | null>(null);
  const [f, setF] = useState({ name: '', theme: 'navy' as 'navy' | 'ivory' | 'graphite', accent: '#2dd4bf', frame: 'modern' as 'modern' | 'classic' });
  if (!user) return null;
  const rows = db.all('certificateTemplates');
  const open = (id: ID | 'new') => {
    const t = id !== 'new' ? db.byId('certificateTemplates', id) : undefined;
    setF({ name: t?.name ?? '', theme: t?.theme ?? 'navy', accent: t?.accent ?? '#2dd4bf', frame: t?.frame ?? 'modern' });
    setEditing(id);
  };
  const save = () => {
    if (!f.name.trim()) { toast('error', 'Nama template wajib diisi.'); return; }
    if (editing === 'new') db.insert('certificateTemplates', { ...f });
    else if (editing) db.update('certificateTemplates', editing, { ...f });
    toast('success', 'Template disimpan.');
    setEditing(null);
  };
  return (
    <DashShell title="Template Sertifikat">
      <PageHeader title="Template Sertifikat" sub="Template digunakan saat sertifikat digital diterbitkan."
        actions={<button className="btn-primary" onClick={() => open('new')}><Icon name="plus" size={15} /> Template Baru</button>} />
      {rows.length === 0 ? <EmptyState icon="award" title="Belum ada template" sub="Buat template sertifikat pertamamu." action={<button className="btn-primary" onClick={() => open('new')}>Create New</button>} /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((t, i) => (
            <div key={t.id} className="card card-hover overflow-hidden anim-rise" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="relative flex h-32 items-center justify-center" style={{ background: t.theme === 'ivory' ? '#faf7f0' : t.theme === 'graphite' ? '#171a21' : '#0c1226' }}>
                <div className="absolute inset-2 rounded-md" style={{ border: `1.5px solid ${t.accent}`, opacity: 0.8, borderRadius: t.frame === 'classic' ? 0 : 10 }} />
                <div className="text-center">
                  <p className="font-mono text-[8px] uppercase" style={{ letterSpacing: '0.4em', color: t.accent }}>Certificate</p>
                  <p className="mt-1 font-display text-sm font-bold" style={{ color: t.theme === 'ivory' ? '#26221a' : '#eef2fb' }}>Nama Student</p>
                  <div className="mx-auto mt-1.5 h-px w-16" style={{ background: t.accent }} />
                </div>
              </div>
              <div className="flex items-center justify-between p-4">
                <div><p className="font-display text-sm font-bold text-base-900 dark:text-base-50">{t.name}</p>
                  <p className="font-mono text-[10px] text-base-400">{t.theme} · {t.frame} · dipakai {db.count('certificates', (c) => c.templateId === t.id)}x</p></div>
                <div className="flex gap-1">
                  <IconButton icon="pencil" title="Edit" tone="brand" onClick={() => open(t.id)} />
                  <IconButton icon="trash" title="Hapus" tone="danger" onClick={() => setDel(t.id)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Template Baru' : 'Edit Template'} footer={
        <><button className="btn-ghost" onClick={() => setEditing(null)}>Batal</button><button className="btn-primary" onClick={save}><Icon name="check" size={14} /> Simpan</button></>
      }>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Nama Template" required><TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field></div>
          <Field label="Tema"><Select value={f.theme} onChange={(e) => setF({ ...f, theme: e.target.value as typeof f.theme })}>
            <option value="navy">Navy (gelap)</option><option value="ivory">Ivory (terang)</option><option value="graphite">Graphite</option>
          </Select></Field>
          <Field label="Frame"><Select value={f.frame} onChange={(e) => setF({ ...f, frame: e.target.value as typeof f.frame })}>
            <option value="modern">Modern (rounded)</option><option value="classic">Classic (garis ganda)</option>
          </Select></Field>
          <Field label="Warna Aksen"><div className="flex items-center gap-2"><input type="color" value={f.accent} onChange={(e) => setF({ ...f, accent: e.target.value })} className="h-10 w-14 cursor-pointer rounded-lg border border-base-300 dark:border-base-700" /><span className="font-mono text-xs text-base-400">{f.accent}</span></div></Field>
        </div>
      </Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} message="Hapus template ini? Sertifikat yang sudah terbit tetap aman." onConfirm={() => { if (del) { db.remove('certificateTemplates', del); toast('success', 'Template dihapus.'); } }} />
    </DashShell>
  );
}

/* ================= certificates list ================= */

export function CertificatesAdmin() {
  useDB();
  const { user, toast } = useApp();
  const [revoke, setRevoke] = useState<ID | null>(null);
  const [viewId, setViewId] = useState<ID | null>(null);
  if (!user) return null;
  const isInstructor = user.roleKey === 'instructor';
  const isStudent = user.roleKey === 'student';
  let rows = CertificateService.list();
  if (isInstructor) {
    const myCourseIds = db.where('courses', (c) => c.instructorId === user.id).map((c) => c.id);
    rows = rows.filter((c) => myCourseIds.includes(c.courseId));
  } else if (isStudent) {
    rows = rows.filter((c) => c.userId === user.id);
  }
  rows = rows.slice().sort((a, b) => b.issuedAt - a.issuedAt);
  return (
    <DashShell title="Sertifikat">
      <PageHeader title="Sertifikat Digital" sub="Diterbitkan otomatis saat student menyelesaikan kelas & lulus quiz." />
      <DataTable rows={rows} pageSize={9} searchKeys={(c) => `${c.number} ${db.byId('users', c.userId)?.name ?? ''}`}
        emptyTitle="Belum ada sertifikat" emptySub="Sertifikat terbit otomatis begitu student memenuhi syarat kelulusan."
        columns={[
          { key: 'number', label: 'Nomor', render: (c) => <span className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400">{c.number}</span> },
          { key: 'student', label: 'Student', render: (c) => <span className="text-sm font-semibold">{db.byId('users', c.userId)?.name ?? '—'}</span> },
          { key: 'course', label: 'Kelas', render: (c) => <span className="text-xs text-base-500">{db.byId('courses', c.courseId)?.title ?? '—'}</span> },
          { key: 'issued', label: 'Terbit', render: (c) => <span className="font-mono text-[11px] text-base-400">{fmtDate(c.issuedAt)}</span> },
          { key: 'views', label: 'Verifikasi', render: (c) => <Badge tone="info">{c.views}x</Badge> },
          { key: 'status', label: 'Status', render: (c) => <StatusBadge status={c.status} /> },
        ]}
        rowActions={(c) => (
          <>
            <IconButton icon="eye" title="Lihat & verifikasi" tone="brand" onClick={() => setViewId(c.id)} />
            {c.status === 'issued' && <IconButton icon="alert-triangle" title="Cabut" tone="danger" onClick={() => setRevoke(c.id)} />}
          </>
        )} />
      <Confirm open={!!revoke} onClose={() => setRevoke(null)} message="Cabut sertifikat ini? Halaman verifikasi akan menampilkan status REVOKED." dangerLabel="Ya, Cabut"
        onConfirm={() => { if (revoke) { CertificateService.revoke(revoke, user); toast('success', 'Sertifikat dicabut.'); } }} />
      {viewId && <CertificateModal certId={viewId} open onClose={() => setViewId(null)} />}
    </DashShell>
  );
}
