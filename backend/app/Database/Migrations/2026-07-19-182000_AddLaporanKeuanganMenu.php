<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddLaporanKeuanganMenu extends Migration
{
    public function up()
    {
        $db = \Config\Database::connect();
        
        // 1. Tambahkan menu Laporan Keuangan ke tabel menus
        $db->table('menus')->insert([
            'label'    => 'Laporan Keuangan',
            'grup'     => 'Laporan',
            'icon'     => 'BarChart2',
            'url'      => 'laporan',
            'tabel'    => null,
            'urutan'   => 97,
            'is_aktif' => 1
        ]);
        
        $menuId = $db->insertID();
        
        // 2. Berikan izin akses penuh ke Root (1), Owner (2), dan Supervisor (3)
        $roles = [1, 2, 3];
        foreach ($roles as $roleId) {
            $db->table('role_permissions')->insert([
                'role_id'    => $roleId,
                'menu_id'    => $menuId,
                'can_read'   => 1,
                'can_create' => 1,
                'can_update' => 1,
                'can_delete' => 1,
                'is_aktif'   => 1
            ]);
        }
    }

    public function down()
    {
        $db = \Config\Database::connect();
        
        // Ambil ID menu Laporan Keuangan
        $menu = $db->table('menus')->where('url', 'laporan')->get()->getRow();
        if ($menu) {
            // Hapus permission terkait
            $db->table('role_permissions')->where('menu_id', $menu->id)->delete();
            // Hapus menu
            $db->table('menus')->where('id', $menu->id)->delete();
        }
    }
}
