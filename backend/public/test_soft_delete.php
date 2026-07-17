<?php
header('Content-Type: text/plain');

try {
    $pdo = new PDO("mysql:host=localhost;dbname=bkw;charset=utf8mb4", "root", "", [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    $pdo->beginTransaction();

    // 1. Bersihkan dummy perizinan lama
    $pdo->prepare("DELETE FROM perizinan WHERE alasan = 'TEST_SOFT_DELETE'")->execute();

    // 2. Insert data baru untuk di-soft-delete (Karyawan A ID = 2, Pengganti B ID = null, Usaha ID = 2)
    $stmt = $pdo->prepare("
        INSERT INTO perizinan (usaha_id, karyawan_id, karyawan_pengganti_id, jenis_izin, tanggal, shift_id_izin, alasan, status, created_at, updated_at, deleted_at)
        VALUES (2, 2, null, 'izin', '2026-07-20', '1', 'TEST_SOFT_DELETE', 'menunggu_persetujuan', NOW(), NOW(), NOW())
    ");
    $stmt->execute();
    $insertedId = $pdo->lastInsertId();

    echo "Dummy perizinan dimasukkan & di-soft-delete. ID: $insertedId\n\n";

    // Helper function simulasi query riwayat()
    function simulasiQueryRiwayat($pdo, $userId, $role, $usahaId) {
        // Menambahkan GROUP BY p.id di akhir SQL query simulasi
        $sql = "
            SELECT p.id, p.alasan, p.deleted_at, u.nama as nama_karyawan, r_p.nama_role as role_pemohon
            FROM perizinan p
            LEFT JOIN users u ON u.id = p.karyawan_id
            LEFT JOIN user_role ur_p ON ur_p.user_id = p.karyawan_id
            LEFT JOIN roles r_p ON r_p.id = ur_p.role_id
            WHERE p.alasan = 'TEST_SOFT_DELETE'
        ";

        // Isolasi Cabang
        if ($role === 'root') {
            // Root sees all
        } else if (in_array($role, ['owner', 'supervisor'])) {
            $sql .= " AND p.usaha_id = :usaha_id";
        } else {
            $sql .= " AND (p.karyawan_id = :user_id OR p.karyawan_pengganti_id = :user_id)";
        }

        // Visibilitas Soft Delete
        $sql .= " AND (
            p.deleted_at IS NULL
            OR (:role = 'root')
            OR (:role = 'owner' AND LOWER(r_p.nama_role) IN ('supervisor', 'kasir', 'karyawan', 'member'))
            OR (:role = 'supervisor' AND LOWER(r_p.nama_role) IN ('kasir', 'karyawan', 'member'))
        )";

        // Group by primary key untuk mencegah duplikasi akibat join user_role
        $sql .= " GROUP BY p.id";

        $stmt = $pdo->prepare($sql);
        if ($role !== 'root' && !in_array($role, ['owner', 'supervisor'])) {
            $stmt->bindValue(':user_id', $userId, PDO::PARAM_INT);
        }
        if (in_array($role, ['owner', 'supervisor'])) {
            $stmt->bindValue(':usaha_id', $usahaId, PDO::PARAM_INT);
        }
        $stmt->bindValue(':role', $role, PDO::PARAM_STR);
        $stmt->execute();

        return $stmt->fetchAll();
    }

    // A. Test sebagai Karyawan biasa (Aguseh, ID=2, role=karyawan)
    $resKaryawan = simulasiQueryRiwayat($pdo, 2, 'karyawan', 2);
    echo "A. Sebagai Karyawan biasa (Aguseh):\n";
    echo "Jumlah ketemu: " . count($resKaryawan) . " (Harus: 0 karena data di-soft-delete)\n";
    print_r($resKaryawan);
    echo "\n";

    // B. Test sebagai Supervisor (di usaha_id = 2)
    $resSupervisor = simulasiQueryRiwayat($pdo, 4, 'supervisor', 2);
    echo "B. Sebagai Supervisor:\n";
    echo "Jumlah ketemu: " . count($resSupervisor) . " (Harus: 1 karena pemohonnya Karyawan biasa)\n";
    print_r($resSupervisor);
    echo "\n";

    // C. Test sebagai Owner (di usaha_id = 2)
    $resOwner = simulasiQueryRiwayat($pdo, 5, 'owner', 2);
    echo "C. Sebagai Owner:\n";
    echo "Jumlah ketemu: " . count($resOwner) . " (Harus: 1 karena pemohonnya Karyawan biasa)\n";
    print_r($resOwner);
    echo "\n";

    // D. Test sebagai Root
    $resRoot = simulasiQueryRiwayat($pdo, 1, 'root', null);
    echo "D. Sebagai Root:\n";
    echo "Jumlah ketemu: " . count($resRoot) . " (Harus: 1)\n";
    print_r($resRoot);
    echo "\n";

    $pdo->rollBack();
    echo "Transaksi di-rollback. Database bersih kembali.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
