import { useEffect, useState } from 'react';
import { fmtMoney, fmtDate } from '../../lib/format';
import { api, type ApiVoucher } from '../../lib/api';
import { useApp } from '../../state/store';
import { Icon } from '../../components/icons';
import { Badge, Confirm, Field, IconButton, Modal, PageHeader, Select, StatCard, Tabs, TextArea, TextInput, Toggle } from '../../components/ui';
import { DashShell } from '../../components/Shell';
import { PagedTable, RemoteView, useRemote } from '../../components/remote';

const nowIso = () => new Date().toISOString();

export default function VouchersPage() {
  const { user, toast } = useApp();
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<ApiVoucher | 'new' | null>(null);
  const [del, setDel] = useState<ApiVoucher | null>(null);
  const [f, setF] = useState({ code: '', type: 'percent' as ApiVoucher['type'], value: 10, minOrder: 0, maxDiscount: 0, usageLimit: 0, expiresAt: '', active: true, note: '' });
  const [err, setErr] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [filter]);
  const vouchers = useRemote(() => api.adminVouchers({ page, state: filter }), [page, filter, user?.id]);

  const refresh = vouchers.reload;

  if (!user) return null;


  const open = (v: ApiVoucher | 'new') => {
    setErr('');
    if (v === 'new') setF({ code: '', type: 'percent', value: 10, minOrder: 0, maxDiscount: 0, usageLimit: 0, expiresAt: '', active: true, note: '' });
    else setF({
      code: v.code, type: v.type, value: v.value, minOrder: v.min_order, maxDiscount: v.max_discount,
      usageLimit: v.usage_limit, expiresAt: v.expires_at ? v.expires_at.slice(0, 10) : '', active: v.active, note: v.note ?? '',
    });
    setEditing(v);
  };

  const save = () => {
    const payload = {
      code: f.code.trim().toUpperCase(), type: f.type, value: Number(f.value) || 0, min_order: Number(f.minOrder) || 0,
      max_discount: Number(f.maxDiscount) || 0, usage_limit: Number(f.usageLimit) || 0,
      expires_at: f.expiresAt || null, active: f.active, note: f.note.trim() || null,
    };
    setErr('');
    if (editing === 'new') {
      void api.createVoucher(payload).then(() => {
        toast('success', `Voucher ${payload.code} dibuat.`);
        setEditing(null);
        refresh();
      }).catch((error) => setErr(error instanceof Error ? error.message : 'Gagal membuat voucher.'));
    } else if (editing) {
      void api.updateVoucher(editing.id, payload).then(() => {
        toast('success', 'Voucher diperbarui.');
        setEditing(null);
        refresh();
      }).catch((error) => setErr(error instanceof Error ? error.message : 'Gagal memperbarui voucher.'));
    }
  };

  const toggleActive = (v: ApiVoucher, val: boolean) => {
    void api.updateVoucher(v.id, {
      code: v.code, type: v.type, value: v.value, min_order: v.min_order, max_discount: v.max_discount,
      usage_limit: v.usage_limit, expires_at: v.expires_at, active: val, note: v.note,
    }).then(() => {
      toast('success', `Voucher ${val ? 'diaktifkan' : 'dinonaktifkan'}.`);
      refresh();
    }).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal memperbarui status voucher.'));
  };

  const summary = vouchers.data?.summary;

  return (
    <DashShell title="Voucher">
      <PageHeader title="Voucher & Kode Diskon" sub="Berlaku untuk checkout produk di toko — validasi & perhitungan diskon di backend."
        actions={<button className="btn-primary" onClick={() => open('new')}><Icon name="plus" size={15} /> Buat Voucher</button>} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon="tag" label="Total Voucher" value={summary?.total ?? '—'} delay={0} />
        <StatCard icon="check-circle" label="Aktif" value={summary?.active ?? '—'} tone="ok" delay={50} />
        <StatCard icon="cart" label="Dipakai" value={summary ? `${summary.used}x` : '—'} tone="info" delay={100} />
        <StatCard icon="clock" label="Kadaluarsa" value={summary?.expired ?? '—'} tone="warn" delay={150} />
      </div>
      <div className="mb-4"><Tabs tabs={[{ key: '', label: 'Semua' }, { key: 'active', label: 'Aktif' }, { key: 'inactive', label: 'Nonaktif' }, { key: 'expired', label: 'Kadaluarsa' }]} active={filter} onChange={setFilter} /></div>
      <RemoteView remote={vouchers} isEmpty={(d) => d.page.total === 0 && !filter} emptyTitle="Belum ada voucher" emptySub="Buat kode diskon untuk pelanggan tokomu.">
        {(data) => <PagedTable<ApiVoucher> page={data.page} onPage={setPage} rowKey={(v) => v.id}
        columns={[
          { key: 'code', label: 'Kode', render: (v: ApiVoucher) => <span className="font-mono text-sm font-bold text-brand-600 dark:text-brand-400">{v.code}</span> },
          { key: 'value', label: 'Diskon', render: (v: ApiVoucher) => (
            <div>
              <span className="font-display text-sm font-bold">{v.type === 'percent' ? `${v.value}%` : fmtMoney(v.value)}</span>
              {v.max_discount > 0 && <span className="ml-1.5 font-mono text-[10px] text-base-400">maks {fmtMoney(v.max_discount)}</span>}
              {v.min_order > 0 && <p className="font-mono text-[10px] text-base-400">min. belanja {fmtMoney(v.min_order)}</p>}
            </div>
          )},
          { key: 'usage', label: 'Pemakaian', render: (v: ApiVoucher) => <Badge tone={v.usage_limit > 0 && v.used_count >= v.usage_limit ? 'danger' : 'neutral'}>{v.used_count}{v.usage_limit > 0 ? ` / ${v.usage_limit}` : 'x'}</Badge> },
          { key: 'expires', label: 'Berlaku s/d', render: (v: ApiVoucher) => {
            const expired = !!(v.expires_at && v.expires_at < nowIso());
            return <span className={`font-mono text-[11px] ${expired ? 'text-danger-500 font-bold' : 'text-base-400'}`}>{v.expires_at ? fmtDate(v.expires_at) : 'tanpa batas'}</span>;
          }},
          { key: 'status', label: 'Status', render: (v: ApiVoucher) => (
            <Toggle checked={v.active} onChange={(val) => toggleActive(v, val)} label={v.active ? 'Aktif' : 'Nonaktif'} />
          )},
        ]}
        rowActions={(v: ApiVoucher) => (
          <div className="flex items-center justify-end gap-1">
            <IconButton icon="pencil" title="Edit" tone="brand" onClick={() => open(v)} />
            <IconButton icon="trash" title="Hapus" tone="danger" onClick={() => setDel(v)} />
          </div>
        )} />}
      </RemoteView>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Buat Voucher' : `Edit — ${f.code}`} footer={
        <><button className="btn-ghost" onClick={() => setEditing(null)}>Batal</button>
          <button className="btn-primary" onClick={save}><Icon name="check" size={14} /> Simpan</button></>
      }>
        {err && <p className="mb-3 rounded-lg border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm font-semibold text-danger-500">{err}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kode" required hint="Huruf besar & angka, cth: HEMAT20"><TextInput value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} className="font-mono uppercase" disabled={editing !== 'new'} /></Field>
          <Field label="Tipe Diskon"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as ApiVoucher['type'] })}>
            <option value="percent">Persen (%)</option><option value="fixed">Nominal tetap</option>
          </Select></Field>
          <Field label={f.type === 'percent' ? 'Nilai (%)' : 'Nilai (Rp)'} required><TextInput type="number" min={0} max={f.type === 'percent' ? 100 : undefined} value={f.value || ''} onChange={(e) => setF({ ...f, value: Number(e.target.value) })} /></Field>
          <Field label="Minimal Belanja" hint="0 = tanpa minimal"><TextInput type="number" min={0} value={f.minOrder || ''} onChange={(e) => setF({ ...f, minOrder: Number(e.target.value) })} /></Field>
          <Field label="Maksimal Diskon" hint="0 = tanpa batas (khusus berguna utk persen)"><TextInput type="number" min={0} value={f.maxDiscount || ''} onChange={(e) => setF({ ...f, maxDiscount: Number(e.target.value) })} /></Field>
          <Field label="Kuota Pemakaian" hint="0 = tak terbatas"><TextInput type="number" min={0} value={f.usageLimit || ''} onChange={(e) => setF({ ...f, usageLimit: Number(e.target.value) })} /></Field>
          <Field label="Berlaku Sampai" hint="Kosong = selamanya"><TextInput type="date" value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} /></Field>
          <div className="flex items-end pb-2.5"><Toggle checked={f.active} onChange={(v) => setF({ ...f, active: v })} label="Voucher aktif" /></div>
          <div className="sm:col-span-2"><Field label="Catatan Internal"><TextArea rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="cth: Promo pembukaan toko" /></Field></div>
        </div>
      </Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} message={`Hapus voucher "${del?.code}"? Riwayat order yang memakainya tetap tersimpan.`}
        onConfirm={() => {
          if (!del) return;
          void api.deleteVoucher(del.id).then(() => {
            toast('success', 'Voucher dihapus.');
            refresh();
          }).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal menghapus voucher.'));
        }} />
    </DashShell>
  );
}
