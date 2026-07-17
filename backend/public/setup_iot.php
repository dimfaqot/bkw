<?php
$db = new mysqli('localhost', 'root', '', 'bkw');
if ($db->connect_error) {
    die("Koneksi gagal: " . $db->connect_error);
}

// Create table iot_perangkat
$sql_table = "
CREATE TABLE IF NOT EXISTS iot_perangkat (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usaha_id INT NOT NULL,
    nama_perangkat VARCHAR(100) NOT NULL,
    tipe_perangkat ENUM('billiard', 'android_tv', 'saklar_umum') NOT NULL DEFAULT 'saklar_umum',
    ip_address VARCHAR(45) NULL,
    status_relay TINYINT(1) NOT NULL DEFAULT 0,
    status_penggunaan ENUM('tersedia', 'dipakai', 'gangguan') NOT NULL DEFAULT 'tersedia',
    transaksi_aktif_id INT NULL,
    is_aktif TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
";

if ($db->query($sql_table) === TRUE) {
    echo "Tabel iot_perangkat berhasil dibuat.\n";
} else {
    echo "Error membuat tabel: " . $db->error . "\n";
}

// Check if menu already exists
$result = $db->query("SELECT id FROM menus WHERE url = 'iot_perangkat'");
if ($result->num_rows == 0) {
    // Insert menu IoT
    // We will place it in 'Lainnya' group or 'Sistem' group. Since we have specific groups, let's just make it 'Pengaturan' or 'IoT'. 
    // Wait, let's check what groups exist: Users, Usaha, Menus. Let's create 'Perangkat' group.
    $sql_menu = "
    INSERT INTO menus (label, icon, url, tabel, urutan, is_aktif, grup, role_akses) 
    VALUES ('Manajemen IoT', 'Monitor', 'iot_perangkat', 'iot_perangkat', 7, 1, 'Perangkat', 'root,owner');
    ";
    
    if ($db->query($sql_menu) === TRUE) {
        echo "Menu Manajemen IoT berhasil ditambahkan.\n";
    } else {
        echo "Error menambah menu: " . $db->error . "\n";
    }
} else {
    echo "Menu Manajemen IoT sudah ada.\n";
}

$db->close();
?>
