<?php
try {
    $pdo = new PDO("mysql:host=localhost;dbname=bkw;charset=utf8mb4", "root", "");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    header('Content-Type: text/plain');

    $pdo->beginTransaction();

    echo "1. Memodifikasi tabel jadwal_karyawan...\n";
    // Tambahkan kolom hari jika belum ada
    $cols = $pdo->query("SHOW COLUMNS FROM jadwal_karyawan")->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('hari', $cols)) {
        $pdo->exec("ALTER TABLE jadwal_karyawan ADD COLUMN hari ENUM('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu') NULL AFTER shift_id");
        echo "   - Kolom 'hari' berhasil ditambahkan.\n";
    }

    // Drop index yang mungkin menggunakan kolom tanggal
    try {
        $pdo->exec("ALTER TABLE jadwal_karyawan DROP INDEX usaha_id");
        echo "   - Index usaha_id berhasil di-drop.\n";
    } catch (Exception $e) {
        echo "   - Index usaha_id tidak ada atau gagal di-drop: " . $e->getMessage() . "\n";
    }

    // Drop kolom tanggal, is_lembur, jam_mulai, jam_selesai, original_karyawan_id
    $dropCols = ['tanggal', 'is_lembur', 'jam_mulai', 'jam_selesai', 'original_karyawan_id'];
    foreach ($dropCols as $col) {
        if (in_array($col, $cols)) {
            $pdo->exec("ALTER TABLE jadwal_karyawan DROP COLUMN `$col`");
            echo "   - Kolom '$col' berhasil dihapus.\n";
        }
    }

    echo "\n2. Membuat tabel lembur...\n";
    $pdo->exec("CREATE TABLE IF NOT EXISTS `lembur` (
        `id` INT(11) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        `usaha_id` INT(11) NOT NULL,
        `karyawan_id` INT(11) UNSIGNED NOT NULL,
        `tanggal` DATE NOT NULL,
        `jam_mulai` TIME NOT NULL,
        `jam_selesai` TIME NOT NULL,
        `keterangan` TEXT NULL,
        `status` ENUM('ditunjuk', 'diterima_karyawan', 'ditolak_karyawan') NOT NULL DEFAULT 'ditunjuk',
        `catatan_penolakan` TEXT NULL,
        `created_at` DATETIME NULL,
        `updated_at` DATETIME NULL,
        FOREIGN KEY (`karyawan_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    echo "   - Tabel 'lembur' berhasil dibuat.\n";

    $pdo->commit();
    echo "\nDatabase patch selesai dengan sukses 100%!\n";
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo "Error: " . $e->getMessage() . "\n";
}
