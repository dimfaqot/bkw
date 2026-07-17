<?php
// Seed data kriteria poin otomatis untuk semua usaha yang ada
try {
    $pdo = new PDO("mysql:host=localhost;dbname=bkw;charset=utf8mb4", "root", "");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (Exception $e) {
    die("<p style='color:red'>Gagal koneksi database: " . $e->getMessage() . "</p>");
}

// Ambil semua usaha
$usahaList = $pdo->query("SELECT id, nama_usaha FROM usaha")->fetchAll(PDO::FETCH_ASSOC);

if (empty($usahaList)) {
    echo "<p style='color:red'>Tidak ada usaha ditemukan di database.</p>";
    exit;
}

// Template kriteria poin yang akan dibuat per usaha
$templateKriteria = [
    // === Kehadiran Masuk Otomatis ===
    ['nama_kriteria' => 'Hadir Tepat Waktu',            'nilai_poin' => 10,  'is_otomatis' => 1, 'kode_sistem' => 'HADIR_TEPAT_WAKTU'],
    ['nama_kriteria' => 'Hadir Lebih Awal',             'nilai_poin' => 15,  'is_otomatis' => 1, 'kode_sistem' => 'HADIR_LEBIH_AWAL'],
    ['nama_kriteria' => 'Terlambat (Dalam Toleransi)',  'nilai_poin' => 5,   'is_otomatis' => 1, 'kode_sistem' => 'TERLAMBAT_TOLERANSI'],
    ['nama_kriteria' => 'Terlambat',                    'nilai_poin' => -5,  'is_otomatis' => 1, 'kode_sistem' => 'TERLAMBAT'],
    ['nama_kriteria' => 'Tidak Hadir (Alpha)',           'nilai_poin' => -20, 'is_otomatis' => 1, 'kode_sistem' => 'ALPHA'],
    ['nama_kriteria' => 'Izin Resmi',                   'nilai_poin' => 0,   'is_otomatis' => 1, 'kode_sistem' => 'IZIN'],
    ['nama_kriteria' => 'Sakit (Dengan Surat)',          'nilai_poin' => 0,   'is_otomatis' => 1, 'kode_sistem' => 'SAKIT'],
    // === Kehadiran Pulang Otomatis ===
    ['nama_kriteria' => 'Pulang Tepat Waktu',            'nilai_poin' => 5,   'is_otomatis' => 1, 'kode_sistem' => 'PULANG_TEPAT_WAKTU'],
    ['nama_kriteria' => 'Pulang Lebih Awal (Bolos)',     'nilai_poin' => -10, 'is_otomatis' => 1, 'kode_sistem' => 'PULANG_LEBIH_AWAL'],
    // === Penilaian Manual Atasan ===
    ['nama_kriteria' => 'Bonus Kinerja Bulanan',        'nilai_poin' => 50,  'is_otomatis' => 0, 'kode_sistem' => null],
    ['nama_kriteria' => 'Pencapaian Target Penjualan',  'nilai_poin' => 30,  'is_otomatis' => 0, 'kode_sistem' => null],
    ['nama_kriteria' => 'Inisiatif & Inovasi',          'nilai_poin' => 20,  'is_otomatis' => 0, 'kode_sistem' => null],
    ['nama_kriteria' => 'Pelanggaran SOP',              'nilai_poin' => -15, 'is_otomatis' => 0, 'kode_sistem' => null],
    ['nama_kriteria' => 'Komplain dari Pelanggan',      'nilai_poin' => -10, 'is_otomatis' => 0, 'kode_sistem' => null],
    ['nama_kriteria' => 'Tugas Tambahan / Lembur',      'nilai_poin' => 25,  'is_otomatis' => 0, 'kode_sistem' => null],
];

$berhasil = 0;
$dilewati = 0;
$now = date('Y-m-d H:i:s');

$stmtCek = $pdo->prepare("SELECT id FROM kriteria_poin WHERE usaha_id = ? AND nama_kriteria = ?");
$stmtInsert = $pdo->prepare(
    "INSERT INTO kriteria_poin (usaha_id, nama_kriteria, nilai_poin, is_otomatis, kode_sistem, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)"
);

foreach ($usahaList as $usaha) {
    $usahaId = $usaha['id'];

    foreach ($templateKriteria as $kr) {
        $stmtCek->execute([$usahaId, $kr['nama_kriteria']]);
        if ($stmtCek->fetch()) {
            $dilewati++;
            continue;
        }

        $stmtInsert->execute([
            $usahaId,
            $kr['nama_kriteria'],
            $kr['nilai_poin'],
            $kr['is_otomatis'],
            $kr['kode_sistem'],
            $now,
            $now,
        ]);
        $berhasil++;
    }
}

echo "<div style='font-family: monospace; padding: 20px; max-width: 600px;'>";
echo "<h2 style='color:#16a34a'>✅ Seed Kriteria Poin Selesai</h2>";
echo "<table border='1' cellpadding='8' style='border-collapse:collapse; width:100%'>";
echo "<tr style='background:#f3f4f6'><th>Keterangan</th><th>Jumlah</th></tr>";
echo "<tr><td>✅ Kriteria baru ditambahkan</td><td><strong>{$berhasil}</strong></td></tr>";
echo "<tr><td>⏩ Dilewati (sudah ada)</td><td><strong>{$dilewati}</strong></td></tr>";
echo "<tr><td>🏢 Total usaha diproses</td><td><strong>" . count($usahaList) . "</strong></td></tr>";
echo "</table>";
echo "<br><p style='color:#6b7280;font-size:0.9em'>Segarkan halaman <b>Aturan Poin</b> di dashboard untuk melihat hasilnya.</p>";
echo "</div>";
