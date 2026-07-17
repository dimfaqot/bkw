<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class BuatTabelIot extends Migration
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
                'unsigned'   => true,
            ],
            'nama_perangkat' => [
                'type'       => 'VARCHAR',
                'constraint' => '100',
            ],
            'tipe_perangkat' => [
                'type'       => 'ENUM',
                'constraint' => ['billiard', 'android_tv', 'saklar_umum'],
                'default'    => 'saklar_umum',
            ],
            'ip_address' => [
                'type'       => 'VARCHAR',
                'constraint' => '45',
                'null'       => true,
            ],
            'status_relay' => [
                'type'       => 'TINYINT',
                'constraint' => 1,
                'default'    => 0,
            ],
            'status_penggunaan' => [
                'type'       => 'ENUM',
                'constraint' => ['tersedia', 'dipakai', 'gangguan'],
                'default'    => 'tersedia',
            ],
            'transaksi_aktif_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
                'null'       => true,
            ],
            'is_aktif' => [
                'type'       => 'TINYINT',
                'constraint' => 1,
                'default'    => 1,
            ],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addForeignKey('usaha_id', 'usaha', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('iot');
    }

    public function down()
    {
        $this->forge->dropTable('iot');
    }
}
