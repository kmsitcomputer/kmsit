import { useState } from 'react';
import { db, now, type Voucher, type ID } from '../../lib/db';
import { fmtMoney, fmtDate, audit } from '../../lib/services';
import { VoucherService } from '../../lib/commerce';
import { useApp, useDB } from '../../state/store';
import { Icon } from '../../components/icons';
import { Badge, Confirm, DataTable, Field, IconButton, Modal, PageHeader, Select, StatCard, Tabs, TextArea, TextInput, Toggle } from '../../components/ui';
import { DashShell } from '../../components/Shell';

export default function VouchersPage() {
  useDB();
  const { user, toast } = useApp();
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<Voucher | 'new' | null>(null);
  const [del, setDel] = useState<Voucher | null>(null);
  const [f, setF] = useState({ code: '', type: 'percent' as Voucher['type'], value: 10, minOrder: 0, maxDiscount: 0, usageLimit: 0, expiresAt: '', active: true, note: '' });
  const [err, setErr] = useState('');
  if (!user) return null;

  let rows = VoucherService.list();
  if (filter === 'active') rows = rows.filter((v) => v.active && (!v.expiresAt || v.expiresAt > now()));
  if (filter === 'inactive') rows = rows.filter((v) => !v.active);
  if (filter === 'expired') rows = rows.filter((v) => v.expiresAt && v.expiresAt < now());

  const open = (v: Voucher | 'new') => {
    setErr('');
    if (v === 'new') setF({ code: '', type: 'percent', value: 10, minOrder: 0, maxDiscount: 0, usageLimit: 0, expiresAt: '', active: true, note: '' });
    else setF({
      code: v.code, type: v.type, value: v.value, minOrder: v.minOrder, maxDiscount: v.maxDiscount,
      usageLimit: v.usageLimit, expiresAt: v.expiresAt ? new Date(v.expiresAt).toISOString().slice(0, 10) : '', active: v.active, note: v.note,
    });
    setEditing(v);
  };

  const save = () => {
    const data = {
      code: f.code.trim().toUpperCase(), type: f.type, value: Number(f.value) || 0, minOrder: Number(f.minOrder) || 0,
      maxDiscount: Number(f.maxDiscount) || 0, usageLimit: Number(f.usageLimit) || 0,
      expiresAt: f.expiresAt ? new Date(`${f.expiresAt}T23:59:59`).getTime() : null, active: f.active, note: f.note.trim(),
    };
    if (editing === 'new') {
      const res = VoucherService.create(data);
      if (!res.ok) { setErr(res.error ?? 'Gagal'); return; }
      audit(user.id, user.name, 'create', 'voucher', res.voucher!.id, `Membuat voucher ${data.code}`);
      toast('success', `Voucher ${data.code} dibuat.`);
    } else if (editing) {
      VoucherService.update(editing.id, data);
      audit(user.id, user.name, 'update', 'voucher', editing.id, `Memperbarui voucher ${data.code}`);
      toast('success', 'Voucher diperbarui.');
    }
    setEditing(null);
  };

  const all = VoucherService.list();
  const usedTotal = all.reduce((a, v) => a + v.usedCount, 0);

  return (
    <DashShell title="Voucher">
      <PageHeader title="Voucher & Kode Diskon" sub="Berlaku untuk checkout produk di toko — validasi & perhitungan diskon di backend."
        actions={<button className="btn-primary" onClick={() => open('new')}><Icon name="plus" size={15} /> Buat Voucher</button>} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon="tag" label="Total Voucher" value={all.length} delay={0} />
        <StatCard icon="check-circle" label="Aktif" value={all.filter((v) => v.active).length} tone="ok" delay={50} />
        <StatCard icon="cart" label="Dipakai" value={`${usedTotal}x`} tone="info" delay={100} />
        <StatCard icon="clock" label="Kadaluarsa" value={all.filter((v) => v.expiresAt && v.expiresAt < now()).length} tone="warn" delay={150} />
      </div>
      <div className="mb-4"><Tabs tabs={[{ key: '', label: 'Semua' }, { key: 'active', label: 'Aktif' }, { key: 'inactive', label: 'Nonaktif' }, { key: 'expired', label: 'Kadaluarsa' }]} active={filter} onChange={setFilter} /></div>
      <DataTable rows={rows} pageSize={9} searchKeys={(v: Voucher) => `${v.code} ${v.note}`}
        emptyTitle="Belum ada voucher" emptySub="Buat kode diskon untuk pelanggan tokomu."
        emptyAction={<button className="btn-primary" onClick={() => open('new')}><Icon name="plus" size={14} /> Create New</button>}
        columns={[
          { key: 'code', label: 'Kode', render: (v: Voucher) => <span className="font-mono text-sm font-bold text-brand-600 dark:text-brand-400">{v.code}</span> },
          { key: 'value', label: 'Diskon', render: (v: Voucher) => (
            <div>
              <span className="font-display text-sm font-bold">{v.type === 'percent' ? `${v.value}%` : fmtMoney(v.value)}</span>
              {v.maxDiscount > 0 && <span className="ml-1.5 font-mono text-[10px] text-base-400">maks {fmtMoney(v.maxDiscount)}</span>}
              {v.minOrder > 0 && <p className="font-mono text-[10px] text-base-400">min. belanja {fmtMoney(v.minOrder)}</p>}
            </div>
          )},
          { key: 'usage', label: 'Pemakaian', render: (v: Voucher) => <Badge tone={v.usageLimit > 0 && v.usedCount >= v.usageLimit ? 'danger' : 'neutral'}>{v.usedCount}{v.usageLimit > 0 ? ` / ${v.usageLimit}` : 'x'}</Badge> },
          { key: 'expires', label: 'Berlaku s/d', render: (v: Voucher) => {
            const expired = v.expiresAt && v.expiresAt < now();
            return <span className={`font-mono text-[11px] ${expired ? 'text-danger-500 font-bold' : 'text-base-400'}`}>{v.expiresAt ? fmtDate(v.expiresAt) : 'tanpa batas'}</span>;
          }},
          { key: 'status', label: 'Status', render: (v: Voucher) => (
            <Toggle checked={v.active} onChange={(val) => { VoucherService.update(v.id, { active: val }); toast('success', `Voucher ${val ? 'diaktifkan' : 'dinonaktifkan'}.`); }} label={v.active ? 'Aktif' : 'Nonaktif'} />
          )},
        ]}
        rowActions={(v: Voucher) => (
          <>
            <IconButton icon="pencil" title="Edit" tone="brand" onClick={() => open(v)} />
            <IconButton icon="trash" title="Hapus" tone="danger" onClick={() => setDel(v)} />
          </>
        )} />

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Buat Voucher' : `Edit — ${f.code}`} footer={
        <><button className="btn-ghost" onClick={() => setEditing(null)}>Batal</button>
          <button className="btn-primary" onClick={save}><Icon name="check" size={14} /> Simpan</button></>
      }>
        {err && <p className="mb-3 rounded-lg border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm font-semibold text-danger-500">{err}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kode" required hint="Huruf besar & angka, cth: HEMAT20"><TextInput value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} className="font-mono uppercase" disabled={editing !== 'new'} /></Field>
          <Field label="Tipe Diskon"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as Voucher['type'] })}>
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
        onConfirm={() => { if (del) { VoucherService.remove(del.id); audit(user.id, user.name, 'delete', 'voucher', del.id, `Menghapus voucher ${del.code}`); toast('success', 'Voucher dihapus.'); } }} />
    </DashShell>
  );
}
