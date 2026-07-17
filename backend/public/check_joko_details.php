<?php
$pdo = new PDO("mysql:host=localhost;dbname=bkw;charset=utf8mb4", "root", "");
$stmt = $pdo->query("SELECT * FROM perizinan WHERE karyawan_id = 6 OR karyawan_pengganti_id = 6");
echo "PERIZINAN:\n";
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

$stmt2 = $pdo->query("SELECT * FROM lembur WHERE karyawan_id = 6");
echo "LEMBUR:\n";
print_r($stmt2->fetchAll(PDO::FETCH_ASSOC));

$stmt3 = $pdo->query("SELECT * FROM jadwal_karyawan WHERE karyawan_id = 6");
echo "JADWAL:\n";
print_r($stmt3->fetchAll(PDO::FETCH_ASSOC));
