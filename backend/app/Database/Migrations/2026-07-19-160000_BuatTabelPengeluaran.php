<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class BuatTabelPengeluaran extends Migration
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
            'usaha_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
            ],
            'unit_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
                'null'       => true,
            ],
            'kategori' => [
                'type'       => 'ENUM',
                'constraint' => ['Gaji', 'Bahan Baku', 'Inv', 'Operasional', 'Lain-lain'],
                'default'    => 'Operasional',
            ],
            'deskripsi_keperluan' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => true,
            ],
            'keterangan' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            'karyawan_gaji_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
                'null'       => true,
            ],
            'produk_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
                'null'       => true,
            ],
            'qty' => [
                'type'       => 'INT',
                'constraint' => 11,
                'null'       => true,
            ],
            'harga_satuan' => [
                'type'       => 'DECIMAL',
                'constraint' => '15,2',
                'default'    => 0.00,
            ],
            'diskon' => [
                'type'       => 'DECIMAL',
                'constraint' => '15,2',
                'default'    => 0.00,
            ],
            'nominal_total' => [
                'type'       => 'DECIMAL',
                'constraint' => '15,2',
                'default'    => 0.00,
            ],
            'pencatat_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
            ],
            'penanggung_jawab_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
                'null'       => true,
            ],
            'tanggal' => [
                'type' => 'DATE',
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
        $this->forge->addForeignKey('unit_id', 'unit', 'id', 'SET NULL', 'CASCADE');
        $this->forge->addForeignKey('karyawan_gaji_id', 'users', 'id', 'SET NULL', 'CASCADE');
        $this->forge->addForeignKey('produk_id', 'produk_jasa', 'id', 'SET NULL', 'CASCADE');
        $this->forge->addForeignKey('pencatat_id', 'users', 'id', 'RESTRICT', 'CASCADE');
        $this->forge->addForeignKey('penanggung_jawab_id', 'users', 'id', 'SET NULL', 'CASCADE');
        $this->forge->createTable('pengeluaran');
    }

    public function down()
    {
        $this->forge->dropTable('pengeluaran');
    }
}
