<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class RevertToRolePermissions extends Migration
{
    public function up()
    {
        // 1. Recreate role_permissions table
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
        // Cascade on delete ensures permissions are deleted when a role or menu is deleted
        $this->forge->addForeignKey('role_id', 'roles', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('menu_id', 'menus', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('role_permissions', true);

        // 2. Drop role_akses from menus
        if ($this->db->fieldExists('role_akses', 'menus')) {
            $this->forge->dropColumn('menus', 'role_akses');
        }
    }

    public function down()
    {
        // Add back role_akses to menus
        if (!$this->db->fieldExists('role_akses', 'menus')) {
            $fields = [
                'role_akses' => [
                    'type'       => 'TEXT',
                    'null'       => true,
                ],
            ];
            $this->forge->addColumn('menus', $fields);
        }

        // Drop role_permissions
        $this->forge->dropTable('role_permissions', true);
    }
}
