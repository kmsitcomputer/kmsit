/* Multi-bahasa: id (default) & en. Tambah bahasa baru = tambah kamus di sini. */

export type Lang = 'id' | 'en';

const id = {
  // nav
  home: 'Beranda', courses: 'Kelas', articles: 'Artikel', news: 'Berita', tutorials: 'Tutorial',
  activities: 'Kegiatan', shop: 'Toko', about: 'Tentang Kami', contact: 'Kontak', login: 'Masuk',
  register: 'Daftar', logout: 'Keluar', dashboard: 'Dashboard', search_placeholder: 'Cari kelas, artikel…',
  // auth
  email: 'Email', password: 'Password', name: 'Nama Lengkap', remember_me: 'Ingat saya',
  forgot_password: 'Lupa password?', login_title: 'Masuk ke akunmu', login_sub: 'Lanjutkan belajar atau kelola platform.',
  register_title: 'Buat akun baru', register_as: 'Daftar sebagai', already_have: 'Sudah punya akun?',
  no_account: 'Belum punya akun?', reset_sent: 'Jika email terdaftar, tautan reset password telah dikirim.',
  // common
  save: 'Simpan', cancel: 'Batal', create: 'Buat Baru', edit: 'Ubah', delete: 'Hapus', view: 'Lihat',
  search: 'Cari', filter: 'Filter', all: 'Semua', status: 'Status', action: 'Aksi', title: 'Judul',
  date: 'Tanggal', category: 'Kategori', no_data: 'Belum ada data', create_first: 'Buat entri pertamamu.',
  confirm_delete: 'Hapus data ini? Tindakan tidak dapat dibatalkan.', yes_delete: 'Ya, Hapus',
  save_success: 'Berhasil disimpan.', delete_success: 'Berhasil dihapus.', required: 'Wajib diisi',
  published: 'Terbit', draft: 'Draft', pending: 'Pending', paid: 'Lunas', failed: 'Gagal',
  free: 'Gratis', price: 'Harga', level: 'Level', students: 'Student', instructor: 'Instructor',
  duration: 'Durasi', rating: 'Rating', details: 'Detail', back: 'Kembali', next: 'Lanjut', prev: 'Sebelumnya',
  loading: 'Memuat…', see_all: 'Lihat Semua', minutes: 'menit', lessons: 'Materi', quiz: 'Quiz',
  certificate: 'Sertifikat', download: 'Unduh', verify: 'Verifikasi', verified: 'Terverifikasi',
  // course
  enroll_free: 'Daftar Gratis', buy_course: 'Beli Kelas', continue_learning: 'Lanjutkan Belajar',
  start_learning: 'Mulai Belajar', course_locked: 'Kelas berbayar — beli untuk membuka seluruh materi.',
  curriculum: 'Kurikulum', requirements: 'Persyaratan', outcomes: 'Yang Akan Kamu Kuasai',
  about_course: 'Tentang Kelas Ini', related_courses: 'Kelas Terkait', preview: 'Pratinjau',
  enrolled: 'Terdaftar', progress: 'Progress', completed: 'Selesai',
  // dashboard
  overview: 'Ringkasan', content: 'Konten', lms: 'LMS', users: 'Pengguna', commerce: 'Komersial',
  website: 'Website', settings: 'Pengaturan', general: 'Umum', payment_gateway: 'Payment Gateway',
  language: 'Bahasa', system: 'Sistem', homepage: 'Homepage', menus: 'Menu', media: 'Media',
  pages: 'Halaman', categories_m: 'Kategori', quizzes: 'Quiz', certificates: 'Sertifikat',
  instructors: 'Instructor', administrators: 'Administrator', orders: 'Order', payments: 'Pembayaran',
  transactions: 'Transaksi', withdrawals: 'Withdrawal', balance: 'Saldo', shop_m: 'Toko',
  notifications: 'Notifikasi', mark_all_read: 'Tandai semua dibaca', profile: 'Profil', my_learning: 'Pembelajaranku',
  my_courses: 'Kelas Saya', wallet: 'Dompet', revenue: 'Pendapatan', welcome_back: 'Selamat datang kembali',
  // dashboard navigation & states
  sec_learning: 'Pembelajaran', sec_teaching: 'Mengajar', sec_academic: 'Akademik', sec_content: 'Konten',
  sec_commerce: 'Toko & Order', sec_finance: 'Keuangan', sec_people: 'Pengguna', sec_website: 'Website',
  sec_settings: 'Pengaturan', sec_platform: 'Platform', sec_account: 'Akun',
  nav_my_quizzes: 'Riwayat Quiz', nav_my_certificates: 'Sertifikat Saya', nav_my_orders: 'Order & Pembayaran',
  nav_digital: 'Produk Digital', nav_my_students: 'Student Saya', nav_sales: 'Penjualan & Pendapatan',
  nav_quiz_attempts: 'Hasil Quiz', nav_students_admin: 'Students', nav_all_users: 'Semua User',
  nav_admins: 'Administrator', nav_messages: 'Pesan Masuk', nav_about: 'Tentang Kami', nav_theme: 'Tema Warna',
  nav_integrations: 'Status Integrasi', nav_operations: 'Operasional', nav_audit: 'Sistem & Audit',
  nav_vouchers: 'Voucher', nav_products: 'Produk', nav_certificate_templates: 'Template Sertifikat',
  not_active: 'Belum aktif', state_error: 'Gagal memuat data', state_retry: 'Coba lagi',
  state_forbidden: 'Akses ditolak', state_forbidden_sub: 'Akunmu tidak memiliki izin untuk data ini.',
  page_of: 'Halaman {page} dari {last} · {total} data', all_courses: 'Semua kelas', course: 'Kelas',
  student: 'Student', score: 'Skor', passed: 'Lulus', not_passed: 'Tidak lulus', enrolled_at: 'Terdaftar',
  last_activity: 'Aktivitas terakhir', net_earning: 'Pendapatan bersih', gross: 'Bruto', platform_fee: 'Fee platform',
  buyer: 'Pembeli', sales: 'Penjualan', earnings: 'Pendapatan', attempts: 'Percobaan', view_progress: 'Lihat progress',
  search_name: 'Cari nama/email…', unread: 'Belum dibaca', read: 'Dibaca', no_notifications: 'Belum ada notifikasi',
  // payments
  checkout: 'Checkout', pay_now: 'Bayar Sekarang', choose_method: 'Pilih Metode Pembayaran',
  processing: 'Memproses pembayaran…', payment_success: 'Pembayaran berhasil!', payment_failed: 'Pembayaran gagal.',
  order_summary: 'Ringkasan Order', total: 'Total', subtotal: 'Subtotal', gateway_fee: 'Biaya Gateway',
  cart: 'Keranjang', add_to_cart: 'Tambah ke Keranjang', stock: 'Stok',
};

const en: typeof id = {
  home: 'Home', courses: 'Courses', articles: 'Articles', news: 'News', tutorials: 'Tutorials',
  activities: 'Activities', shop: 'Shop', about: 'About Us', contact: 'Contact', login: 'Sign In',
  register: 'Register', logout: 'Sign Out', dashboard: 'Dashboard', search_placeholder: 'Search courses, articles…',
  email: 'Email', password: 'Password', name: 'Full Name', remember_me: 'Remember me',
  forgot_password: 'Forgot password?', login_title: 'Sign in to your account', login_sub: 'Continue learning or manage the platform.',
  register_title: 'Create a new account', register_as: 'Register as', already_have: 'Already have an account?',
  no_account: "Don't have an account?", reset_sent: 'If the email exists, a password reset link has been sent.',
  save: 'Save', cancel: 'Cancel', create: 'Create New', edit: 'Edit', delete: 'Delete', view: 'View',
  search: 'Search', filter: 'Filter', all: 'All', status: 'Status', action: 'Action', title: 'Title',
  date: 'Date', category: 'Category', no_data: 'No data available', create_first: 'Create your first entry.',
  confirm_delete: 'Delete this item? This cannot be undone.', yes_delete: 'Yes, Delete',
  save_success: 'Saved successfully.', delete_success: 'Deleted successfully.', required: 'Required',
  published: 'Published', draft: 'Draft', pending: 'Pending', paid: 'Paid', failed: 'Failed',
  free: 'Free', price: 'Price', level: 'Level', students: 'Students', instructor: 'Instructor',
  duration: 'Duration', rating: 'Rating', details: 'Details', back: 'Back', next: 'Next', prev: 'Previous',
  loading: 'Loading…', see_all: 'See All', minutes: 'min', lessons: 'Lessons', quiz: 'Quiz',
  certificate: 'Certificate', download: 'Download', verify: 'Verify', verified: 'Verified',
  enroll_free: 'Enroll for Free', buy_course: 'Buy Course', continue_learning: 'Continue Learning',
  start_learning: 'Start Learning', course_locked: 'Paid course — purchase to unlock all materials.',
  curriculum: 'Curriculum', requirements: 'Requirements', outcomes: "What You'll Learn",
  about_course: 'About This Course', related_courses: 'Related Courses', preview: 'Preview',
  enrolled: 'Enrolled', progress: 'Progress', completed: 'Completed',
  overview: 'Overview', content: 'Content', lms: 'LMS', users: 'Users', commerce: 'Commerce',
  website: 'Website', settings: 'Settings', general: 'General', payment_gateway: 'Payment Gateway',
  language: 'Language', system: 'System', homepage: 'Homepage', menus: 'Menus', media: 'Media',
  pages: 'Pages', categories_m: 'Categories', quizzes: 'Quizzes', certificates: 'Certificates',
  instructors: 'Instructors', administrators: 'Administrators', orders: 'Orders', payments: 'Payments',
  transactions: 'Transactions', withdrawals: 'Withdrawals', balance: 'Balance', shop_m: 'Shop',
  notifications: 'Notifications', mark_all_read: 'Mark all read', profile: 'Profile', my_learning: 'My Learning',
  my_courses: 'My Courses', wallet: 'Wallet', revenue: 'Revenue', welcome_back: 'Welcome back',
  sec_learning: 'Learning', sec_teaching: 'Teaching', sec_academic: 'Academic', sec_content: 'Content',
  sec_commerce: 'Shop & Orders', sec_finance: 'Finance', sec_people: 'Users', sec_website: 'Website',
  sec_settings: 'Settings', sec_platform: 'Platform', sec_account: 'Account',
  nav_my_quizzes: 'Quiz History', nav_my_certificates: 'My Certificates', nav_my_orders: 'Orders & Payments',
  nav_digital: 'Digital Products', nav_my_students: 'My Students', nav_sales: 'Sales & Earnings',
  nav_quiz_attempts: 'Quiz Results', nav_students_admin: 'Students', nav_all_users: 'All Users',
  nav_admins: 'Administrators', nav_messages: 'Inbox', nav_about: 'About Us', nav_theme: 'Color Theme',
  nav_integrations: 'Integration Status', nav_operations: 'Operations', nav_audit: 'System & Audit',
  nav_vouchers: 'Vouchers', nav_products: 'Products', nav_certificate_templates: 'Certificate Templates',
  not_active: 'Not active yet', state_error: 'Failed to load data', state_retry: 'Try again',
  state_forbidden: 'Access denied', state_forbidden_sub: 'Your account is not allowed to view this data.',
  page_of: 'Page {page} of {last} · {total} items', all_courses: 'All courses', course: 'Course',
  student: 'Student', score: 'Score', passed: 'Passed', not_passed: 'Not passed', enrolled_at: 'Enrolled',
  last_activity: 'Last activity', net_earning: 'Net earning', gross: 'Gross', platform_fee: 'Platform fee',
  buyer: 'Buyer', sales: 'Sales', earnings: 'Earnings', attempts: 'Attempts', view_progress: 'View progress',
  search_name: 'Search name/email…', unread: 'Unread', read: 'Read', no_notifications: 'No notifications yet',
  checkout: 'Checkout', pay_now: 'Pay Now', choose_method: 'Choose Payment Method',
  processing: 'Processing payment…', payment_success: 'Payment successful!', payment_failed: 'Payment failed.',
  order_summary: 'Order Summary', total: 'Total', subtotal: 'Subtotal', gateway_fee: 'Gateway Fee',
  cart: 'Cart', add_to_cart: 'Add to Cart', stock: 'Stock',
};

const dicts: Record<Lang, typeof id> = { id, en };

export function translate(lang: Lang, key: keyof typeof id, vars?: Record<string, string | number>): string {
  let s: string = dicts[lang]?.[key] ?? dicts.id[key] ?? key;
  if (vars) Object.entries(vars).forEach(([k, v]) => { s = s.replace(`{${k}}`, String(v)); });
  return s;
}
export type TKey = keyof typeof id;
