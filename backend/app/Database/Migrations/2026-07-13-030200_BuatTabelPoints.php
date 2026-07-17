<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class BuatTabelPoints extends Migration
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
            'karyawan_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
            ],
            'jumlah_poin' => [
                'type'       => 'INT',
                'constraint' => 11,
            ],
            'sumber' => [
                'type'       => 'VARCHAR',
                'constraint' => 30,
            ],
            'referensi_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'null'       => true,
            ],
            'pemberi_poin_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
                'null'       => true,
            ],
            'keterangan' => [
                'type' => 'TEXT',
            ],
            'tanggal' => [
                'type' => 'DATE',
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'updated_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
        ]);

        $this->forge->addKey('id', true);
        $this->forge->addForeignKey('karyawan_id', 'users', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('pemberi_poin_id', 'users', 'id', 'SET NULL', 'CASCADE');
        $this->forge->createTable('points');
    }

    public function down()
    {
        $this->forge->dropTable('points');
    }
}
