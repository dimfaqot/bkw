<?php

namespace App\Modules\Notification\Controllers;

use CodeIgniter\RESTful\ResourceController;
use CodeIgniter\API\ResponseTrait;

class NotificationController extends ResourceController
{
    use ResponseTrait;

    protected $format = 'json';

    /**
     * POST /api/notifikasi/subscribe
     * Menyimpan subskripsi Web Push baru dari browser karyawan
     */
    public function subscribe()
    {
        $pengguna = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        if (!$pengguna) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Token tidak valid.'], 401);
        }

        $userId = $pengguna['uid'];
        $input = $this->request->getJSON(true) ?: $this->request->getPost();

        $endpoint = $input['endpoint'] ?? null;
        $p256dh = $input['keys']['p256dh'] ?? null;
        $auth = $input['keys']['auth'] ?? null;

        if (!$endpoint || !$p256dh || !$auth) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Parameter subskripsi tidak lengkap.'], 400);
        }

        $db = \Config\Database::connect();
        
        // Cari subskripsi yang ada dengan endpoint yang sama
        $existing = $db->table('push_subscriptions')
                       ->where('endpoint', $endpoint)
                       ->get()->getRow();

        $now = date('Y-m-d H:i:s');
        $data = [
            'karyawan_id' => $userId,
            'endpoint'    => $endpoint,
            'p256dh'      => $p256dh,
            'auth'        => $auth,
            'updated_at'  => $now
        ];

        if ($existing) {
            $db->table('push_subscriptions')
               ->where('id', $existing->id)
               ->update($data);
        } else {
            $data['created_at'] = $now;
            $db->table('push_subscriptions')->insert($data);
        }

        return $this->respond([
            'status' => 'sukses',
            'pesan'  => 'Subskripsi push berhasil didaftarkan.'
        ]);
    }

    /**
     * GET /api/notifikasi/ambil
     * Mengambil daftar riwayat notifikasi global cabang milik karyawan yang sedang login
     */
    public function ambilNotifikasi()
    {
        $pengguna = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        if (!$pengguna) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Token tidak valid.'], 401);
        }

        $userId = $pengguna['uid'];
        $usahaId = $pengguna['usaha_id'] ?? null;
        $db = \Config\Database::connect();

        // Fallback jika token JWT lama tidak menyimpan klaim usaha_id
        if (empty($usahaId)) {
            $roleAktif = $db->table('user_role')->where('user_id', $userId)->get()->getRow();
            $usahaId = $roleAktif ? $roleAktif->usaha_id : null;
        }

        // Tarik notifikasi cabang dengan left join pelacak baca untuk menentukan status baca secara dinamis
        $notifikasi = $db->table('notifikasi n')
                         ->select('n.*, CASE WHEN nb.id IS NOT NULL THEN 1 ELSE 0 END as is_dibaca', false)
                         ->join('notifikasi_baca nb', "nb.notifikasi_id = n.id AND nb.karyawan_id = {$userId}", 'left')
                         ->where('n.usaha_id', $usahaId)
                         ->orderBy('n.id', 'DESC')
                         ->limit(50)
                         ->get()->getResult();

        return $this->respond([
            'status' => 'sukses',
            'data'   => $notifikasi
        ]);
    }

    /**
     * POST /api/notifikasi/baca/(:num)
     * Menandai notifikasi cabang tertentu sebagai sudah dibaca oleh user bersangkutan
     */
    public function bacaNotifikasi($id)
    {
        $pengguna = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        if (!$pengguna) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Token tidak valid.'], 401);
        }

        $userId = $pengguna['uid'];
        $db = \Config\Database::connect();

        // Pastikan notifikasi ada
        $notif = $db->table('notifikasi')
                    ->where('id', $id)
                    ->get()->getRow();

        if (!$notif) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Notifikasi tidak ditemukan.'], 404);
        }

        // Cek apakah sudah pernah ditandai dibaca
        $sudahBaca = $db->table('notifikasi_baca')
                        ->where('karyawan_id', $userId)
                        ->where('notifikasi_id', $id)
                        ->countAllResults();

        if ($sudahBaca === 0) {
            $db->table('notifikasi_baca')->insert([
                'karyawan_id'   => $userId,
                'notifikasi_id' => $id,
                'created_at'    => date('Y-m-d H:i:s')
            ]);
        }

        return $this->respond([
            'status' => 'sukses',
            'pesan'  => 'Notifikasi ditandai sebagai dibaca.'
        ]);
    }

    /**
     * POST /api/notifikasi/baca-semua
     * Menandai semua notifikasi cabang sebagai sudah dibaca untuk user ini
     */
    public function bacaSemua()
    {
        $pengguna = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        if (!$pengguna) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Token tidak valid.'], 401);
        }

        $userId = $pengguna['uid'];
        $usahaId = $pengguna['usaha_id'] ?? null;
        $db = \Config\Database::connect();

        // Fallback jika token JWT lama tidak menyimpan klaim usaha_id
        if (empty($usahaId)) {
            $roleAktif = $db->table('user_role')->where('user_id', $userId)->get()->getRow();
            $usahaId = $roleAktif ? $roleAktif->usaha_id : null;
        }

        // Cari notifikasi cabang yang belum terdaftar di tabel notifikasi_baca milik user
        $unreads = $db->table('notifikasi n')
                      ->select('n.id')
                      ->join('notifikasi_baca nb', "nb.notifikasi_id = n.id AND nb.karyawan_id = {$userId}", 'left')
                      ->where('n.usaha_id', $usahaId)
                      ->where('nb.id IS NULL')
                      ->get()->getResult();

        $now = date('Y-m-d H:i:s');
        foreach ($unreads as $u) {
            $db->table('notifikasi_baca')->insert([
                'karyawan_id'   => $userId,
                'notifikasi_id' => $u->id,
                'created_at'    => $now
            ]);
        }

        return $this->respond([
            'status' => 'sukses',
            'pesan'  => 'Semua notifikasi ditandai sebagai dibaca.'
        ]);
    }
}
