<?php
// Debug: cek izin kasir untuk tabel points dan kriteria_poin
try {
    $pdo = new PDO("mysql:host=localhost;dbname=bkw;charset=utf8mb4", "root", "");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (Exception $e) {
    die("Koneksi gagal: " . $e->getMessage());
}

echo "<style>body{font-family:monospace;padding:20px} table{border-collapse:collapse;width:100%} td,th{border:1px solid #ccc;padding:6px 10px} th{background:#f3f4f6}</style>";

// Cari semua role yang bukan root
$roles = $pdo->query("SELECT * FROM roles WHERE nama_role != 'root'")->fetchAll(PDO::FETCH_ASSOC);

foreach ($roles as $role) {
    echo "<h3>Role: {$role['nama_role']} (ID: {$role['id']})</h3>";
    
    $stmt = $pdo->prepare("
        SELECT m.label, m.tabel, rp.can_read, rp.can_create, rp.can_update, rp.can_delete, rp.is_aktif
        FROM role_permissions rp
        JOIN menus m ON m.id = rp.menu_id
        WHERE rp.role_id = ?
        AND m.tabel IN ('absensi', 'points', 'kriteria_poin', 'jadwal_karyawan', 'shift')
        ORDER BY m.tabel
    ");
    $stmt->execute([$role['id']]);
    $izin = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($izin)) {
        echo "<p style='color:gray'>Tidak ada izin untuk tabel terkait absensi/poin.</p>";
        continue;
    }
    
    echo "<table><tr><th>Menu</th><th>Tabel</th><th>Read</th><th>Create</th><th>Update</th><th>Delete</th><th>Aktif</th></tr>";
    foreach ($izin as $i) {
        echo "<tr>";
        echo "<td>{$i['label']}</td>";
        echo "<td><code>{$i['tabel']}</code></td>";
        echo "<td style='background:" . ($i['can_read'] ? '#dcfce7' : '#fee2e2') . "'>" . ($i['can_read'] ? '✓' : '✗') . "</td>";
        echo "<td style='background:" . ($i['can_create'] ? '#dcfce7' : '#fee2e2') . "'>" . ($i['can_create'] ? '✓' : '✗') . "</td>";
        echo "<td style='background:" . ($i['can_update'] ? '#dcfce7' : '#fee2e2') . "'>" . ($i['can_update'] ? '✓' : '✗') . "</td>";
        echo "<td style='background:" . ($i['can_delete'] ? '#dcfce7' : '#fee2e2') . "'>" . ($i['can_delete'] ? '✓' : '✗') . "</td>";
        echo "<td>" . ($i['is_aktif'] ? '✓' : '✗') . "</td>";
        echo "</tr>";
    }
    echo "</table><br>";
}

// Cek isi tabel points
$jumlahPoin = $pdo->query("SELECT COUNT(*) FROM points")->fetchColumn();
$jumlahKriteria = $pdo->query("SELECT COUNT(*) FROM kriteria_poin")->fetchColumn();
echo "<h3>Ringkasan Data</h3>";
echo "<p>Total data di tabel <b>points</b>: <b>{$jumlahPoin}</b></p>";
echo "<p>Total data di tabel <b>kriteria_poin</b>: <b>{$jumlahKriteria}</b></p>";

if ($jumlahKriteria > 0) {
    $kriterias = $pdo->query("SELECT nama_kriteria, nilai_poin, kode_sistem FROM kriteria_poin LIMIT 10")->fetchAll(PDO::FETCH_ASSOC);
    echo "<table><tr><th>Nama Kriteria</th><th>Nilai Poin</th><th>Kode Sistem</th></tr>";
    foreach ($kriterias as $k) {
        echo "<tr><td>{$k['nama_kriteria']}</td><td>{$k['nilai_poin']}</td><td><code>" . ($k['kode_sistem'] ?? '-') . "</code></td></tr>";
    }
    echo "</table>";
}
