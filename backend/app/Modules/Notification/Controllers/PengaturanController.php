<?php

namespace App\Modules\Notification\Controllers;

use CodeIgniter\RESTful\ResourceController;
use CodeIgniter\API\ResponseTrait;

class PengaturanController extends ResourceController
{
    use ResponseTrait;

    protected $format = 'json';

    /**
     * GET /api/pengaturan/notifikasi
     * Mengambil daftar pengaturan sakelar notifikasi
     */
    public function ambilPengaturan()
    {
        $pengguna = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        if (!$pengguna) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Token tidak valid.'], 401);
        }

        $userId = $pengguna['uid'];
        $usahaId = $pengguna['usaha_id'] ?? null;
        $roleId = $pengguna['role_id'] ?? null;
        $db = \Config\Database::connect();

        // 1. Verifikasi hak akses dinamis berdasarkan role_permissions database
        if ($roleId) {
            $hasPermission = $db->table('role_permissions rp')
                                ->join('menus m', 'm.id = rp.menu_id')
                                ->where('rp.role_id', $roleId)
                                ->where('m.url', 'pengaturan_notifikasi')
                                ->where('rp.can_read', 1)
                                ->where('rp.is_aktif', 1)
                                ->get()->getRow();
            if (!$hasPermission) {
                return $this->respond(['status' => 'gagal', 'pesan' => 'Anda tidak memiliki hak akses untuk melihat pengaturan ini.'], 403);
            }
        } else {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Role tidak terdefinisi.'], 403);
        }

        // Fallback jika token JWT lama tidak menyimpan klaim usaha_id
        if (empty($usahaId)) {
            $roleAktif = $db->table('user_role')->where('user_id', $userId)->get()->getRow();
            $usahaId = $roleAktif ? $roleAktif->usaha_id : null;
        }

        // 1. Ambil pengaturan default sistem (usaha_id IS NULL)
        $defaults = $db->table('pengaturan_notifikasi')
                       ->where('usaha_id', null)
                       ->get()->getResultArray();

        // 2. Jika user terikat ke usaha tertentu, ambil atau buat pengaturan kustom usaha tersebut
        $dataPengaturan = [];
        if ($usahaId !== null) {
            foreach ($defaults as $d) {
                $kustom = $db->table('pengaturan_notifikasi')
                             ->where('usaha_id', $usahaId)
                             ->where('kunci', $d['kunci'])
                             ->get()->getRow();

                if ($kustom) {
                    $dataPengaturan[] = [
                        'kunci'     => $d['kunci'],
                        'nilai'     => (int)$kustom->nilai,
                        'deskripsi' => $d['deskripsi']
                    ];
                } else {
                    // Masukkan setting default sebagai kustom untuk cabang ini agar ke depan tinggal diupdate
                    $now = date('Y-m-d H:i:s');
                    $db->table('pengaturan_notifikasi')->insert([
                        'usaha_id'   => $usahaId,
                        'kunci'      => $d['kunci'],
                        'nilai'      => $d['nilai'],
                        'deskripsi'  => $d['deskripsi'],
                        'created_at' => $now,
                        'updated_at' => $now
                    ]);
                    $dataPengaturan[] = [
                        'kunci'     => $d['kunci'],
                        'nilai'     => (int)$d['nilai'],
                        'deskripsi' => $d['deskripsi']
                    ];
                }
            }
        } else {
            // Jika root/tanpa usaha (global), kembalikan default sistem
            foreach ($defaults as $d) {
                $dataPengaturan[] = [
                    'kunci'     => $d['kunci'],
                    'nilai'     => (int)$d['nilai'],
                    'deskripsi' => $d['deskripsi']
                ];
            }
        }

        return $this->respond([
            'status' => 'sukses',
            'data'   => $dataPengaturan
        ]);
    }

    /**
     * POST /api/pengaturan/notifikasi/simpan
     * Menyimpan pembaruan nilai sakelar notifikasi
     */
    public function simpanPengaturan()
    {
        $pengguna = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        if (!$pengguna) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Token tidak valid.'], 401);
        }

        $userId = $pengguna['uid'];
        $usahaId = $pengguna['usaha_id'] ?? null;
        $roleId = $pengguna['role_id'] ?? null;
        $db = \Config\Database::connect();

        // Verifikasi hak akses dinamis berdasarkan role_permissions database
        if ($roleId) {
            $hasPermission = $db->table('role_permissions rp')
                                ->join('menus m', 'm.id = rp.menu_id')
                                ->where('rp.role_id', $roleId)
                                ->where('m.url', 'pengaturan_notifikasi')
                                ->where('rp.can_update', 1)
                                ->where('rp.is_aktif', 1)
                                ->get()->getRow();
            if (!$hasPermission) {
                return $this->respond(['status' => 'gagal', 'pesan' => 'Anda tidak memiliki hak akses untuk mengubah pengaturan ini.'], 403);
            }
        } else {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Role tidak terdefinisi.'], 403);
        }

        if (empty($usahaId)) {
            $roleAktif = $db->table('user_role')->where('user_id', $userId)->get()->getRow();
            $usahaId = $roleAktif ? $roleAktif->usaha_id : null;
        }

        $input = $this->request->getJSON(true) ?: $this->request->getPost();
        $settings = $input['settings'] ?? []; // Array key-value: ['kunci' => nilai]

        if (empty($settings) || !is_array($settings)) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Data pengaturan tidak lengkap.'], 400);
        }

        $now = date('Y-m-d H:i:s');
        foreach ($settings as $kunci => $nilai) {
            $nilaiInt = $nilai ? 1 : 0;

            if ($usahaId !== null) {
                // Simpan atau update setting spesifik usaha
                $existing = $db->table('pengaturan_notifikasi')
                               ->where('usaha_id', $usahaId)
                               ->where('kunci', $kunci)
                               ->get()->getRow();

                if ($existing) {
                    $db->table('pengaturan_notifikasi')
                       ->where('id', $existing->id)
                       ->update([
                           'nilai'      => $nilaiInt,
                           'updated_at' => $now
                       ]);
                } else {
                    // Cari deskripsi dari default sistem
                    $def = $db->table('pengaturan_notifikasi')
                              ->where('usaha_id', null)
                              ->where('kunci', $kunci)
                              ->get()->getRow();
                    $desc = $def ? $def->deskripsi : 'Pengaturan notifikasi kustom';

                    $db->table('pengaturan_notifikasi')->insert([
                        'usaha_id'   => $usahaId,
                        'kunci'      => $kunci,
                        'nilai'      => $nilaiInt,
                        'deskripsi'  => $desc,
                        'created_at' => $now,
                        'updated_at' => $now
                    ]);
                }
            } else {
                // Jika root murni mengupdate default sistem (global)
                $db->table('pengaturan_notifikasi')
                   ->where('usaha_id', null)
                   ->where('kunci', $kunci)
                   ->update([
                       'nilai'      => $nilaiInt,
                       'updated_at' => $now
                   ]);
            }
        }

        return $this->respond([
            'status' => 'sukses',
            'pesan'  => 'Pengaturan notifikasi berhasil disimpan.'
        ]);
    }
}
