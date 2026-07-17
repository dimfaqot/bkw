<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class PindahGeoKeUsaha extends Migration
{
    public function up()
    {
        // Tambah kolom geo ke tabel usaha
        $this->forge->addColumn('usaha', [
            'latitude' => [
                'type'       => 'DECIMAL',
                'constraint' => '10,8',
                'null'       => true,
                'after'      => 'no_izin',
            ],
            'longitude' => [
                'type'       => 'DECIMAL',
                'constraint' => '11,8',
                'null'       => true,
                'after'      => 'latitude',
            ],
            'radius_absen' => [
                'type'       => 'INT',
                'constraint' => 11,
                'default'    => 100,
                'after'      => 'longitude',
            ],
        ]);

        // Hapus kolom geo dari tabel unit
        $this->forge->dropColumn('unit', 'latitude');
        $this->forge->dropColumn('unit', 'longitude');
        $this->forge->dropColumn('unit', 'radius_absen');
    }

    public function down()
    {
        // Kembalikan kolom geo ke unit
        $this->forge->addColumn('unit', [
            'latitude' => [
                'type'       => 'DECIMAL',
                'constraint' => '10,8',
                'null'       => true,
            ],
            'longitude' => [
                'type'       => 'DECIMAL',
                'constraint' => '11,8',
                'null'       => true,
            ],
            'radius_absen' => [
                'type'       => 'INT',
                'constraint' => 11,
                'default'    => 50,
            ],
        ]);

        // Hapus kolom geo dari usaha
        $this->forge->dropColumn('usaha', 'latitude');
        $this->forge->dropColumn('usaha', 'longitude');
        $this->forge->dropColumn('usaha', 'radius_absen');
    }
}
