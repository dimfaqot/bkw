<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class BuatTabelPengaturanNotifikasi extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id' => [
                'type'           => 'INT',
                'constraint'     => 11,
                'unsigned'       => true,
                'auto_increment' => true
            ],
            'usaha_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
                'null'       => true
            ],
            'kunci' => [
                'type'       => 'VARCHAR',
                'constraint' => 100
            ],
            'nilai' => [
                'type'       => 'TINYINT',
                'constraint' => 1,
                'default'    => 1
            ],
            'deskripsi' => [
                'type'       => 'VARCHAR',
                'constraint' => 255
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => true
            ],
            'updated_at' => [
                'type' => 'DATETIME',
                'null' => true
            ]
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey(['usaha_id', 'kunci']);
        $this->forge->createTable('pengaturan_notifikasi');
    }

    public function down()
    {
        $this->forge->dropTable('pengaturan_notifikasi');
    }
}
