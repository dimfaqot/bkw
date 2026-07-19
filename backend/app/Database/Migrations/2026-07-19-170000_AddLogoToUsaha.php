<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddLogoToUsaha extends Migration
{
    public function up()
    {
        $this->forge->addColumn('usaha', [
            'logo' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => true,
                'after'      => 'no_izin',
            ]
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('usaha', 'logo');
    }
}
