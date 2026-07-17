<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class BuatTabelJadwalKaryawan extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id' => [
                'type'           => 'INT',
                'constraint'     => 11,
                'unsigned'       => true,
                'auto_increment' => true,
            ],
            'usaha_id' => [
                'type'       => 'INT',
                'constraint' => 11,
            ],
            'karyawan_id' => [
                'type'       => 'INT',
                'constraint' => 11,
            ],
            'shift_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'null'       => true,
            ],
            'tanggal' => [
                'type' => 'DATE',
            ],
            'is_lembur' => [
                'type'       => 'TINYINT',
                'constraint' => 1,
                'default'    => 0,
            ],
            'jam_mulai' => [
                'type' => 'TIME',
                'null' => true,
            ],
            'jam_selesai' => [
                'type' => 'TIME',
                'null' => true,
            ],
            'original_karyawan_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'null'       => true,
            ],
        ]);

        $this->forge->addKey('id', true);
        $this->forge->addKey(['usaha_id', 'karyawan_id', 'tanggal']);
        $this->forge->createTable('jadwal_karyawan');
    }

    public function down()
    {
        $this->forge->dropTable('jadwal_karyawan');
    }
}
