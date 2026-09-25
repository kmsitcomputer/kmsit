# Status Integrasi Eksternal (Tahap 8)

Disusun dari audit kode aktual, bukan dari field settings. Klasifikasi:

- **Implemented** — ada kode produksi yang benar-benar berbicara ke provider (HTTP client nyata di belakang contract).
- **Configuration-only** — hanya ada config/env/key settings; tidak ada kode yang memanggil provider.
- **Placeholder** — field/setting disimpan tetapi tidak pernah dibaca logic apa pun.
- **Absent** — tidak ada kode, config, maupun field.

## Matriks

| Integrasi | Status | Bukti kode | Catatan |
|---|---|---|---|
| Tripay | Implemented (live only) | `app/Services/TripayGateway.php`, `config/payment.php`, `OrderController@initiatePayment` | `createPayment` hanya dipanggil saat `PAYMENT_MODE=live`. Callback: `X-Callback-Signature` (HMAC raw body + private key); fallback signature internal. |
| Xendit | Implemented (live only) | `app/Services/XenditGateway.php` | Callback: header `X-Callback-Token`. Reference = invoice id, `external_id` = order id. |
| Stripe | Implemented (live only) | `app/Services/StripeGateway.php` | Checkout Session. Callback: header `Stripe-Signature` (HMAC `t.payload`, toleransi 300s). |
| YouTube / video embed | Implemented | `app/Support/HtmlSanitizer.php` (`embedUrl`, `videoUrl`), `CourseController`, `ContentController` | Allowlist host https untuk iframe/materi dan `video_url`. Player di-render frontend via `youtubeId`. |
| Zoom | Configuration-only | `config/services.php` (`zoom`), `ZOOM_*` env, settings `zoom_*` | Tidak ada service/OAuth/callsite. Tidak diimplementasi pada putaran ini. |
| Google Meet | Configuration-only | settings `gmeet_enabled`, `gmeet_default_url` | Tidak ada kode yang membaca/memakai. Tidak diimplementasi. |
| YouTube settings (`youtube_enabled`, `youtube_channel_url`) | Placeholder | `SettingsController` writable keys, `Settings.tsx` | Embed YouTube memakai URL per-konten, bukan setting channel ini. |
| RajaOngkir / shipping rate | Implemented | `app/Contracts/ShippingProvider.php`, `app/Services/RajaOngkirProvider.php`, `app/Services/ShippingService.php`, `config/shipping.php`, `ShippingController`, `OrderController@storeShop` | Shipping Cost V2 backend-only (header `key:`); origin server-controlled (settings/env); quote dinormalisasi; checkout revalidasi dan snapshot ke `orders`. Tanpa Delivery API (pickup/AWB/tracking). |
| OpenRouteService / routing | Absent | — | Tidak ada kode/config terkait. |

## Pemilihan provider & mode (server-side)

`OrderController@initiatePayment` memilih provider dan mode **di server**, bukan dari payload client:

- `gateway_active` (settings) bila ada dan valid → provider aktif; bila baris/kolom tidak ada → fallback
  `config('payment.active')` (`PAYMENT_GATEWAY`).
- `gateway_mode` (settings) bila ada dan valid (`sandbox`/`live`) → mode; bila tidak ada → fallback
  `config('payment.mode')` (`PAYMENT_MODE`).
- Nilai setting yang ada tetapi **tidak valid** (mis. `paypal`, `production`) → `503 Konfigurasi payment
  gateway tidak valid.` — tanpa memanggil provider dan tanpa membuat payment; tidak ada fallback diam-diam
  ke provider pilihan client.
- Payload `gateway` dari client **diabaikan**; hanya `method` yang diambil dari client.
- Provider HTTP hanya dipanggil saat mode efektif `live`. Mode `sandbox` memakai flow simulasi internal
  (membuat record `payments` tanpa memanggil provider).
- `payments.gateway` dan `payments.mode` menyimpan nilai yang benar-benar dipakai.

Perubahan gateway/mode admin hanya berlaku untuk payment baru. Webhook lama tetap diproses berdasarkan
`payments.gateway` yang tersimpan — route webhook tidak membaca setting, sehingga callback dari gateway
yang sebelumnya aktif tetap diterima. Credential tetap hanya dari config/environment.

Karena mode efektif berasal dari setting/`PAYMENT_MODE`, base URL sandbox provider hanya relevan bila
operator mengarahkan `*_BASE_URL` ke endpoint sandbox dan menjalankan mode `live` terhadap kredensial
sandbox (tidak dilakukan otomatis).

## Hardening pada putaran ini

- Timeout eksplisit (`PAYMENT_HTTP_TIMEOUT`) dan connect timeout (`PAYMENT_HTTP_CONNECT_TIMEOUT`) pada ketiga gateway.
- Tidak ada retry otomatis pada create-payment (satu percobaan; kegagalan → 502 + payment `failed`).
- Respons provider divalidasi: identifier wajib ada, jika tidak → `RuntimeException` (bukan sukses diam-diam).
- Error mapping generik ke client; respons/log tidak memuat payload provider maupun credential.
- `base_url` Stripe dipindahkan ke config (`STRIPE_BASE_URL`).
- Verifikasi callback tetap sesuai skema masing-masing provider (HMAC/token/signature).
- Secret webhook Tripay dibaca dari config (`TRIPAY_WEBHOOK_SECRET`), fallback `APP_KEY` — bukan `env()` langsung di controller.
- Provider/mode inisiasi dipilih server-side dari settings (env fallback); payload `gateway` client diabaikan; nilai setting tak valid → 503 aman; webhook lama tetap diproses (lihat bagian di atas).

## Yang dibutuhkan sebelum implementasi (configuration-only / absent)

- **Zoom**: pilih model auth (Server-to-Server OAuth vs JWT), endpoint create/update meeting, payload, dan
  verifikasi webhook; butuh `account_id`, `client_id`, `client_secret`, `webhook_secret` valid. Belum ada
  kebutuhan fitur (callsite) di LMS/commerce saat ini.
- **Google Meet**: butuh keputusan produk (link manual vs Calendar API/OAuth), endpoint yang diizinkan,
  dan consent OAuth. Tidak ada callsite saat ini.
- **RajaOngkir/shipping**: butuh keputusan produk (origin, kurir, berat), credential API, dan pemetaan
  alamat; saat ini checkout hanya menampung alamat manual.
- **OpenRoute/routing**: tidak ada kebutuhan fitur; belum ada spesifikasi.

## Verifikasi

- `backend/tests/Feature/PaymentGatewayHttpTest.php` — success, timeout/network error, response invalid,
  signature valid/invalid, reference mismatch, duplicate callback, secret tidak bocor, sandbox/live,
  base URL, tanpa retry, **payload gateway client diabaikan, gateway admin dipakai, setting invalid → 503,
  fallback env saat settings kosong, webhook payment lama tetap diproses**, semua via `Http::fake` +
  `Http::preventStrayRequests()`.
- `backend/tests/Feature/VideoEmbedUrlValidationTest.php` — allowlist host/protokol `video_url` dan materi embed.
