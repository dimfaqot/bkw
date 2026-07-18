<?php

namespace App\Modules\Manajemen\Controllers;

use CodeIgniter\RESTful\ResourceController;

class Transaksi extends ResourceController
{
    protected $format = 'json';

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

        // Generate nomor invoice: KODE_USAHA/KODE_UNIT/YYYYMMDD/NO_URUT
        $kodeUsaha = $this->dapatkanShortCode($usaha['nama_usaha']);
        $kodeUnit = $this->dapatkanShortCode($unit['nama_unit']);
        $today = date('Ymd');
        $prefix = "$kodeUsaha/$kodeUnit/$today/";

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

            if (!$produkId || $qty <= 0) {
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

            $detailData = [
                'transaksi_id'   => $transaksiId,
                'produk_id'      => $produkId,
                'qty'            => $qty,
                'harga_satuan'   => $hargaSatuan,
                'subtotal'       => $subtotal,
                'created_at'     => $now,
                'updated_at'     => $now
            ];

            $db->table('transaksi_detail')->insert($detailData);
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
                              ->select('td.*, p.nama_produk, p.satuan, p.tipe')
                              ->join('produk_jasa p', 'p.id = td.produk_id', 'left')
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
                           ->select('td.*, p.nama_produk, p.satuan, p.tipe')
                           ->join('produk_jasa p', 'p.id = td.produk_id', 'left')
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

            if (!$produkId || $qtyBaru <= 0) {
                $db->transRollback();
                return $this->respond(['status' => 'gagal', 'pesan' => 'Item produk atau kuantitas tidak valid.'], 400);
            }

            $produk = $db->table('produk_jasa')
                         ->where('id', $produkId)
                         ->where('usaha_id', $usahaId)
                         ->get()->getRow();

            if (!$produk) {
                $db->transRollback();
                return $this->respond(['status' => 'gagal', 'pesan' => "Produk #{$produkId} tidak ditemukan."], 404);
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

                    $subtotalBaru = $hargaSatuan * $qtyBaru;
                    $db->table('transaksi_detail')
                       ->where('id', $detailLama['id'])
                       ->update([
                           'qty'        => $qtyBaru,
                           'subtotal'   => $subtotalBaru,
                           'updated_at' => $dateTimeNow
                       ]);
                }
            } else {
                $err = $this->prosesStokProduk($db, $produk, $qtyBaru, $usahaId, $dateTimeNow);
                if ($err) {
                    $db->transRollback();
                    return $this->respond(['status' => 'gagal', 'pesan' => $err], 400);
                }

                $subtotal = $hargaSatuan * $qtyBaru;
                $db->table('transaksi_detail')->insert([
                    'transaksi_id' => $id,
                    'produk_id'    => $produkId,
                    'qty'          => $qtyBaru,
                    'harga_satuan' => $hargaSatuan,
                    'subtotal'     => $subtotal,
                    'created_at'   => $dateTimeNow,
                    'updated_at'   => $dateTimeNow
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

                if (!$produkId || $qtyBaru <= 0) {
                    $db->transRollback();
                    return $this->respond(['status' => 'gagal', 'pesan' => 'Item produk atau kuantitas tidak valid.'], 400);
                }

                $produk = $db->table('produk_jasa')
                             ->where('id', $produkId)
                             ->where('usaha_id', $usahaId)
                             ->get()->getRow();

                if (!$produk) {
                    $db->transRollback();
                    return $this->respond(['status' => 'gagal', 'pesan' => "Produk #{$produkId} tidak ditemukan."], 404);
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

                        $subtotalBaru = $hargaSatuan * $qtyBaru;
                        $db->table('transaksi_detail')
                           ->where('id', $detailLama['id'])
                           ->update([
                               'qty'        => $qtyBaru,
                               'subtotal'   => $subtotalBaru,
                               'updated_at' => $dateTimeNow
                           ]);
                    }
                } else {
                    $err = $this->prosesStokProduk($db, $produk, $qtyBaru, $usahaId, $dateTimeNow);
                    if ($err) {
                        $db->transRollback();
                        return $this->respond(['status' => 'gagal', 'pesan' => $err], 400);
                    }

                    $subtotal = $hargaSatuan * $qtyBaru;
                    $db->table('transaksi_detail')->insert([
                        'transaksi_id' => $id,
                        'produk_id'    => $produkId,
                        'qty'          => $qtyBaru,
                        'harga_satuan' => $hargaSatuan,
                        'subtotal'     => $subtotal,
                        'created_at'   => $dateTimeNow,
                        'updated_at'   => $dateTimeNow
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
}
