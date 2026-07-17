<?php
define('ENVIRONMENT', 'development');
define('FCPATH', __DIR__ . DIRECTORY_SEPARATOR);

require FCPATH . '../app/Config/Paths.php';
$paths = new Config\Paths();
require $paths->systemDirectory . '/Boot.php';
\CodeIgniter\Boot::bootWeb($paths);

use App\Modules\Notification\Services\NotificationService;

$id = isset($_GET['id']) ? (int)$_GET['id'] : 6;

echo "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);'>";
echo "<h2 style='color: #2b6cb0; margin-top: 0;'>BKW mPOS Pro - Simulator Notifikasi</h2>";
echo "<p>Mengirim notifikasi uji coba ke Karyawan ID: <strong>$id</strong>...</p>";

$success = NotificationService::kirim(
    $id, 
    "Notifikasi Uji Coba", 
    "Simulasi pesan real-time berhasil dikirim pada pukul " . date('H:i:s') . ".", 
    "beranda"
);

if ($success) {
    echo "<div style='background-color: #f0fff4; color: #276749; padding: 12px; border-radius: 4px; margin-bottom: 15px;'>";
    echo "<strong>Sukses!</strong> Riwayat notifikasi berhasil ditulis ke database & sinyal Web Push dipancarkan.";
    echo "</div>";
    echo "<p><strong>Cara Verifikasi:</strong></p>";
    echo "<ol>";
    echo "<li>Buka halaman Dashboard aplikasi Anda.</li>";
    echo "<li>Perhatikan **ikon lonceng** di pojok kanan atas, badge merah berisi angka belum dibaca akan bertambah.</li>";
    echo "<li>Jika Anda memberikan izin notifikasi browser, pop-up notifikasi PWA juga akan muncul di layar desktop/HP Anda.</li>";
    echo "</ol>";
    echo "<p style='font-size: 0.85em; color: #718096;'>Tip: Anda bisa mengganti ID karyawan pada URL untuk mencoba akun lain, contoh: <code>?id=7</code></p>";
} else {
    echo "<div style='background-color: #fff5f5; color: #9b2c2c; padding: 12px; border-radius: 4px;'>";
    echo "<strong>Gagal!</strong> Terjadi kendala saat memproses notifikasi.";
    echo "</div>";
}
echo "</div>";
