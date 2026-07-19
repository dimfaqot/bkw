<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class TambahKodeDanNoInv extends Migration
{
    public function up()
    {
        // 1. Tambah kode_usaha di tabel usaha
        $this->forge->addColumn('usaha', [
            'kode_usaha' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => true,
                'after'      => 'nama_usaha',
            ]
        ]);

        // 2. Tambah kode_unit di tabel unit
        $this->forge->addColumn('unit', [
            'kode_unit' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => true,
                'after'      => 'nama_unit',
            ]
        ]);

        // 3. Tambah nomor_inventaris di tabel pengeluaran
        $this->forge->addColumn('pengeluaran', [
            'nomor_inventaris' => [
                'type'       => 'VARCHAR',
                'constraint' => 100,
                'null'       => true,
                'after'      => 'kategori',
            ]
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('usaha', 'kode_usaha');
        $this->forge->dropColumn('unit', 'kode_unit');
        $this->forge->dropColumn('pengeluaran', 'nomor_inventaris');
    }
}
