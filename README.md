# KMSIT Computer — LMS + CMS Platform

Platform **Learning Management System (LMS) + Content Management System (CMS) + E-commerce** production-grade: kelas online (gratis & berbayar), quiz engine, sertifikat digital ber-QR + verifikasi publik, instructor wallet & withdrawal, shop, payment gateway (Tripay / Xendit / Stripe), homepage builder block-based, menu manager ala WordPress, multi-role dashboard, audit log, multi-bahasa (ID/EN), dan dark mode.

## Arsitektur

Repo ini berisi implementasi **monolith Laravel (backend) + React SPA (frontend)** yang berjalan sebagai satu proses deploy:

| Layer | Detail |
|---|---|
| **Backend API** | `backend/` — Laravel 13 (PHP 8.4), MySQL, RESTful API di `/api/v1` |
| **Frontend SPA** | `frontend/` — React 18, TypeScript, Vite, Tailwind CSS 4, HashRouter |
| **Database** | MySQL — skema dari Laravel migration (`backend/database/migrations/`, 27 file); `schema.sql` hanya dump referensi SQLite |
| **Build pipeline** | `npm run build` → sync otomatis ke `backend/public/app.html` |

### Struktur Proyek

```
├── backend/              # Laravel monolith
│   ├── app/
│   │   ├── Http/Controllers/Api/V1/  # 30+ controller API
│   │   ├── Http/Middleware/          # AuthenticateApiUser, PreventMaintenanceAccess
│   │   ├── Models/                   # 39 model domain
│   │   ├── Services/                 # PaymentGatewayManager + gateway implementations
│   │   └── Mail/                     # PasswordResetMail
│   ├── config/           # app, auth, cache, database, mail, payment, queue, session
│   ├── database/
│   │   ├── migrations/   # sumber skema MySQL (LMS, commerce, CMS, certs, notifikasi, dll)
│   │   ├── schema.sql    # dump referensi dialek SQLite — bukan untuk impor MySQL
│   │   └── seeders/
│   ├── routes/
│   │   ├── api.php       # Semua endpoint /api/v1/*
│   │   └── web.php       # SPA fallback + sensitive path protection
│   ├── tests/Feature/    # 19 test PHPUnit
│   ├── public/           # Static assets + app.html (hasil build frontend)
│   └── bootstrap/        # Auto .env creation on first boot
├── frontend/             # React SPA
│   ├── src/
│   │   ├── pages/        # Public (11 halaman) + Dashboard (25+ route per role)
│   │   ├── components/   # Shell, ui design-system, icons, RichText editor
│   │   ├── lib/          # api.ts (REST client), db.ts, lms.ts, commerce.ts, theme.ts, i18n.ts
│   │   ├── state/        # store.tsx (AppProvider: user, theme, language, toast)
│   │   └── assets/
│   └── scripts/          # sync-backend-assets.mjs (postbuild hook)
├── docs/
│   ├── blueprint.md      # System Blueprint lengkap
│   └── architecture.md   # Dokumentasi arsitektur sistem
└── INSTALL.md            # Panduan instalasi production
```

## Fitur Utama

- **Installer ala WordPress** — welcome → system requirements (PASS/FAIL) → konfigurasi DB (test connection) → website + Super Admin pertama → migrasi → **installer terkunci**. **Tidak ada demo user.**
- **RBAC 4 role**: Super Admin (full), Admin (konten & operasional), Instructor (kelas sendiri), Student (belajar) — proteksi di level route *dan* service.
- **LMS**: Course → Section → Lesson (teks, YouTube, video, PDF, file, gambar, URL, embed), status Draft/Pending/Published/Rejected/Archived, moderasi admin, preview lesson, progress tracking per siswa.
- **Payment**: Abstraksi `PaymentGatewayInterface` → Tripay / Xendit / Stripe, mode sandbox & live, biaya per metode, **webhook + signature + idempotency log** (order/wallet tidak diproses dua kali).
- **Revenue split 15%** fee platform (konfigurable) — gross / platform fee / payment fee / net tercatat di ledger wallet yang auditable; withdrawal Pending → Approved → Processing → Completed / Rejected.
- **Quiz**: Pilihan Ganda, Benar/Salah, Jawaban Ganda, Isian Singkat — timer, acak soal, batas percobaan, scoring di backend/controller.
- **Sertifikat digital**: terbit otomatis (progress 100% + lulus quiz), nomor unik `KMSIT-YYYY-NNNNNN`, QR code, halaman verifikasi publik `/certificate/verify/{number}`, cetak/PDF, status revoke.
- **CMS**: Homepage builder (drag-and-drop @dnd-kit), Menu manager (nested, header/footer), Pages, Artikel/Berita/Tutorial/Kegiatan dengan editor Tiptap WYSIWYG, Media Library, SEO fields.
- **Shop**: Produk fisik & digital, varian produk, stok, cart, checkout via payment gateway, voucher diskon, license key untuk produk digital.
- **Sistem**: Audit log, notifikasi in-app per user, global search, backup export (tanpa credential), maintenance mode, multi-bahasa ID/EN, tema visual website & dashboard terpisah, responsive penuh.

## Menjalankan Development

```bash
cd frontend
npm install
npm run dev       # development server :5173
npm run build     # production → dist/ lalu auto-sync ke ../backend/public/
```

Saat pertama dibuka (production): **Installation Wizard** muncul → buat Super Admin → login → redirect `/dashboard` sesuai role.

## Alur Kunci

- **Pembayaran**: Student → Order → `PaymentGatewayManager.initiate()` → Gateway (sandbox/live) → `Webhook callback` → verify signature + idempotency check → `fulfillOrder()` (enrollment/stok/wallet/delivery) → Notifikasi → Audit log.
- **Sertifikat**: lesson selesai / quiz lulus → eligibility check (idempotent) → nomor unik + QR → verifikasi publik tanpa login.
- **Revenue**: Order paid → ledger entry (gross → platform_fee 15% → net 85%) → saldo instructor → withdrawal request → admin approval.

## Keamanan

- Password di-hash dengan Laravel Hash (bcrypt, tanpa salt kolom terpisah), session bertoken dengan expiry.
- Kredensial gateway hanya di `.env` / environment, tidak pernah tersimpan di database atau diubah lewat API biasa.
- Webhook wajib signature valid, payload_hash unique constraint anti-duplikasi.
- HTML konten di-sanitize (script/iframe/event-handler dibuang), input divalidasi ketat.
- Proteksi route berbasis permission inline per-controller.
- Installer terkunci permanen setelah selesai.
- Backup tidak menyertakan hash password/credential.
- Path sensitif (`/.env`, `/database`, `/backend`) diblok 404 secara eksplisit.

## API (REST — `/api/v1`)

- **Auth**: login, logout, register, forgot-password, reset-password, profile CRUD, avatar upload
- **LMS**: courses index/show/enroll, lessons complete, progress tracking, quizzes, certificates
- **Commerce**: orders course/shop, payments webhook, products, cart, vouchers, wallet, withdrawals, digital delivery
- **CMS**: articles, news, tutorials, activities, pages, homepage blocks, menus, categories, media
- **Admin**: users CRUD, roles/permissions, audit logs, backup export, contact messages, settings (public/admin/payment/theme)
- **Public**: search, contact form, certificate verification, health check

Autentikasi via session-cookie Laravel (guard `web`), diperkuat CSRF Sanctum. Rate limiting diterapkan per grup endpoint.

## Troubleshooting

- **Ingin mengulang instalasi** → Dashboard → Pengaturan → Sistem & Audit → Danger Zone → Reset Aplikasi.
- **Lupa password Super Admin** → reset via installer ulang (setelah reset) atau reset password oleh Super Admin lain di menu Semua User.
- **Pembayaran tidak masuk** → periksa Dashboard → Pembayaran → Webhook Log (processed / duplicate / invalid).
- **File unggahan 404** → jalankan `php artisan storage:link` (atau biarkan installer menjalankannya).

## Referensi

- [System Blueprint](docs/blueprint.md) — dokumentasi teknis lengkap (skema data, peta API, arsitektur detail, risiko)
- [INSTALL.md](INSTALL.md) — panduan instalasi production
- [Migrations](backend/database/migrations/) — sumber skema MySQL (jalankan `php artisan migrate --force`)
# kmsit
