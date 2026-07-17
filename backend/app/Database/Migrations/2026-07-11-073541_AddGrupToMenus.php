<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddGrupToMenus extends Migration
{
    public function up()
    {
        $fields = [
            'grup' => [
                'type'       => 'VARCHAR',
                'constraint' => '50',
                'null'       => false,
                'default'    => 'Lainnya',
                'after'      => 'label',
            ],
        ];
        $this->forge->addColumn('menus', $fields);
    }

    public function down()
    {
        $this->forge->dropColumn('menus', 'grup');
    }
}
