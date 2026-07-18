<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddCuciKendaraanToUnitKategori extends Migration
{
    public function up()
    {
        $db = \Config\Database::connect();
        $db->query("ALTER TABLE unit MODIFY COLUMN kategori ENUM('kantin', 'billiard', 'rental_mobil', 'salon', 'multimedia', 'cuci_kendaraan') NULL");
    }

    public function down()
    {
        $db = \Config\Database::connect();
        $db->query("ALTER TABLE unit MODIFY COLUMN kategori ENUM('kantin', 'billiard', 'rental_mobil', 'salon', 'multimedia') NULL");
    }
}
