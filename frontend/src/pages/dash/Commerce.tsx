import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Withdrawal } from '../../lib/types';
import { fmtMoney, fmtDateTime, fmtDate } from '../../lib/format';
import { useApp } from '../../state/store';
import { can } from '../../lib/permissions';
import { api, type ApiAdminWithdrawal, type OrderWithBuyer, type PaymentWithBuyer } from '../../lib/api';
import { Icon } from '../../components/icons';
import { Avatar, Badge, EmptyState, Field, IconButton, Modal, PageHeader, StatCard, StatusBadge, Tabs, TextArea, TextInput } from '../../components/ui';
import { DashShell } from '../../components/Shell';
import { PagedTable, Pager, RemoteView, useRemote } from '../../components/remote';

/** Mirrors the backend rule in WalletController::requestWithdrawal (min:25000). */
const MIN_WITHDRAWAL = 25000;

/* ================= orders ================= */

function PaymentHistory({ orderId }: { orderId: string }) {
  const payments = useRemote(() => api.payments({ order_id: orderId, per_page: 50 }), [orderId]);
  return (
    <RemoteView remote={payments} isEmpty={(p) => p.total === 0} emptyTitle="Belum ada pembayaran diinisiasi.">
      {(page) => (
        <>
          {page.items.map((p) => (
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
        </>
      )}
    </RemoteView>
  );
}

function OrderDetail({ order, onClose }: { order: OrderWithBuyer; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title={`Order — ${order.type === 'course' ? 'Course Purchase' : 'Shop Purchase'}`} wide>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusBadge status={order.status} />
        <span className="font-mono text-[11px] text-base-400">{fmtDateTime(order.createdAt)}{order.paidAt ? ` · dibayar ${fmtDateTime(order.paidAt)}` : ''}</span>
        <span className="ml-auto flex items-center gap-2 text-sm"><Avatar name={order.buyerName ?? '?'} size={24} /><b>{order.buyerName ?? '—'}</b></span>
      </div>
      {order.items.map((it, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-base-100 dark:border-base-800 py-2.5">
          {it.thumbnail ? <img src={it.thumbnail} alt="" className="h-11 w-16 rounded-md object-cover" /> : <span className="flex h-11 w-16 items-center justify-center rounded-md bg-base-100 dark:bg-base-800 text-base-400"><Icon name="bag" size={15} /></span>}
          <div className="flex-1 min-w-0"><p className="truncate text-sm font-bold text-base-900 dark:text-base-100">{it.title}</p>
            <p className="font-mono text-[10px] text-base-400">{it.kind} · {it.qty}x{it.kind === 'course' ? ` · instructor: ${it.instructorName ?? '—'}` : ''}</p></div>
          <span className="font-display text-sm font-bold">{fmtMoney(it.price * it.qty)}</span>
        </div>
      ))}
      <div className="mt-3 flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm">
        <span className="text-base-500">Subtotal <b className="font-mono text-base-800 dark:text-base-100">{fmtMoney(order.subtotal)}</b></span>
        {order.discountAmount > 0 && <span className="text-ok-500">Voucher {order.voucherCode} <b className="font-mono">−{fmtMoney(order.discountAmount)}</b></span>}
        {order.shippingCost > 0 && <span className="text-base-500">Ongkir <b className="font-mono text-base-800 dark:text-base-100">{fmtMoney(order.shippingCost)}</b></span>}
        <span className="text-base-500">Total <b className="font-display text-base-900 dark:text-base-50">{fmtMoney(order.total)}</b></span>
      </div>
      {order.type === 'shop' && (
        order.needsShipping ? (
          <div className="mt-4 rounded-lg bg-base-100 dark:bg-base-850 p-3.5">
            <p className="label !mb-1">Pengiriman (produk fisik)</p>
            <p className="text-sm font-bold text-base-800 dark:text-base-100">{order.shippingName} · {order.shippingPhone}</p>
            <p className="text-xs leading-5 text-base-500">{order.shippingAddress}</p>
            {(order.shippingCityName || order.shippingProvinceName) && (
              <p className="text-xs leading-5 text-base-500">
                {[order.shippingSubdistrictName, order.shippingDistrictName, order.shippingCityName, order.shippingProvinceName].filter(Boolean).join(', ')}
                {order.shippingPostalCode ? ` ${order.shippingPostalCode}` : ''}
              </p>
            )}
            {(order.shippingCourierName || order.shippingCost > 0) && (
              <p className="mt-1.5 text-xs font-bold text-base-700 dark:text-base-200">
                {order.shippingCourierName}{order.shippingService ? ` · ${order.shippingService}` : ''} · {fmtMoney(order.shippingCost)}
                {order.shippingEtd ? ` · Estimasi ${order.shippingEtd}` : ''}
                {order.shippingWeightGrams ? ` · ${(order.shippingWeightGrams / 1000).toFixed(1)} kg` : ''}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-brand-500/[0.07] border border-brand-500/25 px-3.5 py-2.5 text-xs font-semibold text-brand-700 dark:text-brand-300">
            <Icon name="download" size={14} /> Order digital — file dikirim otomatis ke pembeli, tanpa pengiriman barang.
          </p>
        )
      )}
      <p className="label mt-5">Riwayat Pembayaran</p>
      <PaymentHistory orderId={order.id} />
    </Modal>
  );
}

export function OrdersPage({ own }: { own?: boolean }) {
  const { user, t } = useApp();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<OrderWithBuyer | null>(null);
  useEffect(() => { setPage(1); }, [status]);
  const orders = useRemote(() => api.orders({ page, status }), [page, status, user?.id]);
  if (!user) return null;
  return (
    <DashShell title={own ? t('nav_my_orders') : t('orders')}>
      <PageHeader title={own ? t('nav_my_orders') : t('orders')} sub={own ? 'Riwayat pembelian kelas & produk beserta status pembayarannya.' : 'Seluruh transaksi course & shop.'} />
      <div className="mb-4"><Tabs tabs={[{ key: '', label: t('all') }, { key: 'pending', label: 'Pending' }, { key: 'paid', label: 'Lunas' }, { key: 'failed', label: 'Gagal' }, { key: 'expired', label: 'Kedaluwarsa' }, { key: 'cancelled', label: 'Dibatalkan' }]} active={status} onChange={setStatus} /></div>
      <RemoteView remote={orders} isEmpty={(p) => p.total === 0 && !status} emptyTitle="Belum ada order" emptySub={own ? 'Pembelianmu akan muncul di sini.' : 'Order masuk akan tampil di sini.'}>
        {(data) => (
          <PagedTable<OrderWithBuyer> page={data} onPage={setPage} rowKey={(o) => o.id}
            columns={[
              { key: 'item', label: 'Item', render: (o) => <div><p className="truncate font-bold text-base-900 dark:text-base-100 max-w-56">{o.items[0]?.title}{o.items.length > 1 ? ` +${o.items.length - 1}` : ''}</p><p className="font-mono text-[10px] text-base-400">{o.type === 'course' ? 'course purchase' : 'shop purchase'}</p></div> },
              ...(own ? [] : [{ key: 'buyer', label: 'Buyer', render: (o: OrderWithBuyer) => <span className="flex items-center gap-2 text-sm font-semibold"><Avatar name={o.buyerName ?? '?'} size={22} />{o.buyerName ?? '—'}</span> }]),
              { key: 'date', label: 'Tanggal', render: (o) => <span className="font-mono text-[11px] text-base-400">{fmtDateTime(o.createdAt)}</span> },
              { key: 'total', label: 'Total', render: (o) => <span className="font-display text-sm font-bold">{fmtMoney(o.total)}</span> },
              { key: 'status', label: 'Status', render: (o) => <StatusBadge status={o.status} /> },
            ]}
            rowActions={(o) => (
              <div className="flex items-center justify-end gap-1">
                {own && o.status === 'pending' && <Link to={`/checkout/${o.id}`} className="btn-outline btn-sm">Bayar</Link>}
                <IconButton icon="eye" title="Detail" tone="brand" onClick={() => setDetail(o)} />
              </div>
            )} />
        )}
      </RemoteView>
      {detail && <OrderDetail order={detail} onClose={() => setDetail(null)} />}
    </DashShell>
  );
}

/* ================= payments ================= */

export function PaymentsPage() {
  const { user, t } = useApp();
  const [detail, setDetail] = useState<PaymentWithBuyer | null>(null);
  const [page, setPage] = useState(1);
  const [logPage, setLogPage] = useState(1);
  const payments = useRemote(() => api.payments({ page }), [page]);
  const logs = useRemote(() => api.webhookLogs({ page: logPage }), [logPage]);
  // Gateway configuration is requested only by users allowed to read it (super_admin / manage_settings).
  const canReadGateway = can(user, 'manage_settings');
  const gateway = useRemote(() => (canReadGateway ? api.paymentSettings() : Promise.resolve(null)), [canReadGateway]);
  if (!user) return null;
  return (
    <DashShell title={t('payments')}>
      <PageHeader title="Pembayaran & Webhook" sub={gateway.data ? `Gateway aktif: ${gateway.data.gateway} · mode ${gateway.data.mode}` : 'Transaksi pembayaran yang tercatat di server.'} />
      <RemoteView remote={payments} isEmpty={(p) => p.total === 0} emptyTitle="Belum ada pembayaran" emptySub="Transaksi yang diinisiasi dari checkout tampil di sini.">
        {(data) => (
          <PagedTable<PaymentWithBuyer> page={data} onPage={setPage} rowKey={(p) => p.id}
            columns={[
              { key: 'ref', label: 'Reference', render: (p) => <span className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400">{p.reference}</span> },
              { key: 'buyer', label: 'Buyer', render: (p) => <span className="text-sm">{p.buyerName ?? '—'}</span> },
              { key: 'gw', label: 'Gateway', render: (p) => <div className="flex items-center gap-1.5"><Badge tone={p.gateway === 'tripay' ? 'brand' : p.gateway === 'xendit' ? 'info' : 'accent'}>{p.gateway}</Badge><span className="text-xs text-base-400">{p.method}</span></div> },
              { key: 'mode', label: 'Mode', render: (p) => <Badge tone={p.mode === 'sandbox' ? 'warn' : 'ok'}>{p.mode}</Badge> },
              { key: 'amount', label: 'Amount', render: (p) => <span className="font-display text-sm font-bold">{fmtMoney(p.amount)}</span> },
              { key: 'status', label: 'Status', render: (p) => <StatusBadge status={p.status} /> },
            ]}
            rowActions={(p) => <IconButton icon="eye" title="Log transaksi" tone="brand" onClick={() => setDetail(p)} />} />
        )}
      </RemoteView>
      <div className="mt-6">
        <h2 className="mb-3 font-display text-base font-bold text-base-900 dark:text-base-50">Webhook Log (proteksi duplikasi)</h2>
        <RemoteView remote={logs} isEmpty={(p) => p.total === 0} emptyTitle="Belum ada webhook diterima.">
          {(data) => (
            <PagedTable page={data} onPage={setLogPage} rowKey={(w) => w.id}
              columns={[
                { key: 'ref', label: 'Reference', render: (w) => <span className="font-mono text-xs">{w.reference}</span> },
                { key: 'gw', label: 'Gateway', render: (w) => <Badge tone="neutral">{w.gateway}</Badge> },
                { key: 'status', label: 'Status', render: (w) => <span className="font-mono text-xs">{w.status}</span> },
                { key: 'result', label: 'Hasil', render: (w) => <Badge tone={w.result === 'processed' ? 'ok' : w.result === 'duplicate' ? 'warn' : 'danger'}>{w.result}</Badge> },
                { key: 'date', label: 'Waktu', render: (w) => <span className="font-mono text-[11px] text-base-400">{fmtDateTime(w.createdAt)}</span> },
              ]} />
          )}
        </RemoteView>
      </div>
      {detail && (
        <Modal open onClose={() => setDetail(null)} title={`Payment ${detail.reference}`} wide>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={detail.status} /><Badge tone={detail.mode === 'sandbox' ? 'warn' : 'ok'}>{detail.mode}</Badge>
            <span className="ml-auto font-display text-lg font-bold">{fmtMoney(detail.amount)}</span>
          </div>
          <div className="space-y-1.5 rounded-lg bg-base-100 dark:bg-base-850 p-4 font-mono text-[11px] text-base-600 dark:text-base-300">
            {detail.events.map((ev, i) => <p key={i}>[{fmtDateTime(ev.at)}] {ev.event}</p>)}
          </div>
        </Modal>
      )}
    </DashShell>
  );
}

/* ================= wallet & withdrawals ================= */

function WithdrawModal({ onClose, available, onSubmitted }: { onClose: () => void; available: number | null; onSubmitted: () => void }) {
  const { user, toast } = useApp();
  const [f, setF] = useState({ amount: 0, bankName: '', accountName: '', accountNumber: '', notes: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  const submit = () => {
    setBusy(true); setErr('');
    void api.requestWithdrawal({ amount: f.amount, bank_name: f.bankName, account_name: f.accountName, account_number: f.accountNumber, notes: f.notes }).then(() => {
      toast('success', 'Pengajuan withdrawal dikirim ke admin.'); onSubmitted(); onClose();
    }).catch((error) => setErr(error instanceof Error ? error.message : 'Gagal mengajukan withdrawal.')).finally(() => setBusy(false));
  };
  return (
    <Modal open onClose={onClose} title="Ajukan Withdrawal" footer={
      <><button className="btn-ghost" onClick={onClose}>Batal</button>
        <button className="btn-primary" disabled={busy} onClick={submit}><Icon name="send" size={14} /> Ajukan</button></>
    }>
      {err && <p className="mb-3 rounded-lg border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm font-semibold text-danger-500">{err}</p>}
      <div className="mb-4 rounded-lg bg-brand-500/[0.07] border border-brand-500/25 px-4 py-3 text-sm">
        Saldo dapat ditarik: <b className="font-display text-brand-600 dark:text-brand-400">{available === null ? '—' : fmtMoney(available)}</b>
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
  const { user, t } = useApp();
  const [withdraw, setWithdraw] = useState(false);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [wdPage, setWdPage] = useState(1);
  const wallet = useRemote(() => api.wallet(), [user?.id]);
  const ledger = useRemote(() => api.walletLedger({ page: ledgerPage }), [ledgerPage, wallet.data]);
  const withdrawals = useRemote(() => api.myWithdrawals({ page: wdPage }), [wdPage, wallet.data]);
  if (!user) return null;
  const summary = wallet.data?.summary;
  return (
    <DashShell title={t('wallet')}>
      <PageHeader title="Dompet Instructor" sub="Saldo dihitung server dari ledger — setiap penjualan tercatat gross, fee platform, dan net."
        actions={<button className="btn-primary" disabled={!summary} onClick={() => setWithdraw(true)}><Icon name="banknote" size={15} /> Tarik Saldo</button>} />
      <RemoteView remote={wallet}>
        {(data) => (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon="wallet" label="Saldo tersedia" value={fmtMoney(data.summary.available)} delay={0} />
            <StatCard icon="chart" label="Total Pendapatan (net)" value={fmtMoney(data.summary.earned)} sub={`gross ${fmtMoney(data.summary.gross)}`} tone="ok" delay={50} />
            <StatCard icon="clock" label="Withdrawal Tertahan" value={fmtMoney(data.summary.reserved)} tone="warn" delay={100} />
            <StatCard icon="check-circle" label="Fee Platform" value={fmtMoney(data.summary.platformFee)} tone="info" delay={150} />
          </div>
        )}
      </RemoteView>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="card overflow-hidden anim-rise">
          <div className="border-b border-base-200 dark:border-base-800 px-5 py-3.5"><h2 className="font-display text-base font-bold text-base-900 dark:text-base-50">Ledger Transaksi</h2></div>
          <RemoteView remote={ledger} isEmpty={(p) => p.total === 0} emptyTitle="Belum ada transaksi.">
            {(page) => (
              <>
                <ul>
                  {page.items.map((tx) => (
                    <li key={tx.id} className="flex items-center gap-3 border-b border-base-100 dark:border-base-800 px-5 py-3 last:border-0">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tx.amount >= 0 ? 'bg-ok-500/12 text-ok-500' : 'bg-danger-500/12 text-danger-500'}`}>
                        <Icon name={tx.type === 'earning' ? 'arrow-down' : 'arrow-up'} size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-base-800 dark:text-base-100">{tx.note}</p>
                        <p className="font-mono text-[10px] text-base-400">{fmtDateTime(tx.createdAt)} · {tx.status}{tx.gross > 0 ? ` · gross ${fmtMoney(tx.gross)} · fee ${fmtMoney(tx.platformFee)}` : ''}</p>
                      </div>
                      <span className={`font-display text-sm font-bold ${tx.amount >= 0 ? 'text-ok-500' : 'text-danger-500'}`}>{tx.amount >= 0 ? '+' : ''}{fmtMoney(tx.amount)}</span>
                    </li>
                  ))}
                </ul>
                <Pager page={page} onPage={setLedgerPage} />
              </>
            )}
          </RemoteView>
        </div>
        <div className="card overflow-hidden anim-rise" style={{ animationDelay: '80ms' }}>
          <div className="border-b border-base-200 dark:border-base-800 px-5 py-3.5"><h2 className="font-display text-base font-bold text-base-900 dark:text-base-50">Riwayat Withdrawal</h2></div>
          <RemoteView remote={withdrawals} isEmpty={(p) => p.total === 0} emptyTitle="Belum ada pengajuan.">
            {(page) => (
              <>
                <ul>
                  {page.items.map((w) => (
                    <li key={w.id} className="border-b border-base-100 dark:border-base-800 px-5 py-3 last:border-0">
                      <div className="flex items-center justify-between">
                        <span className="font-display text-sm font-bold text-base-900 dark:text-base-50">{fmtMoney(w.amount)}</span>
                        <StatusBadge status={w.status} />
                      </div>
                      <p className="mt-0.5 font-mono text-[10px] text-base-400">{w.bankName} · {w.accountNumber} · {fmtDate(w.createdAt)}{w.adminNote ? ` · catatan: ${w.adminNote}` : ''}</p>
                    </li>
                  ))}
                </ul>
                <Pager page={page} onPage={setWdPage} />
              </>
            )}
          </RemoteView>
        </div>
      </div>
      {withdraw && <WithdrawModal available={summary?.available ?? null} onSubmitted={wallet.reload} onClose={() => setWithdraw(false)} />}
    </DashShell>
  );
}

/* ================= my digital products ================= */

export function MyDigitalPage() {
  const { user, toast, t } = useApp();
  const [page, setPage] = useState(1);
  const deliveries = useRemote(() => api.digitalDeliveries({ page }), [page, user?.id]);
  if (!user) return null;
  return (
    <DashShell title={t('nav_digital')}>
      <PageHeader title="Produk Digital Saya" sub="File & license key dikirim otomatis setelah pembayaran berhasil — tanpa pengiriman barang." />
      <RemoteView remote={deliveries}>
        {(data) => data.total === 0 ? (
          <EmptyState icon="download" title="Belum ada produk digital" sub="Produk digital yang kamu beli akan tersedia di sini untuk diunduh kapan saja."
            action={<Link to="/shop" className="btn-primary"><Icon name="store" size={14} /> Jelajahi Toko</Link>} />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {data.items.map((d, i) => (
                <div key={d.id} className="card card-hover p-5 anim-rise" style={{ animationDelay: `${(i % 2) * 60}ms` }}>
                  <div className="flex gap-4">
                    <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-accent-400/12 text-accent-500"><Icon name="download" size={26} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-display text-sm font-bold text-base-900 dark:text-base-50">{d.productName}</h3>
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
                    {d.downloadUrl && d.status === 'active' ? (
                      <a href={api.digitalDownloadUrl(d.id)} download target="_blank" rel="noopener noreferrer" className="btn-primary btn-sm flex-1">
                        <Icon name="download" size={13} /> Unduh File
                      </a>
                    ) : (
                      <span className="btn-ghost btn-sm flex-1 !text-base-400 pointer-events-none"><Icon name="alert-circle" size={13} /> {d.status === 'active' ? 'File belum diunggah penjual' : 'Akses dicabut'}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="card mt-4"><Pager page={data} onPage={setPage} /></div>
          </>
        )}
      </RemoteView>
    </DashShell>
  );
}

export function WithdrawalsPage() {
  const { user, toast, t } = useApp();
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [process, setProcess] = useState<{ w: ApiAdminWithdrawal; status: Withdrawal['status'] } | null>(null);
  const [note, setNote] = useState('');
  const [withdraw, setWithdraw] = useState(false);
  const isInstructor = user?.roleKey === 'instructor';
  useEffect(() => { setPage(1); }, [filter]);
  const rows = useRemote(() => (isInstructor ? api.myWithdrawals({ page, status: filter }) : api.adminWithdrawals({ page, status: filter })), [page, filter, isInstructor]);
  const wallet = useRemote(() => (isInstructor ? api.wallet() : Promise.resolve(null)), [isInstructor, rows.data]);
  if (!user) return null;

  return (
    <DashShell title={t('withdrawals')}>
      <PageHeader title={isInstructor ? 'Withdrawal Saya' : 'Proses Withdrawal'} sub={isInstructor ? 'Tarik pendapatanmu ke rekening bank.' : 'Setujui, proses, atau tolak pengajuan instructor.'}
        actions={isInstructor ? <button className="btn-primary" onClick={() => setWithdraw(true)}><Icon name="banknote" size={15} /> Ajukan Withdrawal</button> : undefined} />
      <div className="mb-4"><Tabs tabs={[{ key: '', label: t('all') }, { key: 'pending', label: 'Pending' }, { key: 'approved', label: 'Disetujui' }, { key: 'processing', label: 'Diproses' }, { key: 'completed', label: 'Selesai' }, { key: 'rejected', label: 'Ditolak' }]} active={filter} onChange={setFilter} /></div>
      <RemoteView remote={rows} isEmpty={(p) => p.total === 0 && !filter} emptyTitle="Belum ada withdrawal" emptySub="Pengajuan withdrawal tampil di sini.">
        {(data) => (
          <PagedTable<ApiAdminWithdrawal> page={data} onPage={setPage} rowKey={(w) => w.id}
            columns={[
              ...(isInstructor ? [] : [{ key: 'who', label: 'Instructor', render: (w: ApiAdminWithdrawal) => <span className="flex items-center gap-2 text-sm font-semibold"><Avatar name={w.userName ?? '—'} size={22} />{w.userName ?? '—'}</span> }]),
              { key: 'amount', label: 'Jumlah', render: (w) => <span className="font-display text-sm font-bold">{fmtMoney(w.amount)}</span> },
              { key: 'bank', label: 'Rekening', render: (w) => <div><p className="text-sm font-semibold">{w.bankName} — {w.accountName}</p><p className="font-mono text-[10px] text-base-400">{w.accountNumber}</p></div> },
              { key: 'date', label: 'Diajukan', render: (w) => <span className="font-mono text-[11px] text-base-400">{fmtDateTime(w.createdAt)}</span> },
              { key: 'status', label: 'Status', render: (w) => <StatusBadge status={w.status} /> },
            ]}
            rowActions={isInstructor ? undefined : (w) => (
              <div className="flex items-center justify-end gap-1">
                {w.status === 'pending' && <button className="btn-outline btn-sm" onClick={() => { setProcess({ w, status: 'approved' }); setNote(''); }}>Setujui</button>}
                {(w.status === 'approved' || w.status === 'processing') && <button className="btn-outline btn-sm" onClick={() => { setProcess({ w, status: w.status === 'approved' ? 'processing' : 'completed' }); setNote(''); }}>{w.status === 'approved' ? 'Proses' : 'Selesaikan'}</button>}
                {(w.status === 'pending' || w.status === 'approved' || w.status === 'processing') && <button className="btn-ghost btn-sm !text-danger-500" onClick={() => { setProcess({ w, status: 'rejected' }); setNote(''); }}>Tolak</button>}
              </div>
            )} />
        )}
      </RemoteView>
      {process && (
        <Modal open onClose={() => setProcess(null)} title={`Konfirmasi: ${process.status}`} footer={
          <><button className="btn-ghost" onClick={() => setProcess(null)}>Batal</button>
            <button className={process.status === 'rejected' ? 'btn-danger' : 'btn-primary'} onClick={() => {
              void api.updateWithdrawal(process.w.id, process.status, note).then(() => {
                toast('success', `Withdrawal ${process.status}.`); rows.reload(); setProcess(null);
              }).catch((error) => toast('error', error instanceof Error ? error.message : 'Gagal memperbarui withdrawal.'));
            }}><Icon name="check" size={14} /> Konfirmasi</button></>
        }>
          <p className="text-sm text-base-500 mb-3">Pengajuan <b>{process.w.userName ?? '—'}</b> sebesar <b className="font-display">{fmtMoney(process.w.amount)}</b> → <b>{process.status}</b>.</p>
          <Field label="Catatan (opsional)"><TextArea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </Modal>
      )}
      {withdraw && <WithdrawModal available={wallet.data?.summary.available ?? null} onSubmitted={rows.reload} onClose={() => setWithdraw(false)} />}
    </DashShell>
  );
}
