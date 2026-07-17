<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class SeedKriteriaPoinKebersihan extends Seeder
{
    public function run()
    {
        $db = \Config\Database::connect();
        
        // Ambil semua usaha
        $usahas = $db->table('usaha')->get()->getResultArray();
        $now = date('Y-m-d H:i:s');

        foreach ($usahas as $usaha) {
            $usahaId = $usaha['id'];

            // 1. Kriteria Poin Bersih
            $existBersih = $db->table('kriteria_poin')
                              ->where('usaha_id', $usahaId)
                              ->where('kode_sistem', 'KEBERSIHAN_BERSIH')
                              ->countAllResults();
            if ($existBersih === 0) {
                $db->table('kriteria_poin')->insert([
                    'usaha_id'      => $usahaId,
                    'nama_kriteria' => 'Kebersihan Area - Bersih',
                    'nilai_poin'    => 10,
                    'is_otomatis'   => 1,
                    'kode_sistem'   => 'KEBERSIHAN_BERSIH',
                    'created_at'    => $now,
                    'updated_at'    => $now
                ]);
            }

            // 2. Kriteria Poin Kotor (Denda)
            $existKotor = $db->table('kriteria_poin')
                             ->where('usaha_id', $usahaId)
                             ->where('kode_sistem', 'KEBERSIHAN_KOTOR')
                             ->countAllResults();
            if ($existKotor === 0) {
                $db->table('kriteria_poin')->insert([
                    'usaha_id'      => $usahaId,
                    'nama_kriteria' => 'Kebersihan Area - Kotor (Denda)',
                    'nilai_poin'    => -5,
                    'is_otomatis'   => 1,
                    'kode_sistem'   => 'KEBERSIHAN_KOTOR',
                    'created_at'    => $now,
                    'updated_at'    => $now
                ]);
            }
        }
    }
}
