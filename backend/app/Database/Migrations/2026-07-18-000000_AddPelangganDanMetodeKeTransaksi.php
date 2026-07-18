<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddPelangganDanMetodeKeTransaksi extends Migration
{
    public function up()
    {
        $this->forge->addColumn('transaksi', [
            'unit_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
                'after'      => 'usaha_id',
            ],
            'pelanggan_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
                'null'       => true,
                'after'      => 'kasir_id',
            ],
            'metode_pembayaran' => [
                'type'       => 'ENUM',
                'constraint' => ['cash', 'qris', 'tap'],
                'null'       => true,
                'after'      => 'status_pembayaran',
            ],
        ]);

        // Tambah foreign key secara manual agar kompatibel dengan penambahan kolom
        $this->db->query("ALTER TABLE transaksi ADD CONSTRAINT fk_transaksi_unit FOREIGN KEY (unit_id) REFERENCES unit(id) ON DELETE CASCADE ON UPDATE CASCADE");
        $this->db->query("ALTER TABLE transaksi ADD CONSTRAINT fk_transaksi_pelanggan FOREIGN KEY (pelanggan_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE");
    }

    public function down()
    {
        try {
            $this->db->query("ALTER TABLE transaksi DROP FOREIGN KEY fk_transaksi_unit");
        } catch (\Exception $e) {}
        
        try {
            $this->db->query("ALTER TABLE transaksi DROP FOREIGN KEY fk_transaksi_pelanggan");
        } catch (\Exception $e) {}

        $this->forge->dropColumn('transaksi', ['unit_id', 'pelanggan_id', 'metode_pembayaran']);
    }
}
