import { db, uid, now, type ID, type User, type Order, type OrderItem, type Payment, type GatewayKey, type Course, type Product, type Withdrawal, type WalletTx } from './db';
import { audit, fnv1a, getSetting, notify, notifyAdmins, setSettings } from './services';
import { CourseService, EnrollmentService } from './lms';

/* ================= payment gateway abstraction =================
   PaymentGatewayInterface ← TripayService / XenditService / StripeService
   (production: HTTP call ke API masing-masing; sandbox: simulasi lokal) */

export interface GatewayMethod { key: string; label: string; fee: { kind: 'flat' | 'pct'; value: number }; }
export interface GatewayInfo { key: GatewayKey; name: string; methods: GatewayMethod[]; keyFields: { key: string; label: string }[]; }

export const GATEWAYS: GatewayInfo[] = [
  {
    key: 'tripay', name: 'Tripay',
    methods: [
      { key: 'QRIS', label: 'QRIS', fee: { kind: 'flat', value: 4000 } },
      { key: 'BRIVA', label: 'Virtual Account BRI', fee: { kind: 'flat', value: 4000 } },
      { key: 'MANDIRIVA', label: 'Virtual Account Mandiri', fee: { kind: 'flat', value: 4000 } },
      { key: 'DANA', label: 'DANA', fee: { kind: 'pct', value: 1.5 } },
      { key: 'OVO', label: 'OVO', fee: { kind: 'pct', value: 1.5 } },
    ],
    keyFields: [{ key: 'tripay_api_key', label: 'API Key' }, { key: 'tripay_private_key', label: 'Private Key' }, { key: 'tripay_merchant_code', label: 'Merchant Code' }],
  },
  {
    key: 'xendit', name: 'Xendit',
    methods: [
      { key: 'BCAVA', label: 'Virtual Account BCA', fee: { kind: 'flat', value: 4000 } },
      { key: 'BNCVA', label: 'Virtual Account BNC', fee: { kind: 'flat', value: 4000 } },
      { key: 'LALAI', label: 'LinkAja', fee: { kind: 'pct', value: 1.5 } },
      { key: 'CREDIT_CARD', label: 'Kartu Kredit', fee: { kind: 'pct', value: 2.9 } },
    ],
    keyFields: [{ key: 'xendit_api_key', label: 'Secret API Key' }, { key: 'xendit_callback_token', label: 'Callback Verification Token' }],
  },
  {
    key: 'stripe', name: 'Stripe',
    methods: [
      { key: 'CARD', label: 'Kartu Kredit / Debit', fee: { kind: 'pct', value: 2.9 } },
      { key: 'LINK', label: 'Stripe Link', fee: { kind: 'pct', value: 2.9 } },
    ],
    keyFields: [{ key: 'stripe_publishable_key', label: 'Publishable Key' }, { key: 'stripe_secret_key', label: 'Secret Key' }, { key: 'stripe_webhook_secret', label: 'Webhook Secret' }],
  },
];

export const activeGateway = (): GatewayInfo => {
  const key = (getSetting('gateway_active', 'tripay') as GatewayKey);
  return GATEWAYS.find((g) => g.key === key) ?? GATEWAYS[0];
};
export const gatewayMode = (): 'sandbox' | 'live' => (getSetting('gateway_mode', 'sandbox') === 'live' ? 'live' : 'sandbox');
export const gatewaySecret = (gw: GatewayKey): string => {
  const map: Record<GatewayKey, string> = { tripay: getSetting('tripay_private_key'), xendit: getSetting('xendit_callback_token'), stripe: getSetting('stripe_webhook_secret') };
  const v = map[gw];
  return v && v.length > 0 ? v : `${gw}-sandbox-secret`;
};
export const computeFee = (gw: GatewayKey, methodKey: string, amount: number): number => {
  const m = GATEWAYS.find((g) => g.key === gw)?.methods.find((x) => x.key === methodKey);
  if (!m) return 0;
  return m.fee.kind === 'flat' ? m.fee.value : Math.round((amount * m.fee.value) / 100);
};
const sign = (reference: string, amount: number, gw: GatewayKey) => fnv1a(`${reference}|${amount}|${gatewaySecret(gw)}`);

/* ================= orders ================= */

export const OrderService = {
  list: () => db.all('orders').sort((a, b) => b.createdAt - a.createdAt),
  byId: (id: ID) => db.byId('orders', id),
  ofUser: (userId: ID) => db.where('orders', (o) => o.userId === userId).sort((a, b) => b.createdAt - a.createdAt),
  paymentsOf: (orderId: ID) => db.where('payments', (p) => p.orderId === orderId),

  createCourseOrder(user: User, course: Course): { order: Order; free: boolean } {
    const price = CourseService.effectivePrice(course);
    const item: OrderItem = { kind: 'course', refId: course.id, title: course.title, price, qty: 1, instructorId: course.instructorId, thumbnail: course.thumbnail };
    const order = db.insert('orders', {
      userId: user.id, type: 'course', status: 'pending', subtotal: price, gatewayFee: 0,
      total: price, currency: getSetting('currency', 'IDR'), items: [item], paidAt: null,
    });
    audit(user.id, user.name, 'create', 'order', order.id, `Order kelas "${course.title}"`);
    if (course.isFree || price === 0) {
      db.update('orders', order.id, { status: 'paid', paidAt: now() });
      EnrollmentService.enrollAfterPayment(user, course);
      return { order: db.byId('orders', order.id)!, free: true };
    }
    return { order, free: false };
  },

  createShopOrder(user: User, items: OrderItem[], gatewayFee = 0): Order {
    const subtotal = items.reduce((a, i) => a + i.price * i.qty, 0);
    const order = db.insert('orders', {
      userId: user.id, type: 'shop', status: 'pending', subtotal, gatewayFee,
      total: subtotal + gatewayFee, currency: getSetting('currency', 'IDR'), items, paidAt: null,
    });
    audit(user.id, user.name, 'create', 'order', order.id, `Order shop (${items.length} item)`);
    return order;
  },
};

/* ================= payments & webhook ================= */

export const PaymentService = {
  list: () => db.all('payments').sort((a, b) => b.createdAt - a.createdAt),
  ofUser: (userId: ID) => db.where('payments', (p) => !!p.orderId && OrderService.byId(p.orderId)?.userId === userId).sort((a, b) => b.createdAt - a.createdAt),
  byReference: (ref: string) => db.find('payments', (p) => p.reference === ref),

  initiate(order: Order, gw: GatewayKey, methodKey: string): Payment {
    const gwInfo = GATEWAYS.find((g) => g.key === gw)!;
    const fee = computeFee(gw, methodKey, order.subtotal);
    const method = gwInfo.methods.find((m) => m.key === methodKey);
    const reference = `${gw.toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${uid().slice(-5).toUpperCase()}`;
    const amount = order.subtotal + fee;
    const signature = sign(reference, amount, gw);
    db.update('orders', order.id, { gatewayFee: fee, total: amount });
    const payment = db.insert('payments', {
      orderId: order.id, gateway: gw, mode: gatewayMode(), method: method?.label ?? methodKey,
      reference, merchantRef: order.id, amount, fee, status: 'pending', signature,
      events: [{ at: now(), event: `invoice_created via ${gwInfo.name} (${method?.label})` }],
    });
    const buyer = db.byId('users', order.userId);
    audit(buyer?.id ?? null, buyer?.name ?? 'guest', 'initiate_payment', 'payment', payment.id, `${reference} — ${method?.label}`);
    return payment;
  },

  /**
   * Webhook handler — satu-satunya jalan mengubah status pembayaran.
   * Aman dari duplikasi: unique reference + status guard + webhook log.
   */
  handleWebhook(payload: { reference: string; status: 'paid' | 'failed'; signature: string; at: number }):
    { result: 'processed' | 'duplicate' | 'invalid'; payment?: Payment } {
    const payment = PaymentService.byReference(payload.reference);
    if (!payment) return { result: 'invalid' };
    const expected = sign(payload.reference, payment.amount, payment.gateway);
    if (payload.signature !== expected) {
      db.insert('webhookLogs', { reference: payload.reference, payloadHash: payload.signature, gateway: payment.gateway, status: payload.status, result: 'invalid' });
      return { result: 'invalid' };
    }
    const logKey = `${payload.reference}:${payload.status}`;
    const dup = db.find('webhookLogs', (w) => w.payloadHash === logKey);
    if (dup || payment.status === 'paid' || payment.status === 'failed') {
      db.insert('webhookLogs', { reference: payload.reference, payloadHash: logKey, gateway: payment.gateway, status: payload.status, result: 'duplicate' });
      return { result: 'duplicate', payment };
    }
    db.insert('webhookLogs', { reference: payload.reference, payloadHash: logKey, gateway: payment.gateway, status: payload.status, result: 'processed' });
    db.update('payments', payment.id, {
      status: payload.status,
      events: [...payment.events, { at: payload.at, event: `webhook:${payload.status} — signature valid` }],
    });
    const order = OrderService.byId(payment.orderId);
    if (!order) return { result: 'processed' };
    if (payload.status === 'paid') {
      db.update('orders', order.id, { status: 'paid', paidAt: payload.at });
      fulfillOrder(order, payment);
    } else {
      db.update('orders', order.id, { status: 'failed' });
      const buyer = db.byId('users', order.userId);
      if (buyer) notify(buyer.id, 'Pembayaran gagal', `Pembayaran ${payment.reference} gagal. Silakan coba lagi.`, `/checkout/${order.id}`, 'danger');
    }
    audit(null, `webhook:${payment.gateway}`, 'payment_webhook', 'payment', payment.id, `${payload.reference} → ${payload.status}`);
    return { result: 'processed', payment: db.byId('payments', payment.id) };
  },

  /** Sandbox: gateway simulator memanggil webhook dengan signature yang benar. */
  async fireSandboxWebhook(reference: string, status: 'paid' | 'failed', delayMs = 1400) {
    const payment = PaymentService.byReference(reference);
    if (!payment) return { result: 'invalid' as const };
    await new Promise((r) => setTimeout(r, delayMs));
    return PaymentService.handleWebhook({
      reference, status, signature: sign(reference, payment.amount, payment.gateway), at: now(),
    });
  },
};

/** Fulfillment: enrollment + wallet + stock — dijalankan sekali per order (idempotent). */
function fulfillOrder(order: Order, payment: Payment) {
  const buyer = db.byId('users', order.userId);
  order.items.forEach((item) => {
    if (item.kind === 'course') {
      const course = CourseService.byId(item.refId);
      if (course && buyer) {
        EnrollmentService.enrollAfterPayment(buyer, course);
        if (item.instructorId && item.price > 0) WalletService.creditEarning(item.instructorId, order.id, item, payment.fee, order.subtotal);
      }
    } else {
      const product = db.byId('products', item.refId);
      if (product) db.update('products', product.id, { stock: Math.max(0, product.stock - item.qty) });
    }
  });
  if (buyer) notify(buyer.id, 'Pembayaran berhasil', `Order ${payment.reference} telah dibayar. Terima kasih!`, order.type === 'course' ? '/dashboard/my-learning' : '/dashboard/orders', 'success');
}

/* ================= instructor wallet (ledger) ================= */

export const WalletService = {
  ledger: (userId: ID) => db.where('walletTx', (t) => t.userId === userId).sort((a, b) => b.createdAt - a.createdAt),
  summary(userId: ID) {
    const txs = db.where('walletTx', (t) => t.userId === userId);
    const earnings = txs.filter((t) => t.type === 'earning' && t.status === 'completed');
    const totalEarning = earnings.reduce((a, t) => a + t.amount, 0);
    const totalGross = earnings.reduce((a, t) => a + t.gross, 0);
    const totalPlatformFee = earnings.reduce((a, t) => a + t.platformFee, 0);
    const withdrawals = db.where('withdrawals', (w) => w.userId === userId);
    const pendingWd = withdrawals.filter((w) => w.status === 'pending').reduce((a, w) => a + w.amount, 0);
    const reservedWd = withdrawals.filter((w) => w.status === 'approved' || w.status === 'processing').reduce((a, w) => a + w.amount, 0);
    const completedWd = withdrawals.filter((w) => w.status === 'completed').reduce((a, w) => a + w.amount, 0);
    const balance = totalEarning - reservedWd - completedWd;
    return { balance: Math.max(0, balance), totalEarning, totalGross, totalPlatformFee, pendingWd, reservedWd, completedWd, withdrawable: Math.max(0, balance - pendingWd) };
  },
  /** 15% platform service fee (konfigurable) — semua perhitungan di backend. */
  creditEarning(instructorId: ID, orderId: ID, item: OrderItem, orderFee: number, orderSubtotal: number) {
    const pct = parseFloat(getSetting('platform_fee_percent', '15')) || 15;
    const gross = item.price * item.qty;
    const platformFee = Math.round((gross * pct) / 100);
    const paymentFee = orderSubtotal > 0 ? Math.round((orderFee * gross) / orderSubtotal) : 0;
    const net = gross - platformFee;
    const tx = db.insert('walletTx', {
      userId: instructorId, type: 'earning', refId: item.refId, orderId, amount: net, gross,
      platformFee, paymentFee, status: 'completed', note: `Penjualan "${item.title}" (fee platform ${pct}%)`,
    } as Omit<WalletTx, 'id' | 'createdAt' | 'updatedAt'>);
    const instructor = db.byId('users', instructorId);
    if (instructor) notify(instructorId, 'Pendapatan bertambah', `+${net.toLocaleString('id-ID')} dari "${item.title}".`, '/dashboard/wallet', 'success');
    return tx;
  },
};

/* ================= withdrawals ================= */

export const MIN_WITHDRAWAL = 25000;

export const WithdrawalService = {
  list: () => db.all('withdrawals').sort((a, b) => b.createdAt - a.createdAt),
  ofUser: (userId: ID) => db.where('withdrawals', (w) => w.userId === userId).sort((a, b) => b.createdAt - a.createdAt),
  request(user: User, data: { amount: number; bankName: string; accountName: string; accountNumber: string; notes: string }): { ok: boolean; error?: string; w?: Withdrawal } {
    const s = WalletService.summary(user.id);
    if (!data.bankName.trim() || !data.accountName.trim() || !data.accountNumber.trim()) return { ok: false, error: 'Data rekening wajib diisi.' };
    if (data.amount < MIN_WITHDRAWAL) return { ok: false, error: `Minimal withdrawal ${MIN_WITHDRAWAL.toLocaleString('id-ID')}.` };
    if (data.amount > s.withdrawable) return { ok: false, error: 'Saldo dapat ditarik tidak mencukupi.' };
    const w = db.insert('withdrawals', {
      userId: user.id, amount: data.amount, bankName: data.bankName.trim(), accountName: data.accountName.trim(),
      accountNumber: data.accountNumber.trim(), notes: data.notes.trim(), status: 'pending', processedBy: null, processedAt: null, adminNote: '',
    });
    db.insert('walletTx', {
      userId: user.id, type: 'withdrawal', refId: w.id, orderId: null, amount: -data.amount, gross: data.amount,
      platformFee: 0, paymentFee: 0, status: 'pending', note: `Pengajuan withdrawal ke ${data.bankName}`,
    } as Omit<WalletTx, 'id' | 'createdAt' | 'updatedAt'>);
    notifyAdmins('Pengajuan withdrawal baru', `${user.name} mengajukan ${data.amount.toLocaleString('id-ID')}.`, '/dashboard/withdrawals');
    audit(user.id, user.name, 'request', 'withdrawal', w.id, `Withdrawal ${data.amount.toLocaleString('id-ID')}`);
    return { ok: true, w };
  },
  setStatus(id: ID, status: Withdrawal['status'], actor: User, adminNote = '') {
    const w = db.byId('withdrawals', id);
    if (!w) return;
    db.update('withdrawals', id, { status, processedBy: actor.id, processedAt: now(), adminNote });
    const ledger = db.find('walletTx', (t) => t.refId === id && t.type === 'withdrawal');
    if (ledger) db.update('walletTx', ledger.id, { status: status === 'rejected' ? 'rejected' : status === 'completed' ? 'completed' : 'pending' });
    const user = db.byId('users', w.userId);
    const labels: Record<string, string> = { approved: 'disetujui', processing: 'sedang diproses', completed: 'selesai — dana dikirim', rejected: `ditolak${adminNote ? ` (${adminNote})` : ''}` };
    if (user) notify(user.id, `Withdrawal ${labels[status] ?? status}`, `Withdrawal ${w.amount.toLocaleString('id-ID')} ${labels[status] ?? status}.`, '/dashboard/withdrawals', status === 'rejected' ? 'danger' : 'success');
    audit(actor.id, actor.name, 'update', 'withdrawal', id, `Status → ${status}`);
  },
};

/* ================= shop / cart ================= */

export const ShopService = {
  products: () => db.all('products'),
  published: () => db.where('products', (p) => p.status === 'published'),
  cartOf: (userId: ID) => db.where('cartItems', (c) => c.userId === userId),
  cartDetail(userId: ID) {
    const items = ShopService.cartOf(userId).map((c) => ({ item: c, product: db.byId('products', c.productId) })).filter((x) => !!x.product);
    const subtotal = items.reduce((a, x) => a + (x.product!.discountPrice > 0 && x.product!.discountPrice < x.product!.price ? x.product!.discountPrice : x.product!.price) * x.item.qty, 0);
    return { items, subtotal, count: items.reduce((a, x) => a + x.item.qty, 0) };
  },
  addToCart(user: User, product: Product, qty = 1): { ok: boolean; error?: string } {
    if (product.stock <= 0) return { ok: false, error: 'Stok habis.' };
    const existing = db.find('cartItems', (c) => c.userId === user.id && c.productId === product.id);
    if (existing) {
      const nextQty = Math.min(product.stock, existing.qty + qty);
      db.update('cartItems', existing.id, { qty: nextQty });
    } else {
      db.insert('cartItems', { userId: user.id, productId: product.id, qty: Math.min(product.stock, qty) });
    }
    return { ok: true };
  },
  setQty(user: User, productId: ID, qty: number) {
    const item = db.find('cartItems', (c) => c.userId === user.id && c.productId === productId);
    if (!item) return;
    const product = db.byId('products', productId);
    if (qty <= 0) { db.remove('cartItems', item.id); return; }
    db.update('cartItems', item.id, { qty: product ? Math.min(product.stock, qty) : qty });
  },
  removeItem(user: User, productId: ID) {
    const item = db.find('cartItems', (c) => c.userId === user.id && c.productId === productId);
    if (item) db.remove('cartItems', item.id);
  },
  clear(user: User) { ShopService.cartOf(user.id).forEach((c) => db.remove('cartItems', c.id)); },
  checkout(user: User): { ok: boolean; error?: string; order?: Order } {
    const { items, subtotal } = ShopService.cartDetail(user.id);
    if (items.length === 0) return { ok: false, error: 'Keranjang kosong.' };
    for (const x of items) {
      if (!x.product || x.product.stock < x.item.qty) return { ok: false, error: `Stok "${x.product?.name}" tidak mencukupi.` };
    }
    const orderItems: OrderItem[] = items.map((x) => ({
      kind: 'product' as const, refId: x.product!.id, title: x.product!.name,
      price: x.product!.discountPrice > 0 && x.product!.discountPrice < x.product!.price ? x.product!.discountPrice : x.product!.price,
      qty: x.item.qty, instructorId: null, thumbnail: x.product!.thumbnail,
    }));
    const order = OrderService.createShopOrder(user, orderItems);
    ShopService.clear(user);
    return { ok: true, order, error: undefined };
  },
};

/* ================= gateway settings helpers ================= */

export function saveGatewaySettings(patch: Record<string, string>) {
  setSettings(patch);
  const actor = (() => { try { return db.find('users', (u) => u.roleKey === 'super_admin'); } catch { return undefined; } })();
  audit(actor?.id ?? null, actor?.name ?? 'system', 'update', 'settings', null, 'Mengubah konfigurasi payment gateway');
}
export const setPlatformFee = (pct: string) => setSettings({ platform_fee_percent: pct });
export { uid as newId };
