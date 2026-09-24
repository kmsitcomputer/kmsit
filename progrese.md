# Progress KMSIT Computer

## Status

Migrasi dari React browser-only menuju React + Laravel + MySQL sedang berjalan bertahap.

## Log Pengerjaan

### 2026-09-04 - Audit production awal

- Menjalankan `npm run build`: berhasil.
- Menjalankan `npm run typecheck`: berhasil.
- Mengidentifikasi aplikasi frontend masih memakai `localStorage` sebagai database, session, dan data bisnis.
- Memeriksa ServBay: site `kmsitcomputer.host` memakai NGINX dan HTTPS self-signed.
- Mengarahkan site ServBay ke `dist/` sebagai static production.
- Memverifikasi homepage dan asset production HTTP 200.
- Memverifikasi `src/App.tsx` dan `database/schema.sql` tidak terekspos HTTP.
- Menemukan bundle utama sekitar 1 MB; menjadi optimasi lanjutan, bukan blocker.

### 2026-09-04 - Analisis arsitektur

- Menyelesaikan analisis frontend, dashboard, service, routing, database, dan backend.
- Menetapkan React/Vite tetap dipertahankan sebagai frontend.
- Menetapkan Laravel API + Eloquent + MySQL sebagai backend production.
- Menetapkan Sanctum/session cookie, Form Request, Policies, Service layer, database transaction, queue, dan Laravel Storage sebagai target arsitektur.
- Mengidentifikasi gap: backend belum tersedia, auth masih browser-only, payment masih simulator, file masih base64, dan validasi finansial masih frontend.
- Menetapkan migration Laravel sebagai source of truth; SQL legacy tidak dijalankan mentah-mentah karena perbedaan snake_case/relasi/normalisasi.

### 2026-09-04 - Laravel foundation

- Membuat skeleton Laravel di `backend/` menggunakan Laravel 13.30.1 dan PHP 8.3.
- Memperbaiki penggunaan Composer ServBay yang menunjuk ke binary tidak tepat.
- Menambahkan endpoint `GET /api/health`.
- Menambahkan template `backend/.env.production.example` untuk MySQL, HTTPS, session secure, mail, dan payment.
- Menjalankan `php artisan config:cache`.
- Test Laravel awal: lulus.

### 2026-09-04 - Authentication

- Memasang Laravel Sanctum.
- Menambahkan migration `roles`, `permissions`, `users`, dan personal access tokens.
- Mengubah `User` model agar memakai string ID, password hash Laravel, dan relasi role.
- Menambahkan API register, login, current user, dan logout.
- Menggunakan secure Laravel session cookie; auth tidak lagi memakai `localStorage` atau token client.
- Menambahkan test register -> session -> `/me` -> logout.
- Auth test lulus.

### 2026-09-04 - LMS core

- Menambahkan migration categories, courses, course sections, lessons, enrollments, dan lesson progress.
- Menambahkan model Eloquent dan relasi LMS.
- Menambahkan API course catalog, detail, free enrollment, dan lesson completion.
- Menambahkan server-side protection agar lesson privat tidak membocorkan content.
- Menambahkan progress calculation dan completion transaction.
- Memperbaiki mapping model `Section` ke tabel `course_sections` setelah test menemukan mismatch.
- Test LMS access/progress lulus.

### 2026-09-04 - Quiz

- Menambahkan migration quizzes, quiz questions, quiz options, dan quiz attempts.
- Menambahkan model Eloquent quiz.
- Menambahkan API melihat quiz, start attempt, dan submit attempt.
- Scoring single, multiple, boolean, dan short answer dihitung server-side.
- Menambahkan verifikasi enrollment, timer, attempt limit, dan ownership attempt.
- Jawaban benar tidak dikirim ke student.
- Test quiz server-side lulus.

### 2026-09-04 - Order dan payment foundation

- Menambahkan migration orders, order items, payments, dan webhook logs.
- Menambahkan model Eloquent commerce.
- Menambahkan API membuat order course, mengambil order milik user, dan initiate payment.
- Course gratis otomatis membuat enrollment.
- Course berbayar tetap pending hingga webhook valid.
- Menambahkan HMAC signature verification dan webhook idempotency.
- Webhook invalid ditolak dan webhook duplikat tidak diproses ulang.
- Menghapus simulator payment sukses/gagal dari checkout React.
- Test order/payment lulus.

### 2026-09-04 - Checkout frontend

- Menambahkan API client terpusat di `src/lib/api.ts`.
- Menghubungkan CourseDetail untuk membuat order/enrollment lewat Laravel API.
- Menghubungkan Checkout untuk mengambil order dari server dan initiate payment lewat API.
- Menghapus simulator payment lokal dari UI.
- TypeScript dan production build lulus.

### 2026-09-04 - Shop foundation

- Menambahkan migration products, product variants, vouchers, dan cart items.
- Menambahkan model Product, ProductVariant, CartItem, dan Voucher.
- Menambahkan API katalog produk dan cart.
- Menambahkan validasi variant wajib, stock limit server-side, dan ownership cart.
- Memperbaiki bug optional `variant_id` yang sempat menghasilkan HTTP 500.
- Menambahkan API client produk dan cart.
- Test shop lulus.

### 2026-09-04 - Shop API continuation

- Menambahkan endpoint katalog produk dan cart ke Laravel.
- Menambahkan API client produk/cart di `src/lib/api.ts`.
- Menambahkan validasi variant wajib, batas stok server-side, dan ownership item cart.
- Menemukan lalu memperbaiki HTTP 500 saat `variant_id` tidak dikirim; field nullable sekarang diproses aman.
- Test shop akhir lulus.

### 2026-09-04 - Shop API validation continuation

- Migration shop dijalankan ulang bersama seluruh migration Laravel.
- API cart diuji untuk produk dengan variant, variant wajib, stok maksimum, dan ownership antar-user.
- Bug `variant_id` nullable diperbaiki setelah test menghasilkan HTTP 500.
- API client produk/cart tersedia di `src/lib/api.ts`.
- Status: backend shop siap dipakai; halaman Shop React masih memakai service lokal untuk listing/cart/voucher.

### 2026-09-04 - Checkout integration continuation

- Menambahkan endpoint pengambilan order milik user untuk checkout.
- CourseDetail memakai API Laravel untuk free enrollment dan pembuatan paid order.
- Checkout memakai API Laravel untuk mengambil order dan initiate payment.
- Simulator payment lokal dihapus; status sukses hanya boleh berasal dari webhook backend.
- API client ditambah untuk order, payment, produk, dan cart.
- Halaman Shop/cart belum dipindahkan penuh; masih memakai adapter legacy sampai endpoint checkout shop/voucher/stock reservation tersedia.

### 2026-09-04 - Batch validasi terakhir

- Laravel test suite terakhir: 7 test lulus, 41 assertions.
- TypeScript check terakhir: lulus.
- Vite production build terakhir: lulus.
- Checkout course sudah memakai API Laravel; checkout shop belum dipindahkan.

### 2026-09-04 - Shop checkout server-side

- Menambahkan endpoint `POST /api/v1/orders/shop`.
- Checkout membaca cart dari database, bukan payload harga dari browser.
- Harga variant/produk dihitung ulang di Laravel.
- Voucher percent/fixed, minimum order, batas diskon, expiry, dan usage limit divalidasi di backend.
- Produk fisik mewajibkan nama, alamat, dan nomor telepon pengiriman.
- Order shop dibuat sebagai `pending` dan item order dinormalisasi ke `order_items`.
- Menambahkan API client `createShopOrder`.
- Test checkout shop lulus: harga database, voucher, dan shipping validation.
- Status: checkout shop backend siap; halaman Shop React masih perlu migrasi state cart dan submit checkout.

### 2026-09-04 - ShopPage API integration

- ShopPage mulai memakai katalog produk dari Laravel API.
- VariantModal memakai API cart, bukan `ShopService` localStorage.
- Tambah produk, hapus item, update quantity, dan checkout memakai API server.
- Menambahkan endpoint update quantity cart.
- Menemukan dan memperbaiki kurung penutup lama dari `setTimeout` checkout.
- Menemukan dan memperbaiki import React ganda saat menambahkan `useEffect`.
- TypeScript check dan production build lulus.
- Status: state utama ShopPage sudah terhubung API; voucher masih memakai service lokal karena endpoint validasi voucher frontend belum dibuat.

### 2026-09-04 - Voucher API integration

- Menambahkan `POST /api/v1/shop/voucher/validate`.
- Validasi code, status aktif, expiry, usage limit, minimum order, dan maximum discount dilakukan Laravel.
- ShopPage mengganti `VoucherService` lokal dengan `api.validateVoucher`.
- Diskon yang tampil di UI berasal dari response backend.
- TypeScript check dan production build lulus.
- Status: voucher Shop sudah terhubung API; digital delivery, stock fulfillment, dan payment shop masih berikutnya.

### 2026-09-04 - Digital delivery foundation

- Menambahkan migration `digital_deliveries` dan model Eloquent.
- Menambahkan endpoint daftar digital delivery milik user.
- Menambahkan protected download endpoint yang memeriksa user, status license, dan private Laravel Storage.
- Payment webhook sekarang mengurangi stok product/variant saat status `paid`.
- Payment webhook menerbitkan license digital satu kali berdasarkan `order_item_id`.
- Migration fresh dan seluruh test backend lulus: 8 test, 46 assertions.
- Catatan: upload media/private storage dan test file download end-to-end masih perlu dibuat.

### 2026-09-04 - Wallet and withdrawal API

- Menambahkan migration wallet transaction dan withdrawals.
- Menambahkan model WalletTransaction dan Withdrawal.
- Menambahkan endpoint summary/ledger wallet instructor.
- Menambahkan pengajuan withdrawal dengan minimum Rp25.000 dan saldo dihitung dari ledger.
- Menambahkan approval, processing, completed, dan rejected workflow admin.
- Semua perubahan saldo withdrawal memakai database transaction dan row lock.
- Test wallet lulus: saldo, batas saldo, approval, completion, dan ledger.

### 2026-09-04 - Settings API foundation

- Menambahkan migration dan model `settings`.
- Menambahkan public settings allowlist untuk kebutuhan frontend.
- Menambahkan update settings yang dibatasi role admin/super admin.
- Credential payment tidak dapat diubah melalui endpoint settings umum.
- Menambahkan API client public settings dan update setting.
- Migration fresh, route check, dan test suite lulus: 9 test, 52 assertions.

### 2026-09-04 - Dashboard integration preparation

- Menambahkan API client wallet dan withdrawal untuk frontend.
- Endpoint client: wallet summary/ledger, request withdrawal, dan digital delivery.
- Audit menunjukkan `Commerce.tsx` masih memakai `WalletService`/`WithdrawalService` pada WalletPage dan admin withdrawals.
- Status: backend wallet siap; migrasi Dashboard Wallet belum dilakukan agar tidak mencampur state async dengan service lokal admin.

### 2026-09-04 - Dashboard Wallet integration

- WalletPage membaca summary, ledger, dan riwayat withdrawal dari Laravel API.
- WithdrawModal mengirim pengajuan withdrawal ke API dengan validasi server-side.
- Menambahkan mapping snake_case response wallet ke tipe frontend.
- Memperbaiki pemanggilan modal pada halaman admin agar tidak tercampur dengan state WalletPage.
- TypeScript check, production build, dan backend test suite lulus.
- Status: WalletPage instructor sudah terhubung API; halaman admin Withdrawals masih memakai service legacy dan menjadi tahap berikutnya.

### 2026-09-04 - Dashboard Wallet and Settings API integration

- Menambahkan endpoint admin daftar withdrawal dan endpoint update status.
- Dashboard Withdrawals memakai API untuk daftar, nama instructor, dan perubahan status.
- WalletPage/WithdrawModal tetap memakai API wallet instructor.
- SettingsGeneral memuat settings non-secret dari Laravel.
- SettingsGeneral menyimpan perubahan melalui API Laravel.
- Menemukan dan memperbaiki mapping nullable settings dari backend ke form string.
- TypeScript check, production build, dan test suite lulus: 9 test, 52 assertions.
- Status: dashboard wallet/settings inti sudah terhubung; payment settings credential dan CMS masih berikutnya.

### 2026-09-04 - Admin withdrawal and media storage

- Dashboard Withdrawals membaca daftar global dari API Laravel.
- Admin dapat mengubah status withdrawal melalui endpoint server-side.
- Menambahkan migration/model media.
- Upload media menggunakan Laravel Storage dan MIME allowlist.
- Menambahkan protected metadata API dan FormData API client.
- Memperbaiki assertion path pada test upload setelah ditemukan prefix path ganda.
- Media upload test lulus: 4 assertions.

### 2026-09-04 - Dashboard and CMS continuation

- Dashboard Withdrawals memakai API Laravel untuk daftar global dan update status.
- SettingsGeneral memakai API admin non-secret untuk load/save.
- Menambahkan migration/model `media` dan upload Laravel Storage dengan MIME allowlist.
- Menambahkan migration/model `articles` dengan published public API dan admin create API.
- Menambahkan API client settings, media, dan articles.
- Migration fresh berhasil sampai migration media/articles/settings/wallet.
- Test suite backend terakhir: 10 test lulus, 56 assertions.
- TypeScript check dan production build terakhir lulus.
- Catatan: halaman SettingsPayments, CMS CRUD lain, dan MediaPicker belum sepenuhnya dipindahkan dari adapter legacy.

### 2026-09-04 - CMS article validation

- Menambahkan test draft visibility dan admin article creation.
- Draft artikel tidak dapat diakses public.
- Published artikel dapat diakses melalui public API.
- Article API test lulus: 4 assertions.
- TypeScript check dan production build lulus.

### 2026-09-04 - CMS content API continuation

- Menambahkan migration/model generic untuk `news`, `tutorials`, `activities`, dan `pages`.
- Menambahkan satu `ContentController` reusable untuk public listing/detail dan admin create.
- Menambahkan route public/admin untuk empat tipe content.
- Migration fresh berhasil sampai CMS content migration.
- Test draft visibility dan published access artikel lulus.
- Route API total terdaftar: 48.
- Test suite backend terbaru: 11 test lulus, 60 assertions.
- Status: backend CMS content tersedia; frontend CMS CRUD masih memakai adapter legacy.

### 2026-09-04 - Payment configuration and CSRF hardening

- Menambahkan `config/payment.php` untuk mode sandbox/live dan credential environment.
- Menambahkan contract `PaymentGateway` dan resolver yang menolak gateway belum dikonfigurasi.
- Auth frontend mengambil Sanctum CSRF cookie sebelum login/register/logout.
- Menemukan HTTP 419 pada test session auth setelah config cache; akar masalahnya adalah middleware CSRF Laravel 13.
- Memperbaiki feature test agar hanya melewati `PreventRequestForgery`, session middleware tetap aktif.
- Seluruh backend suite kembali lulus: 11 test, 60 assertions.
- Catatan: adapter HTTP Tripay/Xendit/Stripe belum diaktifkan tanpa credential dan kontrak callback live.

### 2026-09-04 - Digital dashboard integration

- MyDigitalPage membaca daftar delivery dari Laravel API.
- License key dan jumlah download berasal dari database backend.
- Link download diarahkan ke protected Laravel endpoint, bukan direct storage URL.
- Menghapus ketergantungan `DeliveryService`/database lokal dari dashboard digital.
- TypeScript check lulus setelah migrasi dashboard digital.

### 2026-09-04 - Current checkpoint

- CMS content backend tersedia untuk artikel, news, tutorials, activities, dan pages.
- Dashboard withdrawal dan Wallet instructor sudah memakai API.
- SettingsGeneral sudah memakai API non-secret.
- Media upload memakai Laravel Storage.
- Payment gateway baru sampai konfigurasi/contract; adapter provider nyata belum aktif.
- Frontend adapter `localStorage` masih dipakai oleh SettingsPayments, CMS CRUD lain, overview/orders/payments, installer, dan beberapa public page.

### 2026-09-04 - Final validation of current batch

- Menemukan helper URL download digital dideklarasikan async padahal mengembalikan string langsung.
- Memperbaiki helper menjadi sinkron agar atribut href React valid.
- Frontend typecheck: lulus.
- Frontend production build: lulus.
- Backend test suite: 11 test lulus, 60 assertions.
- Status: digital dashboard sudah terhubung API; tahap berikutnya adalah migrasi CMS dashboard dan penghapusan adapter localStorage secara bertahap.

### 2026-09-04 - SettingsPayments integration

- SettingsPayments membaca gateway aktif, mode, dan status configured dari Laravel API.
- Credential payment dihapus dari state/input frontend dan tetap dikelola environment server.
- Endpoint settings payment menyimpan gateway/mode tanpa menyimpan secret.
- Memperbaiki payment initiation agar mode menggunakan `PAYMENT_MODE` server-side.
- Menambahkan `PAYMENT_GATEWAY` pada production environment example.
- TypeScript check, production build, dan backend test suite lulus.

### 2026-09-04 - Orders and Payments dashboard integration

- Menambahkan endpoint daftar order dengan filter ownership student/admin.
- Menambahkan endpoint daftar payment dengan filter ownership server-side.
- OrdersPage membaca order dari Laravel API.
- PaymentsPage membaca payment dari Laravel API.
- Menambahkan mapping order/payment response Laravel ke tipe frontend.
- Test ownership order/payment ditambahkan.
- Backend test suite lulus: 11 test, 63 assertions.
- TypeScript check lulus.
- Status: tabel utama dashboard Orders/Payments sudah API; webhook log detail masih memakai adapter legacy.

### 2026-09-04 - Payment dashboard completion

- Menambahkan endpoint admin webhook logs.
- PaymentsPage membaca payment dan webhook logs dari Laravel API.
- Audit tidak menemukan lagi `OrderService.list/ofUser`, `PaymentService.list`, atau `db.all('webhookLogs')` pada halaman dashboard Orders/Payments.
- TypeScript check dan production build lulus.
- Backend test suite lulus: 11 test, 63 assertions.
- Status: dashboard Orders/Payments sudah terhubung penuh untuk data yang tersedia di backend.

### 2026-09-04 - CMS CRUD continuation

- Menambahkan update dan soft delete CMS generic untuk news, tutorials, activities, dan pages.
- Menambahkan update/delete artikel melalui controller generic reusable.
- Menambahkan API client `createContent`, `updateContent`, dan `deleteContent`.
- Menemukan bug resolusi parameter route generic yang menyebabkan update 404.
- Memperbaiki controller agar membaca `type` dan `id` langsung dari route request.
- Article CRUD test lulus: 7 assertions.
- Backend test suite terbaru: 11 test lulus, 66 assertions.
- Frontend typecheck dan production build lulus.

### 2026-09-04 - Public CMS listing integration

- Public listing artikel/news/tutorial/activity memakai generic CMS API Laravel.
- Search listing dikirim ke server; filter kategori existing tetap dipertahankan.
- Menambahkan generic content method pada API client.
- Detail content masih memakai adapter lokal dan akan dipindahkan setelah response detail snake_case dipetakan penuh.
- TypeScript check dan production build lulus.

### 2026-09-04 - Public CMS detail integration

- Public content detail artikel/news/tutorial/activity memuat data detail dari Laravel API.
- Related content dimuat dari endpoint API, bukan query database browser.
- Author dan category metadata artikel disamakan dengan CMS generic response.
- Memperbaiki model generic CMS agar instansiasi class Eloquent runtime valid.
- Audit listing/detail tidak menemukan lagi query `db.find/table` atau `db.where/table` pada komponen tersebut.
- TypeScript check dan production build lulus.
- Backend test suite: 11 test lulus, 66 assertions.

### 2026-09-04 - Current migration status

- Auth, LMS course access/progress, quiz, checkout course/shop, cart, voucher, wallet, withdrawals, orders, payments, webhook logs, settings, digital delivery, media, dan public CMS content sudah memiliki jalur API.
- Sisa adapter localStorage terutama homepage CMS blocks, SettingsSystem/backup, CMS dashboard editor, public settings sync, legacy service overview, serta installer browser-only.

### 2026-09-04 - LMS catalog and detail integration

- CoursesCatalog membaca course published dari Laravel API.
- CourseDetailPage membaca detail course, instructor, enrollment flag, section, lesson, durasi, jumlah materi, dan jumlah student dari API.
- Curriculum detail tidak lagi memakai `CurriculumService` lokal pada halaman detail.
- Metadata backend `enrollments_count` ditambahkan untuk statistik course.
- Menemukan implicit `any` pada reducer API mapper dan memperbaikinya dengan tipe eksplisit.
- TypeScript check dan production build lulus.
- Backend test suite lulus: 11 test, 66 assertions.
- Status: katalog/detail LMS terhubung; LearnPage dan progress/quiz UI masih perlu migrasi remote penuh.

### 2026-09-04 - LMS LearnPage and progress integration

- Menambahkan endpoint progress course dengan daftar lesson selesai dan persentase server-side.
- LearnPage membaca course/curriculum dari Laravel API.
- LearnPage membaca enrollment dan progress dari API.
- Aksi tandai lesson selesai memakai endpoint transaction Laravel.
- Menghapus pemakaian service local pada curriculum LearnPage.
- Tombol pembatalan selesai tidak lagi memanipulasi local DB; status selesai dikelola server.
- Test progress API lulus: 14 assertions.
- Status: katalog, detail, enrollment, curriculum, dan progress LMS sudah terhubung API; quiz UI/certificate UI masih perlu integrasi remote penuh.

### 2026-09-04 - LMS LearnPage validation fix

- Audit menemukan sidebar LearnPage masih memanggil `CurriculumService.lessonsOf`.
- Mengganti sidebar agar memakai `sec.lessons` dari response Laravel.
- Audit akhir LearnPage tidak menemukan lagi pemanggilan `CourseService.bySlug`, `CurriculumService.sections`, `CurriculumService.lessonsOf`, atau `ProgressService.toggle`.
- LMS progress test: 1 test lulus, 14 assertions.
- Frontend typecheck dan production build lulus.

### 2026-09-04 - QuizPlayer API integration

- Menambahkan endpoint daftar quiz per course dengan enrollment guard.
- QuizPlayer memuat quiz/questions dari Laravel API.
- Start attempt memakai endpoint server-side.
- Submit jawaban memakai scoring backend; jawaban benar tidak pernah dikirim ke client.
- Attempt limit dan timer tetap ditegakkan backend.
- Menemukan urutan hook/state LearnPage yang tidak valid setelah penambahan remote quiz, lalu memperbaikinya.
- Quiz API test diperluas untuk daftar quiz per course.
- Backend test suite terbaru: 11 test lulus, 71 assertions.
- TypeScript check dan production build lulus.
- Status: jalur LMS public utama sudah API; certificate UI dan quiz fallback untuk data legacy masih perlu diselesaikan.

### 2026-09-04 - Certificate API foundation

- Menambahkan migration `certificate_templates` dan `certificates`.
- Menambahkan model CertificateTemplate dan Certificate.
- Menambahkan endpoint certificate list milik user.
- Menambahkan endpoint issue certificate dengan syarat enrollment, seluruh lesson selesai, dan semua quiz aktif lulus.
- Issuance dibuat idempotent dengan unique user/course constraint.
- Menambahkan public certificate verification dan view counter.
- Menambahkan API client certificate list/issue/verify.
- Certificate API test lulus: eligibility, issuance, duplicate protection, verification.
- Catatan: CertificateSheet/CertificateModal frontend masih memakai adapter lokal untuk template, course, student, dan instructor.

### 2026-09-04 - Certificate public UI integration

- VerifyPage memverifikasi nomor certificate melalui Laravel API.
- CertificateSheet memakai metadata remote untuk student, course, instructor, dan template.
- Kartu detail verifikasi tidak lagi membaca user/course dari local DB.
- Route `/certificate/verify/:number` otomatis memuat nomor dari route parameter.
- Menambahkan mapper certificate API dan instructor metadata pada endpoint verify.
- TypeScript check dan production build lulus.
- Certificate API test suite tetap lulus.

### 2026-09-04 - Certificate dashboard integration

- Certificate dashboard list membaca data certificate dari Laravel API sesuai role.
- CertificateModal dapat menerima certificate object remote.
- Menambahkan endpoint revoke certificate admin dengan `revoked_by` dan `revoked_at`.
- Revoke student/instructor ditolak server-side; admin dapat revoke.
- Public verification menampilkan status invalid setelah revoke.
- Menambahkan API client list, issue, verify, dan revoke certificate.
- Certificate lifecycle test lulus: 10 assertions.

### 2026-09-04 - MenusPage API integration

- MenusPage membaca menu groups dan nested items dari Laravel API.
- Create, edit, reorder, indent/outdent, dan delete menu item memakai API server.
- Menu aktif disinkronkan setelah response remote masuk.
- Menambahkan menu item update/delete endpoint dengan parent self-reference validation.
- TypeScript check dan production build lulus.
- Backend test suite tetap lulus: 12 test, 81 assertions.
- Sisa local DB di `Cms.tsx` hanya homepage builder lama dan pemilih page CMS.

### 2026-09-04 - Current checkpoint

- LMS public flow dan certificate dashboard/public verify sudah API.
- Shop/cart/checkout/voucher/digital delivery sudah API.
- Dashboard wallet/withdrawals/orders/payments/settings payment sudah API.
- CMS public content, homepage blocks, public menu, dan MenusPage inti sudah API.
- Sisa besar: CMS editor content/media picker penuh, About/settings system, notifications/search, installer, gateway provider nyata, email/queue, dan penghapusan adapter localStorage.
- TypeScript check dan production build lulus.

### 2026-09-04 - Current LMS checkpoint

- LMS public flow sudah API untuk catalog, detail, curriculum, enrollment, progress, quiz listing, quiz attempt/scoring, certificate issue, verify, dan revoke authorization.
- Sisa LMS: dashboard course/quiz editor masih legacy, certificate template editor masih legacy, dan fallback data legacy pada komponen lama.

### 2026-09-04 - Public PageView integration

- PageView CMS membaca halaman published dari Laravel API.
- Query `db.find('pages')` pada PageView dihapus.
- Loading/error fallback tetap memakai EmptyState existing.
- TypeScript check dan production build lulus.
- Status: public pages detail sudah API; CMS dashboard editor dan settings CMS masih berikutnya.

### 2026-09-04 - Notifications API integration

- Menambahkan migration/model notifications.
- Menambahkan API list notification milik user.
- Menambahkan mark one/read-all dengan ownership server-side.
- NotifBell membaca dan memperbarui status notifikasi melalui Laravel API.
- Migration fresh, backend suite, TypeScript, dan production build lulus.

### 2026-09-04 - Notifications and global search integration

- NotifBell memakai notification API Laravel untuk list, mark one, dan mark all.
- Menambahkan global search API publik dengan hasil course/content/product published.
- Search memakai rate limit dan debounce 250 ms pada header.
- Data user/admin tidak dibocorkan ke public search.
- Backend test suite tetap lulus: 12 test, 81 assertions.
- TypeScript check dan production build lulus.

### 2026-09-04 - Notifications, search, audit, and contact integration

- Notifications user memakai API Laravel untuk list/read/read-all.
- Global search memakai API publik dengan rate limit dan debounce frontend.
- SettingsSystem audit log memakai API admin.
- Menambahkan migration/model/API contact messages.
- ContactPage mengirim pesan melalui Laravel API dengan validation dan throttle.
- Backend test suite terbaru: 13 test lulus, 85 assertions.
- TypeScript check dan production build lulus.

### 2026-09-04 - MediaPicker API integration

- MediaPicker membaca daftar media dari Laravel API.
- Upload MediaPicker memakai multipart FormData ke Laravel Storage.
- URL media dihasilkan backend dari path storage.
- MIME allowlist dan ukuran upload tetap divalidasi server-side.
- Menghapus pemakaian `MediaService.add` dan `db.all('media')` dari MediaPicker.
- Media upload test: 1 test lulus, 4 assertions.
- TypeScript check dan production build lulus.

### 2026-09-04 - CMS admin listing API

- Menambahkan admin content listing API dengan filter role untuk articles, news, tutorials, activities, dan pages.
- Endpoint admin dipisahkan ke `/api/v1/admin/content/*`.
- Menemukan konflik awal ketika route admin memakai path public yang sama; diperbaiki sebelum validasi sehingga public CMS tetap tidak memerlukan auth.
- Menambahkan API client `manageContent`.
- Backend test suite: 13 test lulus, 85 assertions.
- TypeScript check dan production build lulus.

### 2026-09-04 - CMS ContentModule API integration

- ContentModule membaca admin content dari Laravel API untuk articles, news, tutorials, activities, dan pages.
- Create/update memakai generic content API dengan payload server-side.
- Publish/unpublish toggle memakai API.
- Delete memakai soft-delete API.
- Menambahkan mapper snake_case CMS response ke format frontend.
- Menemukan dan memperbaiki potensi konflik route admin/public CMS dengan namespace `/admin/content/*`.
- Audit menunjukkan `db.all(def.table)` hanya tersisa untuk products yang belum memiliki admin CRUD API penuh.
- Backend test suite terbaru: 13 test lulus, 85 assertions.
- TypeScript check dan production build lulus.

### 2026-09-04 - Product admin CRUD integration

- Menambahkan ProductController admin CRUD dengan transaction.
- Product variant dinormalisasi ke tabel `product_variants`.
- Parent stock dihitung ulang dari total stock variant di backend.
- ContentModule products memakai admin product API untuk load/create/update/publish/delete.
- Menemukan HTTP 403 pada test karena fixture role student; fixture diperbaiki menjadi admin.
- Menemukan HTTP 500 karena slug optional dibaca langsung; controller diperbaiki dengan null coalescing.
- Product test lulus: 3 test, 12 assertions.
- Backend suite terbaru: 14 test, 88 assertions.
- TypeScript check dan production build lulus.

### 2026-09-04 - Category admin API integration

- Menambahkan CategoryController public listing dan admin CRUD.
- CategoriesPage memakai API untuk list per scope, create, update, dan delete.
- Category slug dibuat unik per scope oleh backend.
- Jumlah item terkait tidak lagi mengambil angka dari local DB; menunggu aggregate endpoint.
- Audit menunjukkan `CategoryService.byScope` tersisa hanya pada dropdown form content.
- TypeScript check, production build, migration fresh, dan backend test suite lulus: 14 test, 88 assertions.

### 2026-09-04 - Certificate template API foundation

- Menambahkan CertificateTemplateController admin CRUD.
- Menambahkan validation theme, frame, dan hex accent color.
- Menambahkan API client certificate template list/create/update/delete.
- Route template terverifikasi: 4 endpoint.
- Backend test suite: 14 test lulus, 88 assertions.
- TypeScript check dan production build lulus.

### 2026-09-04 - Current checkpoint

- ContentModule semua tipe utama sudah memakai API.
- CategoriesPage, Product admin, Certificate dashboard/template foundation, SettingsSystem audit, Notifications, Search, Contact, MediaPicker, HomepageBuilder, MenusPage, AboutEditor, dan public CMS sudah memiliki integrasi server-side bertahap.
- Sisa utama: certificate template UI, SettingsSystem backup/reset, installer backend, public settings fallback pada Shell/Contact, email/queue, real gateway adapters, SQL export/backup, dan penghapusan `src/lib/db.ts` setelah semua consumer legacy selesai.

### 2026-09-04 - Current checkpoint

- Product, category, CMS content, media, homepage, menu, About, public content, LMS, certificate, shop, payment, wallet, notifications, search, contact, dan settings inti sudah punya API.
- Sisa utama: certificate template editor, SettingsSystem backup/reset, installer backend, email/queue, gateway HTTP nyata, content form field normalization lanjutan, dan penghapusan adapter localStorage legacy.

### 2026-09-04 - Current checkpoint

- CMS ContentModule untuk articles/news/tutorials/activities/pages/products sudah API.
- MediaPicker, homepage builder, menus, About, public CMS, and settings sudah API.
- Sisa utama: CMS category CRUD, certificate template editor, SettingsSystem backup/reset, installer backend, email/queue, real gateway HTTP adapters, dan penghapusan adapter localStorage.

### 2026-09-04 - Current checkpoint

- LMS public dan certificate flow sudah API.
- Shop/cart/checkout/voucher/digital delivery sudah API.
- Dashboard wallet/withdrawals/orders/payments/settings/audit sudah API.
- CMS public listing/detail/PageView, homepage builder, About, menu, media picker, dan ContentModule utama sudah API.
- Sisa utama: product admin CRUD lengkap, certificate template editor, SettingsSystem reset/backup server-side, installer backend, email/queue, gateway HTTP provider, dan penghapusan adapter localStorage legacy.

### 2026-09-04 - Latest migration checkpoint

- LMS public dan certificate flow terhubung API.
- Shop, checkout, voucher, digital delivery, wallet, orders, payments, notifications, search, contact, settings, media, homepage, menu, dan public CMS sudah memiliki jalur API.
- Sisa localStorage terukur: `src/lib/db.ts` masih dipakai legacy modules, installer browser-only, dan beberapa dashboard/editor lama.
- Adapter legacy belum dihapus untuk menjaga fitur yang belum memiliki endpoint CRUD lengkap.

### 2026-09-04 - SettingsSystem audit integration

- Menambahkan migration/model `audit_logs`.
- Menambahkan admin audit log API dengan filter model.
- SettingsSystem membaca log dan daftar model dari Laravel API.
- Menemukan Promise chaining audit yang terlalu padat dan memperbaikinya menjadi error handling yang valid.
- Migration fresh, backend test suite, TypeScript, dan production build lulus.
- Status: audit log dashboard sudah API; metadata installer/APP_KEY masih menunggu installer backend.

### 2026-09-04 - Latest feature checkpoint

- Notifications dan global search server-side sudah aktif.
- HomepageBuilder, AboutEditor/AboutPage, MenusPage, SettingsPayments, Orders/Payments, Wallet/Withdrawals, Certificates, LMS, Shop, Media, dan CMS content sudah memiliki jalur API.
- Sisa utama: installer backend, certificate template CRUD, CMS editor content penuh, public contact API, email/queue, gateway HTTP provider, backup SQL, dan penghapusan adapter localStorage.

### 2026-09-04 - Certificate and menu continuation

- Certificate dashboard list/modal memakai API Laravel.
- Certificate revoke memakai endpoint admin server-side.
- Menambahkan certificate lifecycle test: 10 assertions.
- Menambahkan migration/model certificate templates dan certificates.
- Menu item API dilengkapi update/delete dan parent self-reference validation.
- Menambahkan API client menu item CRUD.
- Homepage blocks dan menu public sudah memiliki API backend.
- Migration fresh, backend test suite, TypeScript, dan production build lulus.

### 2026-09-04 - LMS latest checkpoint

- LMS catalog/detail/curriculum/progress/quiz/certificate public flow sudah memakai API.
- Backend suite terbaru: 12 test lulus, 81 assertions.
- Sisa legacy terukur: CMS dashboard editor, SettingsSystem/backup, notifications, overview/search, installer, certificate template editor, dan sebagian public settings.

### 2026-09-04 - Current checkpoint

- LMS public utama: catalog, detail, curriculum, enrollment, lesson access, progress, quiz attempt/scoring, certificate verify sudah memakai API.
- Backend test suite terbaru: 12 test lulus, 78 assertions.
- Sisa utama: CertificateModal/list dashboard, LearnPage quiz fallback legacy, CMS dashboard editor, settings/backup legacy, notifications, external gateway HTTP, email/queue, dan penghapusan adapter localStorage.

### 2026-09-04 - Current checkpoint

- LMS katalog, detail, curriculum, enrollment, lesson access, completion, dan progress sudah terhubung Laravel API.
- Quiz backend sudah server-side, tetapi QuizPlayer UI masih memakai adapter lokal.
- Certificate UI, dashboard course editor, overview, notifications, installer, dan beberapa settings/CMS editor masih membutuhkan API migration.
- Gateway provider HTTP nyata, mail/queue, database export SQL, dan deployment backend production masih belum selesai.

### 2026-09-04 - Homepage blocks integration

- Menambahkan migration/model homepage blocks.
- Menambahkan public API blocks dan admin store/update endpoint.
- HomePage membaca blocks dari Laravel API dan memetakan `sort/content` ke format frontend.
- Audit tidak menemukan lagi query `db.all('homepageBlocks')` pada HomePage.
- Migration fresh, backend suite, TypeScript, dan production build lulus.

### 2026-09-04 - Menu CMS foundation

- Menambahkan migration `menus` dan `menu_items` dengan nested parent FK dan ordering index.
- Menambahkan model Menu dan MenuItem.
- Menambahkan public menu API dan admin create menu item endpoint.
- Menambahkan API client `menus`.
- Migration fresh dan backend suite lulus: 11 test, 66 assertions.
- Status: backend homepage/menu tersedia; Shell dan MenusPage frontend masih memakai adapter legacy.

### 2026-09-04 - Public navigation integration

- PublicNav membaca header menu dari Laravel API.
- PublicShell membaca header dan footer menu dari Laravel API.
- Mapper menu API ditambahkan untuk nested parent dan sort ordering.
- Fallback navigasi bawaan tetap tersedia saat backend belum memiliki data menu.
- Audit tidak menemukan lagi query menu lokal pada navigasi publik.
- TypeScript check, production build, dan backend test suite lulus: 11 test, 66 assertions.

### 2026-09-04 - Current checkpoint

- Homepage blocks, public content listing/detail, public navigation, Shop, checkout, wallet, orders/payments, dan settings payment sudah memiliki integrasi API frontend.
- Sisa utama: MenusPage/CMS dashboard editor, SettingsSystem/backup, global search/notifications, LMS catalog/detail remote penuh, gateway provider nyata, email/queue, migration schema SQL export, dan penghapusan adapter localStorage.

### 2026-09-04 - Latest migration checkpoint

- Dashboard Orders/Payments/Withdrawals/Wallet/SettingsPayments inti sudah API.
- Public Shop listing/cart/voucher/checkout sudah API.
- Public CMS listing sudah API.
- Backend CMS CRUD dan Media upload tersedia.
- Sisa utama: CMS detail/dashboard editor, public settings sync, gateway provider HTTP nyata, email/queue, dan adapter localStorage legacy.

### 2026-09-04 - Current handoff checkpoint

- Dashboard Wallet, Withdrawals, Orders, Payments, dan SettingsPayments inti sudah memakai API Laravel.
- Shop/cart, voucher, checkout course/shop, digital delivery, media upload, dan CMS backend tersedia.
- Sisa besar: migrasi CMS dashboard UI sepenuhnya, public content pages, gateway HTTP provider nyata, notification/email, dan penghapusan adapter `localStorage`.

### 2026-09-04 - CMS dashboard/public settings checkpoint

- HomepageBuilder memakai API Laravel untuk operasi block.
- AboutEditor memakai bulk settings API.
- AboutPage memakai public settings API untuk konten About.
- MenusPage memakai API untuk operasi menu item.
- TypeScript check, production build, dan backend suite lulus: 12 test, 81 assertions.
- Audit command yang gagal hanya disebabkan quoting PowerShell, bukan error source.
- Tahap berikutnya: notifications/search, SettingsSystem/backup, MediaPicker, gateway adapters, dan penghapusan adapter localStorage.

## Checkpoint Terbaru

- Backend test suite terbaru setelah semua batch sebelumnya: 10 test lulus, 56 assertions.
- Test artikel terarah: 1 test lulus, 4 assertions.
- Frontend typecheck: lulus.
- Frontend production build: lulus.
- Tahap aktif berikutnya: migrasi CMS CRUD lain, SettingsPayments, lalu adapter gateway eksternal.

### 2026-09-04 - Quiz and payment continuation

- Quiz backend normalized dan server-side scoring sudah diuji.
- Order/payment backend sudah diuji dengan invalid signature, valid webhook, dan duplicate webhook.
- Test suite backend terakhir: 7 test lulus, 41 assertions sebelum batch shop lanjutan; setelah test shop: 7 test lulus, 41 assertions.

## Validasi Terakhir

- Laravel tests: 7 test lulus, 41 assertions.
- TypeScript check: lulus.
- Vite production build: lulus.
- Sisa `localStorage`: hanya adapter legacy di `src/lib/db.ts` dan status installer; auth serta preferensi UI sudah tidak menggunakannya.

## Pekerjaan Berikutnya

1. Hubungkan halaman Shop/cart React ke API Laravel.
2. Tambahkan shop checkout server-side dengan voucher dan stock transaction.
3. Tambahkan digital delivery private download.
4. Tambahkan wallet dan withdrawal transaction.
5. Tambahkan CMS API dan Laravel Storage.
6. Implementasikan adapter gateway Tripay/Xendit/Stripe dengan credential `.env`.
7. Migrasikan seluruh page/service dari adapter `localStorage`.
8. Arahkan ServBay ke `backend/public` setelah integrasi frontend selesai.
9. Jalankan security audit, backup/restore test, dan smoke test production.

## Catatan Risiko

- Payment gateway eksternal belum dipanggil; credential dan callback HTTPS publik belum tersedia.
- Frontend Shop, CMS, settings, wallet, dan sebagian LMS masih membaca adapter legacy.
- Jangan menghapus `src/lib/db.ts` sebelum seluruh pemanggilnya dipindahkan ke API.
- Jangan mengarahkan domain production ke `backend/public` sebelum frontend build dan route fallback Laravel siap.

### 2026-09-04 - Server-side backup integration

- Menambahkan BackupController khusus Super Admin.
- Backup membaca database aktif dari server, bukan localStorage browser.
- Data sensitif dikeluarkan dari backup: password hash, salt, session/token, dan credential secret.
- SettingsSystem mengunduh backup JSON hasil endpoint Laravel.
- Backend test suite, TypeScript, dan production build lulus.
- Backup introspection ditujukan untuk koneksi MySQL production; reset destruktif belum diaktifkan.

### 2026-09-04 - Certificate template UI integration

- CertificateTemplatesPage membaca template dari Laravel API.
- Create, update, dan delete template memakai endpoint server-side.
- Hitungan pemakaian template dari local DB dihapus agar dashboard tidak menampilkan data browser yang salah.
- TypeScript check, production build, dan backend test suite lulus: 14 test, 88 assertions.

### 2026-09-04 - Final implementation checkpoint

- Product/category/CMS/content/media/homepage/menu/About/settings/audit/notifications/search/contact/backup dan LMS/commerce/certificate sudah memiliki jalur API serta sebagian besar UI sudah terhubung.
- Sisa production blocker: installer server-side, gateway HTTP provider dengan credential live, SMTP/queue, public settings fallback pada komponen lama, reset/restore strategy, dan penghapusan consumer localStorage terakhir.

### 2026-09-04 - Public settings runtime synchronization

- Menambahkan overlay settings public dari Laravel pada service layer.
- AppProvider memuat public settings API saat aplikasi start.
- Komponen lama yang memakai `getSetting` dapat membaca konfigurasi server tanpa langsung mengambil nilai settings dari localStorage.
- Audit localStorage terbaru hanya menemukan adapter persistence `src/lib/db.ts` dan installer legacy.
- TypeScript check, production build, dan backend test suite lulus: 14 test, 88 assertions.

### 2026-09-04 - Current final checkpoint

- Backend API/migrations tersedia untuk auth, LMS, quiz, certificates, shop, orders, payments, webhooks, wallet, withdrawals, CMS, media, settings, menus, homepage, notifications, search, contact, audit, backup, categories, products, dan certificate templates.
- Frontend API integration tersedia untuk public LMS/commerce/CMS, dashboards utama, certificate, navigation, notifications, search, contact, MediaPicker, HomepageBuilder, About, MenusPage, CategoriesPage, ContentModule, dan SettingsSystem audit.
- Remaining production dependencies: real provider credentials/domain callbacks, SMTP/queue infrastructure, server-side installer/reset policy, and final removal of legacy browser database after remaining legacy consumers are replaced.

### 2026-09-04 - Latest production checkpoint

- Auth/session, LMS, quiz, certificate, shop, cart, voucher, orders, payments, webhook idempotency, wallet, withdrawals, CMS, media, settings, menus, homepage, notifications, search, contact, dan backup sudah memiliki jalur backend/API.
- Backend test suite terakhir: 14 test lulus, 88 assertions.
- Frontend typecheck/build terakhir: lulus.
- Sisa go-live: credential/domain gateway live, adapter HTTP provider, SMTP/queue, installer backend, certificate template UI, public settings fallback, dan penghapusan final adapter localStorage.

### 2026-09-04 - Production hardening documentation

- Audit localStorage terakhir menunjukkan hanya adapter `src/lib/db.ts` dan installer legacy yang masih menyimpan data browser.
- Menambahkan instruksi build frontend, install dependency Laravel, storage link, migration force, dan optimize ke `INSTALL.md`.
- Dokumentasi menegaskan document root production harus `backend/public`, bukan root repository.
- Secret payment/mail/database tetap harus diisi melalui `backend/.env` atau secret manager.
- Menambahkan command `php artisan production:check` untuk validasi APP_ENV, APP_DEBUG, APP_KEY, HTTPS, MySQL, storage, queue, dan payment mode.
- Audit lokal awal menemukan 4 konfigurasi belum production: environment masih local, debug aktif, APP_URL belum HTTPS, dan storage link belum ada.
- Storage link lokal kemudian dibuat berhasil dengan `php artisan storage:link`.
- Audit production harus dijalankan ulang setelah `.env` production dan domain HTTPS dikonfigurasi.
- Status: aplikasi belum boleh disebut full production sebelum backend document root, installer server-side, gateway live, SMTP/queue, dan consumer legacy terakhir selesai.

### 2026-09-04 - Server-side maintenance mode

- Menambahkan `PreventMaintenanceAccess` middleware Laravel.
- Visitor/API biasa mendapat halaman atau response JSON `503` saat `maintenance_mode=1`.
- Admin dan Super Admin tetap dapat mengakses aplikasi saat maintenance.
- Auth dan public settings tetap dikecualikan agar admin dapat masuk dan frontend membaca konfigurasi.
- Menambahkan maintenance Blade view.
- Menemukan fixture test gagal karena role belum di-seed; memperbaiki test dengan seed role.
- Maintenance test lulus: 3 assertions.
- Backend suite terbaru: 15 test lulus, 91 assertions.
- TypeScript check dan production build lulus.

### 2026-09-04 - Production readiness checkpoint

- Server-side auth, authorization, LMS, quiz, certificates, shop, payment state/webhook, wallet, CMS, media, settings, notifications, search, contact, audit, backup, dan maintenance mode sudah memiliki fondasi Laravel.
- Sisa yang tidak dapat diaktifkan tanpa infrastruktur/credential: adapter HTTP provider payment live, SMTP provider, queue worker, domain HTTPS publik/callback, dan instalasi database production.
- Legacy browser database masih ada untuk fallback/installer lama; tidak boleh dihapus sebelum seluruh halaman legacy dipindahkan.

### 2026-09-04 - Production audit command

- Menambahkan `php artisan production:check`.
- Check mencakup APP_ENV, APP_DEBUG, APP_KEY, HTTPS APP_URL, MySQL, storage link, queue, dan payment mode.
- Storage link dibuat dengan `php artisan storage:link`.
- Menemukan false negative Windows junction pada check storage dan memperbaikinya menggunakan `file_exists`.
- Audit lokal terakhir: storage, MySQL, APP_KEY, queue, dan payment mode PASS.
- Audit lokal masih FAIL pada APP_ENV local, APP_DEBUG true, dan APP_URL localhost HTTP; tiga nilai wajib diubah saat deployment production dengan domain yang tersedia.
- Menambahkan instruksi queue worker production ke `INSTALL.md`.

### 2026-09-04 - Laravel deployment switch and smoke test

- React production build dipasang ke `backend/public/app.html` dan `backend/public/assets`.
- Laravel web fallback menyajikan SPA build untuk route non-API.
- ServBay site `KMSIT Computer` diarahkan ke `C:\ServBay\www\kms\backend\public` dengan PHP/Laravel rewrite dan HTTPS self-signed.
- Smoke test browser: homepage 200, `/api/health` 200, asset production 200.
- Smoke test security: `/database/schema.sql`, `/backend/.env`, dan `/composer.json` 404.
- Menemukan fallback SPA awal dapat mengembalikan 200 untuk path sensitif; menambahkan explicit 404 routes sebelum fallback.
- Build terbaru disinkronkan ulang ke backend public dan `php artisan optimize` berhasil.
- Catatan: domain memakai self-signed certificate lokal; production publik tetap memerlukan certificate publik.

### 2026-09-04 - SQL migration preparation

- Laravel migration berhasil dijalankan fresh sampai seluruh domain schema aplikasi.
- `backend/database/schema.sql` berhasil dibuat dari migration dengan 48 tabel, 46 FK, dan tanpa INSERT seed.
- Audit menemukan dump tersebut memakai dialect SQLite karena koneksi lokal Laravel masih SQLite.
- Koneksi MySQL lokal terdeteksi dan database `kmsit_computer` tersedia, tetapi CLI menolak tanpa password.
- Credential tidak diminta atau dikirim melalui chat; export MySQL harus dijalankan di server dengan `DB_*` valid.
- Menambahkan instruksi `migrate --force` dan `schema:dump --database=mysql --path=database/schema.mysql.sql` ke `INSTALL.md`.
- Status: persiapan migration SQL selesai; file schema MySQL final menunggu eksekusi pada koneksi MySQL production.

### 2026-09-04 - Public domain configuration

- Domain target ditetapkan menjadi `kmsitcomputer.com`.
- Template `backend/.env.production.example` diperbarui dengan `APP_URL=https://kmsitcomputer.com`.
- Mail sender example diperbarui ke `no-reply@kmsitcomputer.com`.
- ServBay website `KMSIT Computer` diperbarui dari `kmsitcomputer.host` ke `kmsitcomputer.com`.
- Root Laravel tetap `C:\ServBay\www\kms\backend\public`, rewrite Laravel, HTTP/HTTPS aktif, sertifikat lokal self-signed.
- Browser smoke test: `https://kmsitcomputer.com/` menampilkan aplikasi KMSIT Laravel/React.
- Catatan: DNS registrar publik dan certificate Let’s Encrypt belum diverifikasi; domain saat ini terkonfigurasi di ServBay lokal.

### 2026-09-04 - Local domain switch requested

- Konfigurasi `backend/.env` lokal diselaraskan ke `APP_URL=https://kmsitcomputer.host`.
- Template production tetap memakai domain publik `kmsitcomputer.com`.
- Perubahan domain website ServBay belum dapat diterapkan karena control plane ServBay mengembalikan `ServBay is not running` saat operasi update.
- Query status sebelumnya menunjukkan NGINX running, tetapi operasi write/list berikutnya gagal dari control plane; tidak dilakukan perubahan manual pada hosts/config ServBay.

### 2026-09-04 - Local domain diagnosis

- Hosts Windows saat ini memiliki `kmsitcomputer.host -> 127.0.0.1`.
- `kmsitcomputer.com` tetap resolve ke IP publik.
- Akses `.host` via browser gagal `ERR_CERT_COMMON_NAME_INVALID` karena certificate virtual host masih tidak cocok.
- `curl -k` menunjukkan `.host` masuk virtual host Diksi (`diksifoundation-session`) dan `/api/health` 404, bukan virtual host KMSIT.
- ServBay control plane masih mengembalikan `ServBay is not running` untuk operasi website update/list.
- Tidak dilakukan edit manual NGINX/hosts; perbaikan yang benar adalah restore website domain `.host` melalui ServBay setelah control plane aktif, dengan root `C:\ServBay\www\kms\backend\public`, rewrite Laravel, dan certificate self-signed untuk `.host`.

### 2026-09-04 - Clean install reset and migration readiness

- Menghapus database SQLite Laravel lama yang berisi state/test sebelumnya.
- Menghapus cache PHPUnit dan arsip workspace yang tidak diperlukan.
- Membuat kembali database SQLite kosong agar installer dapat berjalan tanpa state lama.
- Installer lock browser lama dibersihkan melalui startup cleanup untuk key `kmsit_db_v1`, `kmsit_meta_v1`, `kmsit_session_token`, `kmsit_pref_theme`, dan `kmsit_pref_lang`.
- InstallGate sekarang hanya memakai `GET /api/v1/install/status` dari Laravel.
- Installer server-side akan menjalankan migration sebelum membuat role/settings/Super Admin pertama.
- `.env` lokal memakai session/cache file agar installer tidak membutuhkan tabel database sebelum instalasi.
- `APP_URL` lokal disetel ke `https://kmsitcomputer.com`.
- Smoke test: root 200, installer status 200 dengan `installed=false`, API health 200, dan path sensitif 404.
- SQL migration disiapkan dari Laravel migrations; export MySQL final tetap memerlukan `DB_*` production valid.

### 2026-09-04 - Clean install smoke verification

- Build React terbaru disinkronkan ke `backend/public`.
- Cache route/config Laravel dibersihkan dan installer route terdaftar.
- Database SQLite lama dihapus, lalu file SQLite kosong dibuat agar runtime installer lokal dapat membuka koneksi tanpa data lama.
- Browser localStorage cleanup aktif untuk seluruh key database/session/preferences lama.
- Smoke test domain `https://kmsitcomputer.com`: root 200, `/api/health` 200, `/api/v1/install/status` 200 dengan `installed=false`.
- Security smoke test: `/database/schema.sql` dan `/backend/.env` 404.
- Installer siap dipakai ulang; migration akan dijalankan oleh endpoint installer sebelum membuat Super Admin.

### 2026-09-04 - Installer hosting readiness

- Field Website URL pada installer dibuat opsional; domain dapat diisi manual nanti melalui settings.
- Backend installer menerima `site_url` nullable dan menyimpan string kosong bila belum diisi.
- Menambahkan tombol lihat/sembunyikan password untuk password database, admin, dan konfirmasi admin.
- Password tetap hanya dikirim ke endpoint installer dan di-hash server-side.
- Build installer terbaru disinkronkan ke `backend/public`.
- Installer test lulus: 7 assertions.
- Backend test suite terbaru: 18 test lulus, 105 assertions.
- TypeScript check dan production build lulus.
- Cache Laravel dibersihkan setelah publish build.

### 2026-09-04 - Server-side installer integration

- Menambahkan InstallController dengan status install dan install transaction.
- Wizard installer React tidak lagi memanggil `seedInstaller`, membuat salt, atau menyimpan konfigurasi/user ke localStorage.
- Backend installer membuat role, settings awal, dan Super Admin dengan Hash Laravel.
- Instalasi kedua ditolak dengan HTTP 409.
- Menemukan route cache lama menyebabkan endpoint installer tertangkap SPA fallback; `route:clear` memperbaiki resolusi route.
- Installer API test lulus: 7 assertions.
- Status: installer server-side dan lock user pertama sudah tersedia; database credential tetap harus dikonfigurasi sebelum deployment.

### 2026-09-04 - Payment provider adapter foundation

- Menambahkan `PaymentGateway` contract.
- Menambahkan server-side adapters Tripay, Xendit, dan Stripe menggunakan Laravel HTTP client.
- PaymentGatewayManager memvalidasi credential environment sebelum memilih adapter.
- Payment initiation live sekarang mencoba provider dan mengembalikan `checkout_url`; kegagalan provider menjadi HTTP 502 dan payment ditandai failed.
- Mode sandbox tetap memakai flow internal yang sudah teruji.
- PHP lint seluruh app lulus.
- Backend test suite: 15 test lulus, 91 assertions.
- TypeScript check dan production build lulus.
- Batasan: callback live perlu pengujian resmi per provider dengan credential/secret dan payload signature masing-masing; belum boleh diaktifkan hanya berdasarkan sandbox test.

### 2026-09-04 - Profile API integration

- Menambahkan ProfileController update profile dan password.
- ProfilePage menyimpan nama, telepon, bio, dan headline ke Laravel API.
- Password diubah dengan Hash Laravel, bukan SHA-256 browser legacy.
- Avatar diupload melalui Media API lalu URL disimpan melalui Profile API.
- Menambahkan profile feature test.
- Backend test suite terbaru: 16 test lulus, 94 assertions.
- TypeScript check dan production build lulus.
- Password reset email masih memerlukan SMTP/Mailable/queue infrastructure.

### 2026-09-04 - Maintenance, profile, and password reset hardening

- Maintenance mode server-side aktif dengan admin bypass dan visitor 503.
- Profile update, avatar URL, dan password update memakai Laravel API.
- Menambahkan password reset request/reset endpoint dengan token hashed dan expiry 60 menit.
- Password reset email memakai queued `PasswordResetMail`.
- Menemukan CSRF 419 pada test reset; memperbaiki test dengan mempertahankan session middleware dan melewati CSRF middleware saja.
- Backend test suite terbaru: 17 test lulus, 98 assertions.
- PHP lint, TypeScript check, dan production build lulus.
- Audit localStorage tetap hanya menemukan adapter `src/lib/db.ts` dan installer legacy.

### 2026-09-24 - Tahap 4 LMS, Quiz, Progress & Certificate

- Dikerjakan, diuji, dan diperiksa sendiri dalam satu putaran; tidak mendelegasikan.
- Inti LMS/quiz/certificate yang sudah benar dipertahankan: enrollment berbayar via order paid, isolasi progress per user, completion dihitung backend, scoring server-side, answer key tidak dikirim, ownership attempt, idempotensi certificate, dan otorisasi revoke.
- Celah ditemukan dan ditutup dengan regression test lebih dulu:
  - Lesson draft ikut terkirim pada `GET /courses/{slug}` untuk non-owner.
  - `submit` attempt tidak memeriksa ulang `max_attempts` sehingga attempt `running` ganda bisa disubmit melewati batas.
  - Quiz dan issuance certificate tidak mensyaratkan course `published` (termasuk course `archived`/soft-deleted).
- Perbaikan minimum tanpa mengubah route, response, schema, atau UI:
  - `CourseController@show` menyaring lesson non-published untuk non-owner.
  - `QuizController` mensyaratkan course `published` pada `byCourse`/`show`/`start`/`submit` dan menegakkan `max_attempts` di `submit`.
  - `CertificateController@issue` hanya untuk course `published`.
- File berubah: `CourseController`, `QuizController`, `CertificateController`; tes baru `LmsStage4RegressionTest`. Tanpa migration.
- Tes terarah LMS: 11 test lulus, 132 assertions. Full suite: 133 test lulus, 1052 assertions (~12.6s). `php -l` dan `git diff --check` bersih (hanya warning CRLF pre-existing).
- Tidak menyentuh commerce, stock, wallet, settings, CMS, React, atau integrasi eksternal; tidak commit/push/deploy/migrate/seed DB existing.

### 2026-09-24 - Tahap 6 Redis, Queue, Scheduler & Operasional

- Email reset password tetap queued, kini terenkripsi, retry 5x dengan backoff, timeout 30s, idempotent (hanya token terbaru & belum kedaluwarsa, maksimal sekali), gagal permanen tercatat di `failed_jobs` + log tanpa token.
- Scheduler: reclaim voucher tunggal (lock overlap 55 menit, onOneServer), heartbeat, prune failed jobs, dan worker fallback via cron bila `QUEUE_SCHEDULER_WORKER=true`.
- `production:check` membedakan FAIL (aplikasi) vs WARN (konfigurasi/operasional); `--strict` menjadikan WARN gagal.
- Template production: database queue + cron (tanpa Redis) sebagai default installer; profil Redis direkomendasikan terdokumentasi di `docs/operations-queue-scheduler.md`.
- Tes: terarah 17 test/88 assertions; full suite 153 test/1148 assertions lulus. Tanpa migration/dependency baru.

### 2026-09-04 - Current production checkpoint

- Server-side feature coverage sudah mencakup auth/session, profile/password reset, LMS, quiz, certificates, shop, order/payment/webhook, wallet/withdrawal, CMS, media, settings, menus, homepage, notifications, search, contact, audit, backup, dan maintenance mode.
- Sisa yang memerlukan konfigurasi/infrastruktur: SMTP aktif, queue worker, credential gateway live, domain HTTPS callback, installer backend, migrasi consumer legacy terakhir, dan production database deployment.

### 2026-09-24 - Tahap 8 Integrasi Eksternal

- Dikerjakan, diuji, dan diperiksa sendiri dalam satu putaran; tanpa delegasi/reviewer. Hanya jalur provider pembayaran, validasi embed/video, config/env, dokumentasi, dan tes terkait. Tidak mengubah UI, schema, lifecycle pembayaran, wallet, stok, atau domain lain; tidak menyentuh DB/.env existing, migration, worker, npm, commit/push/deploy, atau provider nyata.
- Inventaris dari kode aktual: **implemented** Tripay/Xendit/Stripe (hanya saat `PAYMENT_MODE=live`) dan YouTube/video embed; **configuration-only** Zoom & Google Meet; **placeholder** settings `youtube_enabled`/`youtube_channel_url`; **absent** RajaOngkir/ongkir dan OpenRoute/routing. Rincian: `docs/integrations-status.md`.
- Hardening: timeout/connect timeout eksplisit di tiga gateway; tes membuktikan **tidak ada retry** create-payment (satu request meski error); respons provider invalid kini gagal 502 (bukan sukses diam-diam); logging aman tanpa payload/secret (canary payload tidak bocor ke response/log); `signature()` membaca config alih-alih `env()`; `STRIPE_BASE_URL` dikonfigurasi; `video_url` CMS divalidasi allowlist https host YouTube/Vimeo (materi embed sudah disanitasi); `.env.example` diselaraskan (sebelumnya tanpa variabel payment) dan `.env.production.example` dilengkapi base URL/webhook secret/timeout.
- Dokumentasi: baru `docs/integrations-status.md`; koreksi klaim tak terbukti di `docs/blueprint.md`, `docs/blueprint.html`, `docs/architecture.md` (kontrak `PaymentGateway` disamakan kode; Zoom/GMeet/ongkir/routing dinyatakan belum ada), dan `INSTALL.md` §5.1 (credential hanya via `.env`, `PAYMENT_MODE=live` wajib agar request ke provider).
- File: baru `backend/tests/Feature/PaymentGatewayHttpTest.php`, `backend/tests/Feature/VideoEmbedUrlValidationTest.php`, `docs/integrations-status.md`; diubah `config/payment.php`, tiga `Services/*Gateway.php`, `OrderController`, `ContentController`, `HtmlSanitizer`, `.env.example`, `.env.production.example`, `docs/*`, `INSTALL.md`. **Tanpa migration/dependency baru.**
- Tes: terarah provider+video 12 test/73 assertions; terdampak commerce/CMS 21 test/223 assertions; full suite **165 test/1221 assertions lulus**. Dua siklus koreksi (FK role seed; Course nyata untuk FK enrollment). `php -l` dan `git diff --check` bersih (kecuali `backend/public/app.html` pre-existing).
- Sisa/risiko: concurrency MySQL tidak diuji (SQLite); provider & callback HTTPS nyata belum diverifikasi; Zoom, Google Meet, RajaOngkir, OpenRoute masih menunggu spesifikasi/credential/keputusan produk. Tidak memulai tahap berikutnya.

### 2026-09-24 - Penutupan Temuan Tahap 8: Pemilihan Gateway Server-side

- `OrderController@initiatePayment` kini memilih provider dari `gateway_active` (settings) dengan fallback `config('payment.active')`, dan mode dari `gateway_mode` (settings, bila valid) dengan fallback `config('payment.mode')`. Payload `gateway` dari client **diabaikan**; hanya `method` dari client. Nilai setting yang ada tetapi tidak valid → `503 Konfigurasi payment gateway tidak valid.` tanpa memanggil provider dan tanpa membuat payment. `payments.gateway`/`payments.mode` menyimpan nilai efektif. Credential tetap config/env.
- Webhook route tidak diubah: callback payment lama dari gateway yang sebelumnya aktif tetap diproses via `payments.gateway`. Perubahan gateway/mode admin hanya berlaku untuk payment baru.
- Tes: `PaymentGatewayHttpTest` 15 test/81 assertions (termasuk payload client diabaikan, gateway admin dipakai, setting invalid → 503, fallback env, webhook lama, sandbox tanpa network, secret tidak bocor); terdampak payment 52 test/481 assertions; full suite **170 test/1248 assertions lulus**. `php -l` bersih. Tanpa migration/dependency baru.
- Dokumentasi: `docs/integrations-status.md`, `docs/architecture.md`, `INSTALL.md` §5.1 diperbarui. Tidak memulai tahap berikutnya.
