<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddPendiriToUsaha extends Migration
{
    public function up()
    {
        $fields = [
            'pendiri' => [
                'type'       => 'VARCHAR',
                'constraint' => 100,
                'null'       => true,
                'after'      => 'nama_usaha',
            ],
        ];
        $this->forge->addColumn('usaha', $fields);
    }

    public function down()
    {
        $this->forge->dropColumn('usaha', 'pendiri');
    }
}
