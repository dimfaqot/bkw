<?php

namespace App\Modules\Manajemen\Controllers;

use CodeIgniter\RESTful\ResourceController;

class Transaksi extends ResourceController
{
    protected $format = 'json';

    // GET /api/transaksi/staff
    public function ambilStaff()
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        if (!$penggunaAktif) {
            return $this->failUnauthorized('Token tidak valid.');
        }

        $usahaId = $penggunaAktif['usaha_id'] ?? null;
        if (!$usahaId) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Konteks usaha tidak ditemukan.'], 400);
        }

        $db = \Config\Database::connect();
        
        $staff = $db->table('user_role')
                    ->select('users.id, users.nama, users.wa, roles.nama_role')
                    ->join('users', 'users.id = user_role.user_id')
                    ->join('roles', 'roles.id = user_role.role_id')
                    ->where('user_role.usaha_id', $usahaId)
                    ->orderBy('users.nama', 'ASC')
                    ->get()
                    ->getResultArray();

        return $this->respond([
            'status' => 'sukses',
            'data'   => $staff
        ]);
    }

    // POST /api/transaksi/checkout
    public function checkout()
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        if (!$penggunaAktif) {
            return $this->failUnauthorized('Token tidak valid.');
        }

        $usahaId = $penggunaAktif['usaha_id'] ?? null;
        $kasirId = $penggunaAktif['uid'];

        if (!$usahaId) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Konteks usaha tidak ditemukan. Silakan pilih usaha terlebih dahulu.'], 400);
        }

        $input = $this->request->getJSON(true) ?: $this->request->getPost();
        $items = $input['items'] ?? [];

        if (empty($items) || !is_array($items)) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Keranjang transaksi kosong.'], 400);
        }

        $unitId = $input['unit_id'] ?? null;
        if (!$unitId) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Unit belum terpilih.'], 400);
        }

        $pelangganId = $input['pelanggan_id'] ?? null;
        $statusPembayaran = $input['status_pembayaran'] ?? 'lunas';
        $metodePembayaran = $input['metode_pembayaran'] ?? null;
        $uangJaminan = isset($input['uang_jaminan']) ? (float)$input['uang_jaminan'] : 0.00;

        if ($statusPembayaran === 'belum_bayar') {
            if (!$pelangganId) {
                return $this->respond(['status' => 'gagal', 'pesan' => 'Transaksi Bayar Nanti (Hutang) wajib memilih pelanggan.'], 400);
            }
            $metodePembayaran = null;
        } else {
            if (!$metodePembayaran || !in_array($metodePembayaran, ['cash', 'qris', 'tap'])) {
                return $this->respond(['status' => 'gagal', 'pesan' => 'Transaksi Lunas wajib memilih metode pembayaran (Cash, QRIS, Tap).'], 400);
            }
        }

        $db = \Config\Database::connect();

        // Ambil unit details
        $unit = $db->table('unit')->where('id', $unitId)->where('usaha_id', $usahaId)->get()->getRowArray();
        if (!$unit) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Unit tidak valid.'], 400);
        }

        // Ambil usaha details
        $usaha = $db->table('usaha')->where('id', $usahaId)->get()->getRowArray();
        if (!$usaha) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Usaha tidak ditemukan.'], 400);
        }

        // Generate nomor invoice: KODE_USAHA/YYYYMMDD/NO_URUT (tanpa unit karena lintas unit)
        $kodeUsaha = $this->dapatkanShortCode($usaha['nama_usaha']);
        $today = date('Ymd');
        $prefix = "$kodeUsaha/$today/";

        $db->transStart();

        $count = $db->table('transaksi')
                    ->like('nomor_invoice', $prefix, 'after')
                    ->countAllResults();

        $nextNo = str_pad($count + 1, 4, '0', STR_PAD_LEFT);
        $nomorInvoice = $prefix . $nextNo;

        $now = date('Y-m-d H:i:s');
        $transaksiData = [
            'usaha_id'          => $usahaId,
            'unit_id'           => $unitId,
            'nomor_invoice'     => $nomorInvoice,
            'kasir_id'          => $kasirId,
            'pelanggan_id'      => $pelangganId,
            'total_harga'       => 0.00, // dihitung ulang
            'uang_jaminan'      => $uangJaminan,
            'status_pembayaran' => $statusPembayaran,
            'metode_pembayaran' => $metodePembayaran,
            'created_at'        => $now,
            'updated_at'        => $now
        ];

        $db->table('transaksi')->insert($transaksiData);
        $transaksiId = $db->insertID();

        $totalHarga = 0.00;

        foreach ($items as $item) {
            $produkId = $item['produk_id'] ?? null;
            $qty = isset($item['qty']) ? (int)$item['qty'] : 1;
            $isBillingOpen = (isset($item['tipe_billing']) && $item['tipe_billing'] === 'open');

            if (!$produkId || ($qty < 0) || ($qty == 0 && !$isBillingOpen)) {
                $db->transRollback();
                return $this->respond(['status' => 'gagal', 'pesan' => 'Format item produk tidak valid.'], 400);
            }

            $produk = $db->table('produk_jasa')
                          ->where('id', $produkId)
                          ->where('usaha_id', $usahaId)
                          ->get()->getRow();

            if (!$produk) {
                $db->transRollback();
                return $this->respond(['status' => 'gagal', 'pesan' => "Produk dengan ID #{$produkId} tidak ditemukan atau bukan milik cabang usaha ini."], 400);
            }

            // Validasi & Potong Stok
            $err = $this->prosesStokProduk($db, $produk, $qty, $usahaId, $now);
            if ($err) {
                $db->transRollback();
                return $this->respond(['status' => 'gagal', 'pesan' => $err], 400);
            }

            $hargaSatuan = (float)$produk->harga_jual;
            $subtotal = $hargaSatuan * $qty;
            $totalHarga += $subtotal;

            $statusPengerjaan = ($produk->butuh_persiapan == 1) ? 'Menunggu' : 'Selesai';
            
            // Integrasi pemilihan stylist/petugas dan hitung komisi
            $petugasId = !empty($item['petugas_id']) ? (int)$item['petugas_id'] : null;
            $komisiPetugas = isset($item['komisi_petugas']) && $item['komisi_petugas'] !== '' ? (float)$item['komisi_petugas'] : null;

            if ($petugasId && $komisiPetugas === null) {
                // Hitung komisi default jika petugas terpilih namun nominal komisi kosong
                $komisiTipe = $produk->komisi_tipe ?? 'nominal';
                $komisiNilai = (float)($produk->komisi_nilai ?? 0);
                if ($komisiTipe === 'persen') {
                    $komisiPetugas = ($komisiNilai / 100) * $hargaSatuan * $qty;
                } else {
                    $komisiPetugas = $komisiNilai * $qty;
                }
            } else if (!$petugasId) {
                $komisiPetugas = 0.00;
            }

            $detailData = [
                'transaksi_id'      => $transaksiId,
                'produk_id'         => $produkId,
                'qty'               => $qty,
                'harga_satuan'      => $hargaSatuan,
                'subtotal'          => $subtotal,
                'status_pengerjaan' => $statusPengerjaan,
                'petugas_id'        => $petugasId,
                'komisi_petugas'    => $komisiPetugas,
                'created_at'        => $now,
                'updated_at'        => $now
            ];

            $db->table('transaksi_detail')->insert($detailData);
            $detailId = $db->insertID();

            // Poin Otomatis (+5 Poin) langsung ditambahkan jika langsung selesai di kasir
            $namaProduk = $produk->nama_produk;
            if ($statusPengerjaan === 'Selesai' && $petugasId) {
                $db->table('points')->insert([
                    'karyawan_id'     => $petugasId,
                    'jumlah_poin'     => 5,
                    'sumber'          => 'pengerjaan_pesanan',
                    'referensi_id'    => $detailId,
                    'pemberi_poin_id' => null,
                    'keterangan'      => "Menyelesaikan pengerjaan $namaProduk (Nota: $nomorInvoice) - Langsung POS",
                    'tanggal'         => date('Y-m-d'),
                    'created_at'      => $now,
                    'updated_at'      => $now
                ]);
            }

            // Otomatis aktifkan IoT relay jika produk sewa terhubung ke perangkat IoT (Sesi Regular atau Open)
            if (!empty($produk->iot_id)) {
                $iotAlokasi = $db->table('iot_alokasi')->where('iot_id', $produk->iot_id)->get()->getRowArray();
                if ($iotAlokasi) {
                    $isBillingOpen = (isset($item['tipe_billing']) && $item['tipe_billing'] === 'open') || ($qty == 0);
                    $prepaidDurasi = $isBillingOpen ? 0 : ((float)$qty > 0 ? (float)$qty * 60 : 60);

                    $db->table('iot_alokasi')->where('id', $iotAlokasi['id'])->update([
                        'status_relay'         => 1,
                        'status_penggunaan'    => 'dipakai',
                        'transaksi_aktif_id'   => $transaksiId,
                        'prepaid_durasi_menit' => $prepaidDurasi,
                        'waktu_mulai'          => $now,
                        'warning_sent'         => 0,
                        'updated_at'           => $now
                    ]);

                    $iotDev = $db->table('iot')->where('id', $produk->iot_id)->get()->getRowArray();
                    if ($iotDev && !empty($iotDev['ip_address'])) {
                        $this->kirimSinyalRelay($iotDev['ip_address'], 'on');
                    }
                }
            }
        }

        // Update total_harga
        $db->table('transaksi')
           ->where('id', $transaksiId)
           ->update([
               'total_harga' => $totalHarga,
               'updated_at'  => $now
           ]);

        $db->transComplete();

        if ($db->transStatus() === false) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Gagal menyimpan transaksi ke database. Silakan coba lagi.'], 500);
        }

        // Kirim Notifikasi jika ada item yang butuh pengerjaan dapur/kru
        $adaPekerjaan = false;
        foreach ($items as $item) {
            $prod = $db->table('produk_jasa')->where('id', $item['produk_id'])->get()->getRow();
            if ($prod && $prod->butuh_persiapan == 1) {
                $adaPekerjaan = true;
                break;
            }
        }

        if ($adaPekerjaan) {
            $recipientIds = $this->dapatkanKaryawanAktifDanCustomer($db, $usahaId, $pelangganId);
            $this->kirimNotifPekerjaan(
                $usahaId,
                $recipientIds,
                "Pesanan Baru Masuk 🛎️",
                "Ada pesanan baru yang membutuhkan pengerjaan. Nomor Nota: $nomorInvoice",
                "/dashboard"
            );
        }

        return $this->respond([
            'status' => 'sukses',
            'pesan'  => 'Transaksi berhasil disimpan!',
            'data'   => [
                'transaksi_id'  => $transaksiId,
                'nomor_invoice' => $nomorInvoice,
                'total_harga'   => $totalHarga
            ]
        ]);
    }

    // GET /api/transaksi/riwayat
    public function riwayat()
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        if (!$penggunaAktif) {
            return $this->failUnauthorized('Token tidak valid.');
        }

        $usahaId = $penggunaAktif['usaha_id'] ?? null;
        if (!$usahaId) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Konteks usaha tidak ditemukan.'], 400);
        }

        $tanggal = $this->request->getGet('tanggal') ?? date('Y-m-d');

        $db = \Config\Database::connect();

        // 1. Cari shift pertama untuk hitung waktu siklus
        $shiftPertama = $db->table('shift')
                           ->where('usaha_id', $usahaId)
                           ->orderBy('jam_mulai', 'ASC')
                           ->get()->getRowArray();

        if ($shiftPertama) {
            $jamMulai = $shiftPertama['jam_mulai'];
            $toleransi = (int)$shiftPertama['toleransi_sebelum'];

            $A_time = strtotime($tanggal . ' ' . $jamMulai) - ($toleransi * 60) + (15 * 60);
            $A = date('Y-m-d H:i:s', $A_time);

            $T_next = strtotime($tanggal . ' ' . $jamMulai) + 86400;
            $A_next_time = $T_next - ($toleransi * 60) + (15 * 60);
            $akhir_time = $A_next_time - (15 * 60);
            $akhir = date('Y-m-d H:i:s', $akhir_time);
        } else {
            // Fallback kalender 24 jam jika tidak ada shift
            $A = $tanggal . ' 00:00:00';
            $akhir = $tanggal . ' 23:59:59';
        }

        $riwayat = $db->table('transaksi t')
                      ->select('t.*, k.nama as nama_kasir, p.nama as nama_pelanggan, p.wa as wa_pelanggan')
                      ->join('users k', 'k.id = t.kasir_id', 'left')
                      ->join('users p', 'p.id = t.pelanggan_id', 'left')
                      ->where('t.usaha_id', $usahaId)
                      ->where('t.created_at >=', $A)
                      ->where('t.created_at <=', $akhir)
                      ->orderBy('t.created_at', 'DESC')
                      ->get()->getResultArray();

        // Ambil detail masing-masing transaksi
        foreach ($riwayat as &$r) {
            $r['detail'] = $db->table('transaksi_detail td')
                              ->select('td.*, p.nama_produk, p.satuan, p.tipe, u.nama as nama_petugas')
                              ->join('produk_jasa p', 'p.id = td.produk_id', 'left')
                              ->join('users u', 'u.id = td.petugas_id', 'left')
                              ->where('td.transaksi_id', $r['id'])
                              ->get()->getResultArray();
        }

        return $this->respond([
            'status' => 'sukses',
            'data'   => $riwayat
        ]);
    }

    // GET /api/transaksi/members (Bypass RBAC)
    public function members()
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        if (!$penggunaAktif) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Token tidak valid.'], 401);
        }

        $db = \Config\Database::connect();
        $members = $db->table('users')
                      ->select('id, nama, wa')
                      ->orderBy('nama', 'ASC')
                      ->get()->getResultArray();

        return $this->respond([
            'status' => 'sukses',
            'data'   => $members
        ]);
    }

    // POST /api/transaksi/tambah-member (Bypass RBAC)
    public function tambahMember()
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        if (!$penggunaAktif) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Token tidak valid.'], 401);
        }

        $input = $this->request->getJSON(true) ?: $this->request->getPost();
        $nama = trim($input['nama'] ?? '');
        $wa = trim($input['wa'] ?? '');

        if (!$nama || !$wa) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Nama dan WhatsApp wajib diisi.'], 400);
        }

        $db = \Config\Database::connect();

        $exists = $db->table('users')->where('wa', $wa)->countAllResults();
        if ($exists > 0) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Nomor WhatsApp ini sudah terdaftar.'], 400);
        }

        $now = date('Y-m-d H:i:s');
        $userData = [
            'nama'       => $nama,
            'wa'         => $wa,
            'email'      => null,
            'password'   => null, // Diset NULL agar otomatis password 4 digit terakhir WA
            'created_at' => $now,
            'updated_at' => $now
        ];

        $db->table('users')->insert($userData);
        $memberId = $db->insertID();

        return $this->respond([
            'status' => 'sukses',
            'pesan'  => 'Member baru berhasil didaftarkan!',
            'data'   => [
                'id'   => $memberId,
                'nama' => $nama,
                'wa'   => $wa
            ]
        ]);
    }

    // GET /api/transaksi-publik/detail/:id (Bypass JWT)
    public function publikDetail($id)
    {
        $db = \Config\Database::connect();

        $tx = $db->table('transaksi t')
                 ->select('t.*, k.nama as nama_kasir, p.nama as nama_pelanggan, p.wa as wa_pelanggan, u.nama_usaha, un.nama_unit')
                 ->join('users k', 'k.id = t.kasir_id', 'left')
                 ->join('users p', 'p.id = t.pelanggan_id', 'left')
                 ->join('usaha u', 'u.id = t.usaha_id', 'left')
                 ->join('unit un', 'un.id = t.unit_id', 'left')
                 ->where('t.id', $id)
                 ->get()->getRowArray();

        if (!$tx) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Transaksi tidak ditemukan.'], 404);
        }

        $tx['detail'] = $db->table('transaksi_detail td')
                           ->select('td.*, p.nama_produk, p.satuan, p.tipe, u.nama as nama_petugas')
                           ->join('produk_jasa p', 'p.id = td.produk_id', 'left')
                           ->join('users u', 'u.id = td.petugas_id', 'left')
                           ->where('td.transaksi_id', $id)
                           ->get()->getResultArray();

        return $this->respond([
            'status' => 'sukses',
            'data'   => $tx
        ]);
    }

    // PUT /api/transaksi/update-hutang/:id
    public function updateHutang($id)
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        if (!$penggunaAktif) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Token tidak valid.'], 401);
        }

        $usahaId = $penggunaAktif['usaha_id'] ?? null;
        if (!$usahaId) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Konteks usaha tidak ditemukan.'], 400);
        }

        $db = \Config\Database::connect();

        $transaksi = $db->table('transaksi')->where('id', $id)->where('usaha_id', $usahaId)->get()->getRowArray();
        if (!$transaksi) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Transaksi tidak ditemukan.'], 404);
        }

        if ($transaksi['status_pembayaran'] !== 'belum_bayar') {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Hanya transaksi belum lunas (hutang) yang dapat diubah.'], 400);
        }

        // Batasan siklus edit
        $shiftPertama = $db->table('shift')
                           ->where('usaha_id', $usahaId)
                           ->orderBy('jam_mulai', 'ASC')
                           ->get()->getRowArray();

        $now = time();
        $txTime = strtotime($transaksi['created_at']);

        if ($this->dapatkanSiklusTanggal($now, $shiftPertama) !== $this->dapatkanSiklusTanggal($txTime, $shiftPertama)) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Transaksi ini berasal dari siklus sebelumnya dan sudah bersifat final (tidak dapat diubah).'], 400);
        }

        $input = $this->request->getJSON(true) ?: $this->request->getPost();
        $items = $input['items'] ?? [];

        if (empty($items) || !is_array($items)) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Daftar item kosong.'], 400);
        }

        $db->transStart();
        $dateTimeNow = date('Y-m-d H:i:s');

        $detailsLama = $db->table('transaksi_detail')->where('transaksi_id', $id)->get()->getResultArray();
        $detailsMap = [];
        foreach ($detailsLama as $d) {
            $detailsMap[$d['produk_id']] = $d;
        }

        foreach ($items as $item) {
            $produkId = $item['produk_id'] ?? null;
            $qtyBaru = isset($item['qty']) ? (int)$item['qty'] : 0;

            if (!$produkId) {
                $db->transRollback();
                return $this->respond(['status' => 'gagal', 'pesan' => 'Item produk tidak valid.'], 400);
            }

            $produk = $db->table('produk_jasa')
                         ->where('id', $produkId)
                         ->where('usaha_id', $usahaId)
                         ->get()->getRow();

            if (!$produk) {
                $db->transRollback();
                return $this->respond(['status' => 'gagal', 'pesan' => "Produk #{$produkId} tidak ditemukan."], 404);
            }

            $isSewa = ($produk->tipe === 'sewa' || !empty($produk->iot_id));
            if ($qtyBaru < 0 || ($qtyBaru == 0 && !$isSewa)) {
                $db->transRollback();
                return $this->respond(['status' => 'gagal', 'pesan' => 'Item produk atau kuantitas tidak valid.'], 400);
            }

            $hargaSatuan = (float)$produk->harga_jual;

            if (isset($detailsMap[$produkId])) {
                $detailLama = $detailsMap[$produkId];
                $qtyLama = (int)$detailLama['qty'];

                if ($qtyBaru < $qtyLama) {
                    $db->transRollback();
                    return $this->respond(['status' => 'gagal', 'pesan' => "Kuantitas produk '{$produk->nama_produk}' tidak boleh dikurangi. Jumlah sebelumnya: $qtyLama, dikirim: $qtyBaru."], 400);
                }

                $diff = $qtyBaru - $qtyLama;

                if ($diff > 0) {
                    $err = $this->prosesStokProduk($db, $produk, $diff, $usahaId, $dateTimeNow);
                    if ($err) {
                        $db->transRollback();
                        return $this->respond(['status' => 'gagal', 'pesan' => $err], 400);
                    }

                    $statusPengerjaan = ($produk->butuh_persiapan == 1) ? 'Menunggu' : 'Selesai';
                    $subtotalBaru = $hargaSatuan * $qtyBaru;
                    $db->table('transaksi_detail')
                       ->where('id', $detailLama['id'])
                       ->update([
                           'qty'               => $qtyBaru,
                           'subtotal'          => $subtotalBaru,
                           'status_pengerjaan' => $statusPengerjaan,
                           'updated_at'        => $dateTimeNow
                       ]);
                }
            } else {
                $err = $this->prosesStokProduk($db, $produk, $qtyBaru, $usahaId, $dateTimeNow);
                if ($err) {
                    $db->transRollback();
                    return $this->respond(['status' => 'gagal', 'pesan' => $err], 400);
                }

                $statusPengerjaan = ($produk->butuh_persiapan == 1) ? 'Menunggu' : 'Selesai';
                $subtotal = $hargaSatuan * $qtyBaru;
                $db->table('transaksi_detail')->insert([
                    'transaksi_id'      => $id,
                    'produk_id'         => $produkId,
                    'qty'               => $qtyBaru,
                    'harga_satuan'      => $hargaSatuan,
                    'subtotal'          => $subtotal,
                    'status_pengerjaan' => $statusPengerjaan,
                    'created_at'        => $dateTimeNow,
                    'updated_at'        => $dateTimeNow
                ]);
            }
        }

        $totalHargaBaru = $db->table('transaksi_detail')
                             ->selectSum('subtotal')
                             ->where('transaksi_id', $id)
                             ->get()->getRow()->subtotal ?? 0.00;

        $db->table('transaksi')
           ->where('id', $id)
           ->update([
               'total_harga' => $totalHargaBaru,
               'updated_at'  => $dateTimeNow
           ]);

        $db->transComplete();

        if ($db->transStatus() === false) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Gagal memperbarui transaksi.'], 500);
        }

        return $this->respond([
            'status' => 'sukses',
            'pesan'  => 'Pesanan transaksi berhasil diperbarui!',
            'data'   => [
                'transaksi_id' => $id,
                'total_harga'  => $totalHargaBaru
            ]
        ]);
    }

    // PUT /api/transaksi/lunasi-hutang/:id
    public function lunasiHutang($id)
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        if (!$penggunaAktif) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Token tidak valid.'], 401);
        }

        $usahaId = $penggunaAktif['usaha_id'] ?? null;
        if (!$usahaId) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Konteks usaha tidak ditemukan.'], 400);
        }

        $input = $this->request->getJSON(true) ?: $this->request->getPost();
        $metodePembayaran = $input['metode_pembayaran'] ?? null;

        if (!$metodePembayaran || !in_array($metodePembayaran, ['cash', 'qris', 'tap'])) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Wajib memilih metode pembayaran untuk melunasi hutang.'], 400);
        }

        $db = \Config\Database::connect();

        $transaksi = $db->table('transaksi')->where('id', $id)->where('usaha_id', $usahaId)->get()->getRowArray();
        if (!$transaksi) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Transaksi tidak ditemukan.'], 404);
        }

        if ($transaksi['status_pembayaran'] !== 'belum_bayar') {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Transaksi ini sudah lunas sebelumnya.'], 400);
        }

        $items = $input['items'] ?? [];
        $db->transStart();
        $dateTimeNow = date('Y-m-d H:i:s');

        // Matikan lampu & kalkulasi durasi/biaya sewa billiard secara presisi terlebih dahulu jika ada
        $this->matikanLampuBilliardJikaLunas($db, $id, $dateTimeNow);

        $totalHargaBaru = (float)$transaksi['total_harga'];

        if (!empty($items) && is_array($items)) {
            // Cek batasan siklus jika kasir ingin menambah item saat pelunasan
            $shiftPertama = $db->table('shift')
                               ->where('usaha_id', $usahaId)
                               ->orderBy('jam_mulai', 'ASC')
                               ->get()->getRowArray();
            $now = time();
            $txTime = strtotime($transaksi['created_at']);

            if ($this->dapatkanSiklusTanggal($now, $shiftPertama) !== $this->dapatkanSiklusTanggal($txTime, $shiftPertama)) {
                $db->transRollback();
                return $this->respond(['status' => 'gagal', 'pesan' => 'Tidak dapat menambah item pesanan karena siklus transaksi ini sudah berakhir. Silakan langsung lunasi tagihan awal.'], 400);
            }

            $detailsLama = $db->table('transaksi_detail')->where('transaksi_id', $id)->get()->getResultArray();
            $detailsMap = [];
            foreach ($detailsLama as $d) {
                $detailsMap[$d['produk_id']] = $d;
            }

            foreach ($items as $item) {
                $produkId = $item['produk_id'] ?? null;
                $qtyBaru = isset($item['qty']) ? (int)$item['qty'] : 0;

                if (!$produkId) {
                    $db->transRollback();
                    return $this->respond(['status' => 'gagal', 'pesan' => 'Item produk tidak valid.'], 400);
                }

                $produk = $db->table('produk_jasa')
                             ->where('id', $produkId)
                             ->where('usaha_id', $usahaId)
                             ->get()->getRow();

                if (!$produk) {
                    $db->transRollback();
                    return $this->respond(['status' => 'gagal', 'pesan' => "Produk #{$produkId} tidak ditemukan."], 404);
                }

                $isSewa = ($produk->tipe === 'sewa' || !empty($produk->iot_id));
                if ($isSewa) {
                    // Produk sewa durasinya sudah dihitung & dikunci oleh matikanLampuBilliardJikaLunas
                    continue;
                }

                if ($qtyBaru <= 0) {
                    $db->transRollback();
                    return $this->respond(['status' => 'gagal', 'pesan' => 'Item produk atau kuantitas tidak valid.'], 400);
                }

                $hargaSatuan = (float)$produk->harga_jual;

                if (isset($detailsMap[$produkId])) {
                    $detailLama = $detailsMap[$produkId];
                    $qtyLama = (int)$detailLama['qty'];

                    if ($qtyBaru < $qtyLama) {
                        $db->transRollback();
                        return $this->respond(['status' => 'gagal', 'pesan' => "Kuantitas produk '{$produk->nama_produk}' tidak boleh dikurangi. Jumlah sebelumnya: $qtyLama, dikirim: $qtyBaru."], 400);
                    }

                    $diff = $qtyBaru - $qtyLama;

                    if ($diff > 0) {
                        $err = $this->prosesStokProduk($db, $produk, $diff, $usahaId, $dateTimeNow);
                        if ($err) {
                            $db->transRollback();
                            return $this->respond(['status' => 'gagal', 'pesan' => $err], 400);
                        }

                        $statusPengerjaan = ($produk->butuh_persiapan == 1) ? 'Menunggu' : 'Selesai';
                        $subtotalBaru = $hargaSatuan * $qtyBaru;
                        $db->table('transaksi_detail')
                           ->where('id', $detailLama['id'])
                           ->update([
                               'qty'               => $qtyBaru,
                               'subtotal'          => $subtotalBaru,
                               'status_pengerjaan' => $statusPengerjaan,
                               'updated_at'        => $dateTimeNow
                           ]);
                    }
                } else {
                    $err = $this->prosesStokProduk($db, $produk, $qtyBaru, $usahaId, $dateTimeNow);
                    if ($err) {
                        $db->transRollback();
                        return $this->respond(['status' => 'gagal', 'pesan' => $err], 400);
                    }

                    $statusPengerjaan = ($produk->butuh_persiapan == 1) ? 'Menunggu' : 'Selesai';
                    $subtotal = $hargaSatuan * $qtyBaru;
                    $db->table('transaksi_detail')->insert([
                        'transaksi_id'      => $id,
                        'produk_id'         => $produkId,
                        'qty'               => $qtyBaru,
                        'harga_satuan'      => $hargaSatuan,
                        'subtotal'          => $subtotal,
                        'status_pengerjaan' => $statusPengerjaan,
                        'created_at'        => $dateTimeNow,
                        'updated_at'        => $dateTimeNow
                    ]);
                }
            }

            $totalHargaBaru = $db->table('transaksi_detail')
                                 ->selectSum('subtotal')
                                 ->where('transaksi_id', $id)
                                 ->get()->getRow()->subtotal ?? 0.00;
        }

        $db->table('transaksi')
           ->where('id', $id)
           ->update([
               'status_pembayaran' => 'lunas',
               'metode_pembayaran' => $metodePembayaran,
               'total_harga'       => $totalHargaBaru,
               'updated_at'        => $dateTimeNow
           ]);

        $db->transComplete();

        if ($db->transStatus() === false) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Gagal melunasi tagihan.'], 500);
        }

        return $this->respond([
            'status' => 'sukses',
            'pesan'  => 'Tagihan transaksi berhasil dilunasi!',
            'data'   => [
                'transaksi_id'      => $id,
                'status_pembayaran' => 'lunas',
                'metode_pembayaran' => $metodePembayaran,
                'total_harga'       => $totalHargaBaru
            ]
        ]);
    }

    // Helper Private Methods
    private function dapatkanShortCode($nama)
    {
        if (preg_match('/^[A-Z0-9]{2,10}$/', $nama)) {
            return $nama;
        }
        $cleaned = preg_replace('/[^a-zA-Z0-9\s]/', '', $nama);
        $words = explode(' ', trim($cleaned));
        if (count($words) > 1) {
            $code = '';
            foreach ($words as $w) {
                $code .= strtoupper($w[0] ?? '');
            }
            return $code;
        }
        return strtoupper(substr($cleaned, 0, 6));
    }

    private function dapatkanSiklusTanggal($time, $shiftPertama)
    {
        if (!$shiftPertama) {
            return date('Y-m-d', $time);
        }
        $jamMulai = $shiftPertama['jam_mulai'];
        $toleransi = (int)$shiftPertama['toleransi_sebelum'];

        $calDate = date('Y-m-d', $time);
        $cycleStart = strtotime($calDate . ' ' . $jamMulai) - ($toleransi * 60) + (15 * 60);

        if ($time >= $cycleStart) {
            return $calDate;
        } else {
            return date('Y-m-d', strtotime($calDate . ' -1 day'));
        }
    }

    private function prosesStokProduk($db, $produk, $qty, $usahaId, $now)
    {
        $produkId = $produk->id;

        $komposisi = $db->table('produk_komposisi')
                         ->where('produk_induk_id', $produkId)
                         ->get()->getResult();

        if (!empty($komposisi)) {
            foreach ($komposisi as $comp) {
                $bahan = $db->table('produk_jasa')
                            ->where('id', $comp->produk_bahan_id)
                            ->where('usaha_id', $usahaId)
                            ->get()->getRow();

                if (!$bahan) {
                    return "Bahan baku untuk produk '{$produk->nama_produk}' tidak ditemukan di katalog.";
                }

                $qtyDibutuhkan = (float)$comp->jumlah * $qty;

                if ($bahan->tipe === 'barang' && $bahan->is_stok_dikelola == 1) {
                    if ($bahan->stok < $qtyDibutuhkan) {
                        return "⚠️ Stok bahan '{$bahan->nama_produk}' tidak mencukupi untuk membuat '{$produk->nama_produk}'. Dibutuhkan: {$qtyDibutuhkan} {$bahan->satuan} — Sisa stok: {$bahan->stok} {$bahan->satuan}.";
                    }

                    $db->table('produk_jasa')
                       ->where('id', $comp->produk_bahan_id)
                       ->update([
                           'stok' => $bahan->stok - $qtyDibutuhkan,
                           'updated_at' => $now
                       ]);
                }
            }
        } else {
            if ($produk->tipe === 'barang' && $produk->is_stok_dikelola == 1) {
                if ($produk->stok < $qty) {
                    return "⚠️ Stok '{$produk->nama_produk}' tidak mencukupi. Diminta: {$qty} {$produk->satuan} — Sisa stok: {$produk->stok} {$produk->satuan}.";
                }

                $db->table('produk_jasa')
                   ->where('id', $produkId)
                   ->update([
                       'stok' => $produk->stok - $qty,
                       'updated_at' => $now
                   ]);
            }
        }

        return null;
    }

    // GET /api/transaksi/job-board
    public function jobBoard()
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        $usahaId = $penggunaAktif['usaha_id'];

        $db = \Config\Database::connect();
        $jobs = $db->table('transaksi_detail td')
                   ->select('td.*, t.nomor_invoice, t.pelanggan_id, pj.nama_produk, pj.satuan, u.nama as nama_petugas, cust.nama as nama_pelanggan, t.created_at as waktu_nota, un.kategori as kategori_unit')
                   ->join('transaksi t', 't.id = td.transaksi_id')
                   ->join('produk_jasa pj', 'pj.id = td.produk_id')
                   ->join('unit un', 'un.id = pj.unit_id', 'left')
                   ->join('users u', 'u.id = td.petugas_id', 'left')
                   ->join('users cust', 'cust.id = t.pelanggan_id', 'left')
                   ->where('t.usaha_id', $usahaId)
                   ->whereIn('td.status_pengerjaan', ['Menunggu', 'Dikerjakan'])
                   ->orderBy('td.id', 'ASC')
                   ->get()->getResultArray();

        return $this->respond(['status' => 'sukses', 'data' => $jobs]);
    }

    // POST /api/transaksi/job-board/klaim/(:num)
    public function klaimJob($detailId)
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        $userId = $penggunaAktif['uid'];
        $usahaId = $penggunaAktif['usaha_id'];

        $db = \Config\Database::connect();

        // Cek absensi jika butuh_absen == 1
        $usaha = $db->table('usaha')->where('id', $usahaId)->get()->getRow();
        $butuhAbsen = $usaha ? (int)$usaha->butuh_absen : 1;

        if ($butuhAbsen === 1) {
            $today = date('Y-m-d');
            $absen = $db->table('absensi')
                        ->where('karyawan_id', $userId)
                        ->where('DATE(jam_masuk)', $today)
                        ->where('jam_pulang', null)
                        ->get()->getRow();
            if (!$absen) {
                return $this->respond([
                    'status' => 'gagal',
                    'pesan'  => 'Anda harus melakukan absen masuk (clock-in) terlebih dahulu sebelum dapat mengambil pekerjaan.'
                ], 400);
            }
        }

        $db->transStart();
        $detail = $db->table('transaksi_detail')->where('id', $detailId)->get()->getRow();
        if (!$detail) {
            $db->transRollback();
            return $this->respond(['status' => 'gagal', 'pesan' => 'Pekerjaan tidak ditemukan.'], 404);
        }
        if ($detail->status_pengerjaan !== 'Menunggu') {
            $db->transRollback();
            return $this->respond(['status' => 'gagal', 'pesan' => 'Pekerjaan sudah diambil oleh petugas lain.'], 400);
        }

        $db->table('transaksi_detail')->where('id', $detailId)->update([
            'status_pengerjaan' => 'Dikerjakan',
            'petugas_id'        => $userId,
            'updated_at'        => date('Y-m-d H:i:s')
        ]);

        $transaksi = $db->table('transaksi')->where('id', $detail->transaksi_id)->get()->getRow();
        $produk = $db->table('produk_jasa')->where('id', $detail->produk_id)->get()->getRow();

        $db->transComplete();

        if ($db->transStatus() === false) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Gagal mengklaim pekerjaan.'], 500);
        }

        $namaProduk = $produk ? $produk->nama_produk : 'Produk';
        $invoice = $transaksi ? $transaksi->nomor_invoice : '-';
        $pelangganId = $transaksi ? $transaksi->pelanggan_id : null;

        $recipients = $this->dapatkanKaryawanAktifDanCustomer($db, $usahaId, $pelangganId);
        $this->kirimNotifPekerjaan(
            $usahaId,
            $recipients,
            "Pekerjaan Diambil ⚙️",
            "Pekerjaan '$namaProduk' (Nota: $invoice) sedang dikerjakan oleh " . $penggunaAktif['nama'],
            "/dashboard"
        );

        return $this->respond(['status' => 'sukses', 'pesan' => 'Pekerjaan berhasil diklaim.']);
    }

    // POST /api/transaksi/job-board/selesai/(:num)
    public function selesaiJob($detailId)
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        $userId = $penggunaAktif['uid'];
        $usahaId = $penggunaAktif['usaha_id'];

        $db = \Config\Database::connect();

        $detail = $db->table('transaksi_detail')->where('id', $detailId)->get()->getRow();
        if (!$detail) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Pekerjaan tidak ditemukan.'], 404);
        }
        if ($detail->petugas_id != $userId) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Anda bukan petugas yang ditunjuk untuk pekerjaan ini.'], 403);
        }

        if ($detail->status_pengerjaan !== 'Dikerjakan') {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Status pengerjaan tidak valid untuk diselesaikan.'], 400);
        }

        $db->transStart();

        $db->table('transaksi_detail')->where('id', $detailId)->update([
            'status_pengerjaan' => 'Selesai',
            'petugas_id'        => $userId,
            'updated_at'        => date('Y-m-d H:i:s')
        ]);

        $transaksi = $db->table('transaksi')->where('id', $detail->transaksi_id)->get()->getRow();
        $produk = $db->table('produk_jasa')->where('id', $detail->produk_id)->get()->getRow();
        $namaProduk = $produk ? $produk->nama_produk : 'Produk';
        $invoice = $transaksi ? $transaksi->nomor_invoice : '-';

        // Berikan Poin Otomatis (5 Poin)
        $db->table('points')->insert([
            'karyawan_id'     => $userId,
            'jumlah_poin'     => 5,
            'sumber'          => 'pengerjaan_pesanan',
            'referensi_id'    => $detailId,
            'pemberi_poin_id' => null,
            'keterangan'      => "Menyelesaikan pengerjaan $namaProduk (Nota: $invoice)",
            'tanggal'         => date('Y-m-d'),
            'created_at'      => date('Y-m-d H:i:s'),
            'updated_at'      => date('Y-m-d H:i:s')
        ]);

        $db->transComplete();

        if ($db->transStatus() === false) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Gagal menyelesaikan pekerjaan.'], 500);
        }

        $pelangganId = $transaksi ? $transaksi->pelanggan_id : null;
        $recipients = $this->dapatkanKaryawanAktifDanCustomer($db, $usahaId, $pelangganId);
        $this->kirimNotifPekerjaan(
            $usahaId,
            $recipients,
            "Pekerjaan Selesai! 🎉",
            "Pekerjaan '$namaProduk' (Nota: $invoice) telah selesai dikerjakan.",
            "/dashboard"
        );

        return $this->respond(['status' => 'sukses', 'pesan' => 'Pekerjaan selesai, 5 poin berhasil didapatkan!']);
    }

    private function kirimNotifPekerjaan($usahaId, $karyawanIds, $judul, $pesan, $tautan = null)
    {
        $db = \Config\Database::connect();
        $now = date('Y-m-d H:i:s');

        $dataNotif = [
            'usaha_id'    => $usahaId,
            'judul'       => $judul,
            'pesan'       => $pesan,
            'tautan'      => $tautan,
            'created_at'  => $now,
            'updated_at'  => $now
        ];
        $db->table('notifikasi')->insert($dataNotif);

        if (empty($karyawanIds)) {
            return;
        }

        $subs = $db->table('push_subscriptions')
                   ->whereIn('karyawan_id', $karyawanIds)
                   ->get()->getResult();

        if (empty($subs)) {
            return;
        }

        try {
            $config = new \Config\Vapid();

            if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
                $opensslCnf = 'C:/xampp/apache/conf/openssl.cnf';
                if (file_exists($opensslCnf)) {
                    putenv("OPENSSL_CONF=" . $opensslCnf);
                }
            }

            $auth = [
                'VAPID' => [
                    'subject'    => $config->subject,
                    'publicKey'  => $config->publicKey,
                    'privateKey' => $config->privateKey,
                ]
            ];

            $defaultOptions = [];
            $timeout = 2;
            $clientOptions = [
                'connect_timeout' => 2
            ];
            $webPush = new \Minishlink\WebPush\WebPush($auth, $defaultOptions, $timeout, $clientOptions);
            $payload = json_encode([
                'title' => $judul,
                'body'  => $pesan,
                'link'  => $tautan
            ]);

            foreach ($subs as $sub) {
                $subscription = \Minishlink\WebPush\Subscription::create([
                    'endpoint' => $sub->endpoint,
                    'keys' => [
                        'p256dh' => $sub->p256dh,
                        'auth'   => $sub->auth
                    ]
                ]);

                $webPush->queueNotification($subscription, $payload);
            }

            foreach ($webPush->flush() as $report) {
                if (!$report->isSuccess()) {
                    if ($report->isSubscriptionExpired()) {
                        $db->table('push_subscriptions')
                           ->where('endpoint', $report->getEndpoint())
                           ->delete();
                    }
                }
            }
        } catch (\Throwable $e) {
            log_message('error', 'Push Job Notification error: ' . $e->getMessage());
        }
    }

    private function dapatkanKaryawanAktifDanCustomer($db, $usahaId, $pelangganId = null)
    {
        $usaha = $db->table('usaha')->where('id', $usahaId)->get()->getRow();
        $butuhAbsen = $usaha ? (int)$usaha->butuh_absen : 1;

        $karyawanIds = [];
        if ($butuhAbsen === 1) {
            $today = date('Y-m-d');
            $activeEmployees = $db->table('absensi')
                                  ->select('karyawan_id')
                                  ->where('DATE(jam_masuk)', $today)
                                  ->where('jam_pulang', null)
                                  ->get()->getResultArray();
            $karyawanIds = array_column($activeEmployees, 'karyawan_id');
        } else {
            $allEmployees = $db->table('user_role')
                               ->select('user_id')
                               ->where('usaha_id', $usahaId)
                               ->get()->getResultArray();
            $karyawanIds = array_column($allEmployees, 'user_id');
        }

        return array_unique(array_map('intval', $karyawanIds));
    }

    // ==========================================
    // BILLIARD & PLAYSTATION BILLING & TIMER
    // ==========================================

    public function statusBilliard()
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        if (!$penggunaAktif) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Token tidak valid.'], 401);
        }

        $usahaId = $penggunaAktif['usaha_id'];
        $unitId = $this->request->getGet('unit_id');

        $db = \Config\Database::connect();

        $builder = $db->table('iot_alokasi al')
                      ->select('al.*, i.nama_perangkat, i.tipe_perangkat, i.ip_address, u.nama_unit')
                      ->join('iot i', 'i.id = al.iot_id')
                      ->join('unit u', 'u.id = al.unit_id', 'left')
                      ->where('al.is_aktif', 1);

        if (!empty($usahaId)) {
            $builder->where('al.usaha_id', $usahaId);
        }
        if (!empty($unitId)) {
            $builder->where('al.unit_id', $unitId);
        }

        $alokasi = $builder->get()->getResultArray();

        $now = time();
        $updatedList = [];

        foreach ($alokasi as $al) {
            $device = $al;
            $device['sisa_detik'] = 0;
            $device['durasi_berjalan_detik'] = 0;
            $device['akumulasi_biaya'] = 0;

            if ($al['status_penggunaan'] === 'dipakai' && $al['waktu_mulai']) {
                $startTime = strtotime($al['waktu_mulai']);
                $elapsed = $now - $startTime;
                if ($elapsed < 0) $elapsed = 0;

                if ($al['prepaid_durasi_menit'] > 0) {
                    $totalLimit = $al['prepaid_durasi_menit'] * 60;
                    $remaining = $totalLimit - $elapsed;

                    if ($remaining <= 0) {
                        $this->eksekusiAutoStop($db, $al['id']);
                        $device['status_relay'] = 0;
                        $device['status_penggunaan'] = 'tersedia';
                        $device['transaksi_aktif_id'] = null;
                        $device['sisa_detik'] = 0;
                    } else {
                        $device['sisa_detik'] = $remaining;
                        if ($remaining <= 300 && (int)$al['warning_sent'] === 0) {
                            $db->table('iot_alokasi')->where('id', $al['id'])->update(['warning_sent' => 1]);
                            $this->pemicuKedip($al['ip_address']);
                            $device['warning_sent'] = 1;
                        }
                    }
                } else {
                    $device['durasi_berjalan_detik'] = $elapsed;
                    $totalMenit = (int)ceil($elapsed / 60);
                    if ($totalMenit < 1) $totalMenit = 1;
                    $device['durasi_berjalan_menit'] = $totalMenit;

                    if ($al['transaksi_aktif_id']) {
                        $detail = $db->table('transaksi_detail td')
                                    ->select('td.*, p.harga_jual as produk_harga_jual')
                                    ->join('produk_jasa p', 'p.id = td.produk_id', 'left')
                                    ->where('td.transaksi_id', $al['transaksi_aktif_id'])
                                    ->get()->getRow();
                        if ($detail) {
                            $hargaSatuan = (float)($detail->harga_satuan > 0 ? $detail->harga_satuan : $detail->produk_harga_jual);
                            if ($hargaSatuan <= 0) $hargaSatuan = 25000;
                            $hargaMentah = $totalMenit * ($hargaSatuan / 60);
                            $hargaBulat = ceil($hargaMentah / 500) * 500;
                            $device['estimasi_biaya'] = $hargaBulat;
                            $device['akumulasi_biaya'] = $hargaBulat;
                        }
                    }
                }
            } else if ($al['status_penggunaan'] === 'selesai_menunggu_pembayaran') {
                if ($al['transaksi_aktif_id']) {
                    $detail = $db->table('transaksi_detail')
                                ->where('transaksi_id', $al['transaksi_aktif_id'])
                                ->get()->getRow();
                    if ($detail) {
                        $device['akumulasi_biaya'] = (float)$detail->subtotal;
                        $device['durasi_berjalan_detik'] = (int)($detail->qty * 3600);
                    }
                }
            }

            $updatedList[] = $device;
        }

        return $this->respond(['status' => 'sukses', 'data' => $updatedList]);
    }

    public function mulaiBilliard()
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        if (!$penggunaAktif) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Token tidak valid.'], 401);
        }

        $kasirId = $penggunaAktif['uid'];
        $usahaId = $penggunaAktif['usaha_id'];

        $input = $this->request->getJSON(true) ?: $this->request->getPost();
        $alokasiId = $input['iot_alokasi_id'] ?? null;
        $tipeBilling = $input['tipe_billing'] ?? 'open';
        $durasiMenit = isset($input['durasi_menit']) ? (int)$input['durasi_menit'] : 0;
        $produkId = $input['produk_id'] ?? null;

        if (!$alokasiId || !$produkId) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Alokasi perangkat dan Produk Sewa wajib ditentukan.'], 400);
        }

        if ($tipeBilling === 'regular' && $durasiMenit <= 0) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Durasi bermain regular wajib diisi.'], 400);
        }

        $db = \Config\Database::connect();

        $alokasi = $db->table('iot_alokasi')->where('id', $alokasiId)->where('usaha_id', $usahaId)->get()->getRow();
        if (!$alokasi || $alokasi->status_penggunaan !== 'tersedia') {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Perangkat/meja sedang digunakan atau tidak tersedia.'], 400);
        }

        $produk = $db->table('produk_jasa')->where('id', $produkId)->where('usaha_id', $usahaId)->get()->getRow();
        if (!$produk) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Produk Sewa tidak ditemukan.'], 404);
        }

        $now = date('Y-m-d H:i:s');
        $db->transStart();

        $nomorInvoice = 'INV/BILLIARD/' . date('Ymd') . '/' . sprintf('%04d', rand(1, 9999));
        
        $db->table('transaksi')->insert([
            'usaha_id'          => $usahaId,
            'unit_id'           => $alokasi->unit_id,
            'nomor_invoice'     => $nomorInvoice,
            'kasir_id'          => $kasirId,
            'pelanggan_id'      => null,
            'total_harga'       => 0.00,
            'uang_jaminan'      => 0.00,
            'status_pembayaran' => 'belum_bayar',
            'metode_pembayaran' => null,
            'created_at'        => $now,
            'updated_at'        => $now
        ]);

        $transaksiId = $db->insertID();

        $qty = ($tipeBilling === 'regular') ? round($durasiMenit / 60, 2) : 0.00;
        $subtotal = $qty * (float)$produk->harga_jual;

        $db->table('transaksi_detail')->insert([
            'transaksi_id'      => $transaksiId,
            'produk_id'         => $produkId,
            'qty'               => $qty,
            'harga_satuan'      => $produk->harga_jual,
            'subtotal'          => $subtotal,
            'status_pengerjaan' => 'Selesai',
            'created_at'        => $now,
            'updated_at'        => $now
        ]);

        if ($tipeBilling === 'regular') {
            $db->table('transaksi')->where('id', $transaksiId)->update([
                'total_harga' => $subtotal
            ]);
        }

        $db->table('iot_alokasi')->where('id', $alokasiId)->update([
            'status_relay'         => 1,
            'status_penggunaan'    => 'dipakai',
            'transaksi_aktif_id'   => $transaksiId,
            'prepaid_durasi_menit' => ($tipeBilling === 'regular') ? $durasiMenit : null,
            'waktu_mulai'          => $now,
            'warning_sent'         => 0,
            'updated_at'           => $now
        ]);

        $db->transComplete();

        if ($db->transStatus() === false) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Gagal memulai sesi.'], 500);
        }

        $device = $db->table('iot')->where('id', $alokasi->iot_id)->get()->getRow();
        if ($device && $device->ip_address) {
            $this->kirimSinyalRelay($device->ip_address, 'on');
        }

        return $this->respond([
            'status' => 'sukses',
            'pesan'  => 'Sesi billing sewa berhasil dimulai!',
            'data'   => [
                'transaksi_id' => $transaksiId,
                'invoice'      => $nomorInvoice
            ]
        ]);
    }

    public function tambahDurasiBilliard()
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        if (!$penggunaAktif) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Token tidak valid.'], 401);
        }

        $usahaId = $penggunaAktif['usaha_id'];

        $input = $this->request->getJSON(true) ?: $this->request->getPost();
        $alokasiId = $input['iot_alokasi_id'] ?? null;
        $tambahanMenit = isset($input['tambahan_menit']) ? (int)$input['tambahan_menit'] : 0;

        if (!$alokasiId || $tambahanMenit <= 0) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'ID alokasi dan tambahan durasi wajib diisi.'], 400);
        }

        $db = \Config\Database::connect();

        $alokasi = $db->table('iot_alokasi')->where('id', $alokasiId)->where('usaha_id', $usahaId)->get()->getRow();
        if (!$alokasi || $alokasi->status_penggunaan !== 'dipakai' || !$alokasi->prepaid_durasi_menit) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Hanya sesi regular aktif yang dapat ditambahkan durasi.'], 400);
        }

        $now = date('Y-m-d H:i:s');
        $db->transStart();

        $durasiBaru = $alokasi->prepaid_durasi_menit + $tambahanMenit;
        $db->table('iot_alokasi')->where('id', $alokasiId)->update([
            'prepaid_durasi_menit' => $durasiBaru,
            'warning_sent'         => 0,
            'updated_at'           => $now
        ]);

        if ($alokasi->transaksi_aktif_id) {
            $detail = $db->table('transaksi_detail')->where('transaksi_id', $alokasi->transaksi_aktif_id)->get()->getRow();
            if ($detail) {
                $qtyBaru = round($durasiBaru / 60, 2);
                $subtotalBaru = $qtyBaru * (float)$detail->harga_satuan;

                $db->table('transaksi_detail')->where('id', $detail->id)->update([
                    'qty'        => $qtyBaru,
                    'subtotal'   => $subtotalBaru,
                    'updated_at' => $now
                ]);

                $db->table('transaksi')->where('id', $alokasi->transaksi_aktif_id)->update([
                    'total_harga' => $subtotalBaru,
                    'updated_at'  => $now
                ]);
            }
        }

        $db->transComplete();

        if ($db->transStatus() === false) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Gagal menambahkan durasi.'], 500);
        }

        return $this->respond(['status' => 'sukses', 'pesan' => "Durasi sewa berhasil ditambah $tambahanMenit menit."]);
    }

    public function kedipBilliard()
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        if (!$penggunaAktif) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Token tidak valid.'], 401);
        }

        $input = $this->request->getJSON(true) ?: $this->request->getPost();
        $alokasiId = $input['iot_alokasi_id'] ?? null;

        if (!$alokasiId) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Parameter iot_alokasi_id wajib.'], 400);
        }

        $db = \Config\Database::connect();
        $alokasi = $db->table('iot_alokasi al')
                      ->select('al.*, i.ip_address')
                      ->join('iot i', 'i.id = al.iot_id')
                      ->where('al.id', $alokasiId)
                      ->get()->getRow();

        if ($alokasi && $alokasi->ip_address) {
            $this->pemicuKedip($alokasi->ip_address);
        }

        return $this->respond(['status' => 'sukses', 'pesan' => 'Kedipan berhasil dipicu.']);
    }

    public function stopBilliard()
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        if (!$penggunaAktif) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Token tidak valid.'], 401);
        }

        $usahaId = $penggunaAktif['usaha_id'];

        $input = $this->request->getJSON(true) ?: $this->request->getPost();
        $alokasiId = $input['iot_alokasi_id'] ?? null;

        if (!$alokasiId) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Parameter iot_alokasi_id wajib.'], 400);
        }

        $db = \Config\Database::connect();

        $alokasi = $db->table('iot_alokasi')->where('id', $alokasiId)->where('usaha_id', $usahaId)->get()->getRow();
        if (!$alokasi || $alokasi->status_penggunaan !== 'dipakai') {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Meja/perangkat tidak sedang digunakan.'], 400);
        }

        $now = date('Y-m-d H:i:s');
        $db->transStart();

        $startTime = strtotime($alokasi->waktu_mulai);
        $elapsedMinutes = (int)ceil((time() - $startTime) / 60);
        if ($elapsedMinutes < 1) $elapsedMinutes = 1;

        if ($alokasi->prepaid_durasi_menit > 0 && $elapsedMinutes > $alokasi->prepaid_durasi_menit) {
            $elapsedMinutes = (int)$alokasi->prepaid_durasi_menit;
        }

        $transaksiId = $alokasi->transaksi_aktif_id;
        if ($transaksiId) {
            $detail = $db->table('transaksi_detail')->where('transaksi_id', $transaksiId)->get()->getRow();
            if ($detail) {
                $hargaPerJam = (float)$detail->harga_satuan;
                if ($alokasi->prepaid_durasi_menit > 0) {
                    $subtotal = round(($elapsedMinutes / 60) * $hargaPerJam);
                } else {
                    $hargaMentah = $elapsedMinutes * ($hargaPerJam / 60);
                    $subtotal = ceil($hargaMentah / 500) * 500;
                }

                $db->table('transaksi_detail')->where('id', $detail->id)->update([
                    'qty'          => $elapsedMinutes,
                    'durasi_menit' => $elapsedMinutes,
                    'subtotal'     => $subtotal,
                    'updated_at'   => $now
                ]);

                $db->table('transaksi')->where('id', $transaksiId)->update([
                    'total_harga' => $subtotal,
                    'updated_at'  => $now
                ]);
            }
        }

        $isRegular = ($alokasi->prepaid_durasi_menit > 0);
        $statusRelayBaru = $isRegular ? 0 : 1;
        $statusPenggunaanBaru = $isRegular ? 'tersedia' : 'selesai_menunggu_pembayaran';

        $updateData = [
            'status_relay'      => $statusRelayBaru,
            'status_penggunaan' => $statusPenggunaanBaru,
            'updated_at'        => $now
        ];

        if ($isRegular) {
            $updateData['transaksi_aktif_id']   = null;
            $updateData['prepaid_durasi_menit'] = null;
            $updateData['waktu_mulai']          = null;
            $updateData['warning_sent']         = 0;
        }

        $db->table('iot_alokasi')->where('id', $alokasiId)->update($updateData);

        $db->transComplete();

        if ($db->transStatus() === false) {
            return $this->respond(['status' => 'gagal', 'pesan' => 'Gagal menghentikan sewa.'], 500);
        }

        if ($isRegular) {
            $device = $db->table('iot')->where('id', $alokasi->iot_id)->get()->getRow();
            if ($device && $device->ip_address) {
                $this->kirimSinyalRelay($device->ip_address, 'off');
            }
        }

        return $this->respond([
            'status' => 'sukses',
            'pesan'  => 'Sesi billing sewa berhasil dihentikan.',
            'data'   => [
                'transaksi_id' => $transaksiId,
                'is_regular'   => $isRegular
            ]
        ]);
    }

    private function eksekusiAutoStop($db, $alokasiId)
    {
        $alokasi = $db->table('iot_alokasi')->where('id', $alokasiId)->get()->getRow();
        if (!$alokasi || $alokasi->status_penggunaan !== 'dipakai') {
            return;
        }

        $now = date('Y-m-d H:i:s');
        $db->transStart();

        $startTime = strtotime($alokasi->waktu_mulai);
        $elapsedMinutes = ceil((time() - $startTime) / 60);
        if ($alokasi->prepaid_durasi_menit > 0 && $elapsedMinutes > $alokasi->prepaid_durasi_menit) {
            $elapsedMinutes = $alokasi->prepaid_durasi_menit;
        }

        if ($alokasi->transaksi_aktif_id) {
            $detail = $db->table('transaksi_detail')->where('transaksi_id', $alokasi->transaksi_aktif_id)->get()->getRow();
            if ($detail) {
                $qty = round($elapsedMinutes / 60, 2);
                $subtotal = $qty * (float)$detail->harga_satuan;

                $db->table('transaksi_detail')->where('id', $detail->id)->update([
                    'qty'        => $qty,
                    'subtotal'   => $subtotal,
                    'updated_at' => $now
                ]);

                $db->table('transaksi')->where('id', $alokasi->transaksi_aktif_id)->update([
                    'total_harga' => $subtotal,
                    'updated_at'  => $now
                ]);
            }
        }

        $db->table('iot_alokasi')->where('id', $alokasiId)->update([
            'status_relay'         => 0,
            'status_penggunaan'    => 'tersedia',
            'transaksi_aktif_id'   => null,
            'prepaid_durasi_menit' => null,
            'waktu_mulai'          => null,
            'warning_sent'         => 0,
            'updated_at'           => $now
        ]);

        $db->transComplete();

        $device = $db->table('iot')->where('id', $alokasi->iot_id)->get()->getRow();
        if ($device && $device->ip_address) {
            $this->kirimSinyalRelay($device->ip_address, 'off');
        }
    }

    private function matikanLampuBilliardJikaLunas($db, $transaksiId, $now)
    {
        $alokasi = $db->table('iot_alokasi')
                      ->where('transaksi_aktif_id', $transaksiId)
                      ->whereIn('status_penggunaan', ['dipakai', 'selesai_menunggu_pembayaran'])
                      ->get()->getRow();

        if ($alokasi) {
            if ($alokasi->waktu_mulai) {
                $startTime = strtotime($alokasi->waktu_mulai);
                $elapsedMinutes = (int)ceil((time() - $startTime) / 60);
                if ($elapsedMinutes < 1) $elapsedMinutes = 1;

                if ($alokasi->prepaid_durasi_menit > 0 && $elapsedMinutes > $alokasi->prepaid_durasi_menit) {
                    $elapsedMinutes = (int)$alokasi->prepaid_durasi_menit;
                }

                $detail = $db->table('transaksi_detail')->where('transaksi_id', $transaksiId)->get()->getRow();
                if ($detail) {
                    $hargaPerJam = (float)$detail->harga_satuan;
                    if ($alokasi->prepaid_durasi_menit > 0) {
                        $subtotal = round(($elapsedMinutes / 60) * $hargaPerJam);
                    } else {
                        $hargaMentah = $elapsedMinutes * ($hargaPerJam / 60);
                        $subtotal = ceil($hargaMentah / 500) * 500;
                    }

                    $db->table('transaksi_detail')->where('id', $detail->id)->update([
                        'qty'          => $elapsedMinutes,
                        'durasi_menit' => $elapsedMinutes,
                        'subtotal'     => $subtotal,
                        'updated_at'   => $now
                    ]);

                    $db->table('transaksi')->where('id', $transaksiId)->update([
                        'total_harga' => $subtotal,
                        'updated_at'  => $now
                    ]);
                }
            }

            $db->table('iot_alokasi')->where('id', $alokasi->id)->update([
                'status_relay'         => 0,
                'status_penggunaan'    => 'tersedia',
                'transaksi_aktif_id'   => null,
                'prepaid_durasi_menit' => null,
                'waktu_mulai'          => null,
                'warning_sent'         => 0,
                'updated_at'           => $now
            ]);

            $device = $db->table('iot')->where('id', $alokasi->iot_id)->get()->getRow();
            if ($device && $device->ip_address) {
                $this->kirimSinyalRelay($device->ip_address, 'off');
            }
        }
    }

    private function pemicuKedip($ipAddress)
    {
        $this->kirimSinyalRelay($ipAddress, 'off');
        usleep(1500000);
        $this->kirimSinyalRelay($ipAddress, 'on');
    }

    private function kirimSinyalRelay($ipAddress, $status)
    {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "http://" . $ipAddress . "/relay/" . $status);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 2);
        curl_exec($ch);
        curl_close($ch);
    }
}
