<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddPublicTokenToTransaksi extends Migration
{
    public function up()
    {
        $this->forge->addColumn('transaksi', [
            'public_token' => [
                'type'       => 'VARCHAR',
                'constraint' => 64,
                'null'       => true,
                'default'    => null,
                'after'      => 'nomor_invoice'
            ]
        ]);

        // Backfill token acak untuk transaksi lama yang sudah ada di database
        $db = \Config\Database::connect();
        $transaksi = $db->table('transaksi')->where('public_token', null)->get()->getResultArray();
        foreach ($transaksi as $tx) {
            $token = bin2hex(random_bytes(16));
            $db->table('transaksi')->where('id', $tx['id'])->update(['public_token' => $token]);
        }
    }

    public function down()
    {
        $this->forge->dropColumn('transaksi', 'public_token');
    }
}

