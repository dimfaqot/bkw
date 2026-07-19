<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddIotIdToProdukJasa extends Migration
{
    public function up()
    {
        // 1. Add iot_id to produk_jasa
        $this->forge->addColumn('produk_jasa', [
            'iot_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
                'null'       => true,
                'after'      => 'unit_id',
            ]
        ]);

        // 2. Add billing columns to iot_alokasi
        $this->forge->addColumn('iot_alokasi', [
            'prepaid_durasi_menit' => [
                'type'       => 'INT',
                'constraint' => 11,
                'null'       => true,
                'after'      => 'transaksi_aktif_id',
            ],
            'waktu_mulai' => [
                'type'       => 'DATETIME',
                'null'       => true,
                'after'      => 'prepaid_durasi_menit',
            ],
            'warning_sent' => [
                'type'       => 'TINYINT',
                'constraint' => 1,
                'default'    => 0,
                'null'       => false,
                'after'      => 'waktu_mulai',
            ]
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('produk_jasa', 'iot_id');
        $this->forge->dropColumn('iot_alokasi', 'prepaid_durasi_menit');
        $this->forge->dropColumn('iot_alokasi', 'waktu_mulai');
        $this->forge->dropColumn('iot_alokasi', 'warning_sent');
    }
}
