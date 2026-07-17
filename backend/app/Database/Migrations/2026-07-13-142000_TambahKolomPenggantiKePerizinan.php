<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class TambahKolomPenggantiKePerizinan extends Migration
{
    public function up()
    {
        $fields = [
            'karyawan_pengganti_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
                'null'       => true,
                'after'      => 'karyawan_id', // letakkan setelah karyawan_id
            ],
        ];

        $this->forge->addColumn('perizinan', $fields);
        
        // Tambahkan foreign key constraint ke tabel users
        $this->db->query("ALTER TABLE perizinan ADD CONSTRAINT fk_perizinan_pengganti FOREIGN KEY (karyawan_pengganti_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE");
    }

    public function down()
    {
        $this->db->query("ALTER TABLE perizinan DROP FOREIGN KEY fk_perizinan_pengganti");
        $this->forge->dropColumn('perizinan', 'karyawan_pengganti_id');
    }
}
