<?php

namespace App\Modules\Manajemen\Controllers;

use CodeIgniter\RESTful\ResourceController;

class Lembur extends ResourceController
{
    protected $format = 'json';

    // 1. POST /api/lembur/terima/{id}
    public function terima($id)
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        $userId = $penggunaAktif['uid'];

        $db = \Config\Database::connect();
        
        // Pastikan lembur ditunjuk untuk user ini
        $lembur = $db->table('lembur')
            ->where('id', $id)
            ->where('karyawan_id', $userId)
            ->get()->getRow();

        if (!$lembur) {
            return $this->failNotFound('Data penugasan lembur tidak ditemukan atau bukan milik Anda.');
        }

        if ($lembur->status !== 'ditunjuk') {
            return $this->respond([
                'status' => 'gagal',
                'pesan'  => 'Gagal! Tugas lembur ini sudah direspon sebelumnya.'
            ], 400);
        }

        $db->table('lembur')->where('id', $id)->update([
            'status'     => 'diterima_karyawan',
            'updated_at' => date('Y-m-d H:i:s')
        ]);

        return $this->respond([
            'status' => 'sukses',
            'pesan'  => 'Tugas lembur berhasil Anda terima!'
        ]);
    }

    // 2. POST /api/lembur/tolak/{id}
    public function tolak($id)
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        $userId = $penggunaAktif['uid'];

        $db = \Config\Database::connect();

        // Pastikan lembur ditunjuk untuk user ini
        $lembur = $db->table('lembur')
            ->where('id', $id)
            ->where('karyawan_id', $userId)
            ->get()->getRow();

        if (!$lembur) {
            return $this->failNotFound('Data penugasan lembur tidak ditemukan atau bukan milik Anda.');
        }

        if ($lembur->status !== 'ditunjuk') {
            return $this->respond([
                'status' => 'gagal',
                'pesan'  => 'Gagal! Tugas lembur ini sudah direspon sebelumnya.'
            ], 400);
        }

        $input = $this->request->getJSON(true) ?: $this->request->getPost();
        $alasan = $input['catatan_penolakan'] ?? 'Ditolak oleh karyawan';

        $db->table('lembur')->where('id', $id)->update([
            'status'            => 'ditolak_karyawan',
            'catatan_penolakan' => $alasan,
            'updated_at'        => date('Y-m-d H:i:s')
        ]);

        return $this->respond([
            'status' => 'sukses',
            'pesan'  => 'Tugas lembur telah Anda tolak.'
        ]);
    }
}
