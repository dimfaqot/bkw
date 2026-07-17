<?php
try {
    $pdo = new PDO("mysql:host=localhost;dbname=bkw;charset=utf8mb4", "root", "");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    header('Content-Type: text/plain');

    echo "Menambahkan kolom usaha_id ke tabel perizinan...\n";
    
    // Tambah kolom usaha_id
    $pdo->exec("ALTER TABLE perizinan ADD COLUMN usaha_id INT(11) UNSIGNED NULL AFTER status");
    echo "Sukses menambah kolom.\n";

    // Set foreign key
    $pdo->exec("ALTER TABLE perizinan ADD CONSTRAINT fk_perizinan_usaha FOREIGN KEY (usaha_id) REFERENCES usaha(id) ON DELETE CASCADE ON UPDATE CASCADE");
    echo "Sukses membuat foreign key.\n";

    // Backfill data usaha_id dari relasi user_role (karyawan_id ke usaha_id)
    // Agar data uji coba lama tidak kehilangan konteks usahanya
    $pdo->exec("UPDATE perizinan p JOIN user_role ur ON ur.user_id = p.karyawan_id SET p.usaha_id = ur.usaha_id WHERE p.usaha_id IS NULL");
    echo "Sukses melakukan backfill data usaha_id.\n";

} catch (Exception $e) {
    echo "Gagal: " . $e->getMessage() . "\n";
}
