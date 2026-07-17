<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class DropRolePermissionsAndAddRoleAkses extends Migration
{
    public function up()
    {
        // 1. Drop role_permissions table
        $this->forge->dropTable('role_permissions', true);

        // 2. Add role_akses column to menus
        $fields = [
            'role_akses' => [
                'type'       => 'TEXT',
                'null'       => true,
                'after'      => 'grup',
            ],
        ];
        $this->forge->addColumn('menus', $fields);
    }

    public function down()
    {
        // Drop role_akses column from menus
        $this->forge->dropColumn('menus', 'role_akses');

        // Recreate role_permissions table
        $this->forge->addField([
            'id' => [
                'type' => 'INT',
                'constraint' => 11,
                'unsigned' => true,
                'auto_increment' => true,
            ],
            'role_id' => [
                'type' => 'INT',
                'constraint' => 11,
                'unsigned' => true,
            ],
            'menu_id' => [
                'type' => 'INT',
                'constraint' => 11,
                'unsigned' => true,
            ],
            'can_read' => [
                'type' => 'TINYINT',
                'constraint' => 1,
                'default' => 0,
            ],
            'can_create' => [
                'type' => 'TINYINT',
                'constraint' => 1,
                'default' => 0,
            ],
            'can_update' => [
                'type' => 'TINYINT',
                'constraint' => 1,
                'default' => 0,
            ],
            'can_delete' => [
                'type' => 'TINYINT',
                'constraint' => 1,
                'default' => 0,
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
        $this->forge->addForeignKey('role_id', 'roles', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('menu_id', 'menus', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('role_permissions');
    }
}
