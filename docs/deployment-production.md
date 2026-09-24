# Deployment Production

Dokumen ini adalah runbook deployment, bukan perintah untuk dijalankan otomatis. Target minimum: PHP 8.3, Laravel 13, Composer 2, Node yang kompatibel dengan lockfile, MySQL 8/InnoDB, HTTPS, dan web root mengarah ke `backend/public`.

## 1. Pre-deploy

1. Jadwalkan maintenance window dan hentikan perubahan administratif/order baru.
2. Catat commit/release saat ini dan versi PHP, MySQL, Composer, serta Node.
3. Ambil backup konsisten database dan storage (`storage/app`, khususnya `digital/` dan `lessons/`; serta public media). Verifikasi backup dapat dibaca dan catat lokasi/retensinya.
4. Jalankan query read-only untuk mendeteksi duplicate earning sebelum migration 000019:
   `SELECT order_id,user_id,type,ref_id,COUNT(*) FROM instructor_wallet_transactions WHERE type='earning' AND order_id IS NOT NULL AND ref_id IS NOT NULL GROUP BY order_id,user_id,type,ref_id HAVING COUNT(*)>1;`
5. Pastikan ruang disk cukup untuk backup, vendor, build, log, dan kemungkinan rebuild tabel `orders` saat perubahan enum.
6. Aktifkan maintenance setelah backup terverifikasi: `php artisan down --render="errors::503"` (atau mekanisme load balancer setara).

## 2. Dependency dan build

1. Deploy code ke direktori release baru; jangan overwrite release aktif secara parsial.
2. Backend: `composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction`.
3. Frontend: `npm ci`, `npm run typecheck`, lalu `npm run build`. Pastikan postbuild menyinkronkan aset ke `backend/public`.
4. Jangan menaruh credential dalam repository/build artifact. Salin konfigurasi production melalui secret manager atau `.env` server yang permission-nya terbatas.

## 3. Urutan migration dan code switch

1. Dengan code release baru tetapi traffic masih maintenance, jalankan `php artisan migrate --force` dan pastikan urutannya mencakup:
   - `2026_09_23_000019_add_voucher_reservations_to_orders`;
   - `2026_09_24_000020_add_stock_reservation_status_to_orders`.
2. 000019 menambah enum `cancelled`, bookkeeping voucher, index reclaim/webhook, dan unique guard earning. 000020 menambah bookkeeping stok. Keduanya harus selesai sebelum traffic memakai code baru.
3. Switch symlink/release aktif hanya setelah migration sukses. Jangan menjalankan `vouchers:reconcile-legacy --apply` saat deploy.

## 4. Cache Laravel

Sesudah konfigurasi final tersedia: `php artisan optimize:clear`, lalu `php artisan config:cache`, `php artisan route:cache`, dan `php artisan view:cache`. Jika salah satu gagal, jangan buka traffic. Setelah rollback code, clear/rebuild cache memakai code rollback.

## 5. Storage dan permission

1. Pastikan `storage` dan `bootstrap/cache` writable hanya oleh user PHP/worker.
2. Buat/verifikasi `php artisan storage:link`; web server tidak boleh melayani `.env`, `database`, source backend, atau private disk.
3. `media/` dan `avatars/` adalah public. `digital/` dan `lessons/` harus tetap pada disk private/local dan hanya lewat endpoint berotorisasi.
4. Audit media legacy untuk SVG, script, MIME/ekstensi tidak cocok, traversal/path di luar namespace, dan symlink. Quarantine manual; jangan menghapus massal tanpa backup.

## 6. Queue dan cache

- Pilih Redis untuk queue/cache/session jika tersedia dan teruji. Alternatif aman: database queue + file cache, sesuai `.env.production.example`.
- Jangan gunakan `sync`, `array`, atau `null` untuk profil production normal.
- Pastikan tabel `jobs` dan `failed_jobs` tersedia sebelum worker dimulai.

## 7. Scheduler dan worker

1. Pasang satu cron per menit: `* * * * * cd /path/to/backend && php artisan schedule:run`.
2. Jalankan worker melalui Supervisor/systemd: `php artisan queue:work --sleep=3 --tries=5 --timeout=60` (sesuaikan dengan retry/backoff aplikasi).
3. Setelah switch release/cache: `php artisan queue:restart`, lalu pastikan worker baru aktif dan heartbeat scheduler muncul.
4. Shared hosting tanpa daemon boleh memakai fallback scheduler worker yang terdokumentasi, tetapi jangan menjalankan keduanya sekaligus untuk tujuan kapasitas yang sama tanpa perencanaan.

## 8. Voucher legacy reconciliation

Jalankan hanya dry-run setelah migration: `php artisan vouchers:reconcile-legacy --limit=1000`. Tinjau kandidat, ambiguous, paid, dan counter voucher. `--apply` memerlukan window terpisah, backup terverifikasi, dan persetujuan operasional; jangan digabung dengan deployment pertama.

## 9. Production check dan smoke test

Jalankan `php artisan production:check --strict`. Sebelum membuka traffic, lakukan smoke test dengan akun/canary dan gateway sandbox/mock:

- login/logout, suspend/reactivate, dan permission admin;
- listing/detail/enrollment course serta progress lesson;
- checkout, reservasi stok/voucher, cancel, dan stok tidak negatif;
- webhook signed sandbox, replay idempotent, paid/failed/expired, serta audit late-payment shortage;
- wallet earning/withdrawal dan isolasi pemilik;
- quiz/certificate;
- upload/serve/delete media aman serta download lesson/digital lintas-user ditolak.

Jangan mengirim request ke gateway live sebagai bagian smoke test kecuali ada change approval terpisah.

## 10. Monitoring

Pantau error rate/latency, deadlock atau lock-wait MySQL, slow query log, queue depth, `failed_jobs`, scheduler heartbeat, disk, dan log Laravel/web server. Buat alert untuk `stock_fulfillment_shortage`, `voucher_over_limit`, signature webhook invalid berulang, withdrawal/audit anomaly, serta lonjakan 5xx/429.

## 11. Rollback

1. Masuk maintenance dan hentikan worker sebelum rollback.
2. Rollback code via switch release atomik, lalu rebuild cache dan restart worker.
3. Utamakan **forward fix** untuk database. Rollback migration 000020 aman hanya jika bookkeeping stok baru tidak lagi dibutuhkan oleh code aktif.
4. Rollback 000019 diblokir bila ada order `cancelled`; data harus direkonsiliasi terlebih dahulu. Menghapus kolom reservasi/unique index juga menghilangkan guard/idempotency dan tidak mengembalikan counter historis.
5. Jangan restore database saja sementara storage/code tetap versi baru. Untuk rollback destruktif, restore database dan storage dari snapshot konsisten serta dokumentasikan kehilangan transaksi setelah snapshot.
6. Setelah rollback, ulangi production check dan smoke test minimum sebelum membuka traffic.
