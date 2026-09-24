<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\CartItem;
use App\Models\Enrollment;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\WebhookLog;
use App\Models\Voucher;
use App\Models\DigitalDelivery;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use App\Services\PaymentGatewayManager;

class OrderController extends Controller
{
    public function webhookLogs(Request $request): JsonResponse
    {
        abort_unless(in_array($request->user()->role_key, ['admin', 'super_admin'], true), 403, 'Tidak memiliki permission.');
        return response()->json(['webhook_logs' => WebhookLog::latest()->limit(50)->get()]);
    }

    public function index(Request $request): JsonResponse
    {
        $query = Order::with(['items', 'payments', 'user:id,name,email'])->latest();
        if (!in_array($request->user()->role_key, ['admin', 'super_admin'], true)) $query->where('user_id', $request->user()->id);
        return response()->json($query->paginate(min($request->integer('per_page', 20), 50)));
    }

    public function payments(Request $request): JsonResponse
    {
        $query = Payment::with('order:id,user_id')->latest();
        if (!in_array($request->user()->role_key, ['admin', 'super_admin'], true)) $query->whereHas('order', fn ($order) => $order->where('user_id', $request->user()->id));
        return response()->json(['payments' => $query->paginate(min($request->integer('per_page', 30), 50))]);
    }

    public function show(Request $request, string $orderId): JsonResponse
    {
        $order = Order::with('items', 'payments')->where('id', $orderId)->where('user_id', $request->user()->id)->firstOrFail();

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
        ]);

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

            $discount = 0;
            $voucher = null;
            if (!empty($data['voucher_code'])) {
                $voucher = Voucher::where('code', Str::upper(trim($data['voucher_code'])))->where('active', true)->lockForUpdate()->first();
                if (!$voucher || ($voucher->expires_at && $voucher->expires_at->isPast()) || ($voucher->usage_limit > 0 && $voucher->used_count >= $voucher->usage_limit) || $subtotal < $voucher->min_order) abort(422, 'Voucher tidak valid.');
                $discount = $voucher->type === 'percent' ? (int) round($subtotal * $voucher->value / 100) : $voucher->value;
                if ($voucher->max_discount > 0) $discount = min($discount, $voucher->max_discount);
                $discount = min($discount, $subtotal);
            }

            $order = Order::create(['id' => Str::lower(Str::random(12)), 'user_id' => $request->user()->id, 'type' => 'shop', 'status' => 'pending', 'subtotal' => $subtotal, 'discount_amount' => $discount, 'voucher_code' => $voucher?->code, 'total' => $subtotal - $discount, 'currency' => 'IDR', 'needs_shipping' => $needsShipping, 'shipping_name' => $data['shipping']['name'] ?? null, 'shipping_address' => $data['shipping']['address'] ?? null, 'shipping_phone' => $data['shipping']['phone'] ?? null]);
            foreach ($lines as $line) {
                $cart = $line['cart'];
                OrderItem::create(['id' => Str::lower(Str::random(12)), 'order_id' => $order->id, 'kind' => 'product', 'ref_id' => $line['product']->id, 'title' => $line['product']->name . ($cart->variant ? ' - ' . $cart->variant->label : ''), 'price' => $line['price'], 'qty' => $cart->qty, 'thumbnail' => $line['product']->thumbnail, 'variant_id' => $cart->variant_id, 'variant_label' => $cart->variant?->label, 'is_digital' => $line['product']->is_digital]);
            }
            return $order;
        });

        return response()->json(['order' => $order->load('items')], 201);
    }

    public function initiatePayment(Request $request, string $orderId): JsonResponse
    {
        $data = $request->validate(['gateway' => ['required', 'in:tripay,xendit,stripe'], 'method' => ['required', 'string', 'max:60']]);
        $order = Order::where('id', $orderId)->where('user_id', $request->user()->id)->where('status', 'pending')->firstOrFail();
        $reference = strtoupper($data['gateway']) . '-' . strtoupper(Str::random(16));
        $signature = $this->signature($reference, $order->total, $data['gateway'], 'pending');
        $payment = Payment::create([
            'id' => Str::lower(Str::random(12)), 'order_id' => $order->id, 'gateway' => $data['gateway'],
            'mode' => config('payment.mode') === 'live' ? 'live' : 'sandbox', 'method' => $data['method'],
            'reference' => $reference, 'merchant_ref' => $order->id, 'amount' => $order->total,
            'fee' => 0, 'status' => 'pending', 'signature' => $signature, 'events' => [['at' => now()->toISOString(), 'event' => 'payment_created']],
        ]);

        if (config('payment.mode') === 'live') {
            try {
                $provider = app(PaymentGatewayManager::class)->resolve($data['gateway']);
                $providerPayment = $provider->createPayment($order->load(['user', 'items']), $data['method']);
                $payment->update(['reference' => $providerPayment['reference'], 'events' => array_merge($payment->events ?? [], [['at' => now()->toISOString(), 'event' => 'provider_payment_created']])]);
                return response()->json(['payment' => $payment->fresh(), 'checkout_url' => $providerPayment['checkout_url'] ?? null], 201);
            } catch (\Throwable $error) {
                $payment->update(['status' => 'failed', 'events' => array_merge($payment->events ?? [], [['at' => now()->toISOString(), 'event' => 'provider_error']])]);
                return response()->json(['message' => 'Payment gateway gagal dihubungi.'], 502);
            }
        }

        return response()->json(['payment' => $payment], 201);
    }

    public function webhook(Request $request, string $gateway): JsonResponse
    {
        $data = $request->validate([
            'reference' => ['required', 'string', 'max:80'], 'amount' => ['required', 'integer', 'min:0'],
            'status' => ['required', 'in:paid,failed,expired'], 'signature' => ['required', 'string', 'max:128'],
        ]);
        $payment = Payment::where('reference', $data['reference'])->where('gateway', $gateway)->first();
        if (!$payment || (int) $data['amount'] !== (int) $payment->amount || !hash_equals($this->signature($data['reference'], $payment->amount, $gateway, $data['status']), $data['signature'])) {
            return response()->json(['result' => 'invalid'], 422);
        }

        $payloadHash = hash('sha256', implode('|', [$gateway, $data['reference'], $data['amount'], $data['status']]));
        if (WebhookLog::where('payload_hash', $payloadHash)->exists() || $payment->status !== 'pending') {
            return response()->json(['result' => 'duplicate']);
        }

        DB::transaction(function () use ($payment, $data, $payloadHash, $gateway) {
            WebhookLog::create(['id' => Str::lower(Str::random(12)), 'reference' => $payment->reference, 'payload_hash' => $payloadHash, 'gateway' => $gateway, 'status' => $data['status'], 'result' => 'processed']);
            $payment->update(['status' => $data['status'], 'events' => array_merge($payment->events ?? [], [['at' => now()->toISOString(), 'event' => 'webhook:' . $data['status']]])]);
            $order = $payment->order()->with('items')->first();
            $order->update(['status' => $data['status'], 'paid_at' => $data['status'] === 'paid' ? now() : null]);
            if ($data['status'] === 'paid') {
                foreach ($order->items as $item) {
                    if ($item->kind === 'course') {
                        Enrollment::firstOrCreate(['user_id' => $order->user_id, 'course_id' => $item->ref_id], ['id' => Str::lower(Str::random(12)), 'status' => 'active', 'progress_pct' => 0]);
                    } elseif ($item->kind === 'product') {
                        $product = Product::with('variants')->find($item->ref_id);
                        if ($product) {
                            if ($item->variant_id) {
                                $variant = $product->variants->firstWhere('id', $item->variant_id);
                                if ($variant) $variant->decrement('stock', min($variant->stock, $item->qty));
                            } else {
                                $product->decrement('stock', min($product->stock, $item->qty));
                            }
                            if ($item->is_digital) {
                                DigitalDelivery::firstOrCreate(['order_item_id' => $item->id], ['id' => Str::lower(Str::random(12)), 'user_id' => $order->user_id, 'product_id' => $product->id, 'license_key' => 'KMSIT-' . strtoupper(Str::random(16)), 'download_url' => $product->digital_file_url, 'status' => 'active']);
                            }
                        }
                    }
                }
            }
        });

        return response()->json(['result' => 'processed']);
    }

    private function signature(string $reference, int $amount, string $gateway, string $status): string
    {
        $secret = (string) env(strtoupper($gateway) . '_WEBHOOK_SECRET', config('app.key'));
        return hash_hmac('sha256', implode('|', [$reference, $amount, $status]), $secret);
    }
}
