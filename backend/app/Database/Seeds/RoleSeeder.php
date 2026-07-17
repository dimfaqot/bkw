<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run()
    {
        $data = [
            [
                'nama_role' => 'root',
                'deskripsi' => 'Root Super Admin - Akses penuh tanpa batasan untuk seluruh sistem'
            ],
            [
                'nama_role' => 'owner',
                'deskripsi' => 'Owner - Pemilik usaha, akses penuh dalam 1 usaha dan seluruh unit di bawahnya'
            ],
            [
                'nama_role' => 'supervisor',
                'deskripsi' => 'Supervisor - Mengatur dan memantau usaha dan unit di bawahnya'
            ],
            [
                'nama_role' => 'kasir',
                'deskripsi' => 'Kasir - Melakukan transaksi kasir untuk unit-unit di bawah usaha terkait'
            ],
            [
                'nama_role' => 'karyawan',
                'deskripsi' => 'Karyawan - Jika tanpa Unit, menjadi Karyawan Umum (lintas unit). Jika terikat Unit, menjadi Karyawan Khusus di Unit tersebut.'
            ],
            [
                'nama_role' => 'member',
                'deskripsi' => 'Member - Pelanggan global lintas usaha, dapat memesan atau melakukan booking'
            ],
        ];

        // Masukkan data satu persatu dan lewatkan jika nama_role sudah ada (untuk idempotensi seeder)
        $db = \Config\Database::connect();
        
        foreach ($data as $role) {
            $exists = $db->table('roles')->where('nama_role', $role['nama_role'])->countAllResults();
            if ($exists === 0) {
                $db->table('roles')->insert($role);
            }
        }

        // Migrasi Data dari karyawan_khusus/umum ke karyawan
        $karyawanBaru = $db->table('roles')->where('nama_role', 'karyawan')->get()->getRow();
        if ($karyawanBaru) {
            $karyawanUmum = $db->table('roles')->where('nama_role', 'karyawan_umum')->get()->getRow();
            $karyawanKhusus = $db->table('roles')->where('nama_role', 'karyawan_khusus')->get()->getRow();

            $idLama = [];
            if ($karyawanUmum) $idLama[] = $karyawanUmum->id;
            if ($karyawanKhusus) $idLama[] = $karyawanKhusus->id;

            if (!empty($idLama)) {
                // Update tabel relasi
                $db->table('user_role')->whereIn('role_id', $idLama)->update(['role_id' => $karyawanBaru->id]);
                // Hapus role lama
                $db->table('roles')->whereIn('id', $idLama)->delete();
            }
        }
    }
}
