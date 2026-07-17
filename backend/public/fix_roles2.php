<?php
$db = new mysqli('localhost', 'root', '', 'bkw');

if ($db->connect_error) {
    die("Koneksi gagal: " . $db->connect_error);
}

// Cek apakah Karyawan sudah ada
$res = $db->query("SELECT id FROM roles WHERE nama_role = 'Karyawan'");
if ($res->num_rows == 0) {
    $db->query("INSERT INTO roles (nama_role, deskripsi) VALUES ('Karyawan', 'Staf Karyawan yang bisa bersifat umum (global cabang) atau khusus (spesifik unit).')");
    echo "Role Karyawan berhasil ditambahkan.";
} else {
    echo "Role Karyawan sudah ada.";
}
