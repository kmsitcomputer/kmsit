# INSTALL — KMSIT Computer

Panduan instalasi production (arsitektur Laravel + MySQL) dan penggunaan installer.

## 1. Persyaratan Server

- PHP ≥ 8.2 (ext: pdo_mysql, openssl, mbstring, tokenizer, xml, ctype, json, fileinfo, gd, curl)
- MySQL 8.0+ / MariaDB 10.6+
- Apache (mod_rewrite) atau Nginx
- HTTPS disarankan (payment callback wajib reachable)

## 2. Upload & Web Server

1. Upload seluruh project ke server (di luar document root bila memungkinkan).
2. **Apache** — arahkan DocumentRoot ke `/public`:

```apache
<VirtualHost *:443>
    ServerName kmsit.example.com
    DocumentRoot /var/www/kmsit-computer/public
    <Directory /var/www/kmsit-computer/public>
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

3. **Nginx**:

```nginx
server {
    listen 443 ssl http2;
    server_name kmsit.example.com;
    root /var/www/kmsit-computer/public;
    index index.php;
    location / { try_files $uri $uri/ /index.php?$query_string; }
    location ~ \.php$ { fastcgi_pass unix:/run/php/php8.2-fpm.sock; fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name; include fastcgi_params; }
    location ~ /\.(?!well-known) { deny all; }   # blokir .env, .git, migration
}
```

4. Pastikan `storage/` dan `bootstrap/cache/` writable; jalankan `php artisan storage:link`.

## 3. Jalankan Installer

1. Buka `https://kmsit.example.com` — otomatis redirect ke `/install`.
2. **Requirements** — semua cek harus PASS.
3. **Database** — isi host/port/nama DB/username/password MySQL → `Test Database Connection`.
4. **Website Configuration** — nama website, URL, **Super Admin pertama** (nama, email, password + konfirmasi), timezone, bahasa, mata uang.
5. Klik **Install** — installer menulis `.env`, generate `APP_KEY`, menjalankan migration, membuat role/permission, membuat Super Admin (password ter-hash), dan menulis **installation lock**.
6. Selesai → `Go to Dashboard` → redirect `/login`. Setelah login → `/dashboard` sesuai role.

> Installer **tidak dapat diakses ulang** setelah selesai. Tidak ada akun demo — satu-satunya akun awal adalah yang Anda buat di langkah 4.

## 4. Konfigurasi Pasca-Instalasi

1. **Payment Gateway** — Dashboard → Pengaturan → Payment Gateway: pilih gateway aktif (Tripay/Xendit/Stripe), isi API/Secret/Merchant key (production: dari `.env` `TRIPAY_*`, `XENDIT_*`, `STRIPE_*`), daftarkan URL callback `https://kmsit.example.com/api/v1/payments/callback`. Uji di **sandbox** sebelum live.
2. **Fee platform** — default 15% (Pengaturan → Umum → Fee Platform).
3. **Email** — konfigurasi `MAIL_*` untuk welcome, reset password, notifikasi pembayaran, sertifikat, withdrawal.
4. **Google Maps** — isi API key (opsional), latitude/longitude di Pengaturan → Umum.
5. **Homepage & Menu** — susun blok homepage dan menu navigasi (Website → Homepage / Menu).
6. **About Us / Pages / Konten** — isi melalui CMS; semua langsung tampil di frontend.

## 5. Checklist Production & Keamanan

- [ ] `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL` benar
- [ ] `APP_KEY` ter-generate (jangan commit `.env`)
- [ ] DB user dengan hak minimal (bukan root)
- [ ] HTTPS aktif; cookie `SESSION_SECURE_COOKIE=true`, `SESSION_SAME_SITE=lax`
- [ ] `.env`, migration, dan source tidak dapat diakses publik (uji: `/.env` → 403)
- [ ] Rate limiting API (`throttle:api`) & webhook signature verification aktif
- [ ] Backup terjadwal (`php artisan schedule:work` + backup database) — fitur export juga tersedia di Dashboard → Sistem
- [ ] Uji alur: daftar student → beli kelas → webhook sukses → enrollment + saldo instructor 85% → quiz → sertifikat → verifikasi publik
- [ ] Uji duplikasi webhook (kirim 2x) — order/enrollment/saldo **tidak** bertambah dua kali

## 6. Struktur Database (ringkasan migration)

`users, roles, permissions, role_user, permission_role, profiles, instructors, course_categories, courses, course_sections, lessons, enrollments, lesson_progress, quizzes, quiz_questions, quiz_options, quiz_attempts, quiz_answers, certificates, certificate_templates, articles, article_categories, news, tutorials, activities, pages, homepage_sections, menus, menu_items, media, orders, order_items, payments, payment_transactions, instructor_wallets, instructor_wallet_transactions, withdrawals, products, product_categories, carts, cart_items, notifications, settings, audit_logs` — normalized, foreign-key constrained, indexed pada kolom pencarian (slug, email, reference, certificate number), soft delete & timestamps pada tabel konten.
