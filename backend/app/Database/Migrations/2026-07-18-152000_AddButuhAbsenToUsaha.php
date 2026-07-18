<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddButuhAbsenToUsaha extends Migration
{
    public function up()
    {
        $fields = [
            'butuh_absen' => [
                'type'       => 'TINYINT',
                'constraint' => 1,
                'default'    => 1,
                'null'       => false,
                'after'      => 'no_izin',
            ],
        ];
        $this->forge->addColumn('usaha', $fields);
    }

    public function down()
    {
        $this->forge->dropColumn('usaha', 'butuh_absen');
    }
}
