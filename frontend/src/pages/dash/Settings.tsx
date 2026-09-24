import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { GatewayKey } from '../../lib/types';
import { fmtDateTime, downloadFile } from '../../lib/format';
import { getSetting, patchRemoteSettings } from '../../lib/settings';
import { api } from '../../lib/api';
import { useApp } from '../../state/store';
import { Icon } from '../../components/icons';
import { Badge, CopyButton, Field, MediaPicker, PageHeader, Select, TextArea, TextInput, Toggle } from '../../components/ui';
import { DashShell } from '../../components/Shell';
import { PagedTable, RemoteView, useRemote } from '../../components/remote';

/** Credentials live only in the server environment; this list only names them. */
const GATEWAY_INFO: Array<{ key: GatewayKey; name: string; env: string[] }> = [
  { key: 'tripay', name: 'Tripay', env: ['TRIPAY_API_KEY', 'TRIPAY_PRIVATE_KEY', 'TRIPAY_MERCHANT_CODE'] },
  { key: 'xendit', name: 'Xendit', env: ['XENDIT_API_KEY', 'XENDIT_CALLBACK_TOKEN'] },
  { key: 'stripe', name: 'Stripe', env: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] },
];

function Section({ title, children, delay = 0, id }: { title: string; children: React.ReactNode; delay?: number; id?: string }) {
  return (
    <div id={id} className="card p-6 anim-rise" style={{ animationDelay: `${delay}ms` }}>
      <h2 className="mb-4 font-display text-base font-bold text-base-900 dark:text-base-50">{title}</h2>
      {children}
    </div>
  );
}

/* ================= general ================= */

export function SettingsGeneral() {
  const { user, toast } = useApp();
  const [f, setF] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void api.adminSettings().then((remote) => setF(Object.fromEntries(Object.entries(remote).map(([key, value]) => [key, value ?? '']))))
      .catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal memuat pengaturan.')).finally(() => setLoading(false));
  }, []);
  const [logoPick, setLogoPick] = useState<'logo' | 'favicon' | null>(null);
  /* Keys actually rendered in the General form — only these are safe to persist */
  const WritableKeys = [
    'site_name','site_url','slogan','logo','favicon','footer_text',
    'email','phone','whatsapp','google_maps_api_key','address',
    'map_lat','map_lng','map_query',
    'social_facebook','social_instagram','social_youtube','social_tiktok',
    'seo_title','seo_description',
    'allow_registration','maintenance_mode',
    'platform_fee_percent','currency',
  ] as const;

  if (!user) return null;
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const save = () => {
    void Promise.all(WritableKeys.map((key) => api.updateSetting(key, String(f[key] ?? '')))).then(() => {
      patchRemoteSettings(Object.fromEntries(WritableKeys.map((key) => [key, String(f[key] ?? '')])));
      toast('success', 'Pengaturan disimpan.');
    }).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal menyimpan pengaturan.'));
  };
  return (
    <DashShell title="Pengaturan Umum">
      <PageHeader title="Pengaturan Umum" sub="Identitas website, kontak, lokasi, SEO, dan akses."
        actions={<button className="btn-primary" onClick={save} disabled={loading}><Icon name="check" size={15} /> Simpan</button>} />
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
                    <button className="btn-outline btn-sm" onClick={() => setLogoPick('logo')}>Pilih Logo</button>
                    {f.logo && <button className="btn-ghost btn-sm" onClick={() => set('logo', '')}>Hapus</button>}
                  </div>
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Favicon" hint="Ikon tab browser — langsung aktif setelah disimpan (PNG/SVG, disarankan persegi).">
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-base-200 dark:border-base-700 bg-base-100 dark:bg-base-850 overflow-hidden">
                      {f.favicon ? <img src={f.favicon} alt="favicon" className="h-8 w-8 object-contain" /> : <Icon name="globe" size={18} className="text-base-400" />}
                    </span>
                    <button className="btn-outline btn-sm" onClick={() => setLogoPick('favicon')}><Icon name="upload" size={12} /> Unggah / Ganti Favicon</button>
                    {f.favicon && <button className="btn-ghost btn-sm" onClick={() => set('favicon', '')}>Reset</button>}
                    {f.favicon && (
                      <span className="hidden sm:flex items-center gap-1.5 rounded-lg bg-base-100 dark:bg-base-850 border border-base-200 dark:border-base-700 px-2.5 py-1.5">
                        <img src={f.favicon} alt="" className="h-4 w-4 object-contain" />
                        <span className="font-mono text-[10px] text-base-400">pratinjau tab</span>
                      </span>
                    )}
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
      <MediaPicker open={!!logoPick} onClose={() => setLogoPick(null)} onPick={(url) => { if (logoPick) set(logoPick, url); setLogoPick(null); }} />
    </DashShell>
  );
}

/* ================= payment gateway ================= */

export function SettingsPayments() {
  const { user, toast } = useApp();
  const location = useLocation();
  const [active, setActive] = useState<GatewayKey>('tripay');
  const [mode, setMode] = useState<'sandbox' | 'live'>('sandbox');
  const [configured, setConfigured] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const gatewayFromQuery = new URLSearchParams(location.search).get('gateway') as GatewayKey | null;
    if (gatewayFromQuery && ['tripay', 'xendit', 'stripe'].includes(gatewayFromQuery)) {
      setActive(gatewayFromQuery);
    }
    void api.paymentSettings().then((remote) => {
      setActive((gatewayFromQuery && ['tripay', 'xendit', 'stripe'].includes(gatewayFromQuery) ? gatewayFromQuery : remote.gateway));
      setMode(remote.mode);
      setConfigured(remote.configured);
    }).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal memuat payment settings.'));
  }, [location.search]);
  if (!user) return null;
  const callbackUrl = `${getSetting('site_url') || window.location.origin}/api/v1/payments/webhook/${active}`;

  const save = () => {
    void api.updatePaymentSettings(active, mode).then(() => { toast('success', 'Mode payment gateway disimpan.'); }).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal menyimpan payment settings.'));
  };

  return (
    <DashShell title="Payment Gateway">
      <PageHeader title="Payment Gateway" sub="Arsitektur service: Tripay · Xendit · Stripe — credential dari konfigurasi aman, bukan hardcode."
        actions={<button className="btn-primary" onClick={save}><Icon name="check" size={15} /> Simpan</button>} />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {GATEWAY_INFO.map((g) => (
            <div key={g.key} className={`card p-5 transition-all ${active === g.key ? 'border-brand-500/60 shadow-[0_0_0_1px_var(--color-brand-500)]' : ''} anim-rise`}>
              <div className="flex items-center gap-3">
                <button onClick={() => setActive(g.key)} className={`flex h-5 w-5 items-center justify-center rounded-full border-2 cursor-pointer transition-colors ${active === g.key ? 'border-brand-500 bg-brand-500' : 'border-base-300 dark:border-base-600'}`}>
                  {active === g.key && <Icon name="check" size={11} className="text-base-950" />}
                </button>
                <div className="flex-1">
                  <p className="font-display text-base font-bold text-base-900 dark:text-base-50">{g.name}</p>
                  <p className="font-mono text-[10px] text-base-400">{g.env.join(' · ')}</p>
                </div>
                <Badge tone={configured[g.key] ? 'ok' : 'warn'}>{configured[g.key] ? 'Terkonfigurasi' : 'Belum dikonfigurasi'}</Badge>
                {active === g.key && <Badge tone="brand" dot>AKTIF</Badge>}
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
            <p className="mt-3 text-[11px] leading-4 text-base-400">Sandbox tidak menghubungi provider dan tidak memiliki simulator; webhook provider hanya diverifikasi dengan credential server. Gunakan Live untuk transaksi nyata.</p>
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

/* ================= integrations ================= */

export function SettingsIntegrations() {
  const { user, toast, t } = useApp();
  const location = useLocation();
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void api.adminSettings().then((remote) => setValues(Object.fromEntries(Object.entries(remote).map(([key, value]) => [key, value ?? '']))))
      .catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal memuat integrasi.')).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    const section = new URLSearchParams(location.search).get('section');
    if (!section) return;
    const target = document.getElementById(section);
    if (target) {
      setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    }
  }, [location.search]);
  if (!user) return null;
  const set = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const save = () => {
    void api.updateSettings({
      zoom_account_id: values.zoom_account_id ?? '',
      zoom_client_id: values.zoom_client_id ?? '',
      gmeet_default_url: values.gmeet_default_url ?? '',
      youtube_channel_url: values.youtube_channel_url ?? '',
    }).then(() => { toast('success', 'Integrasi berhasil disimpan.'); }).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal menyimpan integrasi.'));
  };
  return (
    <DashShell title={t('nav_integrations')}>
      <PageHeader title={t('nav_integrations')} sub="Status integrasi berdasarkan kode aktual. Integrasi berlabel “Belum aktif” hanya menyimpan konfigurasi dan belum dipakai sistem."
        actions={<button className="btn-primary" onClick={save} disabled={loading}><Icon name="check" size={15} /> Simpan Konfigurasi</button>} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Payment Gateway" id="payment">
          <Badge tone="ok">Aktif</Badge>
          <p className="mt-2 text-sm text-base-500">Tripay, Xendit, dan Stripe menggunakan credential server yang aman. Video lesson YouTube/Vimeo (embed) juga aktif.</p>
          <a href="#/dashboard/settings-payments" className="btn-outline mt-4 inline-flex"><Icon name="card" size={15} /> Kelola Payment Gateway</a>
        </Section>
        <Section title="Zoom Meeting" id="zoom" delay={60}>
          <Badge tone="warn">{t('not_active')}</Badge>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Account ID"><TextInput value={values.zoom_account_id ?? ''} onChange={(e) => set('zoom_account_id', e.target.value)} placeholder="Zoom Account ID" /></Field>
            <Field label="Client ID"><TextInput value={values.zoom_client_id ?? ''} onChange={(e) => set('zoom_client_id', e.target.value)} placeholder="Zoom OAuth Client ID" /></Field>
          </div>
          <p className="mt-3 text-[11px] text-base-400">Client Secret dan Webhook Secret tetap di `.env` server.</p>
        </Section>
        <Section title="Google Meet" id="gmeet" delay={120}>
          <Badge tone="warn">{t('not_active')}</Badge>
          <Field label="Link Meet Default" hint="Dapat diganti per kelas atau lesson."><TextInput value={values.gmeet_default_url ?? ''} onChange={(e) => set('gmeet_default_url', e.target.value)} placeholder="https://meet.google.com/..." /></Field>
        </Section>
        <Section title="YouTube Channel" id="youtube" delay={180}>
          <Badge tone="warn">{t('not_active')}</Badge>
          <Field label="Channel YouTube Default" hint="URL YouTube digunakan sebagai default konten video."><TextInput value={values.youtube_channel_url ?? ''} onChange={(e) => set('youtube_channel_url', e.target.value)} placeholder="https://www.youtube.com/@channel" /></Field>
        </Section>
      </div>
    </DashShell>
  );
}

/* ================= language ================= */

export function SettingsLanguage() {
  const { user, toast } = useApp();
  const [f, setF] = useState({ lang: getSetting('default_language', 'id'), tz: getSetting('timezone', 'Asia/Jakarta'), cur: getSetting('currency', 'IDR') });
  const [saving, setSaving] = useState(false);
  if (!user) return null;
  const save = () => {
    setSaving(true);
    const patch = { default_language: f.lang, timezone: f.tz, currency: f.cur };
    void api.updateSettings(patch).then(() => { patchRemoteSettings(patch); toast('success', 'Pengaturan wilayah disimpan.'); })
      .catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal menyimpan pengaturan wilayah.')).finally(() => setSaving(false));
  };
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
      <button className="btn-primary mt-5" disabled={saving} onClick={save}>
        <Icon name="check" size={15} /> Simpan
      </button>
    </DashShell>
  );
}

/* ================= system & audit ================= */

type AuditRow = { id: string; user_name: string | null; action: string; model: string; model_id: string | null; detail: string | null; ip: string | null; created_at: string | null };

export function SettingsSystem() {
  const { user, toast } = useApp();
  const [model, setModel] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [model]);
  const audit = useRemote(() => api.auditLogs({ page, model }), [page, model]);
  if (!user) return null;
  const backup = () => {
    void api.backup().then((data) => { downloadFile(`kmsit-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2)); toast('success', 'Backup diunduh tanpa credential dan hash password.'); })
      .catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal membuat backup.'));
  };

  return (
    <DashShell title="Sistem & Audit">
      <PageHeader title="Sistem & Audit Log" sub="Aktivitas penting tercatat di server: pembayaran, earning, withdrawal, anomali voucher/stok."
        actions={<>
          <Link to="/dashboard/operations" className="btn-outline"><Icon name="server" size={15} /> Status Operasional</Link>
          {user.roleKey === 'super_admin' && <button className="btn-outline" onClick={backup}><Icon name="download" size={15} /> Backup Database</button>}
        </>} />
      <RemoteView remote={audit}>
        {(data) => (
          <PagedTable<AuditRow> page={data.page} onPage={setPage} rowKey={(l) => l.id}
            toolbar={<Select value={model} onChange={(e) => setModel(e.target.value)} className="w-auto py-2 text-sm">
              <option value="">Semua Model</option>
              {data.models.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>}
            columns={[
              { key: 'time', label: 'Waktu', render: (l) => <span className="font-mono text-[10px] text-base-400">{fmtDateTime(l.created_at)}</span> },
              { key: 'user', label: 'User', render: (l) => <span className="text-sm font-bold text-base-800 dark:text-base-100">{l.user_name || 'system'}</span> },
              { key: 'action', label: 'Aksi', render: (l) => <Badge tone={l.action.includes('delete') || l.action.includes('reject') || l.action.includes('over_limit') || l.action.includes('shortage') ? 'danger' : l.action.includes('payment') || l.action.includes('withdrawal') ? 'accent' : 'neutral'}>{l.action}</Badge> },
              { key: 'model', label: 'Model', render: (l) => <span className="font-mono text-[11px]">{l.model}{l.model_id ? `#${l.model_id.slice(-5)}` : ''}</span> },
              { key: 'detail', label: 'Detail', render: (l) => <span className="text-xs text-base-500">{l.detail}</span> },
            ]} />
        )}
      </RemoteView>
    </DashShell>
  );
}
