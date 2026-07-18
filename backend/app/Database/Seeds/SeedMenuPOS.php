<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class SeedMenuPOS extends Seeder
{
    public function run()
    {
        $db = \Config\Database::connect();

        // 1. Tambahkan Menu Master Produk & Jasa
        $existProduk = $db->table('menus')->where('url', 'produk_jasa')->get()->getRowArray();
        if (!$existProduk) {
            $maxOrder = $db->table('menus')->selectMax('urutan')->get()->getRow();
            $urutan = ($maxOrder ? (int)$maxOrder->urutan : 0) + 1;
            
            $db->table('menus')->insert([
                'label'    => 'Katalog Produk & Jasa',
                'icon'     => 'Layers',
                'url'      => 'produk_jasa',
                'tabel'    => 'produk_jasa',
                'urutan'   => $urutan,
                'is_aktif' => 1,
                'grup'     => 'POS & Kasir'
            ]);
            $produkId = $db->insertID();
        } else {
            $produkId = $existProduk['id'];
            $db->table('menus')->where('id', $produkId)->update(['grup' => 'POS & Kasir']);
        }

        // 2. Tambahkan Menu Kasir POS
        $existKasir = $db->table('menus')->where('url', 'kasir')->get()->getRowArray();
        if (!$existKasir) {
            $maxOrder = $db->table('menus')->selectMax('urutan')->get()->getRow();
            $urutan = ($maxOrder ? (int)$maxOrder->urutan : 0) + 1;

            $db->table('menus')->insert([
                'label'    => 'Layar Kasir (POS)',
                'icon'     => 'ShoppingCart',
                'url'      => 'kasir',
                'tabel'    => 'transaksi',
                'urutan'   => $urutan,
                'is_aktif' => 1,
                'grup'     => 'POS & Kasir'
            ]);
            $kasirId = $db->insertID();
        } else {
            $kasirId = $existKasir['id'];
            $db->table('menus')->where('id', $kasirId)->update(['grup' => 'POS & Kasir']);
        }

        // 3. Hak Akses (Permissions)
        $roles = $db->table('roles')->get()->getResultArray();

        foreach ($roles as $role) {
            $roleName = strtolower($role['nama_role']);
            $roleId = $role['id'];

            // Hak Akses untuk Master Produk (produk_jasa)
            // Hanya untuk Root, Owner, dan Supervisor
            if (in_array($roleName, ['root', 'owner', 'supervisor'])) {
                $existPerm = $db->table('role_permissions')
                                ->where('role_id', $roleId)
                                ->where('menu_id', $produkId)
                                ->countAllResults();
                if ($existPerm === 0) {
                    $db->table('role_permissions')->insert([
                        'role_id'    => $roleId,
                        'menu_id'    => $produkId,
                        'can_read'   => 1,
                        'can_create' => 1,
                        'can_update' => 1,
                        'can_delete' => 1
                    ]);
                }
            }

            // Hak Akses untuk Layar Kasir POS (kasir)
            // Bisa diakses oleh semua peran karyawan (kecuali member/pelanggan)
            if (in_array($roleName, ['root', 'owner', 'supervisor', 'kasir', 'karyawan'])) {
                $existPerm = $db->table('role_permissions')
                                ->where('role_id', $roleId)
                                ->where('menu_id', $kasirId)
                                ->countAllResults();
                if ($existPerm === 0) {
                    $db->table('role_permissions')->insert([
                        'role_id'    => $roleId,
                        'menu_id'    => $kasirId,
                        'can_read'   => 1,
                        'can_create' => 1,
                        'can_update' => 1,
                        'can_delete' => 1
                    ]);
                }
            }
        }
    }
}
