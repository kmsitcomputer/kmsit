import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { DeliveryMethod, LocalDeliveryConfig, LocalDeliveryQuote, RegionRef, ShippingOption, ShippingQuote } from '../lib/types';
import { Field, Select, TextArea, TextInput } from './ui';
import { fmtMoney } from '../lib/format';
import { MapsPicker } from './MapsPicker';

export interface ShippingFormValue {
  name: string; phone: string;
  province_id: string; city_id: string; district_id: string; subdistrict_id: string;
  postal_code: string; address: string; note: string;
  courier: string; service: string;
  delivery_method: DeliveryMethod;
  local_latitude: number | null; local_longitude: number | null;
}

export const EMPTY_SHIPPING: ShippingFormValue = {
  name: '', phone: '', province_id: '', city_id: '', district_id: '', subdistrict_id: '',
  postal_code: '', address: '', note: '', courier: '', service: '',
  delivery_method: 'expedition', local_latitude: null, local_longitude: null,
};

/**
 * Cascading region form + shipping quote (IMP-004). Region data always comes
 * from the KMS backend (never hardcoded, never direct-to-provider). Changing a
 * parent clears all children, the postal code assist, the quote and the
 * selected courier/service.
 */
export function ShippingForm({ value, onChange, compact, cartSignature }: {
  value: ShippingFormValue; onChange: (v: ShippingFormValue) => void; compact?: boolean;
  /** Deterministic physical-cart signature; when it changes the quote + selection are cleared. */
  cartSignature?: string;
}) {
  const [provinces, setProvinces] = useState<RegionRef[]>([]);
  const [cities, setCities] = useState<RegionRef[]>([]);
  const [districts, setDistricts] = useState<RegionRef[]>([]);
  const [subdistricts, setSubdistricts] = useState<RegionRef[]>([]);
  const [loading, setLoading] = useState<'provinces' | 'cities' | 'districts' | 'subdistricts' | null>(null);
  const [error, setError] = useState('');
  const [quote, setQuote] = useState<ShippingQuote | null>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [search, setSearch] = useState({ city: '', district: '', subdistrict: '' });
  const [localConfig, setLocalConfig] = useState<LocalDeliveryConfig | null>(null);
  const [localQuote, setLocalQuote] = useState<LocalDeliveryQuote | null>(null);
  const [localBusy, setLocalBusy] = useState(false);
  const [localError, setLocalError] = useState('');

  const set = (patch: Partial<ShippingFormValue>) => onChange({ ...value, ...patch });
  const isLocal = value.delivery_method === 'local_delivery';

  useEffect(() => {
    api.localDeliveryConfig().then(setLocalConfig).catch(() => setLocalConfig(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoading('provinces');
    api.shippingProvinces().then(setProvinces).catch(() => setError('Gagal memuat provinsi. Coba lagi.')).finally(() => setLoading(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCities([]); setDistricts([]); setSubdistricts([]);
    setQuote(null); setQuoteError('');
    setSearch({ city: '', district: '', subdistrict: '' });
    if (!value.province_id) return;
    setLoading('cities');
    api.shippingCities(value.province_id).then(setCities).catch(() => setError('Gagal memuat kabupaten/kota. Coba lagi.')).finally(() => setLoading(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.province_id]);

  useEffect(() => {
    setDistricts([]); setSubdistricts([]);
    setQuote(null); setQuoteError('');
    setSearch((s) => ({ ...s, district: '', subdistrict: '' }));
    if (!value.city_id) return;
    setLoading('districts');
    api.shippingDistricts(value.city_id).then(setDistricts).catch(() => setError('Gagal memuat kecamatan. Coba lagi.')).finally(() => setLoading(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.city_id]);

  useEffect(() => {
    setSubdistricts([]);
    setQuote(null); setQuoteError('');
    setSearch((s) => ({ ...s, subdistrict: '' }));
    if (!value.district_id) return;
    setLoading('subdistricts');
    api.shippingSubdistricts(value.district_id).then(setSubdistricts).catch(() => setError('Gagal memuat kelurahan/desa. Coba lagi.')).finally(() => setLoading(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.district_id]);

  useEffect(() => {
    setQuote(null); setQuoteError('');
    const found = subdistricts.find((s) => String(s.id) === String(value.subdistrict_id));
    if (found?.zip_code && found.zip_code !== '0') set({ postal_code: found.zip_code });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.subdistrict_id]);

  // Physical cart changes (add/remove/qty/variant) invalidate the old quote:
  // the selected courier/service must be re-quoted, never trusted stale.
  // Skipped on mount so an existing selection is not cleared before any change.
  const seenSignature = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (seenSignature.current === undefined) { seenSignature.current = cartSignature; return; }
    if (seenSignature.current === cartSignature) return;
    seenSignature.current = cartSignature;
    setQuote(null); setQuoteError('');
    set({ courier: '', service: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartSignature]);

  const filter = (rows: RegionRef[], q: string) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(needle));
  };
  const visibleCities = useMemo(() => filter(cities, search.city), [cities, search.city]);
  const visibleDistricts = useMemo(() => filter(districts, search.district), [districts, search.district]);
  const visibleSubdistricts = useMemo(() => filter(subdistricts, search.subdistrict), [subdistricts, search.subdistrict]);

  const refreshQuote = () => {
    if (!value.province_id || !value.city_id || !value.district_id || !value.subdistrict_id) return;
    setQuoteBusy(true); setQuoteError('');
    api.shippingQuote({ province_id: value.province_id, city_id: value.city_id, district_id: value.district_id, subdistrict_id: value.subdistrict_id })
      .then((q) => { setQuote(q); if (q.services.length === 0) setQuoteError('Tidak ada layanan tersedia untuk tujuan ini.'); })
      .catch((e) => setQuoteError(e instanceof Error ? e.message : 'Gagal menghitung ongkir. Coba lagi.'))
      .finally(() => setQuoteBusy(false));
  };

  const refreshLocalQuote = () => {
    if (value.local_latitude == null || value.local_longitude == null) return;
    setLocalBusy(true); setLocalError('');
    api.localDeliveryQuote({ latitude: value.local_latitude, longitude: value.local_longitude })
      .then(setLocalQuote)
      .catch((e) => { setLocalQuote(null); setLocalError(e instanceof Error ? e.message : 'Gagal menghitung ongkir. Coba lagi.'); })
      .finally(() => setLocalBusy(false));
  };

  const selected: ShippingOption | null = quote?.services.find((s) => s.courier === value.courier && s.service === value.service) ?? null;

  const opt = (v: string, label: string) => <option key={v || label} value={v}>{label}</option>;
  const inputCls = compact ? 'input py-2 text-xs' : 'input';

  return (
    <div className="space-y-2.5">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Field label="Nama Penerima" required>
          <TextInput value={value.name} onChange={(e) => set({ name: e.target.value })} placeholder="Nama penerima" className={compact ? 'py-2 text-xs' : ''} />
        </Field>
        <Field label="No. HP" required>
          <TextInput value={value.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="08…" className={compact ? 'py-2 text-xs font-mono' : 'font-mono'} />
        </Field>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => set({ delivery_method: 'expedition', local_latitude: null, local_longitude: null })}
          className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-all cursor-pointer ${!isLocal ? 'bg-base-900 dark:bg-base-50 text-base-50 dark:text-base-950' : 'bg-base-100 dark:bg-base-850 text-base-500'}`}>
          Ekspedisi (RajaOngkir)
        </button>
        <button type="button" disabled={!localConfig?.enabled} title={localConfig?.enabled ? 'Antar langsung dari toko' : 'Local Delivery belum tersedia'}
          onClick={() => set({ delivery_method: 'local_delivery', courier: '', service: '' })}
          className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-all ${isLocal ? 'bg-base-900 dark:bg-base-50 text-base-50 dark:text-base-950' : 'bg-base-100 dark:bg-base-850 text-base-500'} disabled:opacity-40 disabled:cursor-not-allowed`}>
          Local Delivery{localConfig?.store_name ? ` · ${localConfig.store_name}` : ''}
        </button>
      </div>
      {isLocal ? (
        <div className="space-y-2.5">
          <MapsPicker compact latitude={value.local_latitude} longitude={value.local_longitude}
            onChange={(lat, lng) => { set({ local_latitude: lat, local_longitude: lng }); setLocalQuote(null); setLocalError(''); }} />
          <div className="rounded-xl border border-base-200 dark:border-base-800 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="label !mb-0">Ongkir Local Delivery</p>
              <button className="btn-outline btn-sm" disabled={value.local_latitude == null || value.local_longitude == null || localBusy} onClick={refreshLocalQuote}>
                {localBusy ? 'Menghitung…' : localQuote ? 'Hitung ulang' : 'Cek ongkir'}
              </button>
            </div>
            {localError && <p className="mt-2 text-[11px] font-semibold text-danger-500">{localError}</p>}
            {localQuote && (
              <div className="mt-2 rounded-lg bg-brand-500/10 border border-brand-500/30 px-3 py-2 text-xs font-bold text-brand-700 dark:text-brand-300">
                Jarak rute {localQuote.actual_km.toFixed(2)} km · {fmtMoney(localQuote.shipping_cost)}
                <span className="block mt-0.5 font-normal text-[11px] opacity-80">Dihitung server dari rute aktual — diverifikasi ulang saat checkout.</span>
              </div>
            )}
          </div>
        </div>
      ) : (
      <>
      <Field label="Provinsi" required>
        <Select value={value.province_id} disabled={loading === 'provinces'} className={compact ? 'py-2 text-xs' : ''}
          onChange={(e) => set({ province_id: e.target.value, city_id: '', district_id: '', subdistrict_id: '', postal_code: '', courier: '', service: '' })}>
          {opt('', loading === 'provinces' ? 'Memuat provinsi…' : 'Pilih provinsi')}
          {provinces.map((p) => opt(p.id, p.name))}
        </Select>
      </Field>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Field label="Kabupaten/Kota" required>
          <TextInput value={search.city} onChange={(e) => setSearch({ ...search, city: e.target.value })} placeholder="Cari kabupaten/kota…" disabled={!value.province_id} className={compact ? 'py-2 text-xs' : ''} />
          <Select value={value.city_id} disabled={!value.province_id || loading === 'cities'} className={`${compact ? 'py-2 text-xs' : ''} mt-2`}
            onChange={(e) => set({ city_id: e.target.value, district_id: '', subdistrict_id: '', postal_code: '', courier: '', service: '' })}>
            {opt('', !value.province_id ? 'Pilih provinsi terlebih dahulu' : loading === 'cities' ? 'Memuat kabupaten/kota…' : 'Pilih kabupaten/kota')}
            {visibleCities.map((c) => opt(c.id, c.name))}
          </Select>
        </Field>
        <Field label="Kecamatan" required>
          <TextInput value={search.district} onChange={(e) => setSearch({ ...search, district: e.target.value })} placeholder="Cari kecamatan…" disabled={!value.city_id} className={compact ? 'py-2 text-xs' : ''} />
          <Select value={value.district_id} disabled={!value.city_id || loading === 'districts'} className={`${compact ? 'py-2 text-xs' : ''} mt-2`}
            onChange={(e) => set({ district_id: e.target.value, subdistrict_id: '', postal_code: '', courier: '', service: '' })}>
            {opt('', !value.city_id ? 'Pilih kabupaten/kota terlebih dahulu' : loading === 'districts' ? 'Memuat kecamatan…' : 'Pilih kecamatan')}
            {visibleDistricts.map((d) => opt(d.id, d.name))}
          </Select>
        </Field>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Field label="Kelurahan/Desa" required>
          <TextInput value={search.subdistrict} onChange={(e) => setSearch({ ...search, subdistrict: e.target.value })} placeholder="Cari kelurahan/desa…" disabled={!value.district_id} className={compact ? 'py-2 text-xs' : ''} />
          <Select value={value.subdistrict_id} disabled={!value.district_id || loading === 'subdistricts'} className={`${compact ? 'py-2 text-xs' : ''} mt-2`}
            onChange={(e) => set({ subdistrict_id: e.target.value, postal_code: '', courier: '', service: '' })}>
            {opt('', !value.district_id ? 'Pilih kecamatan terlebih dahulu' : loading === 'subdistricts' ? 'Memuat kelurahan/desa…' : 'Pilih kelurahan/desa')}
            {visibleSubdistricts.map((s) => opt(s.id, s.name))}
          </Select>
        </Field>
        <Field label="Kode Pos" required>
          <TextInput value={value.postal_code} onChange={(e) => set({ postal_code: e.target.value })} placeholder="Otomatis dari kelurahan/desa" className={compact ? 'py-2 text-xs font-mono' : 'font-mono'} />
        </Field>
      </div>
      <Field label="Alamat Lengkap" required>
        <TextArea value={value.address} onChange={(e) => set({ address: e.target.value })} placeholder="Jalan, nomor rumah, patokan…" rows={2} className={compact ? 'py-2 text-xs' : ''} />
      </Field>
      <Field label="Catatan Kurir (opsional)">
        <TextInput value={value.note} onChange={(e) => set({ note: e.target.value })} placeholder="Contoh: titip di satpam" className={compact ? 'py-2 text-xs' : ''} />
      </Field>
      {error && <p className="text-[11px] font-semibold text-danger-500">{error} <button className="underline cursor-pointer" onClick={() => window.location.reload()}>Muat ulang</button></p>}

      <div className="rounded-xl border border-base-200 dark:border-base-800 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="label !mb-0">Opsi Pengiriman</p>
          <button className="btn-outline btn-sm" disabled={!value.subdistrict_id || quoteBusy} onClick={refreshQuote}>
            {quoteBusy ? 'Menghitung…' : quote ? 'Hitung ulang' : 'Cek ongkir'}
          </button>
        </div>
        {quoteError && <p className="mt-2 text-[11px] font-semibold text-danger-500">{quoteError}</p>}
        {quote && quote.services.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {quote.services.map((s) => (
              <button key={`${s.courier}:${s.service}`} onClick={() => set({ courier: s.courier, service: s.service })}
                className={`flex w-full items-center gap-3 rounded-lg border-2 px-3 py-2 text-left transition-all cursor-pointer ${selected?.courier === s.courier && selected?.service === s.service ? 'border-brand-500 bg-brand-500/10' : 'border-base-200 dark:border-base-700 hover:border-brand-500/50'}`}>
                <span className="flex-1">
                  <span className="block text-xs font-bold text-base-800 dark:text-base-100">{s.courier_name} · {s.service}</span>
                  <span className="block text-[11px] text-base-400">{s.description}{s.etd ? ` · Estimasi ${s.etd}` : ''}</span>
                </span>
                <span className="font-display text-sm font-bold text-base-900 dark:text-base-50">{fmtMoney(s.cost)}</span>
              </button>
            ))}
            <p className="text-[11px] text-base-400">Berat paket: {(quote.weight_grams / 1000).toFixed(1)} kg · Ongkir dihitung server dan diverifikasi ulang saat checkout.</p>
          </div>
        )}
      </div>
      {selected && (
        <p className="rounded-lg bg-brand-500/10 border border-brand-500/30 px-3 py-2 text-xs font-bold text-brand-700 dark:text-brand-300">
          {selected.courier_name} {selected.service} · {fmtMoney(selected.cost)}{selected.etd ? ` · ${selected.etd}` : ''}
        </p>
      )}
      </>
      )}
    </div>
  );
}
