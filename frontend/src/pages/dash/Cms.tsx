import { useEffect, useState } from 'react';
import type { HomeBlock, BlockType, Menu, MenuItem, ID } from '../../lib/types';
import { getSetting } from '../../lib/settings';
import { useApp } from '../../state/store';
import { api, type ApiContentRow } from '../../lib/api';
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
  banner: { label: 'Banner', icon: 'image' }, slider: { label: 'Slider', icon: 'layers' },
  faq: { label: 'FAQ', icon: 'info' }, testimonial: { label: 'Testimoni', icon: 'chat' },
};

function BlockEditor({ block, onClose }: { block: HomeBlock | null; onClose: () => void }) {
  const { toast } = useApp();
  const [s, setS] = useState<Record<string, string>>(() => {
    const settings = { ...(block?.settings ?? {}) };
    for (const key of ['items']) {
      const value = settings[key];
      if (Array.isArray(value)) settings[key] = JSON.stringify(value, null, 2);
    }
    return settings;
  });
  const type = block?.type ?? 'text';
  const set = (k: string, v: string) => setS((p) => ({ ...p, [k]: v }));
  const fields: Record<BlockType, Array<{ k: string; l: string; kind?: 'area' | 'rich' | 'text' | 'json' }>> = {
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
    banner: [{ k: 'title', l: 'Judul' }, { k: 'subtitle', l: 'Subjudul', kind: 'area' }, { k: 'image', l: 'Gambar (path media / URL)' }, { k: 'cta_label', l: 'Label Tombol' }, { k: 'cta_url', l: 'URL Tombol' }],
    slider: [{ k: 'items', l: 'Item slider (JSON: [{title, image, cta_label, cta_url}])', kind: 'json' }],
    faq: [{ k: 'title', l: 'Judul' }, { k: 'items', l: 'Item FAQ (JSON: [{question, answer}])', kind: 'json' }],
    testimonial: [{ k: 'title', l: 'Judul' }, { k: 'items', l: 'Testimoni (JSON: [{name, role, photo, testimonial, rating}])', kind: 'json' }],
    custom: [{ k: 'html', l: 'HTML (script/iframe dibuang otomatis)', kind: 'area' }],
  };
  const save = () => {
    if (!block) return;
    const payload: Record<string, unknown> = { ...s };
    for (const f of fields[type]) {
      if (f.kind !== 'json') continue;
      const raw = (s[f.k] ?? '').trim();
      if (raw === '') { payload[f.k] = []; continue; }
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { toast('error', `Kolom ${f.l} bukan JSON yang valid.`); return; }
      if (!Array.isArray(parsed)) { toast('error', `Kolom ${f.l} harus berupa array JSON.`); return; }
      payload[f.k] = parsed;
    }
    void api.updateHomepageBlock(block.id, { content: payload }).then(() => { toast('success', 'Blok diperbarui.'); onClose(); }).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal memperbarui blok.'));
  };
  return (
    <Modal open onClose={onClose} title={`Edit Blok — ${BLOCK_META[type].label}`} footer={
      <><button className="btn-ghost" onClick={onClose}>Batal</button>
        <button className="btn-primary" onClick={save}><Icon name="check" size={14} /> Simpan</button></>
    }>
      {fields[type].length === 0 ? <p className="text-sm text-base-400">Blok ini mengambil data langsung dari database — tidak ada pengaturan tambahan.</p> : (
        <div className="space-y-4">
          {fields[type].map((f) => (
            <Field key={f.k} label={f.l}>
              {f.kind === 'rich' ? <RichText value={s[f.k] ?? ''} onChange={(html) => set(f.k, html)} />
                : f.kind === 'json' ? <TextArea rows={6} value={s[f.k] ?? ''} onChange={(e) => set(f.k, e.target.value)} className="font-mono text-xs" />
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
  const { user, toast } = useApp();
  const [blocks, setBlocks] = useState<HomeBlock[]>([]);
  const refreshBlocks = () => { void api.adminHomepageBlocks().then((remote) => setBlocks(remote.map((block: any) => ({ id: String(block.id), type: block.type, enabled: Boolean(block.enabled), order: Number(block.sort || 0), settings: block.content || {}, createdAt: 0, updatedAt: 0 } as HomeBlock)))).catch(() => setBlocks([])); };
  useEffect(refreshBlocks, []);
  const [editing, setEditing] = useState<HomeBlock | null>(null);
  const [adding, setAdding] = useState(false);
  const [del, setDel] = useState<HomeBlock | null>(null);
  if (!user) return null;
  const orderedBlocks = blocks.slice().sort((a, b) => a.order - b.order);

  const move = (b: HomeBlock, dir: -1 | 1) => {
    const i = orderedBlocks.findIndex((x) => x.id === b.id);
    const j = i + dir;
    if (j < 0 || j >= orderedBlocks.length) return;
    void Promise.all([api.updateHomepageBlock(orderedBlocks[i].id, { sort: orderedBlocks[j].order }), api.updateHomepageBlock(orderedBlocks[j].id, { sort: orderedBlocks[i].order })]).then(refreshBlocks);
  };
  const addBlock = (type: BlockType) => {
    void api.createHomepageBlock({ type, enabled: true, sort: blocks.length, content: {} }).then(() => { toast('success', `Blok ${BLOCK_META[type].label} ditambahkan.`); refreshBlocks(); setAdding(false); }).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal menambah blok.'));
  };

  return (
    <DashShell title="Homepage">
      <PageHeader title="Homepage Builder" sub="Susun halaman depan dari blok dinamis — perubahan langsung tampil di website."
        actions={<button className="btn-primary" onClick={() => setAdding(true)}><Icon name="plus" size={15} /> Tambah Blok</button>} />
      {orderedBlocks.length === 0 ? <EmptyState icon="layout" title="Belum ada blok" sub="Tambahkan blok untuk membangun homepage." action={<button className="btn-primary" onClick={() => setAdding(true)}>Create New</button>} /> : (
        <div className="space-y-2">
          {orderedBlocks.map((b, i) => (
            <div key={b.id} className={`card flex items-center gap-3 px-4 py-3 anim-rise transition-opacity ${!b.enabled ? 'opacity-50' : ''}`} style={{ animationDelay: `${i * 30}ms` }}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/12 text-brand-500"><Icon name={BLOCK_META[b.type].icon} size={16} /></span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-bold text-base-900 dark:text-base-50">{BLOCK_META[b.type].label}</p>
                <p className="truncate font-mono text-[10px] text-base-400">{b.settings.title || b.settings.heading?.split('\n')[0] || `blok #${i + 1}`}</p>
              </div>
              <Badge tone={b.enabled ? 'ok' : 'neutral'}>{b.enabled ? 'aktif' : 'nonaktif'}</Badge>
              <Toggle checked={b.enabled} onChange={(v) => { void api.updateHomepageBlock(b.id, { enabled: v }).then(() => { toast('info', v ? 'Blok diaktifkan.' : 'Blok dinonaktifkan.'); refreshBlocks(); }); }} />
              <span className="hidden sm:flex items-center">
                <IconButton icon="arrow-up" title="Naik" onClick={() => move(b, -1)} />
                <IconButton icon="arrow-down" title="Turun" onClick={() => move(b, 1)} />
              </span>
              <IconButton icon="pencil" title="Edit" tone="brand" onClick={() => setEditing(b)} />
              <IconButton icon="copy" title="Duplikat" onClick={() => { void api.createHomepageBlock({ type: b.type, enabled: false, sort: blocks.length, content: { ...b.settings } }).then(() => { toast('success', 'Blok diduplikasi (nonaktif).'); refreshBlocks(); }); }} />
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
        onConfirm={() => { if (del) void api.deleteHomepageBlock(del.id).then(() => { toast('success', 'Blok dihapus.'); refreshBlocks(); setDel(null); }); }} />
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
  const { user, toast } = useApp();
  const [menus, setMenus] = useState<Array<Menu & { items: MenuItem[] }>>([]);
  const refreshMenus = () => { void api.menuGroups().then(setMenus).catch(() => setMenus([])); };
  useEffect(refreshMenus, []);
  const [pages, setPages] = useState<ApiContentRow[]>([]);
  useEffect(() => { void api.content('pages').then(setPages).catch(() => setPages([])); }, []);
  const [menuId, setMenuId] = useState<ID>(menus[0]?.id ?? '');
  useEffect(() => { if (!menuId && menus[0]) setMenuId(menus[0].id); }, [menus, menuId]);
  const [modal, setModal] = useState<{ item: MenuItem | null } | null>(null);
  const [del, setDel] = useState<MenuItem | null>(null);
  const [f, setF] = useState({ label: '', type: 'custom' as MenuItem['type'], target: '' });
  if (!user) return null;
  const menu = menus.find((item) => item.id === menuId);
  const items = menu?.items ?? [];
  const roots = items.filter((i) => !i.parentId);

  const openModal = (item: MenuItem | null) => {
    setF({ label: item?.label ?? '', type: item?.type ?? 'custom', target: item?.target ?? '' });
    setModal({ item });
  };
  const save = () => {
    if (!f.label.trim()) { toast('error', 'Label wajib diisi.'); return; }
    if (modal?.item) { void api.updateMenuItem(modal.item.id, { label: f.label.trim(), type: f.type, target: f.target || null }).then(() => { toast('success', 'Item diperbarui.'); refreshMenus(); setModal(null); }).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal memperbarui item.')); return; }
    else {
      void api.createMenuItem({ menu_id: menuId, parent_id: null, label: f.label.trim(), type: f.type, target: f.target || null, url: f.type === 'custom' ? f.target : null, sort: items.length }).then(() => { toast('success', 'Item menu ditambahkan.'); refreshMenus(); setModal(null); }).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal menambahkan item.')); return;
    }
  };
  const move = (item: MenuItem, dir: -1 | 1) => {
    const siblings = items.filter((i) => i.parentId === item.parentId);
    const i = siblings.findIndex((x) => x.id === item.id);
    const j = i + dir;
    if (j < 0 || j >= siblings.length) return;
    void Promise.all([api.updateMenuItem(siblings[i].id, { sort: j }), api.updateMenuItem(siblings[j].id, { sort: i })]).then(refreshMenus).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal mengurutkan menu.'));
  };

  const createMenu = (name: string, location: 'header' | 'footer') => {
    void api.createMenu(name, location).then((created) => { toast('success', `${name} dibuat.`); refreshMenus(); setMenuId(created.id); }).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal membuat menu.'));
  };
  const hasHeader = menus.some((m) => m.location === 'header' || m.location === 'both');
  const hasFooter = menus.some((m) => m.location === 'footer' || m.location === 'both');

  return (
    <DashShell title="Menu">
      <PageHeader title="Menu" sub="Kelola menu navigasi website — header & footer."
        actions={<button className="btn-primary" onClick={() => openModal(null)} disabled={!menu}><Icon name="plus" size={15} /> Item Menu</button>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tabs tabs={menus.map((m) => ({ key: m.id, label: `${m.name} (${m.location})` }))} active={menuId} onChange={setMenuId} />
        {!hasHeader && <button className="btn-outline btn-sm" onClick={() => createMenu('Header Menu', 'header')}><Icon name="plus" size={13} /> Buat Menu Header</button>}
        {!hasFooter && <button className="btn-outline btn-sm" onClick={() => createMenu('Footer Menu', 'footer')}><Icon name="plus" size={13} /> Buat Menu Footer</button>}
      </div>
      {!menu ? <EmptyState icon="list" title="Belum ada menu" sub="Buat menu Header atau Footer terlebih dahulu." /> : (
        <div className="card overflow-hidden anim-rise">
          {items.length === 0 ? <div className="p-6"><EmptyState icon="list" title="Menu kosong" sub="Tambahkan item menu pertamamu." /></div> : (
            <ul>
              {roots.map((item, idx) => {
                const children = items.filter((i) => i.parentId === item.id);
                return (
                  <li key={item.id}>
                    <MenuRow item={item} index={idx} onEdit={() => openModal(item)} onDel={() => setDel(item)}
                      onUp={() => move(item, -1)} onDown={() => move(item, 1)}
                      onIndent={idx > 0 ? () => { void api.updateMenuItem(item.id, { parent_id: roots[idx - 1].id }).then(() => { toast('success', 'Jadi sub-menu.'); refreshMenus(); }); } : undefined}
                      onOutdent={item.parentId ? () => { void api.updateMenuItem(item.id, { parent_id: null }).then(() => { toast('success', 'Naik ke level atas.'); refreshMenus(); }); } : undefined} />
                    {children.map((c, ci) => (
                      <MenuRow key={c.id} item={c} index={ci} nested onEdit={() => openModal(c)} onDel={() => setDel(c)}
                        onUp={() => move(c, -1)} onDown={() => move(c, 1)}
                        onOutdent={() => { void api.updateMenuItem(c.id, { parent_id: null }).then(() => { toast('success', 'Naik ke level atas.'); refreshMenus(); }); }} />
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
              {pages.map((p) => <option key={p.id} value={p.slug}>{p.title}</option>)}
            </Select></Field>
          )}
          {f.type === 'custom' && <Field label="URL" required><TextInput value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} placeholder="https://…" className="font-mono text-xs" /></Field>}
        </div>
      </Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} message={`Hapus item menu "${del?.label}"?`}
        onConfirm={() => {
          if (del) {
            void api.deleteMenuItem(del.id).then(() => { toast('success', 'Item dihapus.'); refreshMenus(); setDel(null); }).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal menghapus item.'));
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
  const { user, toast } = useApp();
  // Seeded from the public settings already in memory, then replaced by the admin read below.
  const [f, setF] = useState({
    hero: getSetting('about_hero_title'), sub: getSetting('about_hero_subtitle'), desc: getSetting('about_description'),
    vision: getSetting('about_vision'), mission: getSetting('about_mission'), history: getSetting('about_history'), video: getSetting('about_video'),
  });
  const [team, setTeam] = useState<TeamMember[]>(() => { try { return JSON.parse(getSetting('about_team', '[]')); } catch { return []; } });
  const [gallery, setGallery] = useState<string[]>(() => { try { return JSON.parse(getSetting('about_gallery', '[]')); } catch { return []; } });
  const [mediaFor, setMediaFor] = useState<'gallery' | number | null>(null);
  useEffect(() => { void api.adminSettings().then((remote) => {
    const value = (key: string) => remote[key] ?? '';
    setF({ hero: value('about_hero_title'), sub: value('about_hero_subtitle'), desc: value('about_description'), vision: value('about_vision'), mission: value('about_mission'), history: value('about_history'), video: value('about_video') });
    try { setTeam(JSON.parse(value('about_team'))); } catch { setTeam([]); }
    try { setGallery(JSON.parse(value('about_gallery'))); } catch { setGallery([]); }
  }).catch(() => undefined); }, []);
  if (!user) return null;

  const save = () => {
    const settings = {
      about_hero_title: f.hero, about_hero_subtitle: f.sub, about_description: f.desc,
      about_vision: f.vision, about_mission: f.mission, about_history: f.history, about_video: f.video,
      about_team: JSON.stringify(team), about_gallery: JSON.stringify(gallery),
    };
    void api.updateSettings(settings).then(() => { toast('success', 'Tentang Kami diperbarui — cek halaman /about.'); }).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal menyimpan Tentang Kami.'));
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
