<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class TambahKomisiDefaultProduk extends Migration
{
    public function up()
    {
        $this->forge->addColumn('produk_jasa', [
            'komisi_tipe' => [
                'type'       => "ENUM('persen','nominal')",
                'default'    => 'nominal',
                'null'       => false,
                'after'      => 'harga_jual',
            ],
            'komisi_nilai' => [
                'type'       => 'DECIMAL',
                'constraint' => '15,2',
                'default'    => 0.00,
                'null'       => false,
                'after'      => 'komisi_tipe',
            ]
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('produk_jasa', 'komisi_tipe');
        $this->forge->dropColumn('produk_jasa', 'komisi_nilai');
    }
}
