<?php

namespace App\Modules\Manajemen\Controllers;

use CodeIgniter\RESTful\ResourceController;

class Perizinan extends ResourceController
{
    protected $format = 'json';

    // Memproses data unggah file bukti perizinan
    private function prosesUploadBukti()
    {
        $file = $this->request->getFile('dokumen_bukti');
        if ($file && $file->isValid() && !$file->hasMoved()) {
            // Tentukan nama acak aman
            $namaBaru = $file->getRandomName();
            // Simpan ke direktori writable yang aman (tidak bisa diakses publik langsung)
            $file->move(WRITEPATH . 'uploads/perizinan', $namaBaru);
            return $namaBaru;
        }
        return null;
    }

    // Mengupdate otomatis data perizinan kedaluwarsa (auto-expiry) saat diakses
    private function bersihkanDataKedaluwarsa()
    {
        $db = \Config\Database::connect();
        $sekarang = date('Y-m-d H:i:s');
        
        // 1. Jika status = 'menunggu_pengganti' dan sudah lewat dari 4 jam sejak dibuat
        $batasWaktuPengganti = date('Y-m-d H:i:s', strtotime('-4 hours'));
        $db->table('perizinan')
           ->where('status', 'menunggu_pengganti')
           ->where('created_at <', $batasWaktuPengganti)
           ->update(['status' => 'ditolak_pengganti']); // tandai sebagai ditolak pengganti karena tidak direspon

        // 2. Jika tanggal perizinan sudah masuk hari H (dan belum disetujui), tandai ditolak
        $hariIni = date('Y-m-d');
        $db->table('perizinan')
           ->whereIn('status', ['menunggu_pengganti', 'menunggu_persetujuan'])
           ->where('tanggal <', $hariIni)
           ->update(['status' => 'ditolak']); // Ditolak karena kedaluwarsa (lewat hari H)
    }

    // Helper nama hari Indonesia
    private function dapatkanNamaHari($tanggal)
    {
        $hariInggris = date('l', strtotime($tanggal));
        $map = [
            'Sunday'    => 'Minggu',
            'Monday'    => 'Senin',
            'Tuesday'   => 'Selasa',
            'Wednesday' => 'Rabu',
            'Thursday'  => 'Kamis',
            'Friday'    => 'Jumat',
            'Saturday'  => 'Sabtu'
        ];
        return $map[$hariInggris] ?? '';
    }

    // GET /api/perizinan/shift-aktif
    public function shiftAktif()
    {
        $karyawanId = $this->request->getGet('karyawan_id') ?: null;
        $tanggal = $this->request->getGet('tanggal') ?: null;

        if (!$karyawanId || !$tanggal) {
            return $this->fail('Parameter karyawan_id dan tanggal wajib dikirim.');
        }

        $namaHari = $this->dapatkanNamaHari($tanggal);
        $db = \Config\Database::connect();

        // 1. Cek apakah hari ini adalah hari libur mingguan untuk karyawan tersebut
        $libur = $db->table('jadwal_karyawan')
                    ->where('karyawan_id', $karyawanId)
                    ->where('hari', $namaHari)
                    ->get()->getRow();

        if ($libur) {
            return $this->respond([
                'status' => 'sukses',
                'libur'  => true,
                'shifts' => []
            ]);
        }

        // 2. Ambil semua shift aktif (hari IS NULL)
        $shifts = $db->table('jadwal_karyawan')
                     ->select('shift.id, shift.nama_shift, shift.jam_mulai, shift.jam_selesai')
                     ->join('shift', 'shift.id = jadwal_karyawan.shift_id')
                     ->where('jadwal_karyawan.karyawan_id', $karyawanId)
                     ->where('jadwal_karyawan.hari IS NULL')
                     ->get()->getResultArray();

        return $this->respond([
            'status' => 'sukses',
            'libur'  => false,
            'shifts' => $shifts
        ]);
    }

    // 1. GET /api/perizinan/riwayat (Mendapatkan list riwayat perizinan terisolasi)
    public function riwayat()
    {
        $this->bersihkanDataKedaluwarsa();

        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        $role = strtolower($penggunaAktif['role'] ?? 'member');
        $userId = $penggunaAktif['uid'];
        $usahaId = $penggunaAktif['usaha_id'] ?? null;

        $db = \Config\Database::connect();
        $builder = $db->table('perizinan p')
                      ->select('p.*, u.nama as nama_karyawan, up.nama as nama_pengganti, us.nama as nama_penyetuju, b.nama_usaha, r_p.nama_role as role_pemohon')
                      ->join('users u', 'u.id = p.karyawan_id', 'left')
                      ->join('users up', 'up.id = p.karyawan_pengganti_id', 'left')
                      ->join('users us', 'us.id = p.disetujui_oleh', 'left')
                      ->join('usaha b', 'b.id = p.usaha_id', 'left')
                      ->join('user_role ur_p', 'ur_p.user_id = p.karyawan_id', 'left')
                      ->join('roles r_p', 'r_p.id = ur_p.role_id', 'left');

        // A. Batasi baris berdasarkan hak akses isolasi cabang (Mencegah yang tidak terkait mengintip)
        if (in_array($role, ['root'])) {
            // Root bisa melihat semua
        } else if (in_array($role, ['owner', 'supervisor'])) {
            // Atasan hanya bisa melihat perizinan di cabang/usaha mereka sendiri
            if ($usahaId !== null) {
                $builder->where('p.usaha_id', $usahaId);
            } else {
                return $this->respond([]);
            }
        } else {
            // Karyawan biasa (member) hanya melihat data di mana ia merupakan pemohon ATAU target pengganti
            $builder->groupStart()
                    ->where('p.karyawan_id', $userId)
                    ->orWhere('p.karyawan_pengganti_id', $userId)
                    ->groupEnd();
        }

        // B. Batasi visibilitas data soft-deleted berdasarkan hierarki jabatan pembaca
        $builder->groupStart();
        $builder->where('p.deleted_at IS NULL'); // Data aktif selalu tampil

        if ($role === 'root') {
            $builder->orWhere('p.deleted_at IS NOT NULL');
        } else if ($role === 'owner') {
            // Owner bisa melihat data soft-delete milik Supervisor, Kasir, Karyawan, Member
            $builder->orGroupStart()
                        ->where('p.deleted_at IS NOT NULL')
                        ->whereIn('LOWER(r_p.nama_role)', ['supervisor', 'kasir', 'karyawan', 'member'])
                    ->groupEnd();
        } else if ($role === 'supervisor') {
            // Supervisor hanya bisa melihat data soft-delete milik Kasir, Karyawan, Member
            $builder->orGroupStart()
                        ->where('p.deleted_at IS NOT NULL')
                        ->whereIn('LOWER(r_p.nama_role)', ['kasir', 'karyawan', 'member'])
                    ->groupEnd();
        }
        $builder->groupEnd();

        // Urutkan pengajuan terbaru di atas
        $data = $builder->groupBy('p.id')->orderBy('p.id', 'DESC')->get()->getResultArray();
        return $this->respond($data);
    }

    // 2. POST /api/perizinan/ajukan (Pengajuan perizinan baru dengan validasi ketat)
    public function ajukan()
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        $userId = $penggunaAktif['uid'];
        $usahaId = $penggunaAktif['usaha_id'] ?? null;

        if ($usahaId === null) {
            return $this->fail('Pengguna tidak terikat dengan cabang/usaha manapun.');
        }

        // Validasi input data
        $rules = [
            'jenis_izin'            => 'required|in_list[izin,sakit]',
            'tanggal'               => 'required|valid_date[Y-m-d]',
            'alasan'                => 'required',
            'karyawan_pengganti_id' => 'permit_empty'
        ];

        if (!$this->validate($rules)) {
            return $this->respond([
                'status' => 'gagal',
                'pesan'  => implode(' ', $this->validator->getErrors())
            ], 400);
        }

        $isJson = strpos($this->request->getHeaderLine('Content-Type'), 'application/json') !== false;

        if ($isJson) {
            $jsonData = $this->request->getJSON(true) ?: [];
            $jenisIzin = $jsonData['jenis_izin'] ?? 'izin';
            $tanggal = $jsonData['tanggal'] ?? '';
            $alasan = $jsonData['alasan'] ?? '';
            $penggantiId = $jsonData['karyawan_pengganti_id'] ?? null;
            $shiftIds = $jsonData['shift_id_izin'] ?? '';
        } else {
            $jenisIzin = $this->request->getPost('jenis_izin') ?: 'izin';
            $tanggal = $this->request->getPost('tanggal') ?: '';
            $alasan = $this->request->getPost('alasan') ?: '';
            $penggantiId = $this->request->getPost('karyawan_pengganti_id') ?: null;
            $shiftIds = $this->request->getPost('shift_id_izin') ?? '';
        }

        // Ubah $shiftIds menjadi string comma-separated
        if (is_array($shiftIds)) {
            $shiftIdsStr = implode(',', $shiftIds);
        } else {
            $shiftIdsStr = (string)$shiftIds;
        }

        if (empty($shiftIdsStr)) {
            return $this->respond([
                'status' => 'gagal',
                'pesan'  => 'Gagal! Silakan pilih minimal 1 shift kerja yang ingin Anda ajukan izin.'
            ], 400);
        }

        if (empty($penggantiId) || (int)$penggantiId <= 0) {
            $penggantiId = null;
        }

        // A. Validasi Aturan Waktu Tanggal
        $sekarang = date('Y-m-d');
        if ($jenisIzin === 'izin') {
            // Izin pribadi wajib H+1 (minimal besok)
            $minimalMulai = date('Y-m-d', strtotime('+1 day'));
            if ($tanggal < $minimalMulai) {
                return $this->respond([
                    'status' => 'gagal',
                    'pesan'  => 'Gagal! Pengajuan "Izin Pribadi" wajib didaftarkan minimal 24 jam sebelum tanggal mulai.'
                ], 400);
            }
        } else if ($jenisIzin === 'sakit') {
            // Sakit diperbolehkan maksimal H-1 (Kemarin)
            $maksimalMundur = date('Y-m-d', strtotime('-1 day'));
            if ($tanggal < $maksimalMundur) {
                return $this->respond([
                    'status' => 'gagal',
                    'pesan'  => 'Gagal! Pengajuan "Sakit" hanya boleh diajukan maksimal 1 hari ke belakang (Kemarin).'
                ], 400);
            }
        }

        // B. Upload file berkas bukti (opsional)
        $namaFile = $this->prosesUploadBukti();

        // C. Tentukan status awal
        $statusAwal = $penggantiId !== null ? 'menunggu_pengganti' : 'menunggu_persetujuan';

        $db = \Config\Database::connect();
        $db->table('perizinan')->insert([
            'karyawan_id'           => $userId,
            'karyawan_pengganti_id' => $penggantiId,
            'jenis_izin'            => $jenisIzin,
            'tanggal'               => $tanggal,
            'shift_id_izin'         => $shiftIdsStr,
            'shift_id_disetujui'    => $shiftIdsStr,
            'alasan'                => $alasan,
            'dokumen_bukti'         => $namaFile,
            'status'                => $statusAwal,
            'usaha_id'              => $usahaId,
        ]);

        // Hook Notifikasi PWA & Riwayat untuk Perizinan Baru (PWA Flow)
        $pemohon = $db->table('users')->where('id', $userId)->get()->getRow();
        $namaPemohon = $pemohon ? $pemohon->nama : 'Karyawan';
        $tglIzin = date('d-m-Y', strtotime($tanggal));
        
        if (\App\Modules\Notification\Services\NotificationService::isAktif($usahaId, 'notif_perizinan_baru')) {
            if ($penggantiId !== null) {
                $pengganti = $db->table('users')->where('id', $penggantiId)->get()->getRow();
                $namaPengganti = $pengganti ? $pengganti->nama : 'Karyawan pengganti';
                
                \App\Modules\Notification\Services\NotificationService::kirim(
                    $usahaId,
                    "Permintaan Pengganti Shift",
                    "{$namaPemohon} meminta {$namaPengganti} menggantikan shift kerjanya untuk tanggal {$tglIzin}.",
                    "beranda"
                );
            } else {
                \App\Modules\Notification\Services\NotificationService::kirim(
                    $usahaId,
                    "Pengajuan Izin Baru",
                    "{$namaPemohon} mengajukan izin baru untuk tanggal {$tglIzin}.",
                    "beranda"
                );
            }
        }

        return $this->respond([
            'status' => 'sukses',
            'pesan'  => 'Permohonan izin Anda berhasil diajukan!'
        ]);
    }

    // 3. POST /api/perizinan/keputusan-pengganti (Persetujuan tugas pengganti oleh target pengganti)
    public function keputusanPengganti()
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        $userId = $penggunaAktif['uid'];

        $input = $this->request->getJSON(true) ?: $this->request->getPost();
        $id = $input['id'] ?? null;
        $keputusan = $input['keputusan'] ?? null; // 'setuju' atau 'tolak'

        if (!$id || !in_array($keputusan, ['setuju', 'tolak'])) {
            return $this->respond([
                'status' => 'gagal',
                'pesan'  => 'ID data dan keputusan wajib dikirim dengan benar.'
            ], 400);
        }

        $db = \Config\Database::connect();
        $existing = $db->table('perizinan')->where('id', $id)->get()->getRow();

        if (!$existing) {
            return $this->failNotFound('Data pengajuan tidak ditemukan.');
        }

        if ($existing->karyawan_pengganti_id != $userId) {
            return $this->failForbidden('Anda tidak berwenang memberikan keputusan pengganti untuk pengajuan ini.');
        }

        if ($existing->status !== 'menunggu_pengganti') {
            return $this->respond([
                'status' => 'gagal',
                'pesan'  => 'Status pengajuan sudah berubah atau kedaluwarsa.'
            ], 400);
        }

        $statusBaru = $keputusan === 'setuju' ? 'menunggu_persetujuan' : 'ditolak_pengganti';

        $updateData = [
            'status'     => $statusBaru,
            'updated_at' => date('Y-m-d H:i:s')
        ];

        if ($keputusan === 'setuju') {
            $shiftIdsDisetujui = $input['shift_id_disetujui'] ?? null;
            if ($shiftIdsDisetujui !== null) {
                if (is_array($shiftIdsDisetujui)) {
                    $updateData['shift_id_disetujui'] = implode(',', $shiftIdsDisetujui);
                } else {
                    $updateData['shift_id_disetujui'] = (string)$shiftIdsDisetujui;
                }
                
                if (empty($updateData['shift_id_disetujui'])) {
                    return $this->respond([
                        'status' => 'gagal',
                        'pesan'  => 'Gagal! Silakan pilih minimal 1 shift kerja yang Anda sanggup gantikan.'
                    ], 400);
                }
            }
        }

        $db->table('perizinan')->where('id', $id)->update($updateData);

        // Hook Notifikasi PWA & Riwayat untuk Keputusan Pengganti (PWA Flow)
        $tglIzin = date('d-m-Y', strtotime($existing->tanggal));
        $pengganti = $db->table('users')->where('id', $existing->karyawan_pengganti_id)->get()->getRow();
        $namaPengganti = $pengganti ? $pengganti->nama : 'Karyawan pengganti';
        $pemohon = $db->table('users')->where('id', $existing->karyawan_id)->get()->getRow();
        $namaPemohon = $pemohon ? $pemohon->nama : 'Karyawan';

        if ($keputusan === 'setuju') {
            if (\App\Modules\Notification\Services\NotificationService::isAktif($existing->usaha_id, 'notif_perizinan_persetujuan')) {
                \App\Modules\Notification\Services\NotificationService::kirim(
                    $existing->usaha_id,
                    "Pengganti Shift Bersedia",
                    "{$namaPengganti} bersedia menggantikan shift {$namaPemohon} untuk tanggal {$tglIzin}. Menunggu persetujuan atasan.",
                    "beranda"
                );
            }
        } else {
            if (\App\Modules\Notification\Services\NotificationService::isAktif($existing->usaha_id, 'notif_perizinan_persetujuan')) {
                \App\Modules\Notification\Services\NotificationService::kirim(
                    $existing->usaha_id,
                    "Pengganti Shift Menolak",
                    "{$namaPengganti} menolak permintaan pengganti shift {$namaPemohon} untuk tanggal {$tglIzin}.",
                    "beranda"
                );
            }
        }

        return $this->respond([
            'status' => 'sukses',
            'pesan'  => $keputusan === 'setuju' 
                ? 'Tugas pengganti diterima, sekarang menunggu keputusan atasan.' 
                : 'Tugas pengganti berhasil ditolak.'
        ]);
    }

    // 4. POST /api/perizinan/eskalasi-atasan (Bypass langsung ke atasan)
    public function eskalasiAtasan()
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        $userId = $penggunaAktif['uid'];

        $input = $this->request->getJSON(true) ?: $this->request->getPost();
        $id = $input['id'] ?? null;

        if (!$id) {
            return $this->respond([
                'status' => 'gagal',
                'pesan'  => 'ID pengajuan wajib disertasikan.'
            ], 400);
        }

        $db = \Config\Database::connect();
        $existing = $db->table('perizinan')->where('id', $id)->get()->getRow();

        if (!$existing) {
            return $this->failNotFound('Data pengajuan tidak ditemukan.');
        }

        if ($existing->karyawan_id != $userId) {
            return $this->failForbidden('Hanya pembuat pengajuan yang berwenang melakukan eskalasi.');
        }

        if ($existing->status !== 'ditolak_pengganti') {
            return $this->respond([
                'status' => 'gagal',
                'pesan'  => 'Eskalasi hanya dapat dilakukan jika tugas ditolak oleh pengganti.'
            ], 400);
        }

        // Set pengganti menjadi NULL (karena diteruskan tanpa pengganti) dan naikkan status
        $db->table('perizinan')->where('id', $id)->update([
            'karyawan_pengganti_id' => null,
            'status'                => 'menunggu_persetujuan',
            'updated_at'            => date('Y-m-d H:i:s')
        ]);

        // Hook Notifikasi PWA & Riwayat untuk Eskalasi ke Atasan (PWA Flow)
        $pemohon = $db->table('users')->where('id', $userId)->get()->getRow();
        $namaPemohon = $pemohon ? $pemohon->nama : 'Karyawan';
        $tglIzin = date('d-m-Y', strtotime($existing->tanggal));

        if (\App\Modules\Notification\Services\NotificationService::isAktif($existing->usaha_id, 'notif_perizinan_baru')) {
            \App\Modules\Notification\Services\NotificationService::kirim(
                $existing->usaha_id,
                "Pengajuan Izin Baru (Eskalasi)",
                "{$namaPemohon} mengajukan izin baru untuk tanggal {$tglIzin} (langsung ke atasan).",
                "beranda"
            );
        }

        return $this->respond([
            'status' => 'sukses',
            'pesan'  => 'Permohonan berhasil dialihkan langsung ke Supervisor/Atasan!'
        ]);
    }

    // 5. POST /api/perizinan/evaluasi-atasan (Evaluasi akhir atasan & pertukaran shift otomatis jika disetujui)
    public function evaluasiAtasan()
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        $role = strtolower($penggunaAktif['role'] ?? 'member');
        $userId = $penggunaAktif['uid'];

        if (!in_array($role, ['root', 'owner', 'supervisor'])) {
            return $this->failForbidden('Anda tidak memiliki peran atasan untuk mengevaluasi perizinan.');
        }

        $input = $this->request->getJSON(true) ?: $this->request->getPost();
        $id = $input['id'] ?? null;
        $status = $input['status'] ?? null; // 'disetujui' atau 'ditolak'
        $catatan = $input['catatan_atasan'] ?? '';

        if (!$id || !in_array($status, ['disetujui', 'ditolak'])) {
            return $this->respond([
                'status' => 'gagal',
                'pesan'  => 'ID data dan keputusan status akhir wajib dikirim dengan benar.'
            ], 400);
        }

        $db = \Config\Database::connect();
        $existing = $db->table('perizinan')->where('id', $id)->get()->getRow();

        if (!$existing) {
            return $this->failNotFound('Data pengajuan tidak ditemukan.');
        }

        if ($existing->status !== 'menunggu_persetujuan') {
            return $this->respond([
                'status' => 'gagal',
                'pesan'  => 'Pengajuan ini tidak sedang menunggu ulasan atasan.'
            ], 400);
        }

        $db->transStart();

        // A. Update status perizinan
        $updateData = [
            'status'         => $status,
            'disetujui_oleh' => $userId,
            'catatan_atasan' => $catatan,
            'updated_at'     => date('Y-m-d H:i:s')
        ];

        if ($status === 'disetujui') {
            $shiftIdsDisetujui = $input['shift_id_disetujui'] ?? null;
            if ($shiftIdsDisetujui !== null) {
                if (is_array($shiftIdsDisetujui)) {
                    $updateData['shift_id_disetujui'] = implode(',', $shiftIdsDisetujui);
                } else {
                    $updateData['shift_id_disetujui'] = (string)$shiftIdsDisetujui;
                }
                
                if (empty($updateData['shift_id_disetujui'])) {
                    return $this->respond([
                        'status' => 'gagal',
                        'pesan'  => 'Gagal! Silakan pilih minimal 1 shift kerja yang disetujui.'
                    ], 400);
                }
            }
        }

        $db->table('perizinan')->where('id', $id)->update($updateData);

        // Hook Notifikasi PWA & Riwayat untuk Evaluasi Atasan (PWA Flow)
        $tglIzin = date('d-m-Y', strtotime($existing->tanggal));
        $pemohon = $db->table('users')->where('id', $existing->karyawan_id)->get()->getRow();
        $namaPemohon = $pemohon ? $pemohon->nama : 'Karyawan';
        
        if ($status === 'disetujui') {
            if (\App\Modules\Notification\Services\NotificationService::isAktif($existing->usaha_id, 'notif_perizinan_persetujuan')) {
                \App\Modules\Notification\Services\NotificationService::kirim(
                    $existing->usaha_id,
                    "Pengajuan Izin Disetujui",
                    "Pengajuan izin {$namaPemohon} untuk tanggal {$tglIzin} telah disetujui oleh atasan.",
                    "beranda"
                );
            }
        } else {
            $catatanText = !empty($catatan) ? " dengan catatan: \"" . $catatan . "\"" : "";
            if (\App\Modules\Notification\Services\NotificationService::isAktif($existing->usaha_id, 'notif_perizinan_persetujuan')) {
                \App\Modules\Notification\Services\NotificationService::kirim(
                    $existing->usaha_id,
                    "Pengajuan Izin Ditolak",
                    "Pengajuan izin {$namaPemohon} untuk tanggal {$tglIzin} telah ditolak oleh atasan{$catatanText}.",
                    "beranda"
                );
            }
        }

        // B. Jika DISETUJUI, sistem tidak lagi memutasi jadwal_karyawan fisik karena merupakan template mingguan.
        // Status override (pengganti/libur) akan langsung dibaca dan di-bypass secara runtime saat proses absensi masuk.

        $db->transComplete();

        if ($db->transStatus() === false) {
            return $this->respond([
                'status' => 'gagal',
                'pesan'  => 'Gagal menyimpan evaluasi perizinan.'
            ], 500);
        }

        return $this->respond([
            'status' => 'sukses',
            'pesan'  => 'Evaluasi perizinan berhasil disimpan!'
        ]);
    }
}
