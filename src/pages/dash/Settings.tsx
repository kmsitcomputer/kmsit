import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, type GatewayKey } from '../../lib/db';
import { getSetting, setSettings, audit, exportBackup, fmtDateTime, maskKey, downloadFile } from '../../lib/services';
import { GATEWAYS, saveGatewaySettings } from '../../lib/commerce';
import { useApp, useDB } from '../../state/store';
import { Icon } from '../../components/icons';
import { Badge, Confirm, CopyButton, DataTable, Field, MediaPicker, Modal, PageHeader, Select, StatCard, TextArea, TextInput, Toggle } from '../../components/ui';
import { DashShell } from '../../components/Shell';

function Section({ title, children, delay = 0 }: { title: string; children: React.ReactNode; delay?: number }) {
  return (
    <div className="card p-6 anim-rise" style={{ animationDelay: `${delay}ms` }}>
      <h2 className="mb-4 font-display text-base font-bold text-base-900 dark:text-base-50">{title}</h2>
      {children}
    </div>
  );
}

/* ================= general ================= */

export function SettingsGeneral() {
  useDB();
  const { user, toast } = useApp();
  const s = db.settings();
  const [f, setF] = useState({ ...s });
  const [logoPick, setLogoPick] = useState(false);
  if (!user) return null;
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const save = () => {
    setSettings(f);
    audit(user.id, user.name, 'update', 'settings', null, 'Memperbarui pengaturan umum');
    toast('success', 'Pengaturan disimpan.');
  };
  return (
    <DashShell title="Pengaturan Umum">
      <PageHeader title="Pengaturan Umum" sub="Identitas website, kontak, lokasi, SEO, dan akses."
        actions={<button className="btn-primary" onClick={save}><Icon name="check" size={15} /> Simpan</button>} />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Section title="Identitas Website">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nama Website" required><TextInput value={f.site_name ?? ''} onChange={(e) => set('site_name', e.target.value)} /></Field>
              <Field label="URL Website"><TextInput value={f.site_url ?? ''} onChange={(e) => set('site_url', e.target.value)} className="font-mono text-xs" /></Field>
              <div className="sm:col-span-2"><Field label="Slogan"><TextInput value={f.slogan ?? ''} onChange={(e) => set('slogan', e.target.value)} /></Field></div>
              <div className="sm:col-span-2">
                <Field label="Logo">
                  <div className="flex items-center gap-3">
                    {f.logo ? <img src={f.logo} alt="logo" className="h-12 w-12 rounded-xl object-cover border border-base-200 dark:border-base-700" /> : <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-base-100 dark:bg-base-850 text-base-400"><Icon name="image" size={18} /></span>}
                    <button className="btn-outline btn-sm" onClick={() => setLogoPick(true)}>Pilih Logo</button>
                    {f.logo && <button className="btn-ghost btn-sm" onClick={() => set('logo', '')}>Hapus</button>}
                  </div>
                </Field>
              </div>
              <div className="sm:col-span-2"><Field label="Teks Footer"><TextArea rows={2} value={f.footer_text ?? ''} onChange={(e) => set('footer_text', e.target.value)} /></Field></div>
            </div>
          </Section>
          <Section title="Kontak & Lokasi" delay={60}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email"><TextInput value={f.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
              <Field label="Telepon"><TextInput value={f.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></Field>
              <Field label="WhatsApp" hint="cth: 6281234567890"><TextInput value={f.whatsapp ?? ''} onChange={(e) => set('whatsapp', e.target.value)} className="font-mono text-xs" /></Field>
              <Field label="Google Maps API Key" hint="Opsional — tanpa key tetap pakai embed."><TextInput value={f.google_maps_api_key ?? ''} onChange={(e) => set('google_maps_api_key', e.target.value)} className="font-mono text-xs" /></Field>
              <div className="sm:col-span-2"><Field label="Alamat"><TextArea rows={2} value={f.address ?? ''} onChange={(e) => set('address', e.target.value)} /></Field></div>
              <Field label="Latitude"><TextInput value={f.map_lat ?? ''} onChange={(e) => set('map_lat', e.target.value)} className="font-mono text-xs" /></Field>
              <Field label="Longitude"><TextInput value={f.map_lng ?? ''} onChange={(e) => set('map_lng', e.target.value)} className="font-mono text-xs" /></Field>
              <div className="sm:col-span-2"><Field label="Query Peta" hint="Dipakai sebagai titik peta jika diisi."><TextInput value={f.map_query ?? ''} onChange={(e) => set('map_query', e.target.value)} /></Field></div>
            </div>
          </Section>
        </div>
        <div className="space-y-5">
          <Section title="Media Sosial" delay={40}>
            <div className="grid gap-4">
              {([['social_facebook', 'Facebook', 'facebook'], ['social_instagram', 'Instagram', 'instagram'], ['social_youtube', 'YouTube', 'youtube'], ['social_tiktok', 'TikTok', 'tiktok']] as const).map(([k, l, ic]) => (
                <Field key={k} label={l}><div className="flex items-center gap-2"><Icon name={ic} size={16} className="text-base-400 shrink-0" /><TextInput value={f[k] ?? ''} onChange={(e) => set(k, e.target.value)} placeholder="https://…" className="font-mono text-xs" /></div></Field>
              ))}
            </div>
          </Section>
          <Section title="SEO Default" delay={80}>
            <div className="grid gap-4">
              <Field label="Meta Title"><TextInput value={f.seo_title ?? ''} onChange={(e) => set('seo_title', e.target.value)} /></Field>
              <Field label="Meta Description"><TextArea rows={2} value={f.seo_description ?? ''} onChange={(e) => set('seo_description', e.target.value)} /></Field>
            </div>
          </Section>
          <Section title="Akses & Ekonomi" delay={120}>
            <div className="space-y-4">
              <Toggle checked={f.allow_registration === '1'} onChange={(v) => set('allow_registration', v ? '1' : '0')} label="Izinkan pendaftaran publik (register)" />
              <Toggle checked={f.maintenance_mode === '1'} onChange={(v) => set('maintenance_mode', v ? '1' : '0')} label="Maintenance mode (publik dikunci, admin tetap masuk)" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Fee Platform (%)" hint="Potongan per penjualan kelas berbayar."><TextInput type="number" min={0} max={100} value={f.platform_fee_percent ?? '15'} onChange={(e) => set('platform_fee_percent', e.target.value)} /></Field>
                <Field label="Mata Uang"><Select value={f.currency ?? 'IDR'} onChange={(e) => set('currency', e.target.value)}><option value="IDR">IDR</option><option value="USD">USD</option></Select></Field>
              </div>
            </div>
          </Section>
        </div>
      </div>
      <MediaPicker open={logoPick} onClose={() => setLogoPick(false)} onPick={(url) => { set('logo', url); setLogoPick(false); }} />
    </DashShell>
  );
}

/* ================= payment gateway ================= */

export function SettingsPayments() {
  useDB();
  const { user, toast } = useApp();
  const s = db.settings();
  const [active, setActive] = useState<GatewayKey>((s.gateway_active as GatewayKey) ?? 'tripay');
  const [mode, setMode] = useState<'sandbox' | 'live'>(s.gateway_mode === 'live' ? 'live' : 'sandbox');
  const [keys, setKeys] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    GATEWAYS.forEach((g) => g.keyFields.forEach((kf) => { out[kf.key] = s[kf.key] ?? ''; }));
    return out;
  });
  const [show, setShow] = useState<Record<string, boolean>>({});
  if (!user) return null;
  const callbackUrl = `${s.site_url || window.location.origin}/api/v1/payments/callback`;

  const save = () => {
    saveGatewaySettings({ gateway_active: active, gateway_mode: mode, ...keys });
    audit(user.id, user.name, 'update', 'settings', null, `Gateway aktif: ${active} (${mode})`);
    toast('success', 'Konfigurasi payment gateway disimpan.');
  };

  return (
    <DashShell title="Payment Gateway">
      <PageHeader title="Payment Gateway" sub="Arsitektur service: Tripay · Xendit · Stripe — credential dari konfigurasi aman, bukan hardcode."
        actions={<button className="btn-primary" onClick={save}><Icon name="check" size={15} /> Simpan</button>} />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {GATEWAYS.map((g) => (
            <div key={g.key} className={`card p-5 transition-all ${active === g.key ? 'border-brand-500/60 shadow-[0_0_0_1px_var(--color-brand-500)]' : ''} anim-rise`}>
              <div className="flex items-center gap-3">
                <button onClick={() => setActive(g.key)} className={`flex h-5 w-5 items-center justify-center rounded-full border-2 cursor-pointer transition-colors ${active === g.key ? 'border-brand-500 bg-brand-500' : 'border-base-300 dark:border-base-600'}`}>
                  {active === g.key && <Icon name="check" size={11} className="text-base-950" />}
                </button>
                <div className="flex-1">
                  <p className="font-display text-base font-bold text-base-900 dark:text-base-50">{g.name}</p>
                  <p className="font-mono text-[10px] text-base-400">{g.methods.map((m) => m.label).join(' · ')}</p>
                </div>
                {active === g.key && <Badge tone="brand" dot>AKTIF</Badge>}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {g.keyFields.map((kf) => (
                  <Field key={kf.key} label={kf.label}>
                    <div className="relative">
                      <TextInput type={show[kf.key] ? 'text' : 'password'} value={keys[kf.key]} onChange={(e) => setKeys({ ...keys, [kf.key]: e.target.value })}
                        placeholder={maskKey(s[kf.key] ?? '')} className="pr-10 font-mono text-xs" />
                      <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-base-400 hover:text-base-700 dark:hover:text-base-200 cursor-pointer" onClick={() => setShow({ ...show, [kf.key]: !show[kf.key] })}>
                        <Icon name={show[kf.key] ? 'eye-off' : 'eye'} size={14} />
                      </button>
                    </div>
                  </Field>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <Section title="Mode">
            <div className="grid grid-cols-2 gap-2">
              {(['sandbox', 'live'] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)} className={`rounded-xl border-2 px-3 py-3 text-sm font-bold uppercase font-mono transition-all cursor-pointer ${mode === m ? (m === 'sandbox' ? 'border-warn-400 bg-warn-400/10 text-accent-500' : 'border-ok-500 bg-ok-500/10 text-ok-500') : 'border-base-200 dark:border-base-700 text-base-400'}`}>
                  {m}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-4 text-base-400">Sandbox memakai simulator gateway lokal dengan signature & webhook yang sama seperti production.</p>
          </Section>
          <Section title="Callback / Webhook" delay={60}>
            <p className="mb-2 text-[11px] text-base-400">Daftarkan URL ini di dashboard gateway:</p>
            <div className="rounded-lg bg-base-100 dark:bg-base-850 p-3 font-mono text-[11px] break-all text-base-600 dark:text-base-300">{callbackUrl}</div>
            <div className="mt-2"><CopyButton text={callbackUrl} label="Salin URL" /></div>
            <ul className="mt-3 space-y-1.5 text-[11px] text-base-400">
              <li className="flex gap-1.5"><Icon name="shield" size={12} className="text-brand-500 shrink-0 mt-0.5" /> Signature diverifikasi (HMAC equivalent)</li>
              <li className="flex gap-1.5"><Icon name="refresh" size={12} className="text-brand-500 shrink-0 mt-0.5" /> Idempotency: duplikat webhook diabaikan</li>
              <li className="flex gap-1.5"><Icon name="check-circle" size={12} className="text-brand-500 shrink-0 mt-0.5" /> Enrollment & wallet hanya diproses saat status PAID valid</li>
            </ul>
          </Section>
        </div>
      </div>
    </DashShell>
  );
}

/* ================= language ================= */

export function SettingsLanguage() {
  useDB();
  const { user, toast } = useApp();
  const s = db.settings();
  const [f, setF] = useState({ lang: s.default_language ?? 'id', tz: s.timezone ?? 'Asia/Jakarta', cur: s.currency ?? 'IDR' });
  if (!user) return null;
  return (
    <DashShell title="Bahasa & Wilayah">
      <PageHeader title="Bahasa & Wilayah" sub="Arsitektur translation Laravel-style: tambah bahasa = tambah kamus." />
      <div className="grid gap-5 lg:grid-cols-3">
        <Section title="Bahasa Default">
          <div className="grid grid-cols-2 gap-2">
            {([{ k: 'id', l: 'Bahasa Indonesia' }, { k: 'en', l: 'English' }] as const).map((o) => (
              <button key={o.k} onClick={() => setF({ ...f, lang: o.k })} className={`rounded-xl border-2 px-3 py-4 text-sm font-bold transition-all cursor-pointer ${f.lang === o.k ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400' : 'border-base-200 dark:border-base-700 text-base-400'}`}>{o.l}</button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-base-400">User tetap bisa mengganti bahasa dari topbar (preferensi tersimpan aman di sisi client).</p>
        </Section>
        <Section title="Zona Waktu" delay={60}>
          <Select value={f.tz} onChange={(e) => setF({ ...f, tz: e.target.value })}>
            {['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'Asia/Singapore', 'UTC'].map((z) => <option key={z} value={z}>{z}</option>)}
          </Select>
        </Section>
        <Section title="Mata Uang" delay={120}>
          <Select value={f.cur} onChange={(e) => setF({ ...f, cur: e.target.value })}>
            <option value="IDR">IDR — Rupiah Indonesia</option><option value="USD">USD — US Dollar</option>
          </Select>
        </Section>
      </div>
      <button className="btn-primary mt-5" onClick={() => { setSettings({ default_language: f.lang, timezone: f.tz, currency: f.cur }); toast('success', 'Pengaturan wilayah disimpan.'); }}>
        <Icon name="check" size={15} /> Simpan
      </button>
    </DashShell>
  );
}

/* ================= system & audit ================= */

export function SettingsSystem() {
  useDB();
  const { user, toast } = useApp();
  const nav = useNavigate();
  const [model, setModel] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [resetText, setResetText] = useState('');
  if (!user) return null;
  const logs = db.all('auditLogs').slice().reverse().filter((l) => !model || l.model === model);
  const models = [...new Set(db.all('auditLogs').map((l) => l.model))];
  const meta = db.meta();

  return (
    <DashShell title="Sistem & Audit">
      <PageHeader title="Sistem & Audit Log" sub="Aktivitas penting tercatat: login, CRUD, pembayaran, approval, withdrawal." />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon="shield" label="Status Instalasi" value="Terkunci" sub={meta.installedAt ? `sejak ${fmtDateTime(meta.installedAt)}` : ''} tone="ok" delay={0} />
        <StatCard icon="key" label="APP_KEY" value={<span className="font-mono text-sm">{maskKey(meta.appKey)}</span>} sub="disimpan di .env" tone="info" delay={50} />
        <StatCard icon="server" label="Database" value="MySQL" sub="adapter relational" tone="brand" delay={100} />
        <StatCard icon="file" label="Audit Log" value={db.count('auditLogs')} sub="entri tercatat" tone="accent" delay={150} />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={model} onChange={(e) => setModel(e.target.value)} className="w-auto">
          <option value="">Semua Model</option>
          {models.map((m) => <option key={m} value={m}>{m}</option>)}
        </Select>
        <button className="btn-outline" onClick={() => { exportBackup(); toast('success', 'Backup diunduh (tanpa credential & hash password).'); }}><Icon name="download" size={15} /> Backup Database</button>
        <button className="btn-outline" onClick={() => { downloadFile('kmsit_computer.sql', '-- KMSIT Computer schema export\n-- Struktur lengkap tersedia di database/migrations (Laravel) — lihat README.md\nSELECT "schema managed by migrations" AS info;\n', 'text/plain'); toast('success', 'File SQL diunduh.'); }}><Icon name="database" size={15} /> Skema SQL</button>
      </div>
      <DataTable rows={logs} pageSize={10} searchKeys={(l) => `${l.userName} ${l.action} ${l.model} ${l.detail}`}
        emptyTitle="Belum ada log" emptySub="Aktivitas akan tercatat otomatis."
        columns={[
          { key: 'time', label: 'Waktu', render: (l) => <span className="font-mono text-[10px] text-base-400">{fmtDateTime(l.createdAt)}</span> },
          { key: 'user', label: 'User', render: (l) => <span className="text-sm font-bold text-base-800 dark:text-base-100">{l.userName || 'system'}</span> },
          { key: 'action', label: 'Aksi', render: (l) => <Badge tone={l.action === 'delete' || l.action === 'reject' ? 'danger' : l.action === 'create' ? 'ok' : l.action.includes('payment') ? 'accent' : 'neutral'}>{l.action}</Badge> },
          { key: 'model', label: 'Model', render: (l) => <span className="font-mono text-[11px]">{l.model}{l.modelId ? `#${l.modelId.slice(-5)}` : ''}</span> },
          { key: 'detail', label: 'Detail', render: (l) => <span className="text-xs text-base-500">{l.detail}</span> },
          { key: 'ip', label: 'IP', render: (l) => <span className="font-mono text-[10px] text-base-400">{l.ip}</span> },
        ]} />
      <div className="mt-6 card border-danger-500/30 p-6 anim-rise">
        <h2 className="font-display text-base font-bold text-danger-500">Danger Zone</h2>
        <p className="mt-1 text-sm text-base-500">Reset menghapus SELURUH database aplikasi dan mengembalikan installer. Super Admin & semua data hilang.</p>
        <button className="btn-danger mt-4" onClick={() => { setResetOpen(true); setResetText(''); }}><Icon name="alert-triangle" size={15} /> Reset Aplikasi</button>
      </div>
      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="Reset Aplikasi" footer={
        <><button className="btn-ghost" onClick={() => setResetOpen(false)}>Batal</button>
          <button className="btn-danger" disabled={resetText !== 'RESET'} onClick={() => { db.resetAll(); localStorage.removeItem('kmsit_session_token'); nav('/install'); }}>
            <Icon name="trash" size={14} /> Hapus Semua & Kembali ke Installer
          </button></>
      }>
        <p className="text-sm text-base-500">Ketik <b className="font-mono text-danger-500">RESET</b> untuk konfirmasi. Tindakan ini tidak dapat dibatalkan.</p>
        <TextInput className="mt-3 font-mono" value={resetText} onChange={(e) => setResetText(e.target.value)} placeholder="RESET" />
      </Modal>
    </DashShell>
  );
}
