<?php
try {
    $pdo = new PDO("mysql:host=localhost;dbname=bkw;charset=utf8mb4", "root", "");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    header('Content-Type: text/plain');

    $total = $pdo->query("SELECT COUNT(*) FROM jadwal_karyawan")->fetchColumn();
    echo "Total rows in jadwal_karyawan: " . $total . "\n\n";

    if ($total > 0) {
        $rows = $pdo->query("SELECT * FROM jadwal_karyawan LIMIT 10")->fetchAll(PDO::FETCH_ASSOC);
        print_r($rows);
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
