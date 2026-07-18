<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddStatusPengerjaanToTransaksiDetail extends Migration
{
    public function up()
    {
        $fields = [
            'status_pengerjaan' => [
                'type'       => 'ENUM',
                'constraint' => ['Menunggu', 'Dikerjakan', 'Selesai'],
                'default'    => 'Selesai',
                'null'       => false,
                'after'      => 'status_sewa',
            ],
        ];
        $this->forge->addColumn('transaksi_detail', $fields);
    }

    public function down()
    {
        $this->forge->dropColumn('transaksi_detail', 'status_pengerjaan');
    }
}
