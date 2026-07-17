<?php

namespace App\Modules\Absen\Controllers;

use CodeIgniter\RESTful\ResourceController;
use CodeIgniter\API\ResponseTrait;

/**
 * Controller Absensi Mandiri
 * 
 * Endpoint ini diakses langsung oleh karyawan untuk absen masuk/pulang.
 * Tidak melalui sistem CRUD role_permissions, hanya butuh JWT yang valid.
 * Semua data karyawan diambil dari token JWT (bukan dari input frontend).
 */
class Absen extends ResourceController
{
    use ResponseTrait;

    protected $format = 'json';

    /**
     * POST /api/absen/masuk
     * Merekam absen masuk karyawan yang sedang login.
     */
    public function masuk()
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();

        if (!$penggunaAktif || $penggunaAktif['tipe'] !== 'final') {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Token tidak valid atau bukan token final.'], 401);
        }

        $userId   = $penggunaAktif['uid'];
        $usahaId  = $penggunaAktif['usaha_id'] ?? null;
        $db       = \Config\Database::connect();

        $input = $this->request->getJSON(true) ?: $this->request->getPost();
        $lemburId = isset($input['lembur_id']) && $input['lembur_id'] ? (int)$input['lembur_id'] : null;
        $jadwalId = isset($input['jadwal_karyawan_id']) && $input['jadwal_karyawan_id'] ? (int)$input['jadwal_karyawan_id'] : null;

        $today = date('Y-m-d');

        // Proteksi: Cegah absen masuk jika waktu shift/lembur hari ini belum dimulai atau telah berakhir
        if ($jadwalId) {
            $jk = $db->table('jadwal_karyawan jk')
                     ->select('s.jam_mulai, s.jam_selesai, s.toleransi_sebelum')
                     ->join('shift s', 's.id = jk.shift_id')
                     ->where('jk.id', $jadwalId)
                     ->get()->getRow();
            if ($jk) {
                $jamMulaiShift = $jk->jam_mulai;
                $jamSelesaiShift = $jk->jam_selesai;
                $toleransiSebelum = (int)$jk->toleransi_sebelum; // dalam menit
                
                $dateToday = date('Y-m-d');
                $dateYesterday = date('Y-m-d', strtotime('-1 day'));
                $sekarangTime = time();

                // 1. Tentukan apakah waktu sekarang masuk ke dalam jendela shift hari kemarin (jika lintas hari)
                $hariIni = $dateToday;

                if ($jamSelesaiShift < $jamMulaiShift) {
                    // Shift lintas hari kemarin
                    $startMulaiYesterday = strtotime("$dateYesterday $jamMulaiShift");
                    $startSelesaiYesterday = strtotime("$dateToday $jamSelesaiShift");
                    $batasMulaiYesterday = $startMulaiYesterday - ($toleransiSebelum * 60);

                    if ($sekarangTime >= $batasMulaiYesterday && $sekarangTime <= $startSelesaiYesterday) {
                        $hariIni = $dateYesterday;
                    }
                }

                // 2. Kalkulasi waktu mulai & selesai berdasarkan $hariIni bisnis yang terpilih
                $datetimeMulai = strtotime("$hariIni $jamMulaiShift");
                if ($jamSelesaiShift < $jamMulaiShift) {
                    // Jika lintas hari, selesai shift adalah tanggal bisnis + 1 hari (+86400)
                    $datetimeSelesai = strtotime("$hariIni $jamSelesaiShift") + 86400;
                } else {
                    $datetimeSelesai = strtotime("$hariIni $jamSelesaiShift");
                }

                $batasAwalMasuk = $datetimeMulai - ($toleransiSebelum * 60);

                if ($sekarangTime < $batasAwalMasuk) {
                    return $this->respond([
                        'status' => 'gagal',
                        'pesan'  => 'Absen masuk ditolak karena waktu shift kerja belum dimulai.'
                    ], 400);
                }

                if ($sekarangTime > $datetimeSelesai) {
                    return $this->respond([
                        'status' => 'gagal',
                        'pesan'  => 'Absen masuk ditolak karena waktu shift kerja hari ini telah berakhir.'
                    ], 400);
                }
            }
        }

        if ($lemburId) {
            $lem = $db->table('lembur')
                      ->where('id', $lemburId)
                      ->get()->getRow();
            if ($lem) {
                $jamMulaiLembur = $lem->jam_mulai;
                $jamSelesaiLembur = $lem->jam_selesai;
                $tanggalLembur = $lem->tanggal;
                
                $datetimeMulai = strtotime("$tanggalLembur $jamMulaiLembur");
                if ($jamSelesaiLembur < $jamMulaiLembur) {
                    $datetimeSelesai = strtotime("$tanggalLembur $jamSelesaiLembur") + 86400;
                } else {
                    $datetimeSelesai = strtotime("$tanggalLembur $jamSelesaiLembur");
                }
                
                $sekarangTime = time();

                // Batas awal lembur (toleransi default 120 menit)
                $batasAwalMasuk = $datetimeMulai - (120 * 60);

                if ($sekarangTime < $batasAwalMasuk) {
                    return $this->respond([
                        'status' => 'gagal',
                        'pesan'  => 'Absen masuk ditolak karena waktu tugas lembur belum dimulai.'
                    ], 400);
                }

                if ($sekarangTime > $datetimeSelesai) {
                    return $this->respond([
                        'status' => 'gagal',
                        'pesan'  => 'Absen masuk ditolak karena waktu tugas lembur telah berakhir.'
                    ], 400);
                }
            }
        }
        // 1. Tentukan tanggal bisnis kerja berdasarkan waktu mulai shift yang ter-kalkulasi
        if (isset($hariIni)) {
            $today = $hariIni;
        }

        // 2. Cegah absen masuk ganda pada jendela aktif shift/lembur yang sama
        if (isset($batasAwalMasuk) && isset($datetimeSelesai)) {
            $builderCek = $db->table('absensi')
                             ->where('karyawan_id', $userId)
                             ->where('jam_masuk >=', date('Y-m-d H:i:s', $batasAwalMasuk))
                             ->where('jam_masuk <=', date('Y-m-d H:i:s', $datetimeSelesai));

            if ($lemburId) {
                $builderCek->where('lembur_id', $lemburId);
            } else {
                $builderCek->where('jadwal_karyawan_id', $jadwalId)->where('lembur_id IS NULL');
            }

            $sudahAbsen = $builderCek->get()->getRow();

            if ($sudahAbsen) {
                return $this->respond([
                    'status' => 'gagal',
                    'pesan'  => 'Anda sudah absen masuk pada shift/tugas ini.',
                    'data'   => ['id' => $sudahAbsen->id]
                ], 400);
            }
        }

        $statusKehadiran = $input['status_kehadiran'] ?? 'tepat_waktu';
        $jamMasuk        = $input['jam_masuk'] ?? date('Y-m-d H:i:s');

        $validStatus = ['tepat_waktu', 'lebih_awal', 'terlambat', 'terlambat_toleransi', 'izin', 'sakit', 'alpha'];
        if (!in_array($statusKehadiran, $validStatus)) {
            $statusKehadiran = 'tepat_waktu';
        }

        $now = date('Y-m-d H:i:s');
        $data = [
            'karyawan_id'        => $userId,
            'jadwal_karyawan_id' => $jadwalId,
            'lembur_id'          => $lemburId,
            'jam_masuk'          => $jamMasuk,
            'jam_pulang'         => null,
            'status_kehadiran'   => $statusKehadiran,
            'created_at'         => $now,
            'updated_at'         => $now,
        ];

        $builder = $db->table('absensi');
        if (!$builder->insert($data)) {
            return $this->fail('Gagal menyimpan data absensi.');
        }

        $idBaru = $db->insertID();

        // Ambil data usahaId dengan fallback jika kosong
        if (empty($usahaId)) {
            $roleAktif = $db->table('user_role')->where('user_id', $userId)->get()->getRow();
            $usahaId = $roleAktif ? $roleAktif->usaha_id : null;
        }

        // Ambil nama karyawan untuk deskripsi notifikasi
        $karyawan = $db->table('users')->where('id', $userId)->get()->getRow();
        $namaKaryawan = $karyawan ? $karyawan->nama : 'Karyawan';

        // 1. Notifikasi Absen Masuk Rutin/Lembur
        if ($usahaId) {
            if (\App\Modules\Notification\Services\NotificationService::isAktif($usahaId, 'notif_absen_masuk')) {
                \App\Modules\Notification\Services\NotificationService::kirim(
                    $usahaId,
                    "Absen Masuk Karyawan",
                    "{$namaKaryawan} telah melakukan absen masuk.",
                    "absensi"
                );
            }

            // 2. Notifikasi Peringatan Keterlambatan
            if (in_array($statusKehadiran, ['terlambat', 'terlambat_toleransi'])) {
                if (\App\Modules\Notification\Services\NotificationService::isAktif($usahaId, 'notif_absen_terlambat')) {
                    $statusFormatted = ucwords(str_replace('_', ' ', $statusKehadiran));
                    \App\Modules\Notification\Services\NotificationService::kirim(
                        $usahaId,
                        "Keterlambatan Absen",
                        "Peringatan! {$namaKaryawan} absen masuk dengan status: {$statusFormatted}.",
                        "absensi"
                    );
                }
            }
        }

        // 1. Tentukan Kriteria Poin Utama (Hadir Biasa / Lembur)
        $nilaiPoin = 0;
        $pointsId  = null;

        if ($lemburId) {
            // Lembur mendapatkan poin dengan kode khusus ABSEN_LEMBUR, atau TERLAMBAT jika terlambat
            $kodeSistem = 'ABSEN_LEMBUR';
            if ($statusKehadiran === 'terlambat') {
                $kodeSistem = 'TERLAMBAT';
            } else if ($statusKehadiran === 'terlambat_toleransi') {
                $kodeSistem = 'TERLAMBAT_TOLERANSI';
            }

            $kriteria = $db->table('kriteria_poin')
                ->where('usaha_id', $usahaId)
                ->where('kode_sistem', $kodeSistem)
                ->get()->getRow();

            if (!$kriteria && ($statusKehadiran === 'terlambat' || $statusKehadiran === 'terlambat_toleransi')) {
                // Fallback ke ABSEN_LEMBUR jika kriteria denda terlambat tidak ada
                $kriteria = $db->table('kriteria_poin')
                    ->where('usaha_id', $usahaId)
                    ->where('kode_sistem', 'ABSEN_LEMBUR')
                    ->get()->getRow();
            }

            if (!$kriteria) {
                $kriteria = $db->table('kriteria_poin')
                    ->where('usaha_id', $usahaId)
                    ->where('kode_sistem', 'HADIR_TEPAT_WAKTU')
                    ->get()->getRow();
            }

            if ($kriteria && $kriteria->nilai_poin != 0) {
                $poinData = [
                    'karyawan_id'  => $userId,
                    'jumlah_poin'  => $kriteria->nilai_poin,
                    'sumber'       => 'absensi',
                    'referensi_id' => $idBaru,
                    'keterangan'   => 'Absen Lembur' . ($statusKehadiran !== 'tepat_waktu' && $statusKehadiran !== 'lebih_awal' ? ' - ' . ucwords(str_replace('_', ' ', $statusKehadiran)) : ''),
                    'tanggal'      => $today,
                    'created_at'   => $now,
                    'updated_at'   => $now,
                ];
                $db->table('points')->insert($poinData);
                $pointsId  = $db->insertID() ?: null;
                $nilaiPoin = $kriteria->nilai_poin;
            }
        } else {
            // Absen Rutin / Pengganti
            $kodeMap = [
                'tepat_waktu'         => 'HADIR_TEPAT_WAKTU',
                'lebih_awal'          => 'HADIR_LEBIH_AWAL',
                'terlambat_toleransi' => 'TERLAMBAT_TOLERANSI',
                'terlambat'           => 'TERLAMBAT',
            ];
            $kodeSistem = $kodeMap[$statusKehadiran] ?? null;

            if ($kodeSistem && $usahaId) {
                $kriteria = $db->table('kriteria_poin')
                    ->where('usaha_id', $usahaId)
                    ->where('kode_sistem', $kodeSistem)
                    ->get()->getRow();

                if ($kriteria && $kriteria->nilai_poin != 0) {
                    $poinData = [
                        'karyawan_id'  => $userId,
                        'jumlah_poin'  => $kriteria->nilai_poin,
                        'sumber'       => 'absensi',
                        'referensi_id' => $idBaru,
                        'keterangan'   => 'Kehadiran - ' . ucwords(str_replace('_', ' ', $statusKehadiran)),
                        'tanggal'      => $today,
                        'created_at'   => $now,
                        'updated_at'   => $now,
                    ];
                    $db->table('points')->insert($poinData);
                    $pointsId  = $db->insertID() ?: null;
                    $nilaiPoin = $kriteria->nilai_poin;
                }
            }

            // 2. Cek apakah ini adalah tugas pengganti (B menggantikan A yang sedang izin disetujui)
            // Cari data izin untuk tanggal hari ini di mana user ini (B) bertindak sebagai pengganti
            $izin = $db->table('perizinan')
                       ->where('karyawan_pengganti_id', $userId)
                       ->where('tanggal', $today)
                       ->where('status', 'disetujui')
                       ->get()->getRow();

            if ($izin) {
                // Berikan poin bonus JADI_PENGGANTI
                $kriteriaBonus = $db->table('kriteria_poin')
                    ->where('usaha_id', $usahaId)
                    ->where('kode_sistem', 'JADI_PENGGANTI')
                    ->get()->getRow();

                if ($kriteriaBonus && $kriteriaBonus->nilai_poin != 0) {
                    $db->table('points')->insert([
                        'karyawan_id'  => $userId,
                        'jumlah_poin'  => $kriteriaBonus->nilai_poin,
                        'sumber'       => 'absensi',
                        'referensi_id' => $idBaru,
                        'keterangan'   => 'Bonus Pengganti Shift',
                        'tanggal'      => $today,
                        'created_at'   => $now,
                        'updated_at'   => $now,
                    ]);
                }
            }
        }

        return $this->respondCreated([
            'status'     => 'sukses',
            'pesan'      => 'Absen masuk berhasil dicatat.',
            'id_baru'    => $idBaru,
            'points_id'  => $pointsId,
            'nilai_poin' => $nilaiPoin,
        ]);
    }

    /**
     * PUT /api/absen/pulang/{id}
     * Merekam absen pulang karyawan yang sedang login.
     */
    public function pulang($id)
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();

        if (!$penggunaAktif || $penggunaAktif['tipe'] !== 'final') {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Token tidak valid.'], 401);
        }

        $userId  = $penggunaAktif['uid'];
        $usahaId = $penggunaAktif['usaha_id'] ?? null;
        $db      = \Config\Database::connect();

        // Pastikan ID absensi milik user sendiri
        $absensi = $db->table('absensi')
            ->where('id', $id)
            ->where('karyawan_id', $userId)
            ->get()->getRow();

        if (!$absensi) {
            return $this->failNotFound('Data absensi tidak ditemukan atau bukan milik Anda.');
        }

        if ($absensi->jam_pulang) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Anda sudah absen pulang sebelumnya.'], 400);
        }

        $input     = $this->request->getJSON(true) ?: $this->request->getPost();
        $jamPulang = $input['jam_pulang'] ?? date('Y-m-d H:i:s');
        $today     = date('Y-m-d');
        $now       = date('Y-m-d H:i:s');

        $db->table('absensi')->where('id', $id)->update([
            'jam_pulang' => $jamPulang,
            'updated_at' => $now,
        ]);

        // Tentukan status pulang dan hitung poin
        $statusPulang = $input['status_pulang'] ?? null;
        $pointsId     = null;
        $nilaiPoin    = 0;

        if ($statusPulang && $usahaId) {
            $kodeMap = [
                'PULANG_TEPAT_WAKTU' => 'PULANG_TEPAT_WAKTU',
                'PULANG_LEBIH_AWAL'  => 'PULANG_LEBIH_AWAL',
            ];
            $kodeSistem = $kodeMap[$statusPulang] ?? null;

            if ($kodeSistem) {
                $kriteria = $db->table('kriteria_poin')
                    ->where('usaha_id', $usahaId)
                    ->where('kode_sistem', $kodeSistem)
                    ->get()->getRow();

                if ($kriteria && $kriteria->nilai_poin != 0) {
                    $labelPulang = $statusPulang === 'PULANG_TEPAT_WAKTU' ? 'Pulang Tepat Waktu' : 'Pulang Lebih Awal (Bolos)';
                    $poinData    = [
                        'karyawan_id'  => $userId,
                        'jumlah_poin'  => $kriteria->nilai_poin,
                        'sumber'       => 'absensi',
                        'referensi_id' => $id,
                        'keterangan'   => $labelPulang,
                        'tanggal'      => $today,
                        'created_at'   => $now,
                        'updated_at'   => $now,
                    ];
                    $db->table('points')->insert($poinData);
                    $pointsId  = $db->insertID() ?: null;
                    $nilaiPoin = $kriteria->nilai_poin;
                }
            }
        }

        // Ambil data usahaId dengan fallback jika kosong
        if (empty($usahaId)) {
            $roleAktif = $db->table('user_role')->where('user_id', $userId)->get()->getRow();
            $usahaId = $roleAktif ? $roleAktif->usaha_id : null;
        }

        if ($usahaId) {
            // Ambil nama karyawan
            $karyawan = $db->table('users')->where('id', $userId)->get()->getRow();
            $namaKaryawan = $karyawan ? $karyawan->nama : 'Karyawan';

            if (\App\Modules\Notification\Services\NotificationService::isAktif($usahaId, 'notif_absen_pulang')) {
                \App\Modules\Notification\Services\NotificationService::kirim(
                    $usahaId,
                    "Absen Pulang Karyawan",
                    "{$namaKaryawan} telah melakukan absen pulang.",
                    "absensi"
                );
            }
        }

        return $this->respond([
            'status'     => 'sukses',
            'pesan'      => 'Absen pulang berhasil dicatat.',
            'points_id'  => $pointsId,
            'nilai_poin' => $nilaiPoin,
        ]);
    }

    /**
     * GET /api/absen/hari-ini
     * Mengambil data absensi hari ini milik user yang login.
     */
    public function hariIni()
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();

        if (!$penggunaAktif || $penggunaAktif['tipe'] !== 'final') {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Token tidak valid.'], 401);
        }

        $userId = $penggunaAktif['uid'];
        $today  = date('Y-m-d');
        $db     = \Config\Database::connect();

        $absensi = $db->table('absensi')
            ->where('karyawan_id', $userId)
            ->where("DATE(jam_masuk)", $today)
            ->get()->getResultArray();

        return $this->respond([
            'status' => 'sukses',
            'data'   => $absensi,
        ]);
    }

    /**
     * GET /api/absen/total-poin
     * Mengambil total poin karyawan yang login, dengan filter opsional:
     * ?bulan=7&tahun=2026  → Juli 2026
     * ?tahun=2026          → seluruh 2026
     * (tanpa param)        → semua waktu
     */
    public function totalPoin()
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();

        if (!$penggunaAktif || $penggunaAktif['tipe'] !== 'final') {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Token tidak valid.'], 401);
        }

        $userId = $penggunaAktif['uid'];
        $db     = \Config\Database::connect();

        $bulan = $this->request->getGet('bulan');
        $tahun = $this->request->getGet('tahun');

        $builder = $db->table('points')
            ->selectSum('jumlah_poin', 'total')
            ->where('karyawan_id', $userId);

        if ($tahun) {
            $builder->where('YEAR(tanggal)', (int)$tahun);
        }
        if ($bulan) {
            $builder->where('MONTH(tanggal)', (int)$bulan);
        }

        $total = $builder->get()->getRow();

        return $this->respond([
            'status'     => 'sukses',
            'total_poin' => (int)($total->total ?? 0),
        ]);
    }

    /**
     * GET /api/absen/tugas-hari-ini
     * Mengambil daftar tugas (jadwal rutin dan/atau lembur) aktif karyawan hari ini.
     */
    public function tugasHariIni()
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();

        if (!$penggunaAktif || $penggunaAktif['tipe'] !== 'final') {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Token tidak valid.'], 401);
        }

        $userId = $penggunaAktif['uid'];
        $db     = \Config\Database::connect();
        
        $today  = date('Y-m-d');
        $yesterday = date('Y-m-d', strtotime('-1 day'));
        
        $hariMap = [
            'Sunday' => 'Minggu', 'Monday' => 'Senin', 'Tuesday' => 'Selasa',
            'Wednesday' => 'Rabu', 'Thursday' => 'Kamis', 'Friday' => 'Jumat',
            'Saturday' => 'Sabtu'
        ];
        $namaHariToday = $hariMap[date('l')] ?? null;
        $namaHariYesterday = $hariMap[date('l', strtotime('-1 day'))] ?? null;

        $kemarinAktif = false;
        $tanggalBisnis = $today;
        $namaHari = $namaHariToday;

        // Cek jadwal rutin kemarin
        $liburQueryKemarin = $db->table('jadwal_karyawan')
                               ->where('karyawan_id', $userId)
                               ->where('hari', $namaHariYesterday)
                               ->get()->getRow();

        $jadwalKemarin = null;
        if (!$liburQueryKemarin) {
            $jadwalKemarin = $db->table('jadwal_karyawan')
                                ->select('jadwal_karyawan.id, shift.nama_shift, shift.jam_mulai, shift.jam_selesai, shift.toleransi_sebelum, shift.toleransi_terlambat')
                                ->join('shift', 'shift.id = jadwal_karyawan.shift_id')
                                ->where('jadwal_karyawan.karyawan_id', $userId)
                                ->where('jadwal_karyawan.hari IS NULL')
                                ->get()->getRow();
        }

        // Cek lembur kemarin
        $lemburKemarin = $db->table('lembur')
                            ->where('karyawan_id', $userId)
                            ->where('tanggal', $yesterday)
                            ->whereIn('status', ['ditunjuk', 'diterima_karyawan'])
                            ->get()->getRow();

        $nowTime = time();

        // Evaluasi jadwal kemarin
        if ($jadwalKemarin && $jadwalKemarin->jam_selesai < $jadwalKemarin->jam_mulai) {
            $startMulai = strtotime("$yesterday {$jadwalKemarin->jam_mulai}");
            $startSelesai = strtotime("$today {$jadwalKemarin->jam_selesai}");
            $batasMulai = $startMulai - ((int)$jadwalKemarin->toleransi_sebelum * 60);
            
            if ($nowTime >= $batasMulai && $nowTime <= $startSelesai) {
                $kemarinAktif = true;
            }
        }

        // Evaluasi lembur kemarin
        if (!$kemarinAktif && $lemburKemarin && $lemburKemarin->jam_selesai < $lemburKemarin->jam_mulai) {
            $startMulai = strtotime("$yesterday {$lemburKemarin->jam_mulai}");
            $startSelesai = strtotime("$today {$lemburKemarin->jam_selesai}");
            $batasMulai = $startMulai - (120 * 60);
            
            if ($nowTime >= $batasMulai && $nowTime <= $startSelesai) {
                $kemarinAktif = true;
            }
        }

        // Evaluasi pengganti kemarin
        if (!$kemarinAktif) {
            $penggantiKemarin = $db->table('perizinan')
                                   ->select('perizinan.*, u.nama as nama_pemohon')
                                   ->join('users u', 'u.id = perizinan.karyawan_id')
                                   ->where('perizinan.karyawan_pengganti_id', $userId)
                                   ->where('perizinan.tanggal', $yesterday)
                                   ->where('perizinan.status', 'disetujui')
                                   ->get()->getResult();

            foreach ($penggantiKemarin as $pk) {
                $liburPemohon = $db->table('jadwal_karyawan')
                                   ->where('karyawan_id', $pk->karyawan_id)
                                   ->where('hari', $namaHariYesterday)
                                   ->get()->getRow();
                if (!$liburPemohon) {
                    $jadwalPemohon = $db->table('jadwal_karyawan')
                                        ->select('shift.id as shift_id, shift.jam_mulai, shift.jam_selesai, shift.toleransi_sebelum')
                                        ->join('shift', 'shift.id = jadwal_karyawan.shift_id')
                                        ->where('jadwal_karyawan.karyawan_id', $pk->karyawan_id)
                                        ->where('jadwal_karyawan.hari IS NULL')
                                        ->get()->getResult();

                    foreach ($jadwalPemohon as $jp) {
                        $approvedShifts = explode(',', $pk->shift_id_disetujui ?: '');
                        if (in_array($jp->shift_id, $approvedShifts) && $jp->jam_selesai < $jp->jam_mulai) {
                            $startMulai = strtotime("$yesterday {$jp->jam_mulai}");
                            $startSelesai = strtotime("$today {$jp->jam_selesai}");
                            $batasMulai = $startMulai - ((int)$jp->toleransi_sebelum * 60);

                            if ($nowTime >= $batasMulai && $nowTime <= $startSelesai) {
                                $kemarinAktif = true;
                                break 2;
                            }
                        }
                    }
                }
            }
        }

        if ($kemarinAktif) {
            $today = $yesterday;
            $namaHari = $namaHariYesterday;
        }

        // 2. Dapatkan jadwal rutin (jika tidak libur hari ini)
        $liburQuery = $db->table('jadwal_karyawan')
                         ->where('karyawan_id', $userId)
                         ->where('hari', $namaHari)
                         ->get()->getRow();

        $jadwalRutin = null;
        if (!$liburQuery) {
            $jadwalRutin = $db->table('jadwal_karyawan')
                             ->select('jadwal_karyawan.id, shift.id as shift_id, shift.nama_shift, shift.jam_mulai, shift.jam_selesai, shift.toleransi_sebelum, shift.toleransi_terlambat')
                             ->join('shift', 'shift.id = jadwal_karyawan.shift_id')
                             ->where('jadwal_karyawan.karyawan_id', $userId)
                             ->where('jadwal_karyawan.hari IS NULL')
                             ->get()->getRow();
        }

        // 1. Cek apakah ada izin disetujui hari ini untuk shift yang sedang aktif
        $izin = null;
        $izinQuery = $db->table('perizinan')
                        ->where('karyawan_id', $userId)
                        ->where('tanggal', $today)
                        ->where('status', 'disetujui')
                        ->get()->getResult();
        
        if ($jadwalRutin) {
            foreach ($izinQuery as $iz) {
                $approvedShifts = explode(',', $iz->shift_id_disetujui ?: '');
                if (in_array($jadwalRutin->shift_id, $approvedShifts)) {
                    $izin = $iz;
                    break;
                }
            }
        }

        // 3. Dapatkan tugas lembur aktif hari ini
        $lembur = $db->table('lembur')
                     ->where('karyawan_id', $userId)
                     ->where('tanggal', $today)
                     ->whereIn('status', ['ditunjuk', 'diterima_karyawan'])
                     ->get()->getRow();

        // 4. Cek apakah ada orang lain yang diizinkan menggantikan user ini hari ini untuk shift ini
        $digantikan = null;
        if ($jadwalRutin) {
            foreach ($izinQuery as $iz) {
                if ($iz->karyawan_pengganti_id !== null) {
                    $approvedShifts = explode(',', $iz->shift_id_disetujui ?: '');
                    if (in_array($jadwalRutin->shift_id, $approvedShifts)) {
                        $digantikan = $iz;
                        break;
                    }
                }
            }
        }

        // 5. Cek apakah user ini (B) bertindak sebagai pengganti orang lain (A) hari ini
        $sebagaiPengganti = null;
        $jadwalPengganti = null;

        $penggantiQuery = $db->table('perizinan')
                             ->select('perizinan.*, u.nama as nama_pemohon')
                             ->join('users u', 'u.id = perizinan.karyawan_id')
                             ->where('perizinan.karyawan_pengganti_id', $userId)
                             ->where('perizinan.tanggal', $today)
                             ->where('perizinan.status', 'disetujui')
                             ->get()->getResult();

        foreach ($penggantiQuery as $sp) {
            $liburPemohon = $db->table('jadwal_karyawan')
                               ->where('karyawan_id', $sp->karyawan_id)
                               ->where('hari', $namaHari)
                               ->get()->getRow();

            if (!$liburPemohon) {
                $jadwalPemohon = $db->table('jadwal_karyawan')
                                    ->select('jadwal_karyawan.id, shift.id as shift_id, shift.nama_shift, shift.jam_mulai, shift.jam_selesai, shift.toleransi_sebelum, shift.toleransi_terlambat')
                                    ->join('shift', 'shift.id = jadwal_karyawan.shift_id')
                                    ->where('jadwal_karyawan.karyawan_id', $sp->karyawan_id)
                                    ->where('jadwal_karyawan.hari IS NULL')
                                    ->get()->getResult();

                foreach ($jadwalPemohon as $jp) {
                    $approvedShifts = explode(',', $sp->shift_id_disetujui ?: '');
                    if (in_array($jp->shift_id, $approvedShifts)) {
                        $sebagaiPengganti = $sp;
                        $jadwalPengganti = [
                            'id' => $jp->id,
                            'shift_id' => $jp->shift_id,
                            'nama_shift' => $jp->nama_shift,
                            'jam_mulai' => $jp->jam_mulai,
                            'jam_selesai' => $jp->jam_selesai,
                            'toleransi_sebelum' => $jp->toleransi_sebelum,
                            'toleransi_terlambat' => $jp->toleransi_terlambat,
                            'keterangan_tukar' => "Menggantikan " . $sp->nama_pemohon
                        ];
                        break 2;
                    }
                }
            }
        }

        return $this->respond([
            'status' => 'sukses',
            'data'   => [
                'izin_aktif'        => $izin ? true : false,
                'digantikan'        => $digantikan ? true : false,
                'jadwal_rutin'      => $jadwalRutin,
                'lembur_aktif'      => $lembur,
                'jadwal_pengganti'  => $jadwalPengganti
            ]
        ]);
    }
}
