<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class BuatTabelProdukKomposisi extends Migration
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
            'produk_induk_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
            ],
            'produk_bahan_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
            ],
            'jumlah' => [
                'type'       => 'DECIMAL',
                'constraint' => '15,2',
                'default'    => 1.00,
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
        $this->forge->addForeignKey('produk_induk_id', 'produk_jasa', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('produk_bahan_id', 'produk_jasa', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('produk_komposisi');
    }

    public function down()
    {
        $this->forge->dropTable('produk_komposisi');
    }
}
