<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\CartItem;
use App\Models\Enrollment;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Setting;
use App\Models\WebhookLog;
use App\Models\Voucher;
use App\Models\DigitalDelivery;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use App\Support\AdminAccess;
use App\Support\Pagination;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use App\Services\PaymentGatewayManager;
use App\Services\InstructorEarnings;
use App\Services\VoucherReservation;
use App\Services\StockReservation;
use App\Services\NotificationService;

class OrderController extends Controller
{
    public function webhookLogs(Request $request): JsonResponse
    {
        AdminAccess::authorize($request->user(), 'view_payments');
        $query = WebhookLog::query()
            ->when($request->string('result')->trim()->value(), fn ($q, string $result) => $q->where('result', $result))
            ->when($request->string('gateway')->trim()->value(), fn ($q, string $gateway) => $q->where('gateway', $gateway))
            ->latest()->orderByDesc('id');
        return response()->json(['webhook_logs' => Pagination::paginate($query, $request)]);
    }

    /** What a buyer needs to render checkout: server-selected provider, mode and its method list. */
    public function paymentOptions(): JsonResponse
    {
        try {
            $gateway = $this->activeGateway();
            $mode = $this->paymentMode();
        } catch (\InvalidArgumentException) {
            return response()->json(['message' => 'Konfigurasi payment gateway tidak valid.'], 503);
        }
        $methods = collect(config("payment.methods.{$gateway}", []))->map(fn (string $label, string $key) => ['key' => $key, 'label' => $label])->values();
        return response()->json(['gateway' => $gateway, 'mode' => $mode, 'methods' => $methods]);
    }

    /** Staff with manage_orders see every order; everyone else only their own purchases. */
    public function index(Request $request): JsonResponse
    {
        $query = Order::with(['items.instructor:id,name', 'user:id,name,email'])->withCount('payments')
            ->when($request->string('status')->trim()->value(), fn ($q, string $status) => $q->where('status', $status))
            ->when($request->string('type')->trim()->value(), fn ($q, string $type) => $q->where('type', $type))
            ->latest()->orderByDesc('id');
        if (!AdminAccess::allows($request->user(), 'manage_orders')) $query->where('user_id', $request->user()->id);
        return response()->json(Pagination::paginate($query, $request));
    }

    /** Staff with view_payments see every payment; everyone else only payments of their own orders. */
    public function payments(Request $request): JsonResponse
    {
        $query = Payment::with(['order:id,user_id', 'order.user:id,name,email'])
            ->when($request->string('order_id')->trim()->value(), fn ($q, string $orderId) => $q->where('order_id', $orderId))
            ->when($request->string('status')->trim()->value(), fn ($q, string $status) => $q->where('status', $status))
            ->latest()->orderByDesc('id');
        if (!AdminAccess::allows($request->user(), 'view_payments')) $query->whereHas('order', fn ($order) => $order->where('user_id', $request->user()->id));
        return response()->json(['payments' => Pagination::paginate($query, $request, 30)]);
    }

    public function show(Request $request, string $orderId): JsonResponse
    {
        $query = Order::with(['items.instructor:id,name', 'payments', 'user:id,name,email'])->where('id', $orderId);
        if (!AdminAccess::allows($request->user(), 'manage_orders')) $query->where('user_id', $request->user()->id);
        $order = $query->firstOrFail();

        return response()->json(['order' => $order]);
    }

    public function storeCourse(Request $request): JsonResponse
    {
        $data = $request->validate(['course_slug' => ['required', 'string', 'max:140']]);
        $course = Course::where('slug', $data['course_slug'])->where('status', 'published')->firstOrFail();
        $price = $course->is_free ? 0 : ($course->discount_price > 0 && $course->discount_price < $course->price ? $course->discount_price : $course->price);

        $order = DB::transaction(function () use ($request, $course, $price) {
            $order = Order::create([
                'id' => Str::lower(Str::random(12)), 'user_id' => $request->user()->id, 'type' => 'course',
                'status' => $price === 0 ? 'paid' : 'pending', 'subtotal' => $price, 'total' => $price,
                'currency' => 'IDR', 'paid_at' => $price === 0 ? now() : null, 'needs_shipping' => false,
            ]);
            OrderItem::create([
                'id' => Str::lower(Str::random(12)), 'order_id' => $order->id, 'kind' => 'course', 'ref_id' => $course->id,
                'title' => $course->title, 'price' => $price, 'qty' => 1, 'instructor_id' => $course->instructor_id,
                'thumbnail' => $course->thumbnail,
            ]);
            if ($price === 0) {
                Enrollment::firstOrCreate(
                    ['user_id' => $request->user()->id, 'course_id' => $course->id],
                    ['id' => Str::lower(Str::random(12)), 'status' => 'active', 'progress_pct' => 0]
                );
            }
            return $order;
        });

        return response()->json(['order' => $order->load('items')], $price === 0 ? 201 : 201);
    }

    public function storeShop(Request $request): JsonResponse
    {
        $data = $request->validate([
            'voucher_code' => ['nullable', 'string', 'max:40'],
            'shipping' => ['nullable', 'array'],
            'shipping.name' => ['nullable', 'string', 'max:120'],
            'shipping.address' => ['nullable', 'string', 'max:2000'],
            'shipping.phone' => ['nullable', 'string', 'max:30'],
            'shipping.note' => ['nullable', 'string', 'max:500'],
            'shipping.postal_code' => ['nullable', 'string', 'max:10'],
            'shipping.province_id' => ['nullable'],
            'shipping.city_id' => ['nullable'],
            'shipping.district_id' => ['nullable'],
            'shipping.subdistrict_id' => ['nullable'],
            'shipping.courier' => ['nullable', 'string', 'max:30'],
            'shipping.service' => ['nullable', 'string', 'max:60'],
            'shipping_cost' => ['nullable', 'integer', 'min:0'],
        ]);

        if (!empty($data['voucher_code'])) {
            app(VoucherReservation::class)->expireDue(Str::upper(trim($data['voucher_code'])));
        }

        $order = DB::transaction(function () use ($request, $data) {
            $items = CartItem::with(['product', 'variant'])->where('user_id', $request->user()->id)->get();
            if ($items->isEmpty()) abort(422, 'Keranjang kosong.');

            $lines = [];
            $subtotal = 0;
            $needsShipping = false;
            foreach ($items as $cartItem) {
                $product = $cartItem->product;
                if (!$product || $product->status !== 'published') abort(422, 'Produk dalam keranjang sudah tidak tersedia.');
                $stock = $cartItem->variant?->stock ?? $product->stock;
                if ($stock < $cartItem->qty) abort(422, "Stok produk {$product->name} tidak mencukupi.");
                $price = $cartItem->variant?->price ?: ($product->discount_price > 0 && $product->discount_price < $product->price ? $product->discount_price : $product->price);
                $needsShipping = $needsShipping || !$product->is_digital;
                $lines[] = ['cart' => $cartItem, 'product' => $product, 'price' => $price];
                $subtotal += $price * $cartItem->qty;
            }
            if ($needsShipping && (blank($data['shipping']['name'] ?? null) || blank($data['shipping']['address'] ?? null) || blank($data['shipping']['phone'] ?? null))) {
                abort(422, 'Alamat pengiriman wajib diisi untuk produk fisik.');
            }

            // Physical shipping is mandatory: destination + courier/service are
            // revalidated against the provider and the authoritative cost is
            // taken. The frontend-submitted cost is never trusted. Digital-only
            // carts skip this entirely (shipping_cost = 0, no provider contact).
            $shippingCost = 0;
            $shippingWeight = null;
            $shippingOption = null;
            $destination = null;
            $ship = $data['shipping'] ?? [];
            if ($needsShipping) {
                foreach (['province_id' => 'Provinsi', 'city_id' => 'Kabupaten/kota', 'district_id' => 'Kecamatan', 'subdistrict_id' => 'Kelurahan/desa'] as $key => $label) {
                    if (empty($ship[$key])) abort(422, "{$label} wajib dipilih untuk pengiriman.");
                }
                if (empty($ship['courier']) || empty($ship['service'])) abort(422, 'Kurir dan layanan pengiriman wajib dipilih.');
                // Validation/provider failures must surface as safe retryable
                // 422/502 responses, never as 500s from inside the transaction.
                try {
                    $revalidated = app(\App\Services\ShippingService::class)->revalidate(
                        \App\Services\ShippingService::cartLines($items),
                        $ship['province_id'], $ship['city_id'], $ship['district_id'], $ship['subdistrict_id'],
                        $ship['courier'], $ship['service']);
                } catch (\InvalidArgumentException $e) {
                    abort(422, $e->getMessage());
                } catch (\RuntimeException $e) {
                    abort(502, $e->getMessage());
                }
                $shippingCost = $revalidated['option']['cost'];
                $shippingWeight = $revalidated['weight_grams'];
                $shippingOption = $revalidated['option'];
                $destination = $revalidated['destination'];
            }

            $discount = 0;
            $voucher = null;
            if (!empty($data['voucher_code'])) {
                $voucher = Voucher::where('code', Str::upper(trim($data['voucher_code'])))->where('active', true)->lockForUpdate()->first();
                if (!$voucher || ($voucher->expires_at && $voucher->expires_at->isPast()) || ($voucher->usage_limit > 0 && $voucher->used_count >= $voucher->usage_limit) || $subtotal < $voucher->min_order) abort(422, 'Voucher tidak valid.');
                $discount = $voucher->type === 'percent' ? (int) round($subtotal * $voucher->value / 100) : $voucher->value;
                if ($voucher->max_discount > 0) $discount = min($discount, $voucher->max_discount);
                $discount = min($discount, $subtotal);
            }

            // Lock order is voucher -> stock everywhere to avoid MySQL deadlocks.
            app(StockReservation::class)->reserveCart($lines);

            $ttl = max(30, (int) config('commerce.pending_order_ttl_minutes', 30));
            $order = Order::create(['id' => Str::lower(Str::random(12)), 'user_id' => $request->user()->id, 'type' => 'shop', 'status' => 'pending', 'subtotal' => $subtotal, 'discount_amount' => $discount, 'shipping_cost' => $shippingCost, 'voucher_code' => $voucher?->code, 'total' => $subtotal + $shippingCost - $discount, 'currency' => 'IDR', 'needs_shipping' => $needsShipping, 'shipping_name' => $data['shipping']['name'] ?? null, 'shipping_address' => $data['shipping']['address'] ?? null, 'shipping_phone' => $data['shipping']['phone'] ?? null, 'shipping_weight_grams' => $shippingWeight, 'shipping_courier' => $shippingOption['courier'] ?? null, 'shipping_courier_name' => $shippingOption['courier_name'] ?? null, 'shipping_service' => $shippingOption['service'] ?? null, 'shipping_service_name' => $shippingOption['service_name'] ?? $shippingOption['description'] ?? null, 'shipping_etd' => $shippingOption['etd'] ?? null, 'shipping_province_id' => $destination['province_id'] ?? null, 'shipping_province_name' => $destination['province_name'] ?? null, 'shipping_city_id' => $destination['city_id'] ?? null, 'shipping_city_name' => $destination['city_name'] ?? null, 'shipping_district_id' => $destination['district_id'] ?? null, 'shipping_district_name' => $destination['district_name'] ?? null, 'shipping_subdistrict_id' => $destination['subdistrict_id'] ?? null, 'shipping_subdistrict_name' => $destination['subdistrict_name'] ?? null, 'shipping_postal_code' => $data['shipping']['postal_code'] ?? $destination['postal_code'] ?? null, 'shipping_note' => $data['shipping']['note'] ?? null, 'expires_at' => now()->addMinutes($ttl)]);
            $order->forceFill(['stock_reservation_status' => 'reserved'])->save();
            // used_count includes both active reservations and permanent usage.
            if ($voucher) {
                $voucher->increment('used_count');
                $order->forceFill(['voucher_id' => $voucher->id, 'voucher_reservation_status' => 'reserved',
                    'voucher_reserved_until' => now()->addMinutes(max(1, (int) config('commerce.voucher_reservation_minutes', 1440)))])->save();
            }
            foreach ($lines as $line) {
                $cart = $line['cart'];
                OrderItem::create(['id' => Str::lower(Str::random(12)), 'order_id' => $order->id, 'kind' => 'product', 'ref_id' => $line['product']->id, 'title' => $line['product']->name . ($cart->variant ? ' - ' . $cart->variant->label : ''), 'price' => $line['price'], 'qty' => $cart->qty, 'thumbnail' => $line['product']->thumbnail, 'variant_id' => $cart->variant_id, 'variant_label' => $cart->variant?->label, 'is_digital' => $line['product']->is_digital]);
            }
            return $order;
        });

        return response()->json(['order' => $order->load('items')], 201);
    }

    public function cancel(Request $request, string $orderId): JsonResponse
    {
        $order = app(VoucherReservation::class)->cancel($orderId, $request->user()->id);
        return response()->json([
            'order' => $order->load('items'),
            'message' => 'Order dibatalkan. Invoice di payment provider tidak otomatis dibatalkan.',
        ]);
    }

    public function initiatePayment(Request $request, string $orderId): JsonResponse
    {
        // The provider is chosen server-side from admin settings (env fallback); any client-supplied
        // gateway is ignored so a buyer cannot switch providers. Credentials stay in config/env.
        $data = $request->validate(['method' => ['required', 'string', 'max:60']]);
        $order = Order::where('id', $orderId)->where('user_id', $request->user()->id)->where('status', 'pending')->firstOrFail();
        try {
            $gateway = $this->activeGateway();
            $mode = $this->paymentMode();
        } catch (\InvalidArgumentException) {
            return response()->json(['message' => 'Konfigurasi payment gateway tidak valid.'], 503);
        }
        $reference = strtoupper($gateway) . '-' . strtoupper(Str::random(16));
        $signature = $this->signature($reference, $order->total, $gateway, 'pending');
        $payment = Payment::create([
            'id' => Str::lower(Str::random(12)), 'order_id' => $order->id, 'gateway' => $gateway,
            'mode' => $mode, 'method' => $data['method'],
            'reference' => $reference, 'merchant_ref' => $order->id, 'amount' => $order->total,
            'fee' => 0, 'status' => 'pending', 'signature' => $signature, 'events' => [['at' => now()->toISOString(), 'event' => 'payment_created']],
        ]);

        if ($mode === 'live') {
            try {
                $provider = app(PaymentGatewayManager::class)->resolve($gateway);
                $providerPayment = $provider->createPayment($order->load(['user', 'items']), $data['method']);
                $payment->update(['reference' => $providerPayment['reference'], 'events' => array_merge($payment->events ?? [], [['at' => now()->toISOString(), 'event' => 'provider_payment_created']])]);
                $this->alignReservationExpiry($order, $providerPayment['expires_at'] ?? null);
                return response()->json(['payment' => $payment->fresh(), 'checkout_url' => $providerPayment['checkout_url'] ?? null], 201);
            } catch (\Throwable $error) {
                // Log only non-sensitive identifiers; the provider response body and credentials are never logged.
                Log::warning('Payment gateway create failed', ['gateway' => $gateway, 'order_id' => $order->id, 'exception' => get_class($error)]);
                $payment->update(['status' => 'failed', 'events' => array_merge($payment->events ?? [], [['at' => now()->toISOString(), 'event' => 'provider_error']])]);
                return response()->json(['message' => 'Payment gateway gagal dihubungi.'], 502);
            }
        }

        return response()->json(['payment' => $payment], 201);
    }

    public function webhook(Request $request, string $gateway): JsonResponse
    {
        $data = $this->normalizeWebhook($request, $gateway);
        if (!$data) return response()->json(['result' => 'invalid'], 422);

        $payment = Payment::where('gateway', $gateway)->where('reference', $data['reference'])->first();
        if (!$payment) {
            // Legacy order references are usable only when they identify one attempt.
            $matches = Payment::where('gateway', $gateway)->where('merchant_ref', $data['reference'])->limit(2)->get();
            $payment = $matches->count() === 1 ? $matches->first() : null;
        }
        if (!$payment || (int) $data['amount'] !== (int) $payment->amount) {
            return response()->json(['result' => 'invalid'], 422);
        }

        $payloadHash = hash('sha256', implode('|', [$gateway, $data['reference'], $data['amount'], $data['status']]));
        $result = DB::transaction(function () use ($payment, $data, $payloadHash, $gateway) {
            // Always lock order before payment: different payment attempts share fulfillment.
            $order = Order::whereKey($payment->order_id)->lockForUpdate()->firstOrFail();
            $payment = Payment::whereKey($payment->id)->where('order_id', $order->id)->lockForUpdate()->firstOrFail();
            if ((int) $data['amount'] !== (int) $payment->amount) return 'invalid';
            $latePaid = $data['status'] === 'paid' && in_array($payment->status, ['failed', 'expired'], true);
            if ((!$latePaid && $payment->status !== 'pending') || WebhookLog::where('payload_hash', $payloadHash)->exists()) {
                return 'duplicate';
            }

            WebhookLog::create(['id' => Str::lower(Str::random(12)), 'reference' => $payment->reference, 'payload_hash' => $payloadHash, 'gateway' => $gateway, 'status' => $data['status'], 'result' => 'processed']);
            $payment->update(['status' => $data['status'], 'events' => array_merge($payment->events ?? [], [['at' => now()->toISOString(), 'event' => 'webhook:' . $data['status']]])]);
            // A committed paid order has already fulfilled in this same transaction.
            // Record every payment outcome, but never undo or repeat that fulfillment.
            if ($order->status === 'paid') {
                if ($data['status'] === 'paid') {
                    // Second successful charge for an already-paid order: keep it visible for refund handling.
                    \App\Models\AuditLog::create(['user_id' => $order->user_id, 'user_name' => 'system', 'action' => 'duplicate_payment', 'model' => 'Payment', 'model_id' => $payment->id,
                        'detail' => sprintf('order=%s already paid; reference=%s; amount=%d; action=refund_review', $order->id, $payment->reference, $payment->amount)]);
                    app(NotificationService::class)->notifyStaff('view_payments', "payment:{$payment->id}:duplicate_paid",
                        'Pembayaran ganda terdeteksi', "Order {$order->id} menerima pembayaran kedua (" . NotificationService::money((int) $payment->amount) . '). Tinjau refund.', '/dashboard/payments', 'danger');
                }
                return 'processed';
            }

            $reservations = app(VoucherReservation::class);
            if ($data['status'] === 'paid') $reservations->confirm($order, $payment->reference);
            else $reservations->release($order);
            $stock = app(StockReservation::class);
            $canFulfill = $data['status'] === 'paid'
                ? $stock->confirm($order, $payment->reference)
                : tap(false, fn () => $stock->release($order));
            $notifications = app(NotificationService::class);
            if ($data['status'] !== 'paid') {
                $notifications->notify($order->user_id, "payment:{$payment->id}:{$data['status']}",
                    $data['status'] === 'expired' ? 'Pembayaran kedaluwarsa' : 'Pembayaran gagal',
                    "Pembayaran untuk order {$order->id} berstatus {$data['status']}. Akses belum diberikan.", '/dashboard/orders', 'danger');
            }
            if ($order->status === 'cancelled' && $data['status'] !== 'paid') return 'processed';
            $order->update(['status' => $data['status'], 'paid_at' => $data['status'] === 'paid' ? now() : null, 'expires_at' => $data['status'] === 'paid' ? null : $order->expires_at]);
            if ($data['status'] === 'paid' && $canFulfill) {
                $products = Product::whereIn('id', $order->items->where('kind', 'product')->pluck('ref_id')->unique())
                    ->get()->keyBy('id');
                foreach ($order->items as $item) {
                    if ($item->kind === 'course') {
                        Enrollment::firstOrCreate(['user_id' => $order->user_id, 'course_id' => $item->ref_id], ['id' => Str::lower(Str::random(12)), 'status' => 'active', 'progress_pct' => 0]);
                    } elseif ($item->kind === 'product') {
                        $product = $products->get($item->ref_id);
                        if ($product) {
                            if ($item->is_digital) {
                                DigitalDelivery::firstOrCreate(['order_item_id' => $item->id], ['id' => Str::lower(Str::random(12)), 'user_id' => $order->user_id, 'product_id' => $product->id, 'license_key' => 'KMSIT-' . strtoupper(Str::random(16)), 'download_url' => $product->digital_file_url, 'status' => 'active']);
                            }
                        }
                    }
                }
                app(InstructorEarnings::class)->creditForOrder($order);
                $notifications->notify($order->user_id, "order:{$order->id}:paid", 'Pembayaran berhasil',
                    "Order {$order->id} lunas (" . NotificationService::money((int) $order->total) . ').', '/dashboard/orders', 'success');
                foreach ($order->items->where('kind', 'course') as $item) {
                    $notifications->notify($order->user_id, "enrollment:{$order->id}:{$item->ref_id}", 'Akses kelas aktif',
                        "Kamu sudah terdaftar di \"{$item->title}\". Selamat belajar!", '/dashboard/my-learning', 'success');
                }
                if ($order->items->contains('kind', 'product') && $order->items->contains('is_digital', true)) {
                    $notifications->notify($order->user_id, "delivery:{$order->id}", 'Produk digital siap diunduh',
                        "File dan license untuk order {$order->id} tersedia.", '/dashboard/digital', 'success');
                }
            } elseif ($data['status'] === 'paid') {
                $notifications->notify($order->user_id, "order:{$order->id}:paid_pending_fulfillment", 'Pembayaran diterima',
                    "Pembayaran order {$order->id} diterima, namun pemenuhan tertunda karena stok. Admin akan menghubungimu.", '/dashboard/orders', 'warning');
            }
            return 'processed';
        });

        return response()->json(['result' => $result], $result === 'invalid' ? 422 : 200);
    }

    private function normalizeWebhook(Request $request, string $gateway): ?array
    {
        if (!in_array($gateway, ['tripay', 'xendit', 'stripe'], true)) return null;
        $payload = $request->all();
        $raw = $request->getContent();

        if ($gateway === 'tripay') {
            $privateKey = (string) config('payment.tripay.private_key');
            // Tripay requires a configured private key for signature verification in all modes.
            // Empty key means webhook cannot be verified — reject immediately (A-01 fail-closed).
            if ($privateKey === '') return null;

            $reference = $payload['reference'] ?? $payload['merchant_ref'] ?? null;
            // Tripay live payloads use total_amount (not amount); fallback to amount for sandbox compatibility.
            $amount = $payload['total_amount'] ?? $payload['amount_received'] ?? $payload['amount'] ?? null;
            $status = strtolower((string) ($payload['status'] ?? ''));
            // Tripay sends X-Callback-Event header; accept known events or empty (sandbox/test fixtures).
            $eventHeader = strtolower((string) ($payload['event'] ?? ''));
            if ($eventHeader !== '' && !in_array($eventHeader, ['payment.status', 'payment.success'], true)) {
                return null;
            }

            $signature = $request->header('X-Callback-Signature');
            if ($signature) {
                $valid = hash_equals(hash_hmac('sha256', $raw, $privateKey), $signature);
            } else {
                // Fallback to payload-based HMAC signature (used in sandbox / tests without header).
                $payloadSignature = $payload['signature'] ?? '';
                $valid = $reference && $amount !== null && hash_equals($this->signature($reference, (int) $amount, $gateway, $status), $payloadSignature);
            }
            return $valid && $reference && is_numeric($amount) && in_array($status, ['paid', 'failed', 'expired'], true)
                ? ['reference' => (string) $reference, 'amount' => (int) $amount, 'status' => $status]
                : null;
        }

        if ($gateway === 'xendit') {
            $reference = $payload['id'] ?? $payload['external_id'] ?? $payload['reference'] ?? null;
            $amount = $payload['paid_amount'] ?? $payload['amount'] ?? null;
            $status = strtolower((string) ($payload['status'] ?? ''));
            $signature = $request->header('X-Callback-Token') ?? $payload['signature'] ?? '';
            $valid = filled($signature) && hash_equals((string) config('payment.xendit.callback_token'), $signature);
            return $valid && $reference && is_numeric($amount) && in_array($status, ['paid', 'failed', 'expired'], true)
                ? ['reference' => (string) $reference, 'amount' => (int) $amount, 'status' => $status]
                : null;
        }

        $event = $payload['type'] ?? '';
        $object = $payload['data']['object'] ?? [];
        $reference = $object['id'] ?? null;
        $amount = $object['amount_total'] ?? null;
        $status = match (true) {
            $event === 'checkout.session.completed' && ($object['payment_status'] ?? '') === 'paid' => 'paid',
            $event === 'checkout.session.expired' => 'expired',
            default => null,
        };
        $stripeSignature = $request->header('Stripe-Signature', '');
        $secret = (string) config('payment.stripe.webhook_secret');
        $valid = false;
        if ($secret && preg_match('/(?:^|,)t=(\d+)(?:,|$)/', $stripeSignature, $time) && preg_match('/(?:^|,)v1=([a-f0-9]+)(?:,|$)/', $stripeSignature, $signature)) {
            $signed = $time[1] . '.' . $raw;
            $valid = abs(time() - (int) $time[1]) <= 300 && hash_equals(hash_hmac('sha256', $signed, $secret), $signature[1]);
        }
        return $valid && $reference && is_numeric($amount) && $status
            ? ['reference' => (string) $reference, 'amount' => (int) $amount, 'status' => $status]
            : null;
    }

    private function alignReservationExpiry(Order $order, mixed $expiresAt): void
    {
        if ($order->voucher_reservation_status !== 'reserved' || !$order->voucher_id) return;
        $expiry = $this->normalizeExpiry($expiresAt);
        if (!$expiry) return;
        $order->forceFill(['voucher_reserved_until' => $expiry])->save();
    }

    private function normalizeExpiry(mixed $value): ?Carbon
    {
        if ($value === null || $value === '' || !(is_numeric($value) || is_string($value))) return null;
        try {
            $candidate = is_numeric($value) ? Carbon::createFromTimestamp((int) $value) : Carbon::parse((string) $value);
        } catch (\Throwable) {
            return null;
        }
        // Eloquent stores the wall-clock time without the offset, so convert the provider's
        // instant (unix/UTC) to the application timezone before it is persisted.
        $candidate = $candidate->setTimezone(config('app.timezone'));
        return $candidate->isFuture() ? $candidate : null;
    }

    private function signature(string $reference, int $amount, string $gateway, string $status): string
    {
        // For sandbox payload-based verification (no X-Callback-Signature header), use the
        // private_key / merchant secret so tests can compute matching signatures.
        $secret = (string) config("payment.{$gateway}.private_key") ?: (string) config("payment.{$gateway}.webhook_secret") ?: (string) config('app.key');
        return hash_hmac('sha256', implode('|', [$reference, $amount, $status]), $secret);
    }

    /** Active provider: the admin setting wins, otherwise the environment config. An invalid setting fails safe. */
    private function activeGateway(): string
    {
        $gateway = $this->paymentSetting('gateway_active') ?? config('payment.active');
        if (!is_string($gateway) || !in_array($gateway, ['tripay', 'xendit', 'stripe'], true)) throw new \InvalidArgumentException('Gateway payment aktif tidak valid.');
        return $gateway;
    }

    /** Sandbox/live: the admin setting wins when valid, otherwise the environment config. */
    private function paymentMode(): string
    {
        $mode = $this->paymentSetting('gateway_mode') ?? config('payment.mode');
        if (!is_string($mode) || !in_array($mode, ['sandbox', 'live'], true)) throw new \InvalidArgumentException('Mode payment tidak valid.');
        return $mode;
    }

    /** Returns a stored setting value, or null when the settings table/key is unavailable (env fallback). */
    private function paymentSetting(string $key): ?string
    {
        try {
            if (!Schema::hasTable('settings')) return null;
        } catch (\Throwable) {
            return null;
        }
        $value = Setting::where('setting_key', $key)->value('setting_value');
        return is_string($value) && $value !== '' ? $value : null;
    }
}
