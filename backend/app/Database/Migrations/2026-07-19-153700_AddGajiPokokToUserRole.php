<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddGajiPokokToUserRole extends Migration
{
    public function up()
    {
        $fields = [
            'gaji_pokok' => [
                'type'       => 'DECIMAL',
                'constraint' => '15,2',
                'default'    => 0.00,
                'null'       => false,
                'after'      => 'role_id',
            ],
        ];
        $this->forge->addColumn('user_role', $fields);
    }

    public function down()
    {
        $this->forge->dropColumn('user_role', 'gaji_pokok');
    }
}
