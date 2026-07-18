<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class SeedMenuKomposisi extends Seeder
{
    public function run()
    {
        $db = \Config\Database::connect();

        // 1. Tambahkan Menu Resep & Komposisi
        $existKomposisi = $db->table('menus')->where('url', 'produk_komposisi')->get()->getRowArray();
        if (!$existKomposisi) {
            $maxOrder = $db->table('menus')->selectMax('urutan')->get()->getRow();
            $urutan = ($maxOrder ? (int)$maxOrder->urutan : 0) + 1;
            
            $db->table('menus')->insert([
                'label'    => 'Resep & Komposisi',
                'icon'     => 'Box',
                'url'      => 'produk_komposisi',
                'tabel'    => 'produk_komposisi',
                'urutan'   => $urutan,
                'is_aktif' => 1,
                'grup'     => 'POS & Kasir'
            ]);
            $menuId = $db->insertID();
        } else {
            $menuId = $existKomposisi['id'];
            $db->table('menus')->where('id', $menuId)->update(['grup' => 'POS & Kasir']);
        }

        // 2. Hak Akses (Permissions)
        $roles = $db->table('roles')->get()->getResultArray();

        foreach ($roles as $role) {
            $roleName = strtolower($role['nama_role']);
            $roleId = $role['id'];

            // Hak Akses untuk Resep (produk_komposisi)
            // Hanya untuk Root, Owner, dan Supervisor
            if (in_array($roleName, ['root', 'owner', 'supervisor'])) {
                $existPerm = $db->table('role_permissions')
                                ->where('role_id', $roleId)
                                ->where('menu_id', $menuId)
                                ->countAllResults();
                if ($existPerm === 0) {
                    $db->table('role_permissions')->insert([
                        'role_id'    => $roleId,
                        'menu_id'    => $menuId,
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
