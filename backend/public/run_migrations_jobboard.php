<?php
// Script migrasi untuk fitur Job Board Kantin
// Jalankan sekali, lalu hapus file ini dari server

$db = new mysqli('localhost', 'root', '', 'bkw');
if ($db->connect_error) {
    die('Koneksi gagal: ' . $db->connect_error);
}

$results = [];

// ─── Migrasi 1: Tambah kolom butuh_absen ke tabel usaha ─────────────────────
$sql = "ALTER TABLE `usaha` ADD COLUMN `butuh_absen` TINYINT(1) NOT NULL DEFAULT 1 AFTER `no_izin`";
$r = $db->query($sql);
$results[] = [
    'migrasi' => 'usaha.butuh_absen',
    'status'  => $r ? '✅ Berhasil ditambahkan' : '⚠️ ' . $db->error,
];

// ─── Migrasi 2: Tambah kolom butuh_persiapan ke tabel produk_jasa ───────────
$sql = "ALTER TABLE `produk_jasa` ADD COLUMN `butuh_persiapan` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_stok_dikelola`";
$r = $db->query($sql);
$results[] = [
    'migrasi' => 'produk_jasa.butuh_persiapan',
    'status'  => $r ? '✅ Berhasil ditambahkan' : '⚠️ ' . $db->error,
];

// ─── Migrasi 3: Tambah kolom status_pengerjaan ke tabel transaksi_detail ─────
$sql = "ALTER TABLE `transaksi_detail` ADD COLUMN `status_pengerjaan` ENUM('Menunggu','Dikerjakan','Selesai') NOT NULL DEFAULT 'Selesai' AFTER `status_sewa`";
$r = $db->query($sql);
$results[] = [
    'migrasi' => 'transaksi_detail.status_pengerjaan',
    'status'  => $r ? '✅ Berhasil ditambahkan' : '⚠️ ' . $db->error,
];

// ─── Verifikasi kolom sudah ada ──────────────────────────────────────────────
$verif = [];

$q = $db->query("SHOW COLUMNS FROM `usaha` LIKE 'butuh_absen'");
$verif['usaha.butuh_absen'] = $q && $q->num_rows > 0 ? '✅ Ada' : '❌ Tidak ditemukan';

$q = $db->query("SHOW COLUMNS FROM `produk_jasa` LIKE 'butuh_persiapan'");
$verif['produk_jasa.butuh_persiapan'] = $q && $q->num_rows > 0 ? '✅ Ada' : '❌ Tidak ditemukan';

$q = $db->query("SHOW COLUMNS FROM `transaksi_detail` LIKE 'status_pengerjaan'");
$verif['transaksi_detail.status_pengerjaan'] = $q && $q->num_rows > 0 ? '✅ Ada' : '❌ Tidak ditemukan';

$db->close();

// ─── Output ──────────────────────────────────────────────────────────────────
header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Migrasi Job Board</title>
  <style>
    body { font-family: monospace; padding: 30px; background: #111; color: #eee; }
    h2 { color: #6ee7b7; }
    h3 { color: #93c5fd; margin-top: 30px; }
    table { border-collapse: collapse; width: 100%; margin-top: 10px; }
    td, th { border: 1px solid #333; padding: 10px 16px; text-align: left; }
    th { background: #1e293b; color: #94a3b8; }
    tr:nth-child(even) { background: #0f172a; }
  </style>
</head>
<body>
  <h2>🛠️ Migrasi Job Board — BKW mPOS Pro</h2>

  <h3>Hasil Eksekusi ALTER TABLE</h3>
  <table>
    <tr><th>Migrasi</th><th>Hasil</th></tr>
    <?php foreach ($results as $r): ?>
    <tr>
      <td><?= htmlspecialchars($r['migrasi']) ?></td>
      <td><?= $r['status'] ?></td>
    </tr>
    <?php endforeach; ?>
  </table>

  <h3>Verifikasi Kolom di Database</h3>
  <table>
    <tr><th>Kolom</th><th>Status</th></tr>
    <?php foreach ($verif as $col => $status): ?>
    <tr>
      <td><?= htmlspecialchars($col) ?></td>
      <td><?= $status ?></td>
    </tr>
    <?php endforeach; ?>
  </table>

  <p style="margin-top:30px; color:#f87171;">
    ⚠️ <strong>Penting:</strong> Setelah migrasi berhasil, hapus file ini dari server.
  </p>
</body>
</html>
