<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class BuatTabelKriteriaPoin extends Migration
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
            'nama_kriteria' => [
                'type'       => 'VARCHAR',
                'constraint' => 100,
            ],
            'nilai_poin' => [
                'type'       => 'INT',
                'constraint' => 11,
            ],
            'is_otomatis' => [
                'type'       => 'TINYINT',
                'constraint' => 1,
                'default'    => 0,
            ],
            'kode_sistem' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => true,
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
        $this->forge->addForeignKey('usaha_id', 'usaha', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('kriteria_poin');
    }

    public function down()
    {
        $this->forge->dropTable('kriteria_poin');
    }
}
