<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class BuatTabelPerizinan extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id' => [
                'type'           => 'INT',
                'constraint'     => 11,
                'unsigned'       => true,
                'auto_increment' => true,
            ],
            'karyawan_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
            ],
            'jenis_izin' => [
                'type'       => 'ENUM',
                'constraint' => ['izin', 'sakit'],
                'default'    => 'izin',
            ],
            'tanggal_mulai' => [
                'type' => 'DATE',
            ],
            'tanggal_selesai' => [
                'type' => 'DATE',
            ],
            'alasan' => [
                'type' => 'TEXT',
            ],
            'dokumen_bukti' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => true,
            ],
            'status' => [
                'type'       => 'ENUM',
                'constraint' => ['diajukan', 'disetujui', 'ditolak'],
                'default'    => 'diajukan',
            ],
            'disetujui_oleh' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
                'null'       => true,
            ],
            'catatan_atasan' => [
                'type' => 'TEXT',
                'null' => true,
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
        $this->forge->addForeignKey('karyawan_id', 'users', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('disetujui_oleh', 'users', 'id', 'SET NULL', 'CASCADE');
        $this->forge->createTable('perizinan');
    }

    public function down()
    {
        $this->forge->dropTable('perizinan');
    }
}
