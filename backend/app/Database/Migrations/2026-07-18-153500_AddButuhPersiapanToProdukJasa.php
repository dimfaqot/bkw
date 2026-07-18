<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddButuhPersiapanToProdukJasa extends Migration
{
    public function up()
    {
        $fields = [
            'butuh_persiapan' => [
                'type'       => 'TINYINT',
                'constraint' => 1,
                'default'    => 0,
                'null'       => false,
                'after'      => 'is_stok_dikelola',
            ],
        ];
        $this->forge->addColumn('produk_jasa', $fields);
    }

    public function down()
    {
        $this->forge->dropColumn('produk_jasa', 'butuh_persiapan');
    }
}
