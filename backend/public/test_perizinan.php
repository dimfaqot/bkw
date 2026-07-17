<?php
// Test endpoint perizinan/riwayat dan ajukan dengan token dari database
try {
    $pdo = new PDO("mysql:host=localhost;dbname=bkw;charset=utf8mb4", "root", "");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    header('Content-Type: text/plain');

    // Verifikasi kolom usaha_id di tabel perizinan
    $cols = $pdo->query("SHOW COLUMNS FROM perizinan")->fetchAll(PDO::FETCH_COLUMN);
    echo "Kolom perizinan:\n";
    echo implode(", ", $cols) . "\n\n";

    // Cek data perizinan yang ada
    $data = $pdo->query("SELECT id, karyawan_id, usaha_id, status, tanggal_mulai, tanggal_selesai FROM perizinan ORDER BY id DESC LIMIT 5")->fetchAll(PDO::FETCH_ASSOC);
    echo "Data perizinan terbaru:\n";
    print_r($data);
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
