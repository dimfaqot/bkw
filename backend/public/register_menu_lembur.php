<?php
try {
    $pdo = new PDO("mysql:host=localhost;dbname=bkw;charset=utf8mb4", "root", "");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    header('Content-Type: text/plain');

    $menu = $pdo->query("SELECT id FROM menus WHERE tabel = 'lembur'")->fetch();
    
    if (!$menu) {
        echo "Menambahkan menu lembur...\n";
        $pdo->exec("INSERT INTO menus (label, grup, icon, url, tabel, urutan, is_aktif) VALUES 
            ('Penugasan Lembur', 'Manajemen', 'clock', 'lembur', 'lembur', 99, 1)");
        $menuId = $pdo->lastInsertId();
        echo "   - Menu lembur berhasil ditambahkan dengan ID: $menuId\n";

        // Berikan akses penuh ke root (ID: 1), owner (ID: 2), dan supervisor (ID: 3)
        $roles = [1, 2, 3];
        foreach ($roles as $roleId) {
            $pdo->exec("INSERT INTO role_permissions (role_id, menu_id, can_read, can_create, can_update, can_delete, is_aktif) 
                VALUES ($roleId, $menuId, 1, 1, 1, 1, 1)");
            echo "   - Hak akses berhasil diberikan ke role ID: $roleId\n";
        }
    } else {
        echo "Menu lembur sudah ada.\n";
    }

    echo "\nRegistrasi menu lembur selesai dengan sukses!\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
