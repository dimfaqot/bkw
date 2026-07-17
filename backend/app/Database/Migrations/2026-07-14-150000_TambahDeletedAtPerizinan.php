<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class TambahDeletedAtPerizinan extends Migration
{
    public function up()
    {
        $fields = [
            'deleted_at' => [
                'type' => 'DATETIME',
                'null' => true,
                'after' => 'updated_at',
            ],
        ];

        $this->forge->addColumn('perizinan', $fields);
    }

    public function down()
    {
        $this->forge->dropColumn('perizinan', 'deleted_at');
    }
}
