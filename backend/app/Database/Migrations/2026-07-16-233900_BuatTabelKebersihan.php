<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class BuatTabelKebersihan extends Migration
{
    public function up()
    {
        // 1. Tabel `kebersihan` (Master)
        $this->forge->addField([
            'id' => [
                'type'           => 'INT',
                'constraint'     => 11,
                'unsigned'       => true,
                'auto_increment' => true,
            ],
            'usaha_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
            ],
            'nama_area' => [
                'type'       => 'VARCHAR',
                'constraint' => 100,
            ],
            'jam_mulai' => [
                'type' => 'TIME',
            ],
            'jam_selesai' => [
                'type' => 'TIME',
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
        $this->forge->addForeignKey('usaha_id', 'usaha', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('kebersihan');

        // 2. Tabel `kebersihan_tugas` (Transaksi Harian)
        $this->forge->addField([
            'id' => [
                'type'           => 'INT',
                'constraint'     => 11,
                'unsigned'       => true,
                'auto_increment' => true,
            ],
            'kebersihan_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
            ],
            'tanggal' => [
                'type' => 'DATE',
            ],
            'karyawan_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
                'null'       => true,
            ],
            'ditunjuk_karyawan_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
                'null'       => true,
            ],
            'status' => [
                'type'       => 'ENUM',
                'constraint' => ['belum_dibersihkan', 'menunggu_verifikasi', 'selesai', 'tidak_bersih'],
                'default'    => 'belum_dibersihkan',
            ],
            'catatan_atasan' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => true,
            ],
            'waktu_dibersihkan' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'waktu_diverifikasi' => [
                'type' => 'DATETIME',
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
        $this->forge->addForeignKey('kebersihan_id', 'kebersihan', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('karyawan_id', 'users', 'id', 'SET NULL', 'CASCADE');
        $this->forge->addForeignKey('ditunjuk_karyawan_id', 'users', 'id', 'SET NULL', 'CASCADE');
        $this->forge->createTable('kebersihan_tugas');
    }

    public function down()
    {
        $this->forge->dropTable('kebersihan_tugas', true);
        $this->forge->dropTable('kebersihan', true);
    }
}
