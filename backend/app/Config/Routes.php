<?php

use CodeIgniter\Router\RouteCollection;

/** @var RouteCollection $routes */
$routes->get('/', 'Home::index');

$routes->group('api/auth', function($routes) {
    $routes->post('daftar', '\App\Modules\Auth\Controllers\Auth::daftar');
    $routes->post('daftar-kasir', '\App\Modules\Auth\Controllers\Auth::daftarKasir');
    $routes->post('login', '\App\Modules\Auth\Controllers\Auth::login');
    $routes->post('buat-password', '\App\Modules\Auth\Controllers\Auth::buatPassword', ['filter' => 'jwt']);
    $routes->get('profil', '\App\Modules\Auth\Controllers\Auth::profil', ['filter' => 'jwt']);
    $routes->get('minta-pilih-usaha', '\App\Modules\Auth\Controllers\Auth::mintaPilihUsaha', ['filter' => 'jwt']);
    $routes->post('pilih-usaha', '\App\Modules\Auth\Controllers\Auth::pilihUsaha', ['filter' => 'jwt']);
});

// Public route to retrieve Usaha Logo
$routes->get('api/ambil-logo/(:any)', '\App\Modules\Manajemen\Controllers\Manajemen::ambilLogoUsaha/$1');

// CRUD Manajemen Rute (Bahasa Indonesia)
$routes->group('api/manajemen', ['filter' => 'jwt'], function($routes) {
    $routes->get('laporan-ringkasan', '\App\Modules\Manajemen\Controllers\Manajemen::laporanRingkasan');
    $routes->get('ambil-bukti/perizinan/(:any)', '\App\Modules\Manajemen\Controllers\Manajemen::ambilBuktiPerizinan/$1');
    $routes->group('', ['filter' => 'rbac'], function($routes) {
        $routes->get('ambil/(:segment)', '\App\Modules\Manajemen\Controllers\Manajemen::ambilData/$1');
        $routes->post('tambah/(:segment)', '\App\Modules\Manajemen\Controllers\Manajemen::tambahData/$1');
        $routes->post('ubah/menus/urutkan', '\App\Modules\Manajemen\Controllers\Manajemen::urutkanMenus');
        $routes->put('ubah/(:segment)/(:num)', '\App\Modules\Manajemen\Controllers\Manajemen::ubahData/$1/$2');
        $routes->delete('hapus/(:segment)/(:num)', '\App\Modules\Manajemen\Controllers\Manajemen::hapusData/$1/$2');
    });
});

// Absensi Mandiri Karyawan (hanya butuh JWT, tanpa RBAC/role_permissions)
// Kasir tidak perlu punya izin CRUD untuk bisa absen
$routes->group('api/absen', ['filter' => 'jwt'], function($routes) {
    $routes->get('hari-ini', '\App\Modules\Absen\Controllers\Absen::hariIni');
    $routes->get('tugas-hari-ini', '\App\Modules\Absen\Controllers\Absen::tugasHariIni');
    $routes->get('total-poin', '\App\Modules\Absen\Controllers\Absen::totalPoin');
    $routes->post('masuk', '\App\Modules\Absen\Controllers\Absen::masuk');
    $routes->put('pulang/(:num)', '\App\Modules\Absen\Controllers\Absen::pulang/$1');
});

// Rute Khusus Alur Perizinan Bertingkat & Aman
$routes->group('api/perizinan', ['filter' => 'jwt'], function($routes) {
    $routes->get('riwayat', '\App\Modules\Manajemen\Controllers\Perizinan::riwayat');
    $routes->get('shift-aktif', '\App\Modules\Manajemen\Controllers\Perizinan::shiftAktif');
    $routes->post('ajukan', '\App\Modules\Manajemen\Controllers\Perizinan::ajukan');
    $routes->post('keputusan-pengganti', '\App\Modules\Manajemen\Controllers\Perizinan::keputusanPengganti');
    $routes->post('eskalasi-atasan', '\App\Modules\Manajemen\Controllers\Perizinan::eskalasiAtasan');
    $routes->post('evaluasi-atasan', '\App\Modules\Manajemen\Controllers\Perizinan::evaluasiAtasan');
});

// Rute Khusus Penugasan Lembur oleh Karyawan
$routes->group('api/lembur', ['filter' => 'jwt'], function($routes) {
    $routes->post('terima/(:num)', '\App\Modules\Manajemen\Controllers\Lembur::terima/$1');
    $routes->post('tolak/(:num)', '\App\Modules\Manajemen\Controllers\Lembur::tolak/$1');
});

// Rute Pusat Notifikasi & Web Push
$routes->group('api/notifikasi', ['filter' => 'jwt'], function($routes) {
    $routes->get('ambil', '\App\Modules\Notification\Controllers\NotificationController::ambilNotifikasi');
    $routes->post('baca/(:num)', '\App\Modules\Notification\Controllers\NotificationController::bacaNotifikasi/$1');
    $routes->post('baca-semua', '\App\Modules\Notification\Controllers\NotificationController::bacaSemua');
    $routes->post('subscribe', '\App\Modules\Notification\Controllers\NotificationController::subscribe');
    $routes->get('pengaturan', '\App\Modules\Notification\Controllers\PengaturanController::ambilPengaturan');
    $routes->post('pengaturan/simpan', '\App\Modules\Notification\Controllers\PengaturanController::simpanPengaturan');
});

// Rute Khusus Modul Kebersihan Gamification
$routes->group('api/kebersihan', ['filter' => 'jwt'], function($routes) {
    $routes->get('tugas', '\App\Modules\Manajemen\Controllers\KebersihanController::ambilTugas');
    $routes->post('tugas/klaim/(:num)', '\App\Modules\Manajemen\Controllers\KebersihanController::klaimTugas/$1');
    $routes->post('tugas/evaluasi/(:num)', '\App\Modules\Manajemen\Controllers\KebersihanController::evaluasiTugas/$1');
    $routes->post('tugas/tunjuk/(:num)', '\App\Modules\Manajemen\Controllers\KebersihanController::tunjukTugas/$1');
});

// Rute Transaksi & Kasir POS
$routes->group('api/transaksi', ['filter' => 'jwt'], function($routes) {
    $routes->post('checkout', '\App\Modules\Manajemen\Controllers\Transaksi::checkout');
    $routes->get('riwayat', '\App\Modules\Manajemen\Controllers\Transaksi::riwayat');
    $routes->get('members', '\App\Modules\Manajemen\Controllers\Transaksi::members');
    $routes->post('tambah-member', '\App\Modules\Manajemen\Controllers\Transaksi::tambahMember');
    $routes->put('update-hutang/(:num)', '\App\Modules\Manajemen\Controllers\Transaksi::updateHutang/$1');
    $routes->put('lunasi-hutang/(:num)', '\App\Modules\Manajemen\Controllers\Transaksi::lunasiHutang/$1');
    $routes->get('job-board', '\App\Modules\Manajemen\Controllers\Transaksi::jobBoard');
    $routes->post('job-board/klaim/(:num)', '\App\Modules\Manajemen\Controllers\Transaksi::klaimJob/$1');
    $routes->post('job-board/selesai/(:num)', '\App\Modules\Manajemen\Controllers\Transaksi::selesaiJob/$1');
});

// Rute Transaksi Publik (tanpa JWT filter untuk Nota digital Opsi B)
$routes->group('api/transaksi-publik', function($routes) {
    $routes->get('detail/(:num)', '\App\Modules\Manajemen\Controllers\Transaksi::publikDetail/$1');
});

// Menangani request preflight OPTIONS secara global untuk CORS
$routes->options('(:any)', function() {
    return response()->setStatusCode(200);
});

