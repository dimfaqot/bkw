<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddTipeBillingToTransaksiDetail extends Migration
{
    public function up()
    {
        $this->forge->addColumn('transaksi_detail', [
            'tipe_billing' => [
                'type'       => 'VARCHAR',
                'constraint' => 10,
                'null'       => true,
                'default'    => null,
                'after'      => 'subtotal'
            ]
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('transaksi_detail', 'tipe_billing');
    }
}

