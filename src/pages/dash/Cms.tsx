import { useState } from 'react';
import { db, uid, now, type HomeBlock, type BlockType, type Menu, type MenuItem, type ID } from '../../lib/db';
import { audit, getSetting, setSettings } from '../../lib/services';
import { useApp, useDB } from '../../state/store';
import { Icon, type IconName } from '../../components/icons';
import RichText from '../../components/RichText';
import { Badge, Confirm, EmptyState, Field, IconButton, MediaPicker, Modal, PageHeader, Select, Tabs, TextArea, TextInput, Toggle } from '../../components/ui';
import { DashShell } from '../../components/Shell';

/* ================= homepage builder ================= */

const BLOCK_META: Record<BlockType, { label: string; icon: IconName }> = {
  hero: { label: 'Hero', icon: 'layout' }, stats: { label: 'Statistik', icon: 'chart' },
  featured_courses: { label: 'Kelas Unggulan', icon: 'star' }, latest_courses: { label: 'Kelas Terbaru', icon: 'book' },
  free_courses: { label: 'Kelas Gratis', icon: 'unlock' }, categories: { label: 'Kategori', icon: 'tag' },
  instructors: { label: 'Instructor', icon: 'grad-cap' }, articles: { label: 'Artikel', icon: 'file-text' },
  news: { label: 'Berita', icon: 'news' }, tutorials: { label: 'Tutorial', icon: 'book-open' },
  activities: { label: 'Kegiatan', icon: 'calendar' }, cta: { label: 'Call to Action', icon: 'send' },
  text: { label: 'Teks / Konten', icon: 'type' }, video: { label: 'Video YouTube', icon: 'youtube' },
  map: { label: 'Google Maps', icon: 'map-pin' }, custom: { label: 'Custom HTML', icon: 'code' },
};

function BlockEditor({ block, onClose }: { block: HomeBlock | null; onClose: () => void }) {
  const { toast } = useApp();
  const [s, setS] = useState<Record<string, string>>({ ...(block?.settings ?? {}) });
  const type = block?.type ?? 'text';
  const set = (k: string, v: string) => setS((p) => ({ ...p, [k]: v }));
  const fields: Record<BlockType, Array<{ k: string; l: string; kind?: 'area' | 'rich' | 'text' }>> = {
    hero: [{ k: 'heading', l: 'Heading (baris ke-2 jadi aksen)', kind: 'area' }, { k: 'sub', l: 'Subjudul', kind: 'area' }, { k: 'search_placeholder', l: 'Placeholder pencarian' }],
    stats: [], categories: [{ k: 'title', l: 'Judul' }],
    featured_courses: [{ k: 'title', l: 'Judul' }, { k: 'sub', l: 'Subjudul' }],
    latest_courses: [{ k: 'title', l: 'Judul' }, { k: 'sub', l: 'Subjudul' }],
    free_courses: [{ k: 'title', l: 'Judul' }, { k: 'sub', l: 'Subjudul' }],
    instructors: [{ k: 'title', l: 'Judul' }, { k: 'sub', l: 'Subjudul' }],
    articles: [{ k: 'title', l: 'Judul' }], news: [{ k: 'title', l: 'Judul' }],
    tutorials: [{ k: 'title', l: 'Judul' }], activities: [{ k: 'title', l: 'Judul' }],
    cta: [{ k: 'title', l: 'Judul' }, { k: 'sub', l: 'Subjudul' }, { k: 'button_label', l: 'Label Tombol' }],
    text: [{ k: 'html', l: 'Konten', kind: 'rich' }],
    video: [{ k: 'title', l: 'Judul' }, { k: 'url', l: 'URL YouTube' }],
    map: [{ k: 'title', l: 'Judul' }],
    custom: [{ k: 'html', l: 'HTML (script/iframe dibuang otomatis)', kind: 'area' }],
  };
  return (
    <Modal open onClose={onClose} title={`Edit Blok — ${BLOCK_META[type].label}`} footer={
      <><button className="btn-ghost" onClick={onClose}>Batal</button>
        <button className="btn-primary" onClick={() => { if (block) { db.update('homepageBlocks', block.id, { settings: s }); toast('success', 'Blok diperbarui.'); onClose(); } }}><Icon name="check" size={14} /> Simpan</button></>
    }>
      {fields[type].length === 0 ? <p className="text-sm text-base-400">Blok ini mengambil data langsung dari database — tidak ada pengaturan tambahan.</p> : (
        <div className="space-y-4">
          {fields[type].map((f) => (
            <Field key={f.k} label={f.l}>
              {f.kind === 'rich' ? <RichText value={s[f.k] ?? ''} onChange={(html) => set(f.k, html)} />
                : f.kind === 'area' ? <TextArea rows={3} value={s[f.k] ?? ''} onChange={(e) => set(f.k, e.target.value)} />
                : <TextInput value={s[f.k] ?? ''} onChange={(e) => set(f.k, e.target.value)} />}
            </Field>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function HomepageBuilder() {
  useDB();
  const { user, toast } = useApp();
  const [editing, setEditing] = useState<HomeBlock | null>(null);
  const [adding, setAdding] = useState(false);
  const [del, setDel] = useState<HomeBlock | null>(null);
  if (!user) return null;
  const blocks = db.all('homepageBlocks').slice().sort((a, b) => a.order - b.order);

  const move = (b: HomeBlock, dir: -1 | 1) => {
    const i = blocks.findIndex((x) => x.id === b.id);
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    db.update('homepageBlocks', blocks[i].id, { order: blocks[j].order });
    db.update('homepageBlocks', blocks[j].id, { order: blocks[i].order });
  };
  const addBlock = (type: BlockType) => {
    db.insert('homepageBlocks', { type, enabled: true, order: blocks.length, settings: {} });
    audit(user.id, user.name, 'create', 'homepage_block', null, `Menambah blok ${type}`);
    toast('success', `Blok ${BLOCK_META[type].label} ditambahkan.`);
    setAdding(false);
  };

  return (
    <DashShell title="Homepage">
      <PageHeader title="Homepage Builder" sub="Susun halaman depan dari blok dinamis — perubahan langsung tampil di website."
        actions={<button className="btn-primary" onClick={() => setAdding(true)}><Icon name="plus" size={15} /> Tambah Blok</button>} />
      {blocks.length === 0 ? <EmptyState icon="layout" title="Belum ada blok" sub="Tambahkan blok untuk membangun homepage." action={<button className="btn-primary" onClick={() => setAdding(true)}>Create New</button>} /> : (
        <div className="space-y-2">
          {blocks.map((b, i) => (
            <div key={b.id} className={`card flex items-center gap-3 px-4 py-3 anim-rise transition-opacity ${!b.enabled ? 'opacity-50' : ''}`} style={{ animationDelay: `${i * 30}ms` }}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/12 text-brand-500"><Icon name={BLOCK_META[b.type].icon} size={16} /></span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-bold text-base-900 dark:text-base-50">{BLOCK_META[b.type].label}</p>
                <p className="truncate font-mono text-[10px] text-base-400">{b.settings.title || b.settings.heading?.split('\n')[0] || `blok #${i + 1}`}</p>
              </div>
              <Badge tone={b.enabled ? 'ok' : 'neutral'}>{b.enabled ? 'aktif' : 'nonaktif'}</Badge>
              <Toggle checked={b.enabled} onChange={(v) => { db.update('homepageBlocks', b.id, { enabled: v }); toast('info', v ? 'Blok diaktifkan.' : 'Blok dinonaktifkan.'); }} />
              <span className="hidden sm:flex items-center">
                <IconButton icon="arrow-up" title="Naik" onClick={() => move(b, -1)} />
                <IconButton icon="arrow-down" title="Turun" onClick={() => move(b, 1)} />
              </span>
              <IconButton icon="pencil" title="Edit" tone="brand" onClick={() => setEditing(b)} />
              <IconButton icon="copy" title="Duplikat" onClick={() => { db.insert('homepageBlocks', { type: b.type, enabled: false, order: blocks.length, settings: { ...b.settings } }); toast('success', 'Blok diduplikasi (nonaktif).'); }} />
              <IconButton icon="trash" title="Hapus" tone="danger" onClick={() => setDel(b)} />
            </div>
          ))}
        </div>
      )}
      {editing && <BlockEditor block={editing} onClose={() => setEditing(null)} />}
      <Modal open={adding} onClose={() => setAdding(false)} title="Tambah Blok" wide>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {(Object.keys(BLOCK_META) as BlockType[]).map((t) => (
            <button key={t} onClick={() => addBlock(t)} className="card card-hover flex flex-col items-center gap-2 p-4 text-center cursor-pointer">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/12 text-brand-500"><Icon name={BLOCK_META[t].icon} size={18} /></span>
              <span className="text-xs font-bold text-base-700 dark:text-base-200">{BLOCK_META[t].label}</span>
            </button>
          ))}
        </div>
      </Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} message={`Hapus blok "${del ? BLOCK_META[del.type].label : ''}" dari homepage?`}
        onConfirm={() => { if (del) { db.remove('homepageBlocks', del.id); toast('success', 'Blok dihapus.'); } }} />
    </DashShell>
  );
}

/* ================= menus ================= */

const ITEM_TYPES: Array<{ k: MenuItem['type']; l: string }> = [
  { k: 'home', l: 'Beranda' }, { k: 'courses', l: 'Kelas' }, { k: 'articles', l: 'Artikel' }, { k: 'news', l: 'Berita' },
  { k: 'tutorials', l: 'Tutorial' }, { k: 'activities', l: 'Kegiatan' }, { k: 'shop', l: 'Toko' }, { k: 'about', l: 'Tentang Kami' },
  { k: 'contact', l: 'Kontak' }, { k: 'page', l: 'Halaman CMS' }, { k: 'custom', l: 'Custom URL' },
];

export function MenusPage() {
  useDB();
  const { user, toast } = useApp();
  const menus = db.all('menus');
  const [menuId, setMenuId] = useState<ID>(menus[0]?.id ?? '');
  const [modal, setModal] = useState<{ item: MenuItem | null } | null>(null);
  const [del, setDel] = useState<MenuItem | null>(null);
  const [f, setF] = useState({ label: '', type: 'custom' as MenuItem['type'], target: '' });
  if (!user) return null;
  const menu = db.byId('menus', menuId) as Menu | undefined;
  const items = db.where('menuItems', (i) => i.menuId === menuId).sort((a, b) => a.order - b.order);
  const roots = items.filter((i) => !i.parentId);

  const openModal = (item: MenuItem | null) => {
    setF({ label: item?.label ?? '', type: item?.type ?? 'custom', target: item?.target ?? '' });
    setModal({ item });
  };
  const save = () => {
    if (!f.label.trim()) { toast('error', 'Label wajib diisi.'); return; }
    if (modal?.item) { db.update('menuItems', modal.item.id, { ...f }); toast('success', 'Item diperbarui.'); }
    else {
      db.insert('menuItems', { menuId, parentId: null, label: f.label.trim(), type: f.type, target: f.target, order: items.length });
      toast('success', 'Item menu ditambahkan.');
    }
    setModal(null);
  };
  const move = (item: MenuItem, dir: -1 | 1) => {
    const siblings = items.filter((i) => i.parentId === item.parentId);
    const i = siblings.findIndex((x) => x.id === item.id);
    const j = i + dir;
    if (j < 0 || j >= siblings.length) return;
    db.update('menuItems', siblings[i].id, { order: j });
    db.update('menuItems', siblings[j].id, { order: i });
  };

  return (
    <DashShell title="Menu">
      <PageHeader title="Menu" sub="Kelola menu navigasi website — header & footer."
        actions={<button className="btn-primary" onClick={() => openModal(null)} disabled={!menu}><Icon name="plus" size={15} /> Item Menu</button>} />
      <div className="mb-4"><Tabs tabs={menus.map((m) => ({ key: m.id, label: `${m.name} (${m.location})` }))} active={menuId} onChange={setMenuId} /></div>
      {!menu ? <EmptyState icon="list" title="Belum ada menu" /> : (
        <div className="card overflow-hidden anim-rise">
          {items.length === 0 ? <div className="p-6"><EmptyState icon="list" title="Menu kosong" sub="Tambahkan item menu pertamamu." /></div> : (
            <ul>
              {roots.map((item, idx) => {
                const children = items.filter((i) => i.parentId === item.id);
                return (
                  <li key={item.id}>
                    <MenuRow item={item} index={idx} onEdit={() => openModal(item)} onDel={() => setDel(item)}
                      onUp={() => move(item, -1)} onDown={() => move(item, 1)}
                      onIndent={idx > 0 ? () => { db.update('menuItems', item.id, { parentId: roots[idx - 1].id }); toast('success', 'Jadi sub-menu.'); } : undefined}
                      onOutdent={item.parentId ? () => { db.update('menuItems', item.id, { parentId: null }); toast('success', 'Naik ke level atas.'); } : undefined} />
                    {children.map((c, ci) => (
                      <MenuRow key={c.id} item={c} index={ci} nested onEdit={() => openModal(c)} onDel={() => setDel(c)}
                        onUp={() => move(c, -1)} onDown={() => move(c, 1)}
                        onOutdent={() => { db.update('menuItems', c.id, { parentId: null }); toast('success', 'Naik ke level atas.'); }} />
                    ))}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.item ? 'Edit Item Menu' : 'Tambah Item Menu'} footer={
        <><button className="btn-ghost" onClick={() => setModal(null)}>Batal</button><button className="btn-primary" onClick={save}><Icon name="check" size={14} /> Simpan</button></>
      }>
        <div className="space-y-4">
          <Field label="Label" required><TextInput value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></Field>
          <Field label="Tipe"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as MenuItem['type'], target: '' })}>
            {ITEM_TYPES.map((t) => <option key={t.k} value={t.k}>{t.l}</option>)}
          </Select></Field>
          {f.type === 'page' && (
            <Field label="Pilih Halaman"><Select value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })}>
              <option value="">— pilih —</option>
              {db.all('pages').map((p) => <option key={p.id} value={p.slug}>{p.title}</option>)}
            </Select></Field>
          )}
          {f.type === 'custom' && <Field label="URL" required><TextInput value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} placeholder="https://…" className="font-mono text-xs" /></Field>}
        </div>
      </Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} message={`Hapus item menu "${del?.label}"?`}
        onConfirm={() => {
          if (del) {
            db.where('menuItems', (i) => i.parentId === del.id).forEach((c) => db.update('menuItems', c.id, { parentId: null }));
            db.remove('menuItems', del.id);
            toast('success', 'Item dihapus.');
          }
        }} />
    </DashShell>
  );
}

function MenuRow({ item, index, nested, onEdit, onDel, onUp, onDown, onIndent, onOutdent }: {
  item: MenuItem; index: number; nested?: boolean;
  onEdit: () => void; onDel: () => void; onUp: () => void; onDown: () => void;
  onIndent?: () => void; onOutdent?: () => void;
}) {
  return (
    <div className={`flex items-center gap-2 border-b border-base-100 dark:border-base-800/70 px-4 py-2.5 last:border-0 ${nested ? 'pl-12 bg-base-50/60 dark:bg-base-850/40' : ''}`}>
      <span className="font-mono text-[10px] font-bold text-brand-500 w-5">{nested ? '└' : String(index + 1).padStart(2, '0')}</span>
      <span className="flex-1 text-sm font-bold text-base-800 dark:text-base-100">{item.label}</span>
      <Badge tone="neutral">{ITEM_TYPES.find((t) => t.k === item.type)?.l ?? item.type}</Badge>
      <IconButton icon="arrow-up" title="Naik" onClick={onUp} />
      <IconButton icon="arrow-down" title="Turun" onClick={onDown} />
      {onIndent && <IconButton icon="arrow-right" title="Jadikan sub-menu" onClick={onIndent} />}
      {onOutdent && <IconButton icon="arrow-left" title="Naikkan level" onClick={onOutdent} />}
      <IconButton icon="pencil" title="Edit" tone="brand" onClick={onEdit} />
      <IconButton icon="trash" title="Hapus" tone="danger" onClick={onDel} />
    </div>
  );
}

/* ================= about us cms ================= */

interface TeamMember { name: string; role: string; photo?: string; }

export function AboutEditor() {
  useDB();
  const { user, toast } = useApp();
  const s = db.settings();
  const [f, setF] = useState({
    hero: s.about_hero_title ?? '', sub: s.about_hero_subtitle ?? '', desc: s.about_description ?? '',
    vision: s.about_vision ?? '', mission: s.about_mission ?? '', history: s.about_history ?? '', video: s.about_video ?? '',
  });
  const [team, setTeam] = useState<TeamMember[]>(() => { try { return JSON.parse(s.about_team ?? '[]'); } catch { return []; } });
  const [gallery, setGallery] = useState<string[]>(() => { try { return JSON.parse(s.about_gallery ?? '[]'); } catch { return []; } });
  const [mediaFor, setMediaFor] = useState<'gallery' | number | null>(null);
  if (!user) return null;

  const save = () => {
    setSettings({
      about_hero_title: f.hero, about_hero_subtitle: f.sub, about_description: f.desc,
      about_vision: f.vision, about_mission: f.mission, about_history: f.history, about_video: f.video,
      about_team: JSON.stringify(team), about_gallery: JSON.stringify(gallery),
    });
    audit(user.id, user.name, 'update', 'about', null, 'Memperbarui Tentang Kami');
    toast('success', 'Tentang Kami diperbarui — cek halaman /about.');
  };

  return (
    <DashShell title="Tentang Kami">
      <PageHeader title="Tentang Kami (CMS)" sub="100% dinamis — konten di sini langsung tampil di halaman publik /about."
        actions={<button className="btn-primary" onClick={save}><Icon name="check" size={15} /> Simpan Semua</button>} />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card space-y-4 p-6 anim-rise">
          <Field label="Judul Hero"><TextInput value={f.hero} onChange={(e) => setF({ ...f, hero: e.target.value })} /></Field>
          <Field label="Subjudul Hero"><TextArea rows={2} value={f.sub} onChange={(e) => setF({ ...f, sub: e.target.value })} /></Field>
          <Field label="Deskripsi"><RichText value={f.desc} onChange={(html) => setF({ ...f, desc: html })} /></Field>
          <Field label="Video (URL YouTube)"><TextInput value={f.video} onChange={(e) => setF({ ...f, video: e.target.value })} placeholder="https://www.youtube.com/watch?v=…" className="font-mono text-xs" /></Field>
        </div>
        <div className="space-y-5">
          <div className="card space-y-4 p-6 anim-rise" style={{ animationDelay: '60ms' }}>
            <Field label="Visi"><RichText value={f.vision} onChange={(html) => setF({ ...f, vision: html })} /></Field>
            <Field label="Misi"><RichText value={f.mission} onChange={(html) => setF({ ...f, mission: html })} /></Field>
            <Field label="Sejarah"><RichText value={f.history} onChange={(html) => setF({ ...f, history: html })} /></Field>
          </div>
          <div className="card p-6 anim-rise" style={{ animationDelay: '120ms' }}>
            <div className="mb-3 flex items-center justify-between">
              <p className="label mb-0">Tim ({team.length})</p>
              <button className="btn-outline btn-sm" onClick={() => setTeam([...team, { name: '', role: '' }])}><Icon name="plus" size={12} /> Anggota</button>
            </div>
            {team.length === 0 && <p className="text-sm text-base-400">Belum ada anggota tim.</p>}
            {team.map((m, i) => (
              <div key={i} className="mb-2 flex items-center gap-2">
                <button className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-base-200 dark:border-base-700 cursor-pointer" onClick={() => setMediaFor(i)}>
                  {m.photo ? <img src={m.photo} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-base-400"><Icon name="camera" size={14} /></span>}
                </button>
                <TextInput value={m.name} placeholder="Nama" onChange={(e) => setTeam(team.map((x, xi) => xi === i ? { ...x, name: e.target.value } : x))} className="flex-1" />
                <TextInput value={m.role} placeholder="Jabatan" onChange={(e) => setTeam(team.map((x, xi) => xi === i ? { ...x, role: e.target.value } : x))} className="flex-1" />
                <IconButton icon="trash" title="Hapus" tone="danger" onClick={() => setTeam(team.filter((_, xi) => xi !== i))} />
              </div>
            ))}
            <p className="label mt-5">Galeri ({gallery.length})</p>
            <div className="grid grid-cols-4 gap-2">
              {gallery.map((g, i) => (
                <div key={i} className="group relative aspect-square overflow-hidden rounded-lg border border-base-200 dark:border-base-700">
                  <img src={g} alt="" className="h-full w-full object-cover" />
                  <button className="absolute inset-0 flex items-center justify-center bg-base-950/60 opacity-0 transition-opacity group-hover:opacity-100 text-white cursor-pointer" onClick={() => setGallery(gallery.filter((_, xi) => xi !== i))}><Icon name="trash" size={15} /></button>
                </div>
              ))}
              <button className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-base-300 dark:border-base-700 text-base-400 hover:border-brand-500 hover:text-brand-500 transition-colors cursor-pointer" onClick={() => setMediaFor('gallery')}><Icon name="plus" size={18} /></button>
            </div>
          </div>
        </div>
      </div>
      <MediaPicker open={mediaFor !== null} onClose={() => setMediaFor(null)} onPick={(url) => {
        if (mediaFor === 'gallery') setGallery([...gallery, url]);
        else if (typeof mediaFor === 'number') setTeam(team.map((x, xi) => xi === mediaFor ? { ...x, photo: url } : x));
        setMediaFor(null);
      }} />
    </DashShell>
  );
}
