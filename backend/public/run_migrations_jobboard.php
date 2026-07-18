<?php
// Script migrasi Job Board — baca kredensial dari .env CI4
// Aman dijalankan berkali-kali (idempotent)

// ─── Baca .env CI4 di atas folder public ────────────────────────────────────
$envFile = __DIR__ . '/../.env';
$config  = ['hostname' => 'localhost', 'database' => 'bkw', 'username' => 'root', 'password' => ''];

if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (str_starts_with(trim($line), '#')) continue;
        if (preg_match('/^database\.default\.(\w+)\s*=\s*(.*)$/', trim($line), $m)) {
            $key = $m[1];
            $val = trim($m[2]);
            if ($key === 'hostname') $config['hostname'] = $val;
            if ($key === 'database') $config['database'] = $val;
            if ($key === 'username') $config['username'] = $val;
            if ($key === 'password') $config['password'] = $val;
        }
    }
}

// ─── Koneksi DB ───────────────────────────────────────────────────────────────
$db = new mysqli($config['hostname'], $config['username'], $config['password'], $config['database']);
if ($db->connect_error) {
    die('<pre style="color:red">Koneksi gagal: ' . $db->connect_error .
        "\n\nKredensial yang digunakan:\n" . print_r($config, true) . '</pre>');
}

$results = [];

// Helper: cek apakah kolom sudah ada
function kolomAda($db, $tabel, $kolom) {
    $q = $db->query("SHOW COLUMNS FROM `$tabel` LIKE '$kolom'");
    return $q && $q->num_rows > 0;
}

// ─── Migrasi 1: usaha.butuh_absen ────────────────────────────────────────────
if (kolomAda($db, 'usaha', 'butuh_absen')) {
    $results[] = ['migrasi' => 'usaha.butuh_absen', 'status' => 'ℹ️ Kolom sudah ada (dilewati)'];
} else {
    $r = $db->query("ALTER TABLE `usaha` ADD COLUMN `butuh_absen` TINYINT(1) NOT NULL DEFAULT 1 AFTER `no_izin`");
    $results[] = ['migrasi' => 'usaha.butuh_absen', 'status' => $r ? '✅ Berhasil ditambahkan' : '❌ ' . $db->error];
}

// ─── Migrasi 2: produk_jasa.butuh_persiapan ──────────────────────────────────
if (kolomAda($db, 'produk_jasa', 'butuh_persiapan')) {
    $results[] = ['migrasi' => 'produk_jasa.butuh_persiapan', 'status' => 'ℹ️ Kolom sudah ada (dilewati)'];
} else {
    $r = $db->query("ALTER TABLE `produk_jasa` ADD COLUMN `butuh_persiapan` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_stok_dikelola`");
    $results[] = ['migrasi' => 'produk_jasa.butuh_persiapan', 'status' => $r ? '✅ Berhasil ditambahkan' : '❌ ' . $db->error];
}

// ─── Migrasi 3: transaksi_detail.status_pengerjaan ───────────────────────────
if (kolomAda($db, 'transaksi_detail', 'status_pengerjaan')) {
    $results[] = ['migrasi' => 'transaksi_detail.status_pengerjaan', 'status' => 'ℹ️ Kolom sudah ada (dilewati)'];
} else {
    $r = $db->query("ALTER TABLE `transaksi_detail` ADD COLUMN `status_pengerjaan` ENUM('Menunggu','Dikerjakan','Selesai') NOT NULL DEFAULT 'Selesai' AFTER `status_sewa`");
    $results[] = ['migrasi' => 'transaksi_detail.status_pengerjaan', 'status' => $r ? '✅ Berhasil ditambahkan' : '❌ ' . $db->error];
}

// ─── Verifikasi ───────────────────────────────────────────────────────────────
$verif = [
    'usaha.butuh_absen'                    => kolomAda($db, 'usaha', 'butuh_absen')                    ? '✅ Ada' : '❌ Tidak ditemukan',
    'produk_jasa.butuh_persiapan'          => kolomAda($db, 'produk_jasa', 'butuh_persiapan')          ? '✅ Ada' : '❌ Tidak ditemukan',
    'transaksi_detail.status_pengerjaan'   => kolomAda($db, 'transaksi_detail', 'status_pengerjaan')   ? '✅ Ada' : '❌ Tidak ditemukan',
];

$db->close();
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
    p.info { color:#94a3b8; font-size:0.85em; }
    table { border-collapse: collapse; width: 100%; margin-top: 10px; }
    td, th { border: 1px solid #333; padding: 10px 16px; text-align: left; }
    th { background: #1e293b; color: #94a3b8; }
    tr:nth-child(even) { background: #0f172a; }
  </style>
</head>
<body>
  <h2>🛠️ Migrasi Job Board — BKW mPOS Pro</h2>
  <p class="info">DB: <strong><?= htmlspecialchars($config['database']) ?></strong> @ <?= htmlspecialchars($config['hostname']) ?> (user: <?= htmlspecialchars($config['username']) ?>)</p>

  <h3>Hasil Eksekusi ALTER TABLE</h3>
  <table>
    <tr><th>Migrasi</th><th>Hasil</th></tr>
    <?php foreach ($results as $r): ?>
    <tr><td><?= htmlspecialchars($r['migrasi']) ?></td><td><?= $r['status'] ?></td></tr>
    <?php endforeach; ?>
  </table>

  <h3>Verifikasi Kolom di Database</h3>
  <table>
    <tr><th>Kolom</th><th>Status</th></tr>
    <?php foreach ($verif as $col => $status): ?>
    <tr><td><?= htmlspecialchars($col) ?></td><td><?= $status ?></td></tr>
    <?php endforeach; ?>
  </table>

  <p style="margin-top:30px; color:#f87171;">
    ⚠️ <strong>Penting:</strong> Setelah migrasi berhasil, hapus file ini dari server.
  </p>
</body>
</html>
