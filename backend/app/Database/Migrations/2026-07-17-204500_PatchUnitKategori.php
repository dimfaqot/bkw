<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class PatchUnitKategori extends Migration
{
    public function up()
    {
        $fields = [
            'kategori' => [
                'type'       => 'ENUM',
                'constraint' => ['kantin', 'billiard', 'rental_mobil', 'salon', 'multimedia'],
                'null'       => true, // Nullable di DB untuk backward-compatibility, tapi wajib diisi pada validasi form
            ],
        ];
        $this->forge->addColumn('unit', $fields);
    }

    public function down()
    {
        $this->forge->dropColumn('unit', 'kategori');
    }
}
