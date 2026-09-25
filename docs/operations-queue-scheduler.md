# Operasional Queue, Cache & Scheduler — KMSIT Computer

Dokumen ini untuk operator server. Semua contoh di bawah adalah **contoh konfigurasi**; sesuaikan path, user, dan versi PHP dengan server Anda. Jangan menaruh credential di file ini atau di repository.

## 1. Arsitektur

| Komponen | Production direkomendasikan (VPS) | Fallback shared hosting (default template/installer) | Development | Test (`phpunit.xml`) |
|---|---|---|---|---|
| Queue | `QUEUE_CONNECTION=redis` + worker Supervisor/systemd | `QUEUE_CONNECTION=database` + `QUEUE_SCHEDULER_WORKER=true` (worker dijalankan cron) | `database` atau `sync` | `sync` / `Queue::fake` |
| Cache & lock scheduler | `CACHE_STORE=redis` | `CACHE_STORE=file` | `database` | `array` |
| Session | `SESSION_DRIVER=file` (tetap di luar Redis — IMP-001) | `file` | `database` | `array` |
| Mail | `MAIL_MAILER=smtp` | `smtp` | `log` | `array` / `Mail::fake` |
| Failed jobs | tabel `failed_jobs` (DB) | tabel `failed_jobs` (DB) | sama | SQLite `:memory:` |

Aplikasi **tidak membutuhkan Redis** untuk berjalan. Redis hanya dipakai bila `.env` memilihnya; test suite tidak pernah menghubungi Redis/SMTP.

### Pekerjaan yang berjalan di queue

| Pekerjaan | Alasan | Jaminan |
|---|---|---|
| Email reset password (`App\Mail\PasswordResetMail`) | Request HTTP tidak menunggu SMTP | Payload terenkripsi (link berisi token), 5 percobaan dengan backoff 10s/1m/5m/15m, timeout 30s (< `retry_after` 90s). Retry hanya mengirim bila token itu masih token terbaru & belum kedaluwarsa, dan paling banyak sekali (penanda di cache). Gagal permanen → `failed_jobs` + log `warning` tanpa token/email polos. Gagal saat enqueue → `report()` ke log; respons API tetap generik. |

Sengaja **tidak** dipindah ke queue: fulfillment webhook pembayaran (enrollment, stok, voucher, digital delivery, saldo instructor), penerbitan sertifikat, notifikasi in-app, inisiasi pembayaran ke gateway (harus mengembalikan `checkout_url`), dan export backup (respons unduhan langsung). Semuanya bergantung pada transaksi/lock yang ada atau hasilnya dibutuhkan di respons yang sama.

### Tugas scheduler (`routes/console.php`)

| Tugas | Jadwal | Catatan |
|---|---|---|
| `vouchers:reclaim-reservations` | per jam | idempotent, `withoutOverlapping(55)`, `onOneServer` |
| `ops:scheduler-heartbeat` | per menit | menulis `ops:scheduler-heartbeat` ke cache; dibaca `production:check` |
| `queue:prune-failed --hours=336` | harian | menghapus failed job > 14 hari |
| `queue:work --stop-when-empty --max-time=50` | per menit | **hanya** bila `QUEUE_SCHEDULER_WORKER=true` dan queue bukan `sync` |

Periksa daftar aktual dengan `php artisan schedule:list`.

## 2. Cron (wajib di semua profil)

Satu entri cron menjalankan seluruh scheduler:

```cron
* * * * * cd /var/www/kms/backend && php artisan schedule:run >> /dev/null 2>&1
```

cPanel/shared hosting: menu **Cron Jobs**, interval *Once Per Minute*, perintah seperti di atas dengan path PHP CLI host (mis. `/usr/local/bin/php`). `schedule:work` hanya untuk development lokal, bukan pengganti cron.

## 3. Profil A — VPS dengan Redis (direkomendasikan)

`.env`:

```dotenv
CACHE_STORE=redis
QUEUE_CONNECTION=redis
QUEUE_SCHEDULER_WORKER=false
SESSION_DRIVER=file            # sesi tetap di luar Redis (IMP-001); database juga didukung
REDIS_CLIENT=phpredis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=             # isi di server, jangan di-commit
REDIS_PREFIX=kmsit-
```

### Supervisor — `/etc/supervisor/conf.d/kmsit-worker.conf`

```ini
[program:kmsit-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/kms/backend/artisan queue:work redis --sleep=3 --max-time=3600 --memory=256
directory=/var/www/kms/backend
user=www-data
numprocs=1
autostart=true
autorestart=true
stopwaitsecs=60
redirect_stderr=true
stdout_logfile=/var/www/kms/backend/storage/logs/worker.log
```

Aktifkan: `supervisorctl reread && supervisorctl update`.

### systemd (alternatif) — `/etc/systemd/system/kmsit-worker.service`

```ini
[Unit]
Description=KMSIT queue worker
After=network.target redis-server.service mysql.service

[Service]
User=www-data
WorkingDirectory=/var/www/kms/backend
ExecStart=/usr/bin/php artisan queue:work redis --sleep=3 --max-time=3600 --memory=256
Restart=always
RestartSec=5
TimeoutStopSec=60

[Install]
WantedBy=multi-user.target
```

Aktifkan: `systemctl daemon-reload && systemctl enable --now kmsit-worker`.

`stopwaitsecs`/`TimeoutStopSec` (60s) harus lebih besar dari timeout job terpanjang (30s) agar job selesai sebelum proses dihentikan. `retry_after` koneksi (default 90s, `REDIS_QUEUE_RETRY_AFTER`/`DB_QUEUE_RETRY_AFTER`) harus lebih besar dari timeout job.

## 4. Profil B — Shared hosting tanpa Redis/Supervisor

Bila host tidak memiliki Redis/Supervisor, pilih profil fallback secara eksplisit
(opt-in, bukan otomatis) di `.env`:

```dotenv
CACHE_STORE=file
QUEUE_CONNECTION=database
QUEUE_SCHEDULER_WORKER=true
```

Cron dari bagian 2 setiap menit menjalankan worker pendek (`--stop-when-empty`, maks 50 detik, tanpa overlap). Email reset password biasanya terkirim < 1 menit setelah permintaan. Tanpa cron, job menumpuk di tabel `jobs` dan `production:check` memberi peringatan.

Bila host sama sekali tidak mengizinkan cron: `QUEUE_CONNECTION=sync` (email dikirim di dalam request) — fungsional tetapi request menunggu SMTP dan reclaim voucher hanya berjalan secara lazy saat checkout. `production:check` memberi `WARN`.

## 5. Deploy

```bash
php artisan down --retry=60          # opsional
php artisan migrate --force          # tabel jobs/failed_jobs/cache sudah termasuk migration dasar
php artisan config:cache && php artisan route:cache
php artisan queue:restart            # worker Supervisor/systemd memuat kode baru setelah job berjalan selesai
php artisan up
php artisan production:check
```

`queue:restart` memakai cache; pastikan cache store sama untuk web dan worker.

## 6. Pemantauan & failed jobs

`php artisan production:check`:

- `FAIL` = aplikasi tidak dapat berjalan benar dengan konfigurasi ini (DB tidak tersedia, `APP_KEY` kosong, cache/queue/Redis yang dipilih tidak dapat dihubungi, tabel `jobs`/`failed_jobs` belum ada, dst.). Exit code 1.
- `WARN` = berjalan, tetapi perlu tindakan: queue `sync`, mailer `log`/`array`, cache `array`, heartbeat scheduler tidak ada/lebih dari 5 menit, ada failed job, job tertunda > 10 menit. Exit code 0 (1 dengan `--strict`).
- `INFO` = rekomendasi (mis. gunakan Redis).

Failed job:

```bash
php artisan queue:failed               # daftar
php artisan queue:retry <uuid>         # ulangi satu (aman: email reset hanya terkirim bila token masih berlaku)
php artisan queue:retry all
php artisan queue:forget <uuid>
```

Endpoint publik `/api/health` hanya melaporkan status database dan sengaja tidak membuka detail konfigurasi queue/cache.
