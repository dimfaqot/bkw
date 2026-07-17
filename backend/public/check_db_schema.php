<?php
try {
    $pdo = new PDO("mysql:host=localhost;dbname=bkw;charset=utf8mb4", "root", "");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    header('Content-Type: text/plain');

    $cols = $pdo->query("SHOW COLUMNS FROM jadwal_karyawan")->fetchAll(PDO::FETCH_ASSOC);
    echo "Kolom jadwal_karyawan saat ini:\n";
    foreach ($cols as $c) {
        echo "- {$c['Field']} ({$c['Type']})\n";
    }

    echo "\nKolom lembur saat ini:\n";
    $colsLembur = $pdo->query("SHOW COLUMNS FROM lembur")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($colsLembur as $c) {
        echo "- {$c['Field']} ({$c['Type']})\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
