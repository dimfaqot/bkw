<?php
$db = new mysqli('localhost', 'root', '', 'bkw');
if ($db->connect_error) {
    die("Koneksi gagal: " . $db->connect_error);
}

// Drop old table if exists
$db->query("DROP TABLE IF EXISTS iot_perangkat");
$db->query("DROP TABLE IF EXISTS iot");

// Create new table iot
$sql_table = "
CREATE TABLE IF NOT EXISTS iot (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usaha_id INT UNSIGNED NOT NULL,
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
    echo "Tabel iot berhasil dibuat.\n";
} else {
    echo "Error membuat tabel: " . $db->error . "\n";
}

// Update menus table
$db->query("UPDATE menus SET url = 'iot', tabel = 'iot' WHERE url = 'iot_perangkat'");

// Insert 10 seed records
$seed_data = [
    [1, "Lampu Billiard 1", "billiard", "192.168.1.101"],
    [1, "Lampu Billiard 2", "billiard", "192.168.1.102"],
    [1, "Lampu Billiard 3", "billiard", "192.168.1.103"],
    [1, "Lampu Billiard 4", "billiard", "192.168.1.104"],
    [1, "PS5 VIP 1 (TV)", "android_tv", "192.168.1.111"],
    [1, "PS5 VIP 2 (TV)", "android_tv", "192.168.1.112"],
    [1, "PS4 Reguler 1 (TV)", "android_tv", "192.168.1.113"],
    [1, "PS4 Reguler 2 (TV)", "android_tv", "192.168.1.114"],
    [1, "Lampu Ruang Tunggu", "saklar_umum", "192.168.1.121"],
    [1, "AC Ruang Utama", "saklar_umum", "192.168.1.122"],
];

foreach ($seed_data as $data) {
    $nama = $db->real_escape_string($data[1]);
    $tipe = $db->real_escape_string($data[2]);
    $ip = $db->real_escape_string($data[3]);
    $db->query("INSERT INTO iot (usaha_id, nama_perangkat, tipe_perangkat, ip_address, status_relay, status_penggunaan, is_aktif) VALUES (1, '$nama', '$tipe', '$ip', 0, 'tersedia', 1)");
}
echo "10 data seeder berhasil ditambahkan.\n";

$db->close();
?>
