<?php

namespace App\Modules\Manajemen\Controllers;

use CodeIgniter\RESTful\ResourceController;
use CodeIgniter\API\ResponseTrait;

class KebersihanController extends ResourceController
{
    use ResponseTrait;

    protected $format = 'json';

    /**
     * GET /api/kebersihan/tugas
     * Meload daftar tugas kebersihan hari ini. Melakukan lazy-init jika belum ada.
     */
    public function ambilTugas()
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        if (!$penggunaAktif || $penggunaAktif['tipe'] !== 'final') {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Token tidak valid.'], 401);
        }

        $userId = $penggunaAktif['uid'];
        $usahaId = $penggunaAktif['usaha_id'] ?? null;
        if (empty($usahaId)) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Usaha tidak terasosiasi dengan akun Anda.'], 400);
        }

        $db = \Config\Database::connect();
        $nowTime = time();

        // 1. Tentukan tanggal bisnis aktif berdasarkan siklus shift (Opsi B) & Jeda (Dead Zone)
        $activeDate = $this->getActiveBusinessDate($usahaId, $nowTime);
        $nowStr = date('Y-m-d H:i:s', $nowTime);

        // 2. Query kebersihan_tugas untuk activeDate
        $tugas = $db->table('kebersihan_tugas kt')
                    ->select('kt.*, k.nama_area, k.jam_mulai, k.jam_selesai, u1.nama as nama_karyawan, u2.nama as nama_ditunjuk')
                    ->join('kebersihan k', 'k.id = kt.kebersihan_id')
                    ->join('users u1', 'u1.id = kt.karyawan_id', 'left')
                    ->join('users u2', 'u2.id = kt.ditunjuk_karyawan_id', 'left')
                    ->where('k.usaha_id', $usahaId)
                    ->where('kt.tanggal', $activeDate)
                    ->get()->getResultArray();

        // 3. Lazy Initialization: jika belum ada data tugas untuk tanggal bisnis ini, copy dari master kebersihan
        if (empty($tugas)) {
            $masterArea = $db->table('kebersihan')
                             ->where('usaha_id', $usahaId)
                             ->get()->getResultArray();

            if (!empty($masterArea)) {
                $now = date('Y-m-d H:i:s');
                $insertBatch = [];
                foreach ($masterArea as $ma) {
                    $insertBatch[] = [
                        'kebersihan_id'        => $ma['id'],
                        'tanggal'              => $activeDate,
                        'karyawan_id'          => null,
                        'ditunjuk_karyawan_id' => null,
                        'status'               => 'belum_dibersihkan',
                        'catatan_atasan'       => null,
                        'waktu_dibersihkan'    => null,
                        'waktu_diverifikasi'   => null,
                        'created_at'           => $now,
                        'updated_at'           => $now,
                    ];
                }
                $db->table('kebersihan_tugas')->insertBatch($insertBatch);

                // Ambil ulang data ter-init
                $tugas = $db->table('kebersihan_tugas kt')
                            ->select('kt.*, k.nama_area, k.jam_mulai, k.jam_selesai, u1.nama as nama_karyawan, u2.nama as nama_ditunjuk')
                            ->join('kebersihan k', 'k.id = kt.kebersihan_id')
                            ->join('users u1', 'u1.id = kt.karyawan_id', 'left')
                            ->join('users u2', 'u2.id = kt.ditunjuk_karyawan_id', 'left')
                            ->where('k.usaha_id', $usahaId)
                            ->where('kt.tanggal', $activeDate)
                            ->get()->getResultArray();
            }
        }

        // 4. Kalkulasi status waktu (belum_mulai, aktif, terlewat) untuk setiap tugas
        foreach ($tugas as &$t) {
            $jamMulai = $t['jam_mulai'];
            $jamSelesai = $t['jam_selesai'];
            
            // Format jam agar HH:MM saja
            $t['jam_mulai_formatted'] = substr($jamMulai, 0, 5);
            $t['jam_selesai_formatted'] = substr($jamSelesai, 0, 5);

            // Waktu mulai pengerjaan tugas pada activeDate
            $datetimeMulai = strtotime("{$activeDate} {$jamMulai}");

            if ($jamSelesai < $jamMulai) {
                // Jika lintas hari, selesai tugas adalah H+1 dari tanggal bisnis
                $datetimeSelesai = strtotime("{$activeDate} {$jamSelesai}") + 86400;
            } else {
                $datetimeSelesai = strtotime("{$activeDate} {$jamSelesai}");
            }

            if ($nowTime < $datetimeMulai) {
                $t['status_waktu'] = 'belum_mulai';
            } elseif ($nowTime >= $datetimeMulai && $nowTime <= $datetimeSelesai) {
                $t['status_waktu'] = 'aktif';
            } else {
                $t['status_waktu'] = 'terlewat';
            }
        }

        return $this->respond([
            'status'             => 'sukses',
            'tanggal_bisnis'     => $activeDate,
            'tanggal_bisnis_str' => date('d M Y', strtotime($activeDate)),
            'data'               => $tugas
        ]);
    }

    /**
     * POST /api/kebersihan/tugas/klaim/(:num)
     * Karyawan mengklaim telah membersihkan area.
     */
    public function klaimTugas($id)
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        if (!$penggunaAktif || $penggunaAktif['tipe'] !== 'final') {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Token tidak valid.'], 401);
        }

        $userId = $penggunaAktif['uid'];
        $usahaId = $penggunaAktif['usaha_id'] ?? null;
        $db = \Config\Database::connect();
        $nowTime = time();
        $now = date('Y-m-d H:i:s', $nowTime);

        // Ambil data tugas
        $tugas = $db->table('kebersihan_tugas kt')
                    ->select('kt.*, k.nama_area, k.jam_mulai, k.jam_selesai')
                    ->join('kebersihan k', 'k.id = kt.kebersihan_id')
                    ->where('kt.id', $id)
                    ->get()->getRow();

        if (!$tugas) {
            return $this->failNotFound('Data tugas kebersihan tidak ditemukan.');
        }

        // Rule 1: Jika sudah selesai tidak bisa diubah lagi
        if ($tugas->status === 'selesai') {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Tugas ini sudah selesai dan tidak dapat diubah lagi.'], 400);
        }

        // Proteksi Penunjukan: Jika didelegasikan ke orang lain, hanya yang ditunjuk yang bisa klaim
        if ($tugas->ditunjuk_karyawan_id !== null && (int)$tugas->ditunjuk_karyawan_id !== (int)$userId) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Tugas ini ditugaskan khusus untuk karyawan lain.'], 400);
        }

        // Rule Pengerjaan (Enforcement Waktu Ketat): Mulai jam_mulai s.d jam_selesai, tanpa toleransi
        $jamMulai = $tugas->jam_mulai;
        $jamSelesai = $tugas->jam_selesai;
        $activeDate = $tugas->tanggal;

        $datetimeMulai = strtotime("{$activeDate} {$jamMulai}");
        if ($jamSelesai < $jamMulai) {
            $datetimeSelesai = strtotime("{$activeDate} {$jamSelesai}") + 86400;
        } else {
            $datetimeSelesai = strtotime("{$activeDate} {$jamSelesai}");
        }

        if ($nowTime < $datetimeMulai) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Waktu pengerjaan tugas kebersihan belum dimulai.'], 400);
        }

        if ($nowTime > $datetimeSelesai) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Waktu pengerjaan tugas kebersihan sudah berakhir.'], 400);
        }

        // Update status
        $db->table('kebersihan_tugas')->where('id', $id)->update([
            'status'            => 'menunggu_verifikasi',
            'karyawan_id'       => $userId,
            'waktu_dibersihkan' => $now,
            'updated_at'        => $now
        ]);

        // Kirim Notifikasi ke Atasan
        $namaKaryawan = $penggunaAktif['nama'] ?? 'Karyawan';
        \App\Modules\Notification\Services\NotificationService::kirim(
            $usahaId,
            "Kebersihan: Menunggu Verifikasi",
            "{$namaKaryawan} selesai membersihkan area {$tugas->nama_area}. Menunggu verifikasi atasan.",
            "kebersihan_tugas"
        );

        return $this->respond([
            'status' => 'sukses',
            'pesan'  => 'Laporan kebersihan berhasil diajukan. Menunggu verifikasi atasan.'
        ]);
    }

    /**
     * POST /api/kebersihan/tugas/evaluasi/(:num)
     * Atasan memverifikasi tugas kebersihan (Setuju / Tolak)
     */
    public function evaluasiTugas($id)
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        if (!$penggunaAktif || $penggunaAktif['tipe'] !== 'final') {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Token tidak valid.'], 401);
        }

        // Otorisasi: Hanya atasan
        $role = strtolower($penggunaAktif['role'] ?? '');
        if (!in_array($role, ['root', 'owner', 'supervisor'])) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Anda tidak memiliki wewenang untuk mengevaluasi tugas.'], 403);
        }

        $atasanId = $penggunaAktif['uid'];
        $usahaId = $penggunaAktif['usaha_id'] ?? null;
        $input = $this->request->getJSON(true) ?: $this->request->getPost();
        $keputusan = $input['keputusan'] ?? ''; // 'bersih' atau 'tidak_bersih'
        $catatan = $input['catatan_atasan'] ?? '';

        if (!in_array($keputusan, ['bersih', 'tidak_bersih'])) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Keputusan evaluasi tidak valid.'], 400);
        }

        $db = \Config\Database::connect();
        $now = date('Y-m-d H:i:s');

        // Ambil data tugas
        $tugas = $db->table('kebersihan_tugas kt')
                    ->select('kt.*, k.nama_area')
                    ->join('kebersihan k', 'k.id = kt.kebersihan_id')
                    ->where('kt.id', $id)
                    ->get()->getRow();

        if (!$tugas) {
            return $this->failNotFound('Data tugas kebersihan tidak ditemukan.');
        }

        // Rule 1: Jika sudah selesai tidak bisa diubah lagi
        if ($tugas->status === 'selesai') {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Tugas ini sudah selesai dan tidak dapat diubah lagi.'], 400);
        }

        $karyawanId = $tugas->karyawan_id;
        if (empty($karyawanId)) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Belum ada karyawan yang membersihkan tugas ini.'], 400);
        }

        // Cari nama karyawan untuk detail notifikasi
        $karyawan = $db->table('users')->where('id', $karyawanId)->get()->getRow();
        $namaKaryawan = $karyawan ? $karyawan->nama : 'Karyawan';

        $db->transStart();

        if ($keputusan === 'bersih') {
            // Set status selesai
            $db->table('kebersihan_tugas')->where('id', $id)->update([
                'status'             => 'selesai',
                'catatan_atasan'     => $catatan,
                'waktu_diverifikasi' => $now,
                'updated_at'         => $now
            ]);

            // Ambil kriteria poin bersyukur/bersih
            $kriteria = $db->table('kriteria_poin')
                           ->where('usaha_id', $usahaId)
                           ->where('kode_sistem', 'KEBERSIHAN_BERSIH')
                           ->get()->getRow();

            $poin = $kriteria ? (int)$kriteria->nilai_poin : 10;

            // Berikan Poin
            $db->table('points')->insert([
                'karyawan_id'     => $karyawanId,
                'jumlah_poin'     => $poin,
                'sumber'          => 'kebersihan',
                'referensi_id'    => $id,
                'pemberi_poin_id' => $atasanId,
                'keterangan'      => "Kebersihan Bersih - Area: {$tugas->nama_area}",
                'tanggal'         => $tugas->tanggal,
                'created_at'      => $now,
                'updated_at'      => $now
            ]);

            // Kirim Notifikasi Berhasil
            $pesanNotif = "Area {$tugas->nama_area} diverifikasi BERSIH oleh {$penggunaAktif['nama']}. {$namaKaryawan} mendapat +{$poin} poin.";
            \App\Modules\Notification\Services\NotificationService::kirim($usahaId, "Kebersihan: Bersih (Disetujui)", $pesanNotif, "kebersihan_tugas");

        } else {
            // Set status tidak_bersih
            $db->table('kebersihan_tugas')->where('id', $id)->update([
                'status'             => 'tidak_bersih',
                'catatan_atasan'     => $catatan,
                'waktu_diverifikasi' => $now,
                'updated_at'         => $now
            ]);

            // Ambil kriteria poin denda kotor
            $kriteria = $db->table('kriteria_poin')
                           ->where('usaha_id', $usahaId)
                           ->where('kode_sistem', 'KEBERSIHAN_KOTOR')
                           ->get()->getRow();

            $denda = $kriteria ? (int)$kriteria->nilai_poin : -5;

            // Masukkan denda ke tabel points
            $db->table('points')->insert([
                'karyawan_id'     => $karyawanId,
                'jumlah_poin'     => $denda,
                'sumber'          => 'kebersihan',
                'referensi_id'    => $id,
                'pemberi_poin_id' => $atasanId,
                'keterangan'      => "Kebersihan Kotor (Denda) - Area: {$tugas->nama_area}",
                'tanggal'         => $tugas->tanggal,
                'created_at'      => $now,
                'updated_at'      => $now
            ]);

            // Kirim Notifikasi Ditolak/Denda
            $pesanNotif = "Area {$tugas->nama_area} dinyatakan TIDAK BERSIH oleh {$penggunaAktif['nama']}. {$namaKaryawan} dipotong denda {$denda} poin.";
            \App\Modules\Notification\Services\NotificationService::kirim($usahaId, "Kebersihan: Kotor (Ditolak)", $pesanNotif, "kebersihan_tugas");
        }

        $db->transComplete();

        if ($db->transStatus() === false) {
            return $this->fail('Gagal melakukan verifikasi tugas.');
        }

        return $this->respond([
            'status' => 'sukses',
            'pesan'  => 'Hasil evaluasi berhasil disimpan.'
        ]);
    }

    /**
     * POST /api/kebersihan/tugas/tunjuk/(:num)
     * Atasan menunjuk karyawan lain untuk membersihkan area
     */
    public function tunjukTugas($id)
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        if (!$penggunaAktif || $penggunaAktif['tipe'] !== 'final') {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Token tidak valid.'], 401);
        }

        // Otorisasi: Hanya atasan
        $role = strtolower($penggunaAktif['role'] ?? '');
        if (!in_array($role, ['root', 'owner', 'supervisor'])) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Anda tidak memiliki wewenang untuk menunjuk tugas.'], 403);
        }

        $usahaId = $penggunaAktif['usaha_id'] ?? null;
        $input = $this->request->getJSON(true) ?: $this->request->getPost();
        $ditunjukId = isset($input['ditunjuk_karyawan_id']) ? (int)$input['ditunjuk_karyawan_id'] : null;

        if (!$ditunjukId) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'ID karyawan yang ditunjuk harus diisi.'], 400);
        }

        $db = \Config\Database::connect();
        $now = date('Y-m-d H:i:s');

        // Ambil data tugas
        $tugas = $db->table('kebersihan_tugas kt')
                    ->select('kt.*, k.nama_area')
                    ->join('kebersihan k', 'k.id = kt.kebersihan_id')
                    ->where('kt.id', $id)
                    ->get()->getRow();

        if (!$tugas) {
            return $this->failNotFound('Data tugas kebersihan tidak ditemukan.');
        }

        // Rule 1: Jika sudah selesai tidak bisa diubah lagi
        if ($tugas->status === 'selesai') {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Tugas ini sudah selesai dan tidak dapat diubah lagi.'], 400);
        }

        // Cek apakah karyawan yang ditunjuk ada di database dan dalam usaha yang sama
        $karyawan = $db->table('users u')
                       ->join('user_role ur', 'ur.user_id = u.id')
                       ->where('u.id', $ditunjukId)
                       ->where('ur.usaha_id', $usahaId)
                       ->get()->getRow();

        if (!$karyawan) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Karyawan yang ditunjuk tidak valid atau tidak terdaftar di outlet Anda.'], 400);
        }

        // Reset status kembali ke belum_dibersihkan, hapus claimant lama, masukkan ditunjuk_karyawan_id
        $db->table('kebersihan_tugas')->where('id', $id)->update([
            'status'               => 'belum_dibersihkan',
            'karyawan_id'          => null,
            'ditunjuk_karyawan_id' => $ditunjukId,
            'catatan_atasan'       => null,
            'waktu_dibersihkan'    => null,
            'waktu_diverifikasi'   => null,
            'updated_at'           => $now
        ]);

        // Kirim Notifikasi ke Karyawan yang Ditunjuk
        \App\Modules\Notification\Services\NotificationService::kirim(
            $usahaId,
            "Kebersihan: Delegasi Tugas",
            "Atasan {$penggunaAktif['nama']} menunjuk Anda untuk membersihkan area {$tugas->nama_area}.",
            "kebersihan_tugas"
        );

        return $this->respond([
            'status' => 'sukses',
            'pesan'  => "Tugas berhasil didelegasikan kepada {$karyawan->nama}."
        ]);
    }

    /**
     * Helper untuk menghitung Tanggal Bisnis aktif.
     * Menggunakan logika Siklus B (berakhir tepat pada shift paling malam selesai).
     */
    private function getActiveBusinessDate($usahaId, $nowTime)
    {
        $today = date('Y-m-d', $nowTime);
        $yesterday = date('Y-m-d', strtotime('-1 day', $nowTime));
        
        $db = \Config\Database::connect();
        $shifts = $db->table('shift')->where('usaha_id', $usahaId)->get()->getResultArray();
        
        if (empty($shifts)) {
            return $today;
        }
        
        // 1. Cek apakah ada shift kemarin yang lintas hari dan masih aktif sekarang
        $kemarinAktif = false;
        foreach ($shifts as $s) {
            $jamMulai = $s['jam_mulai'];
            $jamSelesai = $s['jam_selesai'];
            $toleransiSebelum = (int)$s['toleransi_sebelum'];
            
            if ($jamSelesai < $jamMulai) {
                // Lintas hari
                $startMulaiYesterday = strtotime("$yesterday $jamMulai");
                $startSelesaiYesterday = strtotime("$today $jamSelesai");
                $batasMulaiYesterday = $startMulaiYesterday - ($toleransiSebelum * 60);
                
                if ($nowTime >= $batasMulaiYesterday && $nowTime <= $startSelesaiYesterday) {
                    $kemarinAktif = true;
                    break;
                }
            }
        }
        
        if ($kemarinAktif) {
            return $yesterday;
        }
        
        // 2. Cek apakah hari ini sudah dimulai (earliest shift window has opened)
        $earliestStartToday = null;
        foreach ($shifts as $s) {
            $jamMulai = $s['jam_mulai'];
            $toleransiSebelum = (int)$s['toleransi_sebelum'];
            
            $startMulaiToday = strtotime("$today $jamMulai");
            $batasMulaiToday = $startMulaiToday - ($toleransiSebelum * 60);
            
            if ($earliestStartToday === null || $batasMulaiToday < $earliestStartToday) {
                $earliestStartToday = $batasMulaiToday;
            }
        }
        
        if ($earliestStartToday !== null && $nowTime < $earliestStartToday) {
            return $yesterday;
        }
        
        return $today;
    }
}
