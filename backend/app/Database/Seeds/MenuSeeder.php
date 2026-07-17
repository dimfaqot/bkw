<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class MenuSeeder extends Seeder
{
    public function run()
    {
        $menus = [
            [
                'label'    => 'Beranda',
                'icon'     => 'Home',
                'url'      => 'beranda',
                'tabel'    => null,
                'urutan'   => 1,
                'is_aktif' => 1
            ],
            [
                'label'    => 'CRUD Data',
                'icon'     => 'Database',
                'url'      => 'crud',
                'tabel'    => 'crud', // Khusus karena Dashboard.jsx menggabungkan 5 tabel di sini
                'urutan'   => 2,
                'is_aktif' => 1
            ],
            [
                'label'    => 'Transaksi',
                'icon'     => 'ShoppingCart',
                'url'      => 'transaksi',
                'tabel'    => null,
                'urutan'   => 3,
                'is_aktif' => 1
            ],
            [
                'label'    => 'Laporan',
                'icon'     => 'BarChart2',
                'url'      => 'laporan',
                'tabel'    => null,
                'urutan'   => 4,
                'is_aktif' => 1
            ],
            [
                'label'    => 'Pengaturan',
                'icon'     => 'Settings',
                'url'      => 'pengaturan',
                'tabel'    => null,
                'urutan'   => 5,
                'is_aktif' => 1
            ]
        ];

        // Kosongkan dan masukkan data menu
        $this->db->table('menus')->emptyTable();
        $this->db->table('menus')->insertBatch($menus);

        // Berikan hak akses default kepada peran 'member' (id=1 biasanya) dan 'kasir'
        // Kita asumsikan peran-peran ini sudah ada atau akan ditambahkan kemudian.
        
        // Kosongkan permissions lama
        $this->db->table('role_permissions')->emptyTable();

        $menusData = $this->db->table('menus')->get()->getResultArray();
        
        // Cari ID role member dan kasir
        $roleMember = $this->db->table('roles')->where('nama_role', 'member')->get()->getRowArray();
        $roleKasir = $this->db->table('roles')->where('nama_role', 'kasir')->get()->getRowArray();

        $permissions = [];

        foreach ($menusData as $menu) {
            // Member bisa melihat beranda dan pengaturan
            if ($roleMember) {
                if (in_array($menu['url'], ['beranda', 'pengaturan'])) {
                    $permissions[] = [
                        'role_id'    => $roleMember['id'],
                        'menu_id'    => $menu['id'],
                        'can_read'   => 1,
                        'can_create' => 0,
                        'can_update' => 0,
                        'can_delete' => 0
                    ];
                }
            }
            
            // Kasir bisa melihat beranda, transaksi, dan crud (terbatas)
            if ($roleKasir) {
                if (in_array($menu['url'], ['beranda', 'transaksi', 'crud'])) {
                    $permissions[] = [
                        'role_id'    => $roleKasir['id'],
                        'menu_id'    => $menu['id'],
                        'can_read'   => 1,
                        'can_create' => ($menu['url'] === 'crud' ? 1 : 0), // Misal kasir bisa tambah data di crud
                        'can_update' => ($menu['url'] === 'crud' ? 1 : 0),
                        'can_delete' => 0 // Kasir tidak boleh hapus data
                    ];
                }
            }
        }

        if (!empty($permissions)) {
            $this->db->table('role_permissions')->insertBatch($permissions);
        }
    }
}
