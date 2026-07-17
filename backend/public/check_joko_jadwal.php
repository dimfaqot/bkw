<?php
$pdo = new PDO("mysql:host=localhost;dbname=bkw;charset=utf8mb4", "root", "");
$stmt = $pdo->query("SELECT jk.*, s.nama_shift, s.jam_mulai, s.jam_selesai FROM jadwal_karyawan jk LEFT JOIN shift s ON s.id = jk.shift_id WHERE jk.karyawan_id = 6");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
