<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class SeedMenuKebersihan extends Seeder
{
    public function run()
    {
        $db = \Config\Database::connect();

        // 1. Tambahkan Menu Area Kebersihan
        $existMaster = $db->table('menus')->where('url', 'kebersihan')->get()->getRowArray();
        if (!$existMaster) {
            $maxOrder = $db->table('menus')->selectMax('urutan')->get()->getRow();
            $urutan = ($maxOrder ? (int)$maxOrder->urutan : 0) + 1;
            
            $db->table('menus')->insert([
                'label'    => 'Area Kebersihan',
                'icon'     => 'Layers',
                'url'      => 'kebersihan',
                'tabel'    => 'kebersihan',
                'urutan'   => $urutan,
                'is_aktif' => 1
            ]);
            $masterId = $db->insertID();
        } else {
            $masterId = $existMaster['id'];
        }

        // 2. Tambahkan Menu Tugas Kebersihan
        $existTugas = $db->table('menus')->where('url', 'kebersihan_tugas')->get()->getRowArray();
        if (!$existTugas) {
            $maxOrder = $db->table('menus')->selectMax('urutan')->get()->getRow();
            $urutan = ($maxOrder ? (int)$maxOrder->urutan : 0) + 1;

            $db->table('menus')->insert([
                'label'    => 'Tugas Kebersihan',
                'icon'     => 'CheckSquare',
                'url'      => 'kebersihan_tugas',
                'tabel'    => 'kebersihan_tugas',
                'urutan'   => $urutan,
                'is_aktif' => 1
            ]);
            $tugasId = $db->insertID();
        } else {
            $tugasId = $existTugas['id'];
        }

        // 3. Hak Akses (Permissions)
        $roles = $db->table('roles')->get()->getResultArray();

        foreach ($roles as $role) {
            $roleName = strtolower($role['nama_role']);
            $roleId = $role['id'];

            // Hak Akses untuk Master Area Kebersihan (kebersihan)
            // Hanya untuk Root, Owner, dan Supervisor
            if (in_array($roleName, ['root', 'owner', 'supervisor'])) {
                $existPerm = $db->table('role_permissions')
                                ->where('role_id', $roleId)
                                ->where('menu_id', $masterId)
                                ->countAllResults();
                if ($existPerm === 0) {
                    $db->table('role_permissions')->insert([
                        'role_id'    => $roleId,
                        'menu_id'    => $masterId,
                        'can_read'   => 1,
                        'can_create' => 1,
                        'can_update' => 1,
                        'can_delete' => 1
                    ]);
                }
            }

            // Hak Akses untuk Tugas Kebersihan (kebersihan_tugas)
            // Bisa diakses oleh semua peran karyawan (kecuali member/pelanggan)
            if (in_array($roleName, ['root', 'owner', 'supervisor', 'kasir', 'karyawan'])) {
                $existPerm = $db->table('role_permissions')
                                ->where('role_id', $roleId)
                                ->where('menu_id', $tugasId)
                                ->countAllResults();
                if ($existPerm === 0) {
                    $db->table('role_permissions')->insert([
                        'role_id'    => $roleId,
                        'menu_id'    => $tugasId,
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
