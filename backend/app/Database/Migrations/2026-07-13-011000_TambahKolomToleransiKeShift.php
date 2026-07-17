<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class TambahKolomToleransiKeShift extends Migration
{
    public function up()
    {
        $this->forge->addColumn('shift', [
            'toleransi_terlambat' => [
                'type'       => 'INT',
                'constraint' => 11,
                'default'    => 0,
                'after'      => 'jam_selesai',
            ],
            'toleransi_sebelum' => [
                'type'       => 'INT',
                'constraint' => 11,
                'default'    => 0,
                'after'      => 'toleransi_terlambat',
            ],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('shift', ['toleransi_terlambat', 'toleransi_sebelum']);
    }
}
