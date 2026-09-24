# INSTALL — KMSIT Computer

Panduan instalasi production (arsitektur **Laravel + MySQL**) untuk LMS + CMS + Online Shop **KMSIT Computer**, lengkap dengan installer web ala WordPress.

---

## 1. Persyaratan Server

| Komponen | Minimum |
|---|---|
| PHP | **8.3+** |
| Ekstensi PHP | `pdo_mysql`, `openssl`, `mbstring`, `tokenizer`, `xml`, `ctype`, `json`, `fileinfo`, `gd`, `curl`, `bcmath` |
| Database | **MySQL 8.0+** / MariaDB 10.6+ |
| Web server | Apache 2.4+ (mod_rewrite) **atau** Nginx |
| Lain | Composer 2.x, Node 20+ (build asset), HTTPS (wajib untuk payment callback) |

> **Status implementasi saat ini:** repo terbagi dua: `frontend/` (React/Vite) dan `backend/` (Laravel). `npm run build` di dalam `frontend/` membuild ke `frontend/dist/` lalu otomatis menyalinnya (hook `postbuild`, lihat `frontend/scripts/sync-backend-assets.mjs`) ke `backend/public/app.html` + `backend/public/assets/` (membersihkan file asset lama sebelum menyalin yang baru). Domain target lokal/production yang didaftarkan adalah `kmsitcomputer.com`; arahkan domain tersebut ke `backend/public` dan gunakan HTTPS publik sebelum payment live. Jangan mengarahkan domain live ke root repository.

> **Tidak perlu setting `.env` manual.** Installer web (`/install`) menulis `backend/.env` sendiri — generate `APP_KEY`, isi `DB_*` dari form yang Anda isi di browser, dan langsung menjalankan migration. Yang **tetap** perlu disiapkan sebelum upload (karena kebanyakan shared hosting tidak punya Composer/Node di server): jalankan `composer install --no-dev` dan `npm run build` di komputer Anda, lalu upload folder `backend/` **beserta `vendor/`** dan `backend/public/` yang sudah berisi hasil build frontend. Setelah itu cukup: pastikan folder `backend/storage`, `backend/bootstrap/cache`, dan `backend/` sendiri bisa ditulis PHP (writable), buat database MySQL kosong di panel hosting, lalu buka domainnya di browser — wizard `/install` akan menuntun sisanya (test koneksi DB, tulis `.env`, migrasi, buat Super Admin pertama).

## 2. Upload & Konfigurasi Web Server

### Build dan backend

Jalankan di komputer development (bukan di server hosting) sebelum upload — `.env`, `APP_KEY`, dan migration akan ditangani otomatis oleh installer web setelah upload, **tidak perlu dijalankan manual di server**:

```bash
cd frontend
npm ci
npm run build   # build ke dist/ lalu auto-sync ke ../backend/public/ (postbuild hook)
cd ../backend
composer install --no-dev --optimize-autoloader
```

Hasilnya: `backend/` (lengkap dengan `vendor/`) + `backend/public/app.html` + `backend/public/assets/` siap diupload apa adanya. **Jangan** upload `.env` — biarkan installer yang menulisnya di server.

> Jika hosting Anda punya akses shell (VPS/Composer/Node tersedia di server) dan Anda tetap ingin setup manual tanpa wizard: `php artisan key:generate`, `php artisan storage:link`, `php artisan migrate --force`, lalu salin `backend/.env.production.example` ke `backend/.env` dan isi `DB_*` sebelum request pertama. Ini opsional — cara di atas (upload lalu buka `/install`) sudah cukup untuk hosting biasa tanpa akses shell.

1. Upload seluruh project ke server, idealnya **di luar** document root.
2. **Apache** — arahkan DocumentRoot hanya ke `/public` (melindungi `.env`, migration, dan source):

```apache
<VirtualHost *:443>
    ServerName kmsit.example.com
    DocumentRoot /var/www/kmsit-computer/public

    <Directory /var/www/kmsit-computer/public>
        AllowOverride All
        Require all granted
    </Directory>

    # blokir akses ke file sensitif di luar /public
    <DirectoryMatch "^/var/www/kmsit-computer/(?!public)">
        Require all denied
    </DirectoryMatch>
</VirtualHost>
```

4. **Nginx**:

```nginx
server {
    listen 443 ssl http2;
    server_name kmsit.example.com;
    root /var/www/kmsit-computer/public;
    index index.php;

    client_max_body_size 20M;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    # jangan biarkan file tersembunyi (.env, .git) diakses publik
    location ~ /\.(?!well-known) { deny all; }
}
```

5. Izin tulis (di shared hosting biasanya sudah writable secara default oleh akun Anda; di VPS jalankan ini):

```bash
chown -R www-data:www-data storage bootstrap/cache
```

`storage:link` dijalankan otomatis oleh installer web — tidak perlu manual.

## 3. Database — dua cara

### Cara A: biarkan installer menjalankan migration (disarankan)

Cukup buat database kosong:

```sql
CREATE DATABASE kmsit_computer CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'kmsit'@'localhost' IDENTIFIED BY 'PASSWORD_KUAT';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES
  ON kmsit_computer.* TO 'kmsit'@'localhost';
FLUSH PRIVILEGES;
```

Installer akan membuat seluruh tabel otomatis (langkah 6).

### Cara B: migration via CLI (server dengan akses shell)

Laravel migration adalah satu-satunya sumber skema MySQL. Jalankan dari folder `backend/` setelah `.env` berisi `DB_*` yang benar:

```bash
php artisan migrate --force
```

> `backend/database/schema.sql` **bukan** file impor MySQL: isinya dump referensi dialek SQLite (tanpa data seed) dan tidak boleh di-`mysql <`/`SOURCE`. Role, permission, dan settings awal dibuat oleh installer; installer tetap wajib dijalankan untuk membuat **Super Admin pertama** dan mengunci instalasi.

## 4. Menjalankan Installer

1. Buka `https://kmsit.example.com` — otomatis redirect ke **`/install`**.
2. **Step 1 — Welcome.** Klik `Start Installation`.
3. **Step 2 — System Requirements.** Semua cek harus **PASS** (versi PHP, ekstensi, izin `storage/`, `bootstrap/cache/`, `.env` writable).
4. **Step 3 — Database.** Isi Host, Port (3306), Nama DB, Username, Password → klik `Test Database Connection`.
5. **Step 4 — Website Configuration.** Nama website, URL, **Super Admin pertama** (nama, email, password + konfirmasi), timezone, bahasa default, mata uang.
6. **Step 5 — Install.** Installer menulis `.env` (APP_KEY, DB_*, struktur MAIL_*, gateway kosong), menjalankan migration, membuat role/permission, membuat Super Admin **dengan password ter-hash**, membuat storage link, dan menulis **installation lock**.
7. **Step 6 — Finish.** `Go to Dashboard` → redirect `/login`. Setelah login → `/dashboard` **sesuai role**.

> Keamanan: installer **tidak dapat diakses ulang** setelah selesai; tidak ada akun demo — satu-satunya akun awal adalah Super Admin yang Anda buat di langkah 5.

## 5. Konfigurasi Pasca-Instalasi

### 5.1 Payment Gateway (Tripay / Xendit / Stripe)

Dashboard → **Pengaturan → Payment Gateway**:

1. Credential gateway **hanya** dari `.env` server (endpoint settings menolak key secret):
   - Tripay: `TRIPAY_API_KEY`, `TRIPAY_PRIVATE_KEY`, `TRIPAY_MERCHANT_CODE` (opsional `TRIPAY_WEBHOOK_SECRET`)
   - Xendit: `XENDIT_API_KEY`, `XENDIT_CALLBACK_TOKEN`
   - Stripe: `STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
2. Pilih gateway aktif & mode di Dashboard → Pengaturan → Payment Gateway (status `configured` per gateway
   ditampilkan). Pilihan ini dipakai untuk **payment baru**; perubahan tidak memengaruhi payment/webhook lama.
   Bila settings belum ada, sistem memakai fallback `PAYMENT_GATEWAY`/`PAYMENT_MODE` dari `.env`.
   Set `PAYMENT_MODE=live` (atau mode Live di dashboard) agar request benar-benar dikirim ke provider;
   mode `sandbox` memakai flow simulasi internal (tidak menghubungi provider).
3. Daftarkan URL callback di dashboard gateway:

```
https://kmsit.example.com/api/v1/payments/webhook/{gateway}
```

Ganti `{gateway}` dengan gateway aktif: `tripay`, `xendit`, atau `stripe`.

Sistem memverifikasi **signature** setiap webhook dan mencatatnya di `webhook_logs` dengan `UNIQUE(payload_hash)` — webhook duplikat **tidak** memproses ulang order/enrollment/saldo (idempotency).

### 5.2 Ekonomi Platform

- **Fee platform** default **15%** (Pengaturan → Umum → Fee Platform). Per penjualan: `gross` → `platform_fee 15%` → `net 85%` masuk ledger instructor (`instructor_wallet_transactions`), tercatat gross/fee/net per transaksi.
- Minimal withdrawal default Rp25.000; admin memproses via **Keuangan → Withdrawal** (pending → approved → processing → completed/rejected).

### 5.3 Shop — Varian, Produk Digital, Voucher

Dashboard → **Toko & Order → Produk**:

- **Varian**: di editor produk, tambahkan varian (label + harga + stok). Stok produk otomatis = total stok varian; pengurangan stok saat pembayaran memotong varian yang dibeli.
- **Produk digital**: aktifkan toggle *Produk Digital* dan unggah file via Media Library. Tanpa form alamat saat checkout — setelah pembayaran valid, buyer otomatis menerima **license key** + file di **Pembelajaran → Produk Digital**.
- **Voucher**: Dashboard → **Toko & Order → Voucher** — buat kode (persen/nominal, minimal order, maksimal diskon, kuota, masa berlaku). Buyer memasukkan kode di keranjang; validasi & perhitungan diskon di backend, pemakaian tercatat saat pembayaran berhasil.
- Form alamat pengiriman hanya muncul bila ada produk fisik di keranjang.

### 5.4 Email, Peta, Identitas

- **Email** (`MAIL_*` di `.env`): saat ini hanya **reset password** (via queue). Status pembayaran, enrollment, sertifikat, moderasi kelas, dan withdrawal dikirim sebagai **notifikasi in-app** (Dashboard → Notifikasi), bukan email.
- **Google Maps**: `GOOGLE_MAPS_API_KEY` (opsional) + latitude/longitude/query di Pengaturan → Umum.
- **Logo & Favicon**: Pengaturan → Umum — unggah logo **dan favicon**; favicon langsung aktif di tab browser setelah disimpan.

### 5.5 Website & Konten

- Susun blok homepage (hero, statistik, kelas unggulan/terbaru, instructor, berita, tutorial, kegiatan, CTA, peta/kontak) di **Website → Homepage**.
- Kelola menu & dropdown di **Website → Menu**; isi **Tentang Kami**, halaman CMS, artikel, berita, tutorial, dan kegiatan — semua langsung tampil di frontend.

## 6. Checklist Production & Keamanan

- [ ] `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL` benar
- [ ] `APP_KEY` ter-generate installer; `.env` tidak di-commit
- [ ] DB user hak minimal (bukan root)
- [ ] HTTPS aktif; `SESSION_SECURE_COOKIE=true`, `SESSION_SAME_SITE=lax`
- [ ] `/.env` dan `/database/migrations` mengembalikan 403/404 dari publik
- [ ] Rate limiting API (`throttle:api`), kebijakan & gate per route
- [ ] Webhook gateway terdaftar & teruji (kirim 2x → order/enrollment/saldo tidak ganda)
- [ ] Uji alur penuh: daftar student → beli kelas berbayar → webhook sukses → enrollment + saldo instructor 85% → quiz lulus → sertifikat → verifikasi publik
- [ ] Uji alur shop: varian → voucher → bayar → stok varian berkurang; produk digital → license + file terbit
- [ ] Cron `* * * * * php artisan schedule:run` aktif (reclaim voucher, heartbeat, dan worker fallback shared hosting); worker queue Redis/Supervisor bila VPS — lihat [docs/operations-queue-scheduler.md](docs/operations-queue-scheduler.md)
- [ ] `MAIL_MAILER=smtp` terkonfigurasi (email reset password dikirim via queue)
- [ ] `php artisan production:check` tanpa `FAIL`; tinjau setiap `WARN`
- [ ] Export backup dari **Pengaturan → Sistem & Audit**

## 7. Struktur Database (ringkasan)

`roles, permissions, users, sessions, categories, courses, course_sections, lessons, enrollments, lesson_progress, quizzes, quiz_questions, quiz_options, quiz_attempts, certificates, certificate_templates, articles, news, tutorials, activities, pages, homepage_blocks, menus, menu_items, media, orders, order_items, payments, webhook_logs, instructor_wallet_transactions, withdrawals, products, product_variants, vouchers, cart_items, digital_deliveries, notifications, audit_logs, contact_messages, settings`

Prinsip: normalized, foreign-key constrained, indexed pada kolom pencarian (`slug`, `email`, `reference`, `license_key`, `code`, `number`), unique constraint anti-duplikasi (enrollment, sertifikat per student/kelas, payload webhook), soft delete pada konten, timestamps di semua tabel.

## 8. Troubleshooting

| Gejala | Solusi |
|---|---|
| Installer tidak muncul (halaman normal) | Hapus lock instalasi hanya dari Pengaturan → Sistem → *Reset Aplikasi* (butuh konfirmasi `RESET`) |
| `Test Database Connection` gagal | Periksa kredensial, port 3306 terbuka, user punya hak pada DB tersebut |
| 500 saat install | Lihat `storage/logs/laravel.log`; biasanya izin tulis `storage/` atau `bootstrap/cache/` |
| Callback payment tidak masuk | URL callback harus publik & HTTPS; cek `webhook_logs` di Dashboard → Pembayaran |
| Webhook masuk tapi `invalid` | Signature tidak cocok — samakan secret key di `.env` dengan dashboard gateway |
| Gambar unggahan 404 | Jalankan `php artisan storage:link` |
| `Class "PDO" not found` | Aktifkan ekstensi `php8.2-mysql` lalu restart PHP-FPM |
| Favicon tidak berubah | Hard-refresh browser (Ctrl+Shift+R) — cache favicon agresif |

---

**Referensi cepat:** `README.md` (arsitektur & API) · `backend/database/migrations/` (sumber skema MySQL) · `.env.example` (seluruh variabel konfigurasi).
