<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class UpdateArsitekturNotifikasi extends Migration
{
    public function up()
    {
        $db = \Config\Database::connect();
        
        // Bersihkan data lama di tabel notifikasi agar tidak bentrok dengan skema baru
        $db->table('notifikasi')->truncate();

        // 1. Hapus Foreign Key constraint terlebih dahulu
        // Gunakan query langsung karena dropForeignKey di CI Forge terkadang bermasalah pada engine MySQL tertentu
        $db->query("ALTER TABLE `notifikasi` DROP FOREIGN KEY `notifikasi_karyawan_id_foreign`");

        // 2. Modifikasi Tabel `notifikasi`
        $this->forge->dropColumn('notifikasi', 'karyawan_id');
        $this->forge->dropColumn('notifikasi', 'is_dibaca');

        // Tambahkan kolom usaha_id
        $fields = [
            'usaha_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
                'null'       => true,
                'after'      => 'id'
            ]
        ];
        $this->forge->addColumn('notifikasi', $fields);

        // 3. Buat Tabel Pelacak `notifikasi_baca`
        $this->forge->addField([
            'id' => [
                'type'           => 'INT',
                'constraint'     => 11,
                'unsigned'       => true,
                'auto_increment' => true
            ],
            'karyawan_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true
            ],
            'notifikasi_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => true
            ]
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey(['karyawan_id', 'notifikasi_id']);
        $this->forge->createTable('notifikasi_baca');
    }

    public function down()
    {
        $this->forge->dropTable('notifikasi_baca');
        $this->forge->dropColumn('notifikasi', 'usaha_id');

        $fields = [
            'karyawan_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
                'after'      => 'id'
            ],
            'is_dibaca' => [
                'type'       => 'TINYINT',
                'constraint' => 1,
                'default'    => 0,
                'after'      => 'tautan'
            ]
        ];
        $this->forge->addColumn('notifikasi', $fields);
        
        $db = \Config\Database::connect();
        $db->query("ALTER TABLE `notifikasi` ADD CONSTRAINT `notifikasi_karyawan_id_foreign` FOREIGN KEY (`karyawan_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE");
    }
}
