<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class SeedAreaKebersihan extends Seeder
{
    public function run()
    {
        $db = \Config\Database::connect();
        
        // Ambil semua usaha
        $usahaList = $db->table('usaha')->get()->getResultArray();
        if (empty($usahaList)) {
            return;
        }

        foreach ($usahaList as $usaha) {
            $areas = [
                [
                    'usaha_id' => $usaha['id'],
                    'nama_area' => 'Toilet Karyawan & Pelanggan',
                    'jam_mulai' => '08:00:00',
                    'jam_selesai' => '09:00:00',
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s')
                ],
                [
                    'usaha_id' => $usaha['id'],
                    'nama_area' => 'Area Kasir & Etalase Depan',
                    'jam_mulai' => '11:00:00',
                    'jam_selesai' => '12:00:00',
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s')
                ],
                [
                    'usaha_id' => $usaha['id'],
                    'nama_area' => 'Ruang Makan / Dine-in',
                    'jam_mulai' => '15:00:00',
                    'jam_selesai' => '16:00:00',
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s')
                ],
                [
                    'usaha_id' => $usaha['id'],
                    'nama_area' => 'Dapur & Tempat Cuci Piring',
                    'jam_mulai' => '21:00:00',
                    'jam_selesai' => '22:00:00',
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s')
                ]
            ];

            foreach ($areas as $area) {
                $exists = $db->table('kebersihan')
                             ->where('usaha_id', $area['usaha_id'])
                             ->where('nama_area', $area['nama_area'])
                             ->countAllResults();
                if ($exists === 0) {
                    $db->table('kebersihan')->insert($area);
                }
            }
        }
    }
}
