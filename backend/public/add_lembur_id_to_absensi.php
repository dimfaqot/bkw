<?php
try {
    $pdo = new PDO("mysql:host=localhost;dbname=bkw;charset=utf8mb4", "root", "");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    header('Content-Type: text/plain');

    $cols = $pdo->query("SHOW COLUMNS FROM absensi")->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('lembur_id', $cols)) {
        $pdo->exec("ALTER TABLE absensi ADD COLUMN lembur_id INT(11) UNSIGNED NULL AFTER jadwal_karyawan_id");
        echo "Kolom 'lembur_id' berhasil ditambahkan ke tabel absensi!\n";
    } else {
        echo "Kolom 'lembur_id' sudah ada.\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
