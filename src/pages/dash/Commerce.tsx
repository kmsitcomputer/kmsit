import { useState } from 'react';
import { Link } from 'react-router-dom';
import { db, type Order, type Payment, type Withdrawal, type ID } from '../../lib/db';
import { fmtMoney, fmtDateTime, fmtDate, maskKey } from '../../lib/services';
import { OrderService, PaymentService, WalletService, WithdrawalService, DeliveryService, MIN_WITHDRAWAL, activeGateway, gatewayMode, GATEWAYS } from '../../lib/commerce';
import { useApp, useDB } from '../../state/store';
import { Icon } from '../../components/icons';
import { Avatar, Badge, Confirm, DataTable, EmptyState, Field, IconButton, Modal, PageHeader, Select, StatCard, StatusBadge, Tabs, TextArea, TextInput } from '../../components/ui';
import { DashShell } from '../../components/Shell';

/* ================= orders ================= */

function OrderDetail({ order, onClose }: { order: Order; onClose: () => void }) {
  const payments = OrderService.paymentsOf(order.id);
  const buyer = db.byId('users', order.userId);
  return (
    <Modal open onClose={onClose} title={`Order — ${order.type === 'course' ? 'Course Purchase' : 'Shop Purchase'}`} wide>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusBadge status={order.status} />
        <span className="font-mono text-[11px] text-base-400">{fmtDateTime(order.createdAt)}{order.paidAt ? ` · dibayar ${fmtDateTime(order.paidAt)}` : ''}</span>
        <span className="ml-auto flex items-center gap-2 text-sm"><Avatar name={buyer?.name ?? '?'} size={24} /><b>{buyer?.name}</b></span>
      </div>
      {order.items.map((it, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-base-100 dark:border-base-800 py-2.5">
          {it.thumbnail ? <img src={it.thumbnail} alt="" className="h-11 w-16 rounded-md object-cover" /> : <span className="flex h-11 w-16 items-center justify-center rounded-md bg-base-100 dark:bg-base-800 text-base-400"><Icon name="bag" size={15} /></span>}
          <div className="flex-1 min-w-0"><p className="truncate text-sm font-bold text-base-900 dark:text-base-100">{it.title}</p>
            <p className="font-mono text-[10px] text-base-400">{it.kind} · {it.qty}x · instructor: {it.instructorId ? db.byId('users', it.instructorId)?.name : '—'}</p></div>
          <span className="font-display text-sm font-bold">{fmtMoney(it.price * it.qty)}</span>
        </div>
      ))}
      <div className="mt-3 flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm">
        <span className="text-base-500">Subtotal <b className="font-mono text-base-800 dark:text-base-100">{fmtMoney(order.subtotal)}</b></span>
        {order.discountAmount > 0 && <span className="text-ok-500">Voucher {order.voucherCode} <b className="font-mono">−{fmtMoney(order.discountAmount)}</b></span>}
        <span className="text-base-500">Gateway <b className="font-mono text-base-800 dark:text-base-100">{fmtMoney(order.gatewayFee)}</b></span>
        <span className="text-base-500">Total <b className="font-display text-base-900 dark:text-base-50">{fmtMoney(order.total)}</b></span>
      </div>
      {order.type === 'shop' && (
        order.needsShipping ? (
          <div className="mt-4 rounded-lg bg-base-100 dark:bg-base-850 p-3.5">
            <p className="label !mb-1">Pengiriman (produk fisik)</p>
            <p className="text-sm font-bold text-base-800 dark:text-base-100">{order.shippingName} · {order.shippingPhone}</p>
            <p className="text-xs leading-5 text-base-500">{order.shippingAddress}</p>
          </div>
        ) : (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-brand-500/[0.07] border border-brand-500/25 px-3.5 py-2.5 text-xs font-semibold text-brand-700 dark:text-brand-300">
            <Icon name="download" size={14} /> Order digital — file dikirim otomatis ke pembeli, tanpa pengiriman barang.
          </p>
        )
      )}
      <p className="label mt-5">Riwayat Pembayaran</p>
      {payments.length === 0 ? <p className="text-sm text-base-400">Belum ada pembayaran diinisiasi.</p> : payments.map((p) => (
        <div key={p.id} className="mb-2 rounded-lg border border-base-200 dark:border-base-700 p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge tone={p.gateway === 'tripay' ? 'brand' : p.gateway === 'xendit' ? 'info' : 'accent'}>{p.gateway}</Badge>
            <span className="font-mono font-bold text-base-800 dark:text-base-100">{p.reference}</span>
            <span className="text-base-400">{p.method}</span>
            <Badge tone={p.mode === 'sandbox' ? 'warn' : 'ok'}>{p.mode}</Badge>
            <StatusBadge status={p.status} />
            <span className="ml-auto font-display font-bold">{fmtMoney(p.amount)}</span>
          </div>
          <div className="mt-2 space-y-1 font-mono text-[10px] text-base-400">
            {p.events.map((ev, i) => <p key={i}>· [{fmtDateTime(ev.at)}] {ev.event}</p>)}
          </div>
        </div>
      ))}
    </Modal>
  );
}

export function OrdersPage({ own }: { own?: boolean }) {
  useDB();
  const { user } = useApp();
  const [status, setStatus] = useState('');
  const [detail, setDetail] = useState<Order | null>(null);
  if (!user) return null;
  let rows = own ? OrderService.ofUser(user.id) : OrderService.list();
  if (status) rows = rows.filter((o) => o.status === status);
  return (
    <DashShell title="Orders">
      <PageHeader title={own ? 'Order Saya' : 'Orders'} sub={own ? 'Riwayat pembelian kelas & produk.' : 'Seluruh transaksi course & shop.'} />
      <div className="mb-4"><Tabs tabs={[{ key: '', label: 'Semua' }, { key: 'pending', label: 'Pending' }, { key: 'paid', label: 'Lunas' }, { key: 'failed', label: 'Gagal' }]} active={status} onChange={setStatus} /></div>
      <DataTable rows={rows} pageSize={9} searchKeys={(o: Order) => o.items.map((i) => i.title).join(' ')}
        emptyTitle="Belum ada order" emptySub={own ? 'Pembelianmu akan muncul di sini.' : 'Order masuk akan tampil di sini.'}
        emptyAction={own ? <Link to="/courses" className="btn-primary">Jelajahi Kelas</Link> : undefined}
        columns={[
          { key: 'item', label: 'Item', render: (o: Order) => <div><p className="truncate font-bold text-base-900 dark:text-base-100 max-w-56">{o.items[0]?.title}{o.items.length > 1 ? ` +${o.items.length - 1}` : ''}</p><p className="font-mono text-[10px] text-base-400">{o.type === 'course' ? 'course purchase' : 'shop purchase'}</p></div> },
          ...(own ? [] : [{ key: 'buyer', label: 'Buyer', render: (o: Order) => { const b = db.byId('users', o.userId); return <span className="flex items-center gap-2 text-sm font-semibold"><Avatar name={b?.name ?? '?'} size={22} />{b?.name ?? '—'}</span>; } }]),
          { key: 'date', label: 'Tanggal', render: (o: Order) => <span className="font-mono text-[11px] text-base-400">{fmtDateTime(o.createdAt)}</span> },
          { key: 'total', label: 'Total', render: (o: Order) => <span className="font-display text-sm font-bold">{fmtMoney(o.total)}</span> },
          { key: 'status', label: 'Status', render: (o: Order) => <StatusBadge status={o.status} /> },
        ]}
        rowActions={(o: Order) => <IconButton icon="eye" title="Detail" tone="brand" onClick={() => setDetail(o)} />} />
      {detail && <OrderDetail order={detail} onClose={() => setDetail(null)} />}
    </DashShell>
  );
}

/* ================= payments ================= */

export function PaymentsPage() {
  useDB();
  const { user } = useApp();
  const [detail, setDetail] = useState<Payment | null>(null);
  if (!user) return null;
  const rows = PaymentService.list();
  const whLogs = db.all('webhookLogs').slice().reverse().slice(0, 12);
  return (
    <DashShell title="Pembayaran">
      <PageHeader title="Pembayaran & Webhook" sub={`Gateway aktif: ${activeGateway().name} · mode ${gatewayMode()}`} />
      <DataTable rows={rows} pageSize={8} searchKeys={(p: Payment) => `${p.reference} ${p.gateway} ${p.method}`}
        emptyTitle="Belum ada pembayaran" emptySub="Transaksi yang diinisiasi dari checkout tampil di sini."
        columns={[
          { key: 'ref', label: 'Reference', render: (p: Payment) => <span className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400">{p.reference}</span> },
          { key: 'gw', label: 'Gateway', render: (p: Payment) => <div className="flex items-center gap-1.5"><Badge tone={p.gateway === 'tripay' ? 'brand' : p.gateway === 'xendit' ? 'info' : 'accent'}>{p.gateway}</Badge><span className="text-xs text-base-400">{p.method}</span></div> },
          { key: 'mode', label: 'Mode', render: (p: Payment) => <Badge tone={p.mode === 'sandbox' ? 'warn' : 'ok'}>{p.mode}</Badge> },
          { key: 'fee', label: 'Fee', render: (p: Payment) => <span className="font-mono text-xs">{fmtMoney(p.fee)}</span> },
          { key: 'amount', label: 'Amount', render: (p: Payment) => <span className="font-display text-sm font-bold">{fmtMoney(p.amount)}</span> },
          { key: 'status', label: 'Status', render: (p: Payment) => <StatusBadge status={p.status} /> },
        ]}
        rowActions={(p: Payment) => <IconButton icon="eye" title="Log transaksi" tone="brand" onClick={() => setDetail(p)} />} />
      <div className="mt-6 card overflow-hidden anim-rise">
        <div className="border-b border-base-200 dark:border-base-800 px-5 py-3.5"><h2 className="font-display text-base font-bold text-base-900 dark:text-base-50">Webhook Log (proteksi duplikasi)</h2></div>
        {whLogs.length === 0 ? <p className="px-5 py-6 text-center text-sm text-base-400">Belum ada webhook diterima.</p> : (
          <table className="w-full">
            <thead className="bg-base-100/60 dark:bg-base-850"><tr><th className="th">Reference</th><th className="th">Gateway</th><th className="th">Status</th><th className="th">Hasil</th></tr></thead>
            <tbody>
              {whLogs.map((w) => (
                <tr key={w.id}>
                  <td className="td font-mono text-xs">{w.reference}</td>
                  <td className="td"><Badge tone="neutral">{w.gateway}</Badge></td>
                  <td className="td font-mono text-xs">{w.status}</td>
                  <td className="td"><Badge tone={w.result === 'processed' ? 'ok' : w.result === 'duplicate' ? 'warn' : 'danger'}>{w.result}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {detail && (
        <Modal open onClose={() => setDetail(null)} title={`Payment ${detail.reference}`} wide>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={detail.status} /><Badge tone={detail.mode === 'sandbox' ? 'warn' : 'ok'}>{detail.mode}</Badge>
            <span className="ml-auto font-display text-lg font-bold">{fmtMoney(detail.amount)}</span>
          </div>
          <p className="font-mono text-[11px] text-base-400 mb-4">signature: {detail.signature} · fee {fmtMoney(detail.fee)}</p>
          <div className="space-y-1.5 rounded-lg bg-base-100 dark:bg-base-850 p-4 font-mono text-[11px] text-base-600 dark:text-base-300">
            {detail.events.map((ev, i) => <p key={i}>[{fmtDateTime(ev.at)}] {ev.event}</p>)}
          </div>
        </Modal>
      )}
    </DashShell>
  );
}

/* ================= wallet & withdrawals ================= */

function WithdrawModal({ onClose }: { onClose: () => void }) {
  const { user, toast } = useApp();
  const [f, setF] = useState({ amount: 0, bankName: '', accountName: '', accountNumber: '', notes: '' });
  const [err, setErr] = useState('');
  if (!user) return null;
  const s = WalletService.summary(user.id);
  return (
    <Modal open onClose={onClose} title="Ajukan Withdrawal" footer={
      <><button className="btn-ghost" onClick={onClose}>Batal</button>
        <button className="btn-primary" onClick={() => {
          const res = WithdrawalService.request(user, f);
          if (!res.ok) { setErr(res.error ?? 'Gagal'); return; }
          toast('success', 'Pengajuan withdrawal dikirim ke admin.');
          onClose();
        }}><Icon name="send" size={14} /> Ajukan</button></>
    }>
      {err && <p className="mb-3 rounded-lg border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm font-semibold text-danger-500">{err}</p>}
      <div className="mb-4 rounded-lg bg-brand-500/[0.07] border border-brand-500/25 px-4 py-3 text-sm">
        Saldo dapat ditarik: <b className="font-display text-brand-600 dark:text-brand-400">{fmtMoney(s.withdrawable)}</b>
        <span className="ml-2 font-mono text-[10px] text-base-400">min. {fmtMoney(MIN_WITHDRAWAL)}</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Jumlah" required><TextInput type="number" min={MIN_WITHDRAWAL} value={f.amount || ''} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} /></Field>
        <Field label="Nama Bank" required><TextInput value={f.bankName} onChange={(e) => setF({ ...f, bankName: e.target.value })} placeholder="cth: BCA" /></Field>
        <Field label="Nama Rekening" required><TextInput value={f.accountName} onChange={(e) => setF({ ...f, accountName: e.target.value })} /></Field>
        <Field label="Nomor Rekening" required><TextInput value={f.accountNumber} onChange={(e) => setF({ ...f, accountNumber: e.target.value })} className="font-mono" /></Field>
        <div className="sm:col-span-2"><Field label="Catatan"><TextArea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field></div>
      </div>
    </Modal>
  );
}

export function WalletPage() {
  useDB();
  const { user } = useApp();
  const [withdraw, setWithdraw] = useState(false);
  if (!user) return null;
  const s = WalletService.summary(user.id);
  const ledger = WalletService.ledger(user.id);
  const withdrawals = WithdrawalService.ofUser(user.id);
  return (
    <DashShell title="Dompet">
      <PageHeader title="Dompet Instructor" sub="Saldo dihitung dari ledger — setiap penjualan tercatat gross, fee platform 15%, dan net."
        actions={<button className="btn-primary" onClick={() => setWithdraw(true)}><Icon name="banknote" size={15} /> Tarik Saldo</button>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon="wallet" label="Saldo" value={fmtMoney(s.balance)} delay={0} />
        <StatCard icon="chart" label="Total Pendapatan" value={fmtMoney(s.totalEarning)} sub={`gross ${fmtMoney(s.totalGross)}`} tone="ok" delay={50} />
        <StatCard icon="clock" label="Withdrawal Pending" value={fmtMoney(s.pendingWd)} tone="warn" delay={100} />
        <StatCard icon="check-circle" label="Fee Platform Dibayar" value={fmtMoney(s.totalPlatformFee)} tone="info" delay={150} />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="card overflow-hidden anim-rise">
          <div className="border-b border-base-200 dark:border-base-800 px-5 py-3.5"><h2 className="font-display text-base font-bold text-base-900 dark:text-base-50">Ledger Transaksi</h2></div>
          {ledger.length === 0 ? <p className="px-5 py-8 text-center text-sm text-base-400">Belum ada transaksi.</p> : (
            <ul className="max-h-96 overflow-y-auto">
              {ledger.map((t) => (
                <li key={t.id} className="flex items-center gap-3 border-b border-base-100 dark:border-base-800 px-5 py-3 last:border-0">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${t.amount >= 0 ? 'bg-ok-500/12 text-ok-500' : 'bg-danger-500/12 text-danger-500'}`}>
                    <Icon name={t.type === 'earning' ? 'arrow-down' : 'arrow-up'} size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-base-800 dark:text-base-100">{t.note}</p>
                    <p className="font-mono text-[10px] text-base-400">{fmtDateTime(t.createdAt)} · {t.status}{t.gross > 0 ? ` · gross ${fmtMoney(t.gross)} · fee ${fmtMoney(t.platformFee)}` : ''}</p>
                  </div>
                  <span className={`font-display text-sm font-bold ${t.amount >= 0 ? 'text-ok-500' : 'text-danger-500'}`}>{t.amount >= 0 ? '+' : ''}{fmtMoney(t.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card overflow-hidden anim-rise" style={{ animationDelay: '80ms' }}>
          <div className="border-b border-base-200 dark:border-base-800 px-5 py-3.5"><h2 className="font-display text-base font-bold text-base-900 dark:text-base-50">Riwayat Withdrawal</h2></div>
          {withdrawals.length === 0 ? <p className="px-5 py-8 text-center text-sm text-base-400">Belum ada pengajuan.</p> : (
            <ul className="max-h-96 overflow-y-auto">
              {withdrawals.map((w) => (
                <li key={w.id} className="border-b border-base-100 dark:border-base-800 px-5 py-3 last:border-0">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm font-bold text-base-900 dark:text-base-50">{fmtMoney(w.amount)}</span>
                    <StatusBadge status={w.status} />
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] text-base-400">{w.bankName} · {w.accountNumber} · {fmtDate(w.createdAt)}{w.adminNote ? ` · catatan: ${w.adminNote}` : ''}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {withdraw && <WithdrawModal onClose={() => setWithdraw(false)} />}
    </DashShell>
  );
}

/* ================= my digital products ================= */

export function MyDigitalPage() {
  useDB();
  const { user, toast } = useApp();
  if (!user) return null;
  const deliveries = DeliveryService.ofUser(user.id);
  return (
    <DashShell title="Produk Digital">
      <PageHeader title="Produk Digital Saya" sub="File & license key dikirim otomatis setelah pembayaran berhasil — tanpa pengiriman barang." />
      {deliveries.length === 0 ? (
        <EmptyState icon="download" title="Belum ada produk digital" sub="Produk digital yang kamu beli akan tersedia di sini untuk diunduh kapan saja."
          action={<Link to="/shop" className="btn-primary"><Icon name="store" size={14} /> Jelajahi Toko</Link>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {deliveries.map((d, i) => {
            const product = db.byId('products', d.productId);
            return (
              <div key={d.id} className="card card-hover p-5 anim-rise" style={{ animationDelay: `${(i % 2) * 60}ms` }}>
                <div className="flex gap-4">
                  {product?.thumbnail ? <img src={product.thumbnail} alt="" className="h-20 w-20 rounded-xl object-cover" /> : (
                    <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-accent-400/12 text-accent-500"><Icon name="download" size={26} /></span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-display text-sm font-bold text-base-900 dark:text-base-50">{product?.name ?? 'Produk dihapus'}</h3>
                      <Badge tone="accent">Digital</Badge>
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-base-400">dibeli {fmtDateTime(d.createdAt)} · {d.downloads}x diunduh</p>
                    <div className="mt-2 flex items-center gap-2 rounded-lg bg-base-100 dark:bg-base-850 px-3 py-2">
                      <Icon name="key" size={13} className="shrink-0 text-brand-500" />
                      <span className="flex-1 truncate font-mono text-xs font-bold text-base-800 dark:text-base-100">{d.licenseKey}</span>
                      <button className="text-base-400 hover:text-brand-500 cursor-pointer" title="Salin license" onClick={async () => {
                        try { await navigator.clipboard.writeText(d.licenseKey); toast('success', 'License key disalin.'); } catch { toast('error', 'Gagal menyalin.'); }
                      }}><Icon name="copy" size={13} /></button>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  {d.downloadUrl ? (
                    <a href={d.downloadUrl} download target={d.downloadUrl.startsWith('data:') ? undefined : '_blank'} rel="noopener noreferrer"
                      className="btn-primary btn-sm flex-1" onClick={() => DeliveryService.markDownloaded(d.id)}>
                      <Icon name="download" size={13} /> Unduh File
                    </a>
                  ) : (
                    <span className="btn-ghost btn-sm flex-1 !text-base-400 pointer-events-none"><Icon name="alert-circle" size={13} /> File belum diunggah penjual</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashShell>
  );
}

export function WithdrawalsPage() {
  useDB();
  const { user, toast } = useApp();
  const [filter, setFilter] = useState('');
  const [process, setProcess] = useState<{ w: Withdrawal; status: Withdrawal['status'] } | null>(null);
  const [note, setNote] = useState('');
  const [withdraw, setWithdraw] = useState(false);
  if (!user) return null;
  const isInstructor = user.roleKey === 'instructor';
  let rows = isInstructor ? WithdrawalService.ofUser(user.id) : WithdrawalService.list();
  if (filter) rows = rows.filter((w) => w.status === filter);

  return (
    <DashShell title="Withdrawal">
      <PageHeader title={isInstructor ? 'Withdrawal Saya' : 'Proses Withdrawal'} sub={isInstructor ? 'Tarik pendapatanmu ke rekening bank.' : 'Setujui, proses, atau tolak pengajuan instructor.'}
        actions={isInstructor ? <button className="btn-primary" onClick={() => setWithdraw(true)}><Icon name="banknote" size={15} /> Ajukan Withdrawal</button> : undefined} />
      <div className="mb-4"><Tabs tabs={[{ key: '', label: 'Semua' }, { key: 'pending', label: 'Pending' }, { key: 'processing', label: 'Diproses' }, { key: 'completed', label: 'Selesai' }, { key: 'rejected', label: 'Ditolak' }]} active={filter} onChange={setFilter} /></div>
      <DataTable rows={rows} pageSize={9} searchKeys={(w: Withdrawal) => `${w.bankName} ${w.accountName} ${db.byId('users', w.userId)?.name ?? ''}`}
        emptyTitle="Belum ada withdrawal" emptySub="Pengajuan withdrawal tampil di sini."
        columns={[
          ...(isInstructor ? [] : [{ key: 'who', label: 'Instructor', render: (w: Withdrawal) => { const u = db.byId('users', w.userId); return <span className="flex items-center gap-2 text-sm font-semibold"><Avatar name={u?.name ?? '?'} size={22} />{u?.name ?? '—'}</span>; } }]),
          { key: 'amount', label: 'Jumlah', render: (w: Withdrawal) => <span className="font-display text-sm font-bold">{fmtMoney(w.amount)}</span> },
          { key: 'bank', label: 'Rekening', render: (w: Withdrawal) => <div><p className="text-sm font-semibold">{w.bankName} — {w.accountName}</p><p className="font-mono text-[10px] text-base-400">{w.accountNumber}</p></div> },
          { key: 'date', label: 'Diajukan', render: (w: Withdrawal) => <span className="font-mono text-[11px] text-base-400">{fmtDateTime(w.createdAt)}</span> },
          { key: 'status', label: 'Status', render: (w: Withdrawal) => <StatusBadge status={w.status} /> },
        ]}
        rowActions={isInstructor ? undefined : (w: Withdrawal) => (
          <>
            {(w.status === 'pending') && <button className="btn-outline btn-sm" onClick={() => { setProcess({ w, status: 'approved' }); setNote(''); }}>Setujui</button>}
            {(w.status === 'approved' || w.status === 'processing') && <button className="btn-outline btn-sm" onClick={() => { setProcess({ w, status: w.status === 'approved' ? 'processing' : 'completed' }); setNote(''); }}>{w.status === 'approved' ? 'Proses' : 'Selesaikan'}</button>}
            {(w.status === 'pending' || w.status === 'approved' || w.status === 'processing') && <button className="btn-ghost btn-sm !text-danger-500" onClick={() => { setProcess({ w, status: 'rejected' }); setNote(''); }}>Tolak</button>}
          </>
        )} />
      {process && (
        <Modal open onClose={() => setProcess(null)} title={`Konfirmasi: ${process.status}`} footer={
          <><button className="btn-ghost" onClick={() => setProcess(null)}>Batal</button>
            <button className={process.status === 'rejected' ? 'btn-danger' : 'btn-primary'} onClick={() => {
              WithdrawalService.setStatus(process.w.id, process.status, user, note);
              toast('success', `Withdrawal ${process.status}.`);
              setProcess(null);
            }}><Icon name="check" size={14} /> Konfirmasi</button></>
        }>
          <p className="text-sm text-base-500 mb-3">Pengajuan <b>{db.byId('users', process.w.userId)?.name}</b> sebesar <b className="font-display">{fmtMoney(process.w.amount)}</b> → <b>{process.status}</b>.</p>
          <Field label="Catatan (opsional)"><TextArea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </Modal>
      )}
      {withdraw && <WithdrawModal onClose={() => setWithdraw(false)} />}
    </DashShell>
  );
}
