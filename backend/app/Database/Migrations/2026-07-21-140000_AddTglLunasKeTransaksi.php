<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddTglLunasKeTransaksi extends Migration
{
    public function up()
    {
        $this->forge->addColumn('transaksi', [
            'tgl_lunas' => [
                'type' => 'DATETIME',
                'null' => true,
                'after' => 'status_pembayaran',
            ],
            'kasir_pelunasan_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
                'null'       => true,
                'after'      => 'tgl_lunas',
            ],
        ]);

        // Set tgl_lunas = created_at for existing lunas transactions
        $this->db->query("UPDATE transaksi SET tgl_lunas = created_at WHERE status_pembayaran = 'lunas' AND tgl_lunas IS NULL");
    }

    public function down()
    {
        $this->forge->dropColumn('transaksi', ['tgl_lunas', 'kasir_pelunasan_id']);
    }
}
