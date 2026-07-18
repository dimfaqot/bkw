<?php

namespace App\Modules\Manajemen\Controllers;

use CodeIgniter\RESTful\ResourceController;
use CodeIgniter\API\ResponseTrait;

class Manajemen extends ResourceController
{
    use ResponseTrait;

    protected $format = 'json';

    private $daftarTabel = ['users', 'usaha', 'unit', 'roles', 'user_role', 'menus', 'role_permissions', 'iot', 'iot_alokasi', 'shift', 'jadwal_karyawan', 'absensi', 'kriteria_poin', 'points', 'perizinan', 'lembur', 'kebersihan', 'kebersihan_tugas', 'produk_jasa', 'transaksi', 'transaksi_detail', 'produk_komposisi'];

    // Validasi input untuk masing-masing tabel
    private function dapatkanValidasi($tabel, $id = null)
    {
        $aturan = [];
        if ($tabel === 'users') {
            $aturan = [
                'nama'  => [
                    'rules'  => 'required|min_length[3]',
                    'errors' => [
                        'required'   => 'Nama lengkap wajib diisi.',
                        'min_length' => 'Nama minimal 3 karakter.'
                    ]
                ],
                'wa'    => [
                    'rules'  => $id ? "required|numeric|min_length[9]|is_unique[users.wa,id,{$id}]" : 'required|numeric|min_length[9]|is_unique[users.wa]',
                    'errors' => [
                        'required'   => 'Nomor WhatsApp wajib diisi.',
                        'numeric'    => 'Nomor WhatsApp hanya boleh berisi angka.',
                        'min_length' => 'Nomor WhatsApp minimal 9 angka.',
                        'is_unique'  => 'Nomor WhatsApp ini sudah terdaftar oleh pengguna lain.'
                    ]
                ],
                'email' => [
                    'rules'  => $id ? "permit_empty|valid_email|is_unique[users.email,id,{$id}]" : 'permit_empty|valid_email|is_unique[users.email]',
                    'errors' => [
                        'valid_email' => 'Format email tidak valid.',
                        'is_unique'   => 'Alamat email ini sudah terdaftar oleh pengguna lain.'
                    ]
                ]
            ];
        } else if ($tabel === 'usaha') {
            $aturan = [
                'nama_usaha' => [
                    'rules'  => $id ? "required|min_length[3]|is_unique[usaha.nama_usaha,id,{$id}]" : 'required|min_length[3]|is_unique[usaha.nama_usaha]',
                    'errors' => [
                        'required'   => 'Nama usaha wajib diisi.',
                        'min_length' => 'Nama usaha minimal 3 karakter.',
                        'is_unique'  => 'Nama usaha ini sudah terdaftar. Gunakan nama lain.'
                    ]
                ],
                'pendiri' => 'permit_empty|min_length[3]',
                'butuh_absen' => 'permit_empty|in_list[0,1]'
            ];
        } else if ($tabel === 'unit') {
            $aturan = [
                'usaha_id'  => 'required|numeric',
                'nama_unit' => 'required|min_length[3]',
                'kategori'  => 'required|in_list[kantin,billiard,rental_mobil,salon,multimedia,cuci_kendaraan]',
            ];
        } else if ($tabel === 'roles') {
            $aturan = [
                'nama_role' => [
                    'rules'  => $id ? "required|min_length[3]|is_unique[roles.nama_role,id,{$id}]" : 'required|min_length[3]|is_unique[roles.nama_role]',
                    'errors' => [
                        'required'   => 'Nama role wajib diisi.',
                        'min_length' => 'Nama role minimal 3 karakter.',
                        'is_unique'  => 'Nama role ini sudah terdaftar. Gunakan nama lain.'
                    ]
                ]
            ];
        } else if ($tabel === 'user_role') {
            $aturan = [
                'user_id'  => 'required|numeric',
                'usaha_id' => 'permit_empty|numeric',
                'role_id'  => 'required|numeric',
            ];
        } else if ($tabel === 'menus') {
            $aturan = [
                'label'    => [
                    'rules'  => $id ? "required|is_unique[menus.label,id,{$id}]" : 'required|is_unique[menus.label]',
                    'errors' => [
                        'required'   => 'Label menu wajib diisi.',
                        'is_unique'  => 'Label menu sudah terdaftar. Gunakan label lain.'
                    ]
                ],
                'icon'     => [
                    'rules'  => $id ? "required|is_unique[menus.icon,id,{$id}]" : 'required|is_unique[menus.icon]',
                    'errors' => [
                        'required'   => 'Icon menu wajib diisi.',
                        'is_unique'  => 'Icon menu sudah terdaftar. Gunakan icon lain.'
                    ]
                ],
                'urutan'   => [
                    'rules'  => $id ? "required|numeric|is_unique[menus.urutan,id,{$id}]" : 'required|numeric|is_unique[menus.urutan]',
                    'errors' => [
                        'required'   => 'Urutan menu wajib diisi.',
                        'numeric'    => 'Urutan menu harus berupa angka.',
                        'is_unique'  => 'Urutan menu ini sudah terdaftar. Gunakan angka urutan lain.'
                    ]
                ],
                'url'      => 'required',
                'is_aktif' => 'required|in_list[0,1]'
            ];
        } else if ($tabel === 'role_permissions') {
            $aturan = [
                'role_id'    => 'required|numeric',
                'menu_id'    => 'required|numeric',
                'can_read'   => 'required|in_list[0,1]',
                'can_create' => 'required|in_list[0,1]',
                'can_update' => 'required|in_list[0,1]',
                'can_delete' => 'required|in_list[0,1]'
            ];
        } else if ($tabel === 'iot') {
            $aturan = [
                'nama_perangkat' => 'required|min_length[3]',
                'mac_address'    => [
                    'rules'  => $id ? "required|min_length[3]|is_unique[iot.mac_address,id,{$id}]" : 'required|min_length[3]|is_unique[iot.mac_address]',
                    'errors' => [
                        'required'   => 'Alamat MAC / Serial wajib diisi.',
                        'min_length' => 'Alamat MAC minimal 3 karakter.',
                        'is_unique'  => 'Alamat MAC ini sudah terdaftar oleh perangkat lain.'
                    ]
                ],
                'tipe_perangkat' => 'required|in_list[billiard,android_tv,saklar_umum]',
                'is_aktif'       => 'required|in_list[0,1]'
            ];
        } else if ($tabel === 'iot_alokasi') {
            $aturan = [
                'iot_id'   => [
                    'rules'  => $id ? "required|numeric|is_unique[iot_alokasi.iot_id,id,{$id}]" : 'required|numeric|is_unique[iot_alokasi.iot_id]',
                    'errors' => [
                        'required'  => 'Perangkat IoT wajib dipilih.',
                        'numeric'   => 'ID IoT harus berupa angka.',
                        'is_unique' => 'Perangkat IoT ini sudah dialokasikan ke cabang/usaha lain.'
                    ]
                ],
                'usaha_id'          => 'required|numeric',
                'unit_id'           => 'permit_empty|numeric',
                'status_relay'      => 'permit_empty|in_list[0,1]',
                'status_penggunaan' => 'permit_empty|in_list[tersedia,dipakai,gangguan]',
                'is_aktif'          => 'required|in_list[0,1]'
            ];
        } else if ($tabel === 'shift') {
            $aturan = [
                'usaha_id'            => 'required|numeric',
                'nama_shift'          => 'required|min_length[2]',
                'jam_mulai'           => 'required',
                'jam_selesai'         => 'required',
                'toleransi_terlambat' => 'permit_empty|numeric',
                'toleransi_sebelum'   => 'permit_empty|numeric'
            ];
        } else if ($tabel === 'jadwal_karyawan') {
            $aturan = [
                'usaha_id'    => 'required|numeric',
                'karyawan_id' => 'required|numeric',
                'shift_id'    => 'permit_empty|numeric',
                'hari'        => 'permit_empty|in_list[Senin,Selasa,Rabu,Kamis,Jumat,Sabtu,Minggu]'
            ];
        } else if ($tabel === 'lembur') {
            $aturan = [
                'usaha_id'    => 'required|numeric',
                'karyawan_id' => 'required|numeric',
                'tanggal'     => 'required|valid_date[Y-m-d]',
                'jam_mulai'   => 'required',
                'jam_selesai' => 'required',
                'keterangan'  => 'permit_empty',
                'status'      => 'permit_empty|in_list[ditunjuk,diterima_karyawan,ditolak_karyawan]',
                'catatan_penolakan' => 'permit_empty'
            ];
        } else if ($tabel === 'absensi') {
            $aturan = [
                'jadwal_karyawan_id' => 'permit_empty|numeric',
                'karyawan_id'        => 'required|numeric',
                'jam_masuk'          => 'required',
                'jam_pulang'         => 'permit_empty',
                'status_kehadiran'   => 'required'
            ];
        } else if ($tabel === 'kriteria_poin') {
            $aturan = [
                'usaha_id'      => 'required|numeric',
                'nama_kriteria' => 'required|min_length[3]',
                'nilai_poin'    => 'required|numeric',
                'is_otomatis'   => 'permit_empty|in_list[0,1]',
                'kode_sistem'   => 'permit_empty'
            ];
        } else if ($tabel === 'points') {
            $aturan = [
                'karyawan_id'     => 'required|numeric',
                'jumlah_poin'     => 'required|numeric',
                'sumber'          => 'required',
                'referensi_id'    => 'permit_empty|numeric',
                'pemberi_poin_id' => 'permit_empty|numeric',
                'keterangan'      => 'required',
                'tanggal'         => 'required|valid_date[Y-m-d]'
            ];
        } else if ($tabel === 'perizinan') {
            $aturan = [
                'karyawan_id'           => 'required|numeric',
                'karyawan_pengganti_id' => 'permit_empty|numeric',
                'jenis_izin'            => 'required|in_list[izin,sakit]',
                'tanggal'               => 'required|valid_date[Y-m-d]',
                'alasan'                => 'required',
                'dokumen_bukti'         => 'permit_empty',
                'status'                => 'permit_empty|in_list[menunggu_pengganti,ditolak_pengganti,menunggu_persetujuan,disetujui,ditolak]',
                'disetujui_oleh'        => 'permit_empty|numeric',
                'catatan_atasan'        => 'permit_empty'
            ];
        } else if ($tabel === 'kebersihan') {
            $aturan = [
                'usaha_id'    => 'required|numeric',
                'nama_area'   => 'required|min_length[2]',
                'jam_mulai'   => 'required',
                'jam_selesai' => 'required'
            ];
        } else if ($tabel === 'kebersihan_tugas') {
            $aturan = [
                'kebersihan_id'        => 'required|numeric',
                'tanggal'              => 'required|valid_date[Y-m-d]',
                'karyawan_id'          => 'permit_empty|numeric',
                'ditunjuk_karyawan_id' => 'permit_empty|numeric',
                'status'               => 'required|in_list[belum_dibersihkan,menunggu_verifikasi,selesai,tidak_bersih]',
                'catatan_atasan'       => 'permit_empty',
                'waktu_dibersihkan'    => 'permit_empty',
                'waktu_diverifikasi'   => 'permit_empty'
            ];
        } else if ($tabel === 'produk_jasa') {
            $aturan = [
                'usaha_id'         => 'required|numeric',
                'unit_id'          => 'permit_empty|numeric',
                'nama_produk'      => 'required|min_length[3]',
                'tipe'             => 'required|in_list[barang,jasa,sewa]',
                'harga_beli'       => 'permit_empty|numeric',
                'harga_jual'       => 'required|numeric',
                'stok'             => 'permit_empty|numeric',
                'stok_minimum'     => 'permit_empty|numeric',
                'is_stok_dikelola' => 'permit_empty|in_list[0,1]',
                'butuh_persiapan'  => 'permit_empty|in_list[0,1]',
                'satuan'           => 'permit_empty'
            ];
        } else if ($tabel === 'transaksi') {
            $aturan = [
                'usaha_id'          => 'required|numeric',
                'nomor_invoice'     => 'required',
                'kasir_id'          => 'required|numeric',
                'total_harga'       => 'required|numeric',
                'uang_jaminan'      => 'permit_empty|numeric',
                'status_pembayaran' => 'required|in_list[belum_bayar,lunas]'
            ];
        } else if ($tabel === 'transaksi_detail') {
            $aturan = [
                'transaksi_id'      => 'required|numeric',
                'produk_id'         => 'required|numeric',
                'qty'               => 'required|numeric',
                'harga_satuan'      => 'required|numeric',
                'subtotal'          => 'required|numeric',
                'tipe_sewa'         => 'permit_empty|in_list[open,reguler]',
                'waktu_mulai'       => 'permit_empty',
                'waktu_selesai'     => 'permit_empty',
                'durasi_menit'      => 'permit_empty|numeric',
                'status_sewa'       => 'permit_empty|in_list[aktif,selesai]',
                'status_pengerjaan' => 'permit_empty|in_list[Menunggu,Dikerjakan,Selesai]',
                'petugas_id'        => 'permit_empty|numeric',
                'komisi_petugas'    => 'permit_empty|numeric'
            ];
        } else if ($tabel === 'produk_komposisi') {
            $aturan = [
                'produk_induk_id' => 'required|numeric',
                'produk_bahan_id' => 'required|numeric',
                'jumlah'          => 'required|numeric'
            ];
        }
        return $aturan;
    }

    // Merapikan inputan agar konsisten
    private function formatData($tabel, $input)
    {
        if ($tabel === 'users') {
            if (isset($input['nama'])) $input['nama'] = ucwords(strtolower($input['nama']));
            if (isset($input['email'])) $input['email'] = strtolower($input['email']);
        } else if ($tabel === 'menus') {
            if (isset($input['label'])) $input['label'] = ucwords(strtolower($input['label']));
            if (isset($input['grup'])) $input['grup'] = ucwords(strtolower($input['grup']));
            if (isset($input['icon'])) {
                $input['icon'] = str_replace(' ', '', ucwords(str_replace(['-', '_'], ' ', $input['icon'])));
            }
            if (isset($input['url'])) $input['url'] = strtolower($input['url']);
            if (isset($input['tabel'])) $input['tabel'] = strtolower($input['tabel']);
        } else if ($tabel === 'roles') {
            if (isset($input['nama_role'])) $input['nama_role'] = ucwords(strtolower($input['nama_role']));
            if (isset($input['deskripsi'])) {
                $teks = ucfirst(strtolower($input['deskripsi']));
                $input['deskripsi'] = preg_replace_callback('/([.?!])\s*([a-z])/', function ($matches) {
                    return $matches[1] . ' ' . strtoupper($matches[2]);
                }, $teks);
            }
        } else if ($tabel === 'unit') {
            if (isset($input['nama_unit'])) $input['nama_unit'] = ucwords(strtolower($input['nama_unit']));
        } else if ($tabel === 'usaha') {
            if (isset($input['nama_usaha'])) $input['nama_usaha'] = ucwords(strtolower($input['nama_usaha']));
            if (isset($input['pendiri'])) $input['pendiri'] = ucwords(strtolower($input['pendiri']));
            if (isset($input['alamat'])) $input['alamat'] = ucwords(strtolower($input['alamat']));
            if (isset($input['no_izin'])) $input['no_izin'] = strtoupper($input['no_izin']);
        } else if ($tabel === 'shift') {
            if (isset($input['nama_shift'])) $input['nama_shift'] = ucwords(strtolower($input['nama_shift']));
        }
        return $input;
    }

    // Ambil semua data dari tabel tertentu
    public function ambilData($tabel)
    {
        if (!in_array($tabel, $this->daftarTabel)) {
            return $this->failNotFound("Tabel '$tabel' tidak ditemukan atau tidak diizinkan.");
        }

        $db = \Config\Database::connect();
        $builder = $db->table($tabel);

        // ==== ISOLASI DATA (MULTI-TENANT) ====
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        $usahaId = $penggunaAktif['usaha_id'] ?? null; // Akan bernilai null jika masuk sebagai Global (Sistem Inti)
        $roleAktif = strtolower($penggunaAktif['role'] ?? '');

        // Jika user berada di konteks usaha tertentu (bukan Global)
        if ($usahaId !== null) {
            if ($db->fieldExists('usaha_id', $tabel)) {
                $builder->where($tabel . '.usaha_id', $usahaId);
            } else if ($tabel === 'usaha') {
                $builder->where('id', $usahaId);
            } else if ($tabel === 'iot') {
                $builder->join('iot_alokasi', 'iot_alokasi.iot_id = iot.id')
                        ->where('iot_alokasi.usaha_id', $usahaId)
                        ->select('iot.*');
            }
            
            // Filter keamanan tambahan untuk Konteks Usaha:
            if ($tabel === 'users') {
                if ($roleAktif !== 'kasir') {
                    // Filter hanya user yang terdaftar pada usaha ini
                    $builder->join('user_role', 'user_role.user_id = users.id')
                            ->where('user_role.usaha_id', $usahaId)
                            ->select('users.*, user_role.usaha_id')
                            ->groupBy('users.id');
                } else {
                    // Kasir bisa mengakses semua user (baik dalam 1 usaha maupun tidak)
                    $builder->join('user_role', 'user_role.user_id = users.id', 'left')
                            ->select('users.*, user_role.usaha_id')
                            ->groupBy('users.id');
                }

                // Cari id user yang memiliki role 'root'
                $rootRole = $db->table('roles')->where('nama_role', 'root')->get()->getRowArray();
                if ($rootRole) {
                    $rootUsers = $db->table('user_role')->select('user_id')->where('role_id', $rootRole['id'])->get()->getResultArray();
                    $rootIds = array_column($rootUsers, 'user_id');
                    if (!empty($rootIds)) {
                        $builder->whereNotIn('users.id', $rootIds);
                    }
                }
            } else if ($tabel === 'roles') {
                // Sembunyikan role dewa dari level manajemen usaha
                $builder->whereNotIn('nama_role', ['root', 'owner', 'supervisor']);
            } else if ($tabel === 'user_role') {
                // Sembunyikan dari tabel user_role juga
                $rolesToHide = $db->table('roles')->whereIn('nama_role', ['root', 'owner', 'supervisor'])->get()->getResultArray();
                $roleIdsToHide = array_column($rolesToHide, 'id');
                if (!empty($roleIdsToHide)) {
                    $builder->whereNotIn('role_id', $roleIdsToHide);
                }
            } else if ($tabel === 'absensi') {
                $builder->join('user_role', 'user_role.user_id = absensi.karyawan_id')
                        ->where('user_role.usaha_id', $usahaId)
                        ->select('absensi.*');
            } else if ($tabel === 'points') {
                $builder->join('user_role', 'user_role.user_id = points.karyawan_id')
                        ->where('user_role.usaha_id', $usahaId)
                        ->select('points.*');
            } else if ($tabel === 'perizinan') {
                $builder->join('user_role', 'user_role.user_id = perizinan.karyawan_id')
                        ->where('user_role.usaha_id', $usahaId)
                        ->select('perizinan.*');
            } else if ($tabel === 'kebersihan_tugas') {
                $builder->join('kebersihan k_filter', 'k_filter.id = kebersihan_tugas.kebersihan_id')
                        ->where('k_filter.usaha_id', $usahaId)
                        ->select('kebersihan_tugas.*');
            } else if ($tabel === 'transaksi_detail') {
                $builder->join('transaksi', 'transaksi.id = transaksi_detail.transaksi_id')
                        ->where('transaksi.usaha_id', $usahaId)
                        ->select('transaksi_detail.*');
            } else if ($tabel === 'produk_komposisi') {
                $builder->join('produk_jasa p1', 'p1.id = produk_komposisi.produk_induk_id')
                        ->where('p1.usaha_id', $usahaId)
                        ->select('produk_komposisi.*');
            }
        }
        // JOIN relasi untuk iot_alokasi agar response mengandung nama perangkat & unit
        if ($tabel === 'iot_alokasi') {
            $builder->select('iot_alokasi.*, iot.nama_perangkat, iot.tipe_perangkat, iot.mac_address, iot.is_aktif as iot_is_aktif, unit.nama_unit, usaha.nama_usaha')
                    ->join('iot', 'iot.id = iot_alokasi.iot_id', 'left')
                    ->join('unit', 'unit.id = iot_alokasi.unit_id', 'left')
                    ->join('usaha', 'usaha.id = iot_alokasi.usaha_id', 'left');
        }

        // JOIN relasi untuk shift agar response mengandung nama_usaha
        if ($tabel === 'shift') {
            $builder->select('shift.*, usaha.nama_usaha')
                    ->join('usaha', 'usaha.id = shift.usaha_id', 'left');
        }

        // JOIN relasi untuk jadwal_karyawan
        if ($tabel === 'jadwal_karyawan') {
            $builder->select('jadwal_karyawan.*, karyawan.nama as nama_karyawan, shift.nama_shift, usaha.nama_usaha')
                    ->join('users as karyawan', 'karyawan.id = jadwal_karyawan.karyawan_id', 'left')
                    ->join('shift', 'shift.id = jadwal_karyawan.shift_id', 'left')
                    ->join('usaha', 'usaha.id = jadwal_karyawan.usaha_id', 'left');
        }

        // JOIN relasi untuk lembur
        if ($tabel === 'lembur') {
            $builder->select('lembur.*, karyawan.nama as nama_karyawan, usaha.nama_usaha')
                    ->join('users as karyawan', 'karyawan.id = lembur.karyawan_id', 'left')
                    ->join('usaha', 'usaha.id = lembur.usaha_id', 'left');
        }

        // JOIN relasi untuk produk_komposisi
        if ($tabel === 'produk_komposisi') {
            $builder->select('produk_komposisi.*, p_induk.nama_produk as nama_produk_induk, p_bahan.nama_produk as nama_produk_bahan')
                    ->join('produk_jasa p_induk', 'p_induk.id = produk_komposisi.produk_induk_id', 'left')
                    ->join('produk_jasa p_bahan', 'p_bahan.id = produk_komposisi.produk_bahan_id', 'left');
        }

        // JOIN relasi untuk users jika login sebagai Root (usahaId == null) agar respons mengandung usaha_id
        if ($tabel === 'users' && $usahaId === null) {
            $builder->select('users.*, user_role.usaha_id')
                    ->join('user_role', 'user_role.user_id = users.id', 'left')
                    ->groupBy('users.id');
        }

        // JOIN relasi untuk absensi
        if ($tabel === 'absensi') {
            $builder->select('absensi.*, karyawan.nama as nama_karyawan, 
                              IF(absensi.lembur_id IS NOT NULL, \'Lembur\', shift.nama_shift) as nama_shift, 
                              IF(absensi.lembur_id IS NOT NULL, lembur.jam_mulai, shift.jam_mulai) as shift_jam_mulai, 
                              IF(absensi.lembur_id IS NOT NULL, lembur.jam_selesai, shift.jam_selesai) as shift_jam_selesai, 
                              usaha.nama_usaha, ur_format.usaha_id')
                    ->join('users as karyawan', 'karyawan.id = absensi.karyawan_id', 'left')
                    ->join('jadwal_karyawan', 'jadwal_karyawan.id = absensi.jadwal_karyawan_id', 'left')
                    ->join('shift', 'shift.id = jadwal_karyawan.shift_id', 'left')
                    ->join('lembur', 'lembur.id = absensi.lembur_id', 'left')
                    ->join('user_role as ur_format', 'ur_format.user_id = absensi.karyawan_id', 'left')
                    ->join('usaha', 'usaha.id = ur_format.usaha_id', 'left')
                    ->groupBy('absensi.id');
        }

        // JOIN relasi untuk kriteria_poin
        if ($tabel === 'kriteria_poin') {
            $builder->select('kriteria_poin.*, usaha.nama_usaha')
                    ->join('usaha', 'usaha.id = kriteria_poin.usaha_id', 'left');
        }

        // JOIN relasi untuk points
        if ($tabel === 'points') {
            $builder->select('points.*, karyawan.nama as nama_karyawan, pemberi.nama as nama_pemberi_poin, usaha.nama_usaha, ur_format.usaha_id')
                    ->join('users as karyawan', 'karyawan.id = points.karyawan_id', 'left')
                    ->join('users as pemberi', 'pemberi.id = points.pemberi_poin_id', 'left')
                    ->join('user_role as ur_format', 'ur_format.user_id = points.karyawan_id', 'left')
                    ->join('usaha', 'usaha.id = ur_format.usaha_id', 'left')
                    ->groupBy('points.id');
        }

        // JOIN relasi untuk perizinan
        if ($tabel === 'perizinan') {
            $builder->select('perizinan.*, karyawan.nama as nama_karyawan, pengganti.nama as nama_pengganti, penyetuju.nama as nama_penyetuju, usaha.nama_usaha, ur_format.usaha_id')
                    ->join('users as karyawan', 'karyawan.id = perizinan.karyawan_id', 'left')
                    ->join('users as pengganti', 'pengganti.id = perizinan.karyawan_pengganti_id', 'left')
                    ->join('users as penyetuju', 'penyetuju.id = perizinan.disetujui_oleh', 'left')
                    ->join('user_role as ur_format', 'ur_format.user_id = perizinan.karyawan_id', 'left')
                    ->join('usaha', 'usaha.id = ur_format.usaha_id', 'left')
                    ->groupBy('perizinan.id');
        }

        // JOIN relasi untuk kebersihan
        if ($tabel === 'kebersihan') {
            $builder->select('kebersihan.*, usaha.nama_usaha')
                    ->join('usaha', 'usaha.id = kebersihan.usaha_id', 'left');
        }

        // JOIN relasi untuk kebersihan_tugas
        if ($tabel === 'kebersihan_tugas') {
            $builder->select('kebersihan_tugas.*, k.nama_area, k.jam_mulai, k.jam_selesai, karyawan.nama as nama_karyawan, ditunjuk.nama as nama_ditunjuk, penyetuju.nama as nama_penyetuju, usaha.nama_usaha, k.usaha_id')
                    ->join('kebersihan k', 'k.id = kebersihan_tugas.kebersihan_id', 'left')
                    ->join('users as karyawan', 'karyawan.id = kebersihan_tugas.karyawan_id', 'left')
                    ->join('users as ditunjuk', 'ditunjuk.id = kebersihan_tugas.ditunjuk_karyawan_id', 'left')
                    ->join('usaha', 'usaha.id = k.usaha_id', 'left')
                    ->join('points p', "p.referensi_id = kebersihan_tugas.id AND p.sumber = 'kebersihan'", 'left')
                    ->join('users as penyetuju', 'penyetuju.id = p.pemberi_poin_id', 'left')
                    ->groupBy('kebersihan_tugas.id');
        }

        // JOIN relasi untuk produk_jasa
        if ($tabel === 'produk_jasa') {
            $builder->select('produk_jasa.*, usaha.nama_usaha, unit.nama_unit')
                    ->join('usaha', 'usaha.id = produk_jasa.usaha_id', 'left')
                    ->join('unit', 'unit.id = produk_jasa.unit_id', 'left');
        }

        // JOIN relasi untuk transaksi
        if ($tabel === 'transaksi') {
            $builder->select('transaksi.*, usaha.nama_usaha, kasir.nama as nama_kasir')
                    ->join('usaha', 'usaha.id = transaksi.usaha_id', 'left')
                    ->join('users as kasir', 'kasir.id = transaksi.kasir_id', 'left');
        }

        // JOIN relasi untuk transaksi_detail
        if ($tabel === 'transaksi_detail') {
            $builder->select('transaksi_detail.*, produk_jasa.nama_produk, users.nama as nama_petugas')
                    ->join('produk_jasa', 'produk_jasa.id = transaksi_detail.produk_id', 'left')
                    ->join('users', 'users.id = transaksi_detail.petugas_id', 'left');
        }

        $data = $builder->get()->getResultArray();

        return $this->respond([
            'status' => 'sukses',
            'data'   => $data
        ]);
    }

    // Tambah data baru ke tabel tertentu
    public function tambahData($tabel)
    {
        if (!in_array($tabel, $this->daftarTabel)) {
            return $this->failNotFound("Tabel '$tabel' tidak ditemukan atau tidak diizinkan.");
        }

        $contentType = $this->request->header('Content-Type') ? $this->request->header('Content-Type')->getValue() : '';
        if (strpos($contentType, 'application/json') !== false) {
            $input = $this->request->getJSON(true) ?: [];
        } else {
            $input = array_merge($this->request->getPost() ?: [], $this->request->getGet() ?: []);
        }

        if (isset($input['_method'])) {
            unset($input['_method']);
        }
        
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        $usahaId = $penggunaAktif['usaha_id'] ?? null;

        // ==== INJEKSI ISOLASI DATA (MULTI-TENANT) ====
        // Jika user BUKAN global, paksa kolom usaha_id (jika tabel memilikinya)
        // dengan ID usaha tempat ia login sekarang, mengabaikan input licik dari frontend
        $db = \Config\Database::connect();
        if ($usahaId !== null && $db->fieldExists('usaha_id', $tabel)) {
            $input['usaha_id'] = $usahaId;
        }

        // Ubah string kosong menjadi null agar tidak error foreign key atau integer constraint
        foreach ($input as $key => $val) {
            if ($val === '') {
                $input[$key] = null;
            }
        }

        // Otomatis isi urutan terakhir + 1 jika tabel menus
        if ($tabel === 'menus') {
            $maxUrutanRow = $db->table('menus')->selectMax('urutan')->get()->getRow();
            $maxUrutan = $maxUrutanRow ? (int)$maxUrutanRow->urutan : 0;
            $input['urutan'] = $maxUrutan + 1;
        }

        // Format data sesuai aturan konsistensi
        $input = $this->formatData($tabel, $input);

        $aturan = $this->dapatkanValidasi($tabel);
        if ($aturan && !$this->validateData($input, $aturan)) {
            return $this->fail($this->validator->getErrors());
        }

        $db = \Config\Database::connect();

        // Validasi ekstra khusus user_role
        if ($tabel === 'user_role') {
            $role = $db->table('roles')->where('id', $input['role_id'])->get()->getRow();
            $isRoot = $role && strtolower($role->nama_role) === 'root';
            
            if ($role && strtolower($role->nama_role) === 'member') {
                return $this->fail("Peran 'member' adalah peran default sistem dan tidak perlu ditambahkan secara eksplisit.");
            }

            if (!$isRoot && empty($input['usaha_id'])) {
                return $this->fail("Usaha wajib dipilih untuk peran selain Root.");
            }

            // Cek apakah user sudah memiliki role di usaha ini
            if (!empty($input['usaha_id']) && !empty($input['user_id'])) {
                $cekRole = $db->table('user_role')
                              ->where('user_id', $input['user_id'])
                              ->where('usaha_id', $input['usaha_id'])
                              ->get()->getRow();
                if ($cekRole) {
                    return $this->respond([
                        'status' => 'gagal',
                        'pesan'  => "Penambahan dibatalkan! Pengguna ini sudah memiliki role di cabang/usaha tersebut. Satu pengguna hanya boleh memiliki maksimal 1 role per usaha."
                    ], 400);
                }
            }
        }

        // Validasi ekstra khusus role_permissions
        if ($tabel === 'role_permissions') {
            if (!empty($input['role_id']) && !empty($input['menu_id'])) {
                $cekIzin = $db->table('role_permissions')
                              ->where('role_id', $input['role_id'])
                              ->where('menu_id', $input['menu_id'])
                              ->get()->getRow();
                if ($cekIzin) {
                    return $this->respond([
                        'status' => 'gagal',
                        'pesan'  => "Penambahan dibatalkan! Role tersebut sudah memiliki hak akses untuk menu ini. 1 Role tidak boleh memiliki lebih dari 1 aturan untuk menu yang sama."
                    ], 400);
                }
            }
        }

        // Enkripsi password jika di tabel users
        if ($tabel === 'users' && isset($input['password'])) {
            $input['password'] = password_hash($input['password'], PASSWORD_BCRYPT);
        }

        // Validasi ekstra khusus unit (nama unik per usaha)
        if ($tabel === 'unit' && isset($input['nama_unit']) && isset($input['usaha_id'])) {
            $cekUnit = $db->table('unit')
                         ->where('usaha_id', $input['usaha_id'])
                         ->where('nama_unit', $input['nama_unit'])
                         ->get()->getRow();
            if ($cekUnit) {
                return $this->fail("Nama unit '{$input['nama_unit']}' sudah ada di cabang/usaha ini. Silakan gunakan nama lain.");
            }
        }
        
        // Validasi ekstra khusus shift (Keunikan nama_shift per usaha_id)
        if ($tabel === 'shift' && isset($input['nama_shift']) && isset($input['usaha_id'])) {
            $cekShift = $db->table('shift')
                           ->where('usaha_id', $input['usaha_id'])
                           ->where('nama_shift', $input['nama_shift'])
                           ->get()->getRow();
            if ($cekShift) {
                return $this->respond([
                    'status' => 'gagal',
                    'pesan'  => "Nama shift '{$input['nama_shift']}' sudah terdaftar untuk usaha ini. Silakan gunakan nama shift lain."
                ], 400);
            }
        }

        // Validasi ekstra khusus iot_alokasi (Requirement #1)
        if ($tabel === 'iot_alokasi') {
            $iotId = $input['iot_id'] ?? null;
            if ($iotId) {
                $device = $db->table('iot')->where('id', $iotId)->get()->getRow();
                if (!$device) {
                    return $this->respond([
                        'status' => 'gagal',
                        'pesan'  => 'Perangkat IoT tidak ditemukan.'
                    ], 400);
                }
                if ($device->is_aktif == 0) {
                    return $this->respond([
                        'status' => 'gagal',
                        'pesan'  => "Penambahan alokasi dibatalkan! Perangkat IoT '{$device->nama_perangkat}' sedang dinonaktifkan di gudang."
                    ], 400);
                }
                $existingAlokasi = $db->table('iot_alokasi')->where('iot_id', $iotId)->countAllResults();
                if ($existingAlokasi > 0) {
                    return $this->respond([
                        'status' => 'gagal',
                        'pesan'  => "Penambahan alokasi dibatalkan! Perangkat IoT '{$device->nama_perangkat}' sudah dialokasikan ke cabang/usaha lain."
                    ], 400);
                }
            }
        }

        // Validasi ekstra khusus produk_komposisi (memastikan produk induk & bahan berada di bawah usaha_id yang sama)
        if ($tabel === 'produk_komposisi') {
            $induk = $db->table('produk_jasa')->where('id', $input['produk_induk_id'])->get()->getRow();
            $bahan = $db->table('produk_jasa')->where('id', $input['produk_bahan_id'])->get()->getRow();
            
            if (!$induk || !$bahan) {
                return $this->fail('Produk induk atau bahan tidak ditemukan.');
            }
            
            if ($usahaId !== null) {
                if ($induk->usaha_id != $usahaId || $bahan->usaha_id != $usahaId) {
                    return $this->fail('Kedua produk harus milik cabang usaha Anda.');
                }
            }
            
            if ($input['produk_induk_id'] == $input['produk_bahan_id']) {
                return $this->fail('Produk induk tidak boleh sama dengan produk bahan baku.');
            }
            
            // Cek duplikasi komposisi
            $existing = $db->table('produk_komposisi')
                           ->where('produk_induk_id', $input['produk_induk_id'])
                           ->where('produk_bahan_id', $input['produk_bahan_id'])
                           ->get()->getRow();
            if ($existing) {
                return $this->fail('Komposisi bahan untuk produk ini sudah terdaftar.');
            }
        }

        // Validasi ekstra khusus perizinan (Memastikan karyawan pemohon 1 usaha dengan penyunting)
        if ($tabel === 'perizinan') {
            $karyawanId = $input['karyawan_id'] ?? null;
            $penggantiId = $input['karyawan_pengganti_id'] ?? null;
            if ($karyawanId && $usahaId !== null) {
                $cekKaryawanUsaha = $db->table('user_role')
                                      ->where('user_id', $karyawanId)
                                      ->where('usaha_id', $usahaId)
                                      ->countAllResults();
                if ($cekKaryawanUsaha === 0) {
                    return $this->respond([
                        'status' => 'gagal',
                        'pesan'  => 'Operasi dibatalkan! Karyawan yang dipilih tidak terdaftar di cabang/usaha Anda.'
                    ], 400);
                }
            }
            if ($karyawanId && $penggantiId && (int)$penggantiId > 0) {
                // Ambil daftar usaha_id milik pemohon
                $usahaPemohon = $db->table('user_role')->select('usaha_id')->where('user_id', $karyawanId)->get()->getResultArray();
                $idsPemohon = array_filter(array_column($usahaPemohon, 'usaha_id'));

                // Ambil daftar usaha_id milik pengganti
                $usahaPengganti = $db->table('user_role')->select('usaha_id')->where('user_id', $penggantiId)->get()->getResultArray();
                $idsPengganti = array_filter(array_column($usahaPengganti, 'usaha_id'));

                // Cari irisan usaha di antara keduanya
                $irisan = array_intersect($idsPemohon, $idsPengganti);
                if (empty($irisan)) {
                    return $this->respond([
                        'status' => 'gagal',
                        'pesan'  => 'Operasi dibatalkan! Karyawan pengganti harus terdaftar di cabang/usaha yang sama dengan pemohon.'
                    ], 400);
                }
            }
        }

        // Deteksi Bentrok Jadwal saat Membuat Lembur Baru
        if ($tabel === 'lembur') {
            $karyawanId = $input['karyawan_id'] ?? null;
            $tanggal = $input['tanggal'] ?? null;
            $jamMulai = $input['jam_mulai'] ?? null;
            $jamSelesai = $input['jam_selesai'] ?? null;

            if ($karyawanId && $tanggal && $jamMulai && $jamSelesai) {
                $hariMap = [
                    'Sunday' => 'Minggu', 'Monday' => 'Senin', 'Tuesday' => 'Selasa',
                    'Wednesday' => 'Rabu', 'Thursday' => 'Kamis', 'Friday' => 'Jumat',
                    'Saturday' => 'Sabtu'
                ];
                $namaHari = $hariMap[date('l', strtotime($tanggal))] ?? null;

                // Cek apakah hari ini terdaftar sebagai libur di jadwal_karyawan
                $liburQuery = $db->table('jadwal_karyawan')
                                 ->where('karyawan_id', $karyawanId)
                                 ->where('hari', $namaHari)
                                 ->get()->getRow();

                if (!$liburQuery) {
                    // Karyawan terjadwal masuk. Ambil jam shiftnya.
                    $jadwalKerja = $db->table('jadwal_karyawan')
                                      ->select('shift.jam_mulai, shift.jam_selesai')
                                      ->join('shift', 'shift.id = jadwal_karyawan.shift_id')
                                      ->where('jadwal_karyawan.karyawan_id', $karyawanId)
                                      ->where('jadwal_karyawan.hari IS NULL')
                                      ->get()->getResult();

                    foreach ($jadwalKerja as $jk) {
                        $startA = strtotime($jamMulai);
                        $endA = strtotime($jamSelesai);
                        $startB = strtotime($jk->jam_mulai);
                        $endB = strtotime($jk->jam_selesai);

                        if ($startA < $endB && $endA > $startB) {
                            return $this->respond([
                                'status' => 'gagal',
                                'pesan'  => "Pembuatan lembur gagal! Jam lembur ($jamMulai - $jamSelesai) bertabrakan dengan jadwal shift reguler karyawan ($jk->jam_mulai - $jk->jam_selesai)."
                            ], 400);
                        }
                    }
                }
            }
        }

        // Bersihkan field JOIN yang tidak ada di tabel asli
        if ($tabel === 'iot_alokasi') {
            $fieldJoin = ['nama_perangkat', 'tipe_perangkat', 'mac_address', 'iot_is_aktif', 'nama_unit', 'nama_usaha'];
            foreach ($fieldJoin as $f) {
                unset($input[$f]);
            }
        }
        if ($tabel === 'shift') {
            unset($input['nama_usaha']);
        }
        if ($tabel === 'jadwal_karyawan') {
            $fieldJoin = ['nama_karyawan', 'nama_shift', 'nama_usaha', 'nama_original', 'tanggal', 'is_lembur', 'jam_mulai', 'jam_selesai', 'original_karyawan_id'];
            foreach ($fieldJoin as $f) {
                unset($input[$f]);
            }
        }
        if ($tabel === 'absensi') {
            $fieldJoin = ['nama_karyawan', 'nama_shift', 'shift_jam_mulai', 'shift_jam_selesai', 'nama_usaha'];
            foreach ($fieldJoin as $f) {
                unset($input[$f]);
            }
        }
        if ($tabel === 'kriteria_poin') {
            unset($input['nama_usaha']);
        }
        if ($tabel === 'points') {
            $fieldJoin = ['nama_karyawan', 'nama_pemberi_poin', 'nama_usaha'];
            foreach ($fieldJoin as $f) {
                unset($input[$f]);
            }
        }
        if ($tabel === 'perizinan') {
            $fieldJoin = ['nama_karyawan', 'nama_pengganti', 'nama_penyetuju', 'nama_usaha'];
            foreach ($fieldJoin as $f) {
                unset($input[$f]);
            }

            // A. Proses Upload Berkas
            $namaFile = $this->prosesUploadBukti();
            if ($namaFile) {
                $input['dokumen_bukti'] = $namaFile;
            }

            // B. Tentukan Status Awal Perizinan Bertingkat
            $penggantiId = $input['karyawan_pengganti_id'] ?? null;
            if ($penggantiId && (int)$penggantiId > 0) {
                $input['status'] = 'menunggu_pengganti';
            } else {
                $input['status'] = 'menunggu_persetujuan';
            }
        }

        // Set timestamps jika ada kolomnya
        $db = \Config\Database::connect();
        if ($db->fieldExists('created_at', $tabel)) {
            $input['created_at'] = date('Y-m-d H:i:s');
        }
        if ($db->fieldExists('updated_at', $tabel)) {
            $input['updated_at'] = date('Y-m-d H:i:s');
        }

        // Generic cleanup: remove any fields that do not exist in the database table
        $fields = $db->getFieldNames($tabel);
        foreach ($input as $k => $v) {
            if (!in_array($k, $fields)) {
                unset($input[$k]);
            }
        }

        $builder = $db->table($tabel);
        if ($builder->insert($input)) {
            $idBaru = $db->insertID();

            // Hook khusus: Jika user baru berhasil dibuat oleh non-Root (Supervisor/Owner/Unit),
            // kaitkan langsung user tersebut ke usaha_id pembuat agar bisa diakses/dikelola
            if ($tabel === 'users' && $usahaId !== null) {
                // Cari role 'karyawan' atau role non-dewa default
                $roleDefault = $db->table('roles')->where('nama_role', 'karyawan')->get()->getRowArray();
                if (!$roleDefault) {
                    $roleDefault = $db->table('roles')
                                       ->whereNotIn('nama_role', ['root', 'owner', 'supervisor'])
                                       ->get()->getRowArray();
                }
                $roleId = $roleDefault ? $roleDefault['id'] : null;

                $db->table('user_role')->insert([
                    'user_id'    => $idBaru,
                    'usaha_id'   => $usahaId,
                    'role_id'    => $roleId,
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s')
                ]);
            }

            // Hook Notifikasi PWA & Riwayat untuk Perizinan Baru
            if ($tabel === 'perizinan') {
                $pemohon = $db->table('users')->where('id', $input['karyawan_id'])->get()->getRow();
                $namaPemohon = $pemohon ? $pemohon->nama : 'Karyawan';
                $tglIzin = date('d-m-Y', strtotime($input['tanggal']));
                
                if (\App\Modules\Notification\Services\NotificationService::isAktif($usahaId, 'notif_perizinan_baru')) {
                    \App\Modules\Notification\Services\NotificationService::kirim(
                        $usahaId,
                        "Pengajuan Izin Baru",
                        "{$namaPemohon} mengajukan izin baru untuk tanggal {$tglIzin}.",
                        "beranda"
                    );
                }
            }

            // Hook Notifikasi PWA & Riwayat untuk Lembur Baru
            if ($tabel === 'lembur') {
                $tglLembur = date('d-m-Y', strtotime($input['tanggal']));
                $karyawan = $db->table('users')->where('id', $input['karyawan_id'])->get()->getRow();
                $namaKaryawan = $karyawan ? $karyawan->nama : 'Karyawan';
                
                \App\Modules\Notification\Services\NotificationService::kirim(
                    $usahaId,
                    "Tugas Lembur Baru",
                    "Tugas lembur baru didaftarkan untuk {$namaKaryawan} pada tanggal {$tglLembur}.",
                    "beranda"
                );
            }

            return $this->respondCreated([
                'status'  => 'sukses',
                'pesan'   => 'Data berhasil ditambahkan.',
                'id_baru' => $idBaru
            ]);
        }

        return $this->fail("Gagal menambahkan data.");
    }

    // Ubah data yang sudah ada di tabel tertentu
    public function ubahData($tabel, $id)
    {
        if (!in_array($tabel, $this->daftarTabel)) {
            return $this->failNotFound("Tabel '$tabel' tidak ditemukan atau tidak diizinkan.");
        }

        $contentType = $this->request->header('Content-Type') ? $this->request->header('Content-Type')->getValue() : '';
        if (strpos($contentType, 'application/json') !== false) {
            $input = $this->request->getJSON(true) ?: [];
        } else {
            $input = array_merge($this->request->getPost() ?: [], $this->request->getGet() ?: []);
        }

        if (isset($input['_method'])) {
            unset($input['_method']);
        }
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        $usahaId = $penggunaAktif['usaha_id'] ?? null;

        // ==== INJEKSI ISOLASI DATA (MULTI-TENANT) ====
        $db = \Config\Database::connect();
        if ($usahaId !== null && $db->fieldExists('usaha_id', $tabel)) {
            $input['usaha_id'] = $usahaId;
        }
        if ($tabel === 'roles' && $id == 1) {
            return $this->respond([
                'status' => 'gagal',
                'pesan'  => 'Role Root adalah bawaan sistem dan tidak dapat diubah.'
            ], 403);
        }

        if ($tabel === 'kebersihan_tugas') {
            $existing = $db->table('kebersihan_tugas')->where('id', $id)->get()->getRow();
            if ($existing && $existing->status === 'selesai') {
                return $this->respond([
                    'status' => 'gagal',
                    'pesan'  => 'Tugas kebersihan yang sudah selesai tidak dapat diubah lagi.'
                ], 400);
            }
        }

        // Ubah string kosong menjadi null
        foreach ($input as $key => $val) {
            if ($val === '') {
                $input[$key] = null;
            }
        }

        // Format data sesuai aturan konsistensi
        $input = $this->formatData($tabel, $input);

        $aturan = $this->dapatkanValidasi($tabel, $id);
        if ($aturan && !$this->validateData($input, $aturan)) {
            log_message('error', 'Input received: ' . json_encode($input));
            log_message('error', 'Validation errors: ' . json_encode($this->validator->getErrors()));
            return $this->fail($this->validator->getErrors());
        }

        // Validasi ekstra khusus produk_komposisi (saat update)
        if ($tabel === 'produk_komposisi') {
            $indukId = $input['produk_induk_id'] ?? null;
            $bahanId = $input['produk_bahan_id'] ?? null;
            
            if ($indukId && $bahanId) {
                $induk = $db->table('produk_jasa')->where('id', $indukId)->get()->getRow();
                $bahan = $db->table('produk_jasa')->where('id', $bahanId)->get()->getRow();
                
                if (!$induk || !$bahan) {
                    return $this->fail('Produk induk atau bahan tidak ditemukan.');
                }
                
                if ($usahaId !== null) {
                    if ($induk->usaha_id != $usahaId || $bahan->usaha_id != $usahaId) {
                        return $this->fail('Kedua produk harus milik cabang usaha Anda.');
                    }
                }
                
                if ($indukId == $bahanId) {
                    return $this->fail('Produk induk tidak boleh sama dengan produk bahan baku.');
                }
                
                // Cek duplikasi komposisi (kecuali id ini sendiri)
                $existing = $db->table('produk_komposisi')
                               ->where('produk_induk_id', $indukId)
                               ->where('produk_bahan_id', $bahanId)
                               ->where('id !=', $id)
                               ->get()->getRow();
                if ($existing) {
                    return $this->fail('Komposisi bahan untuk produk ini sudah terdaftar.');
                }
            }
        }

        // Enkripsi password jika di tabel users dan di-set
        if ($tabel === 'users' && !empty($input['password'])) {
            $input['password'] = password_hash($input['password'], PASSWORD_BCRYPT);
        } else if ($tabel === 'users') {
            unset($input['password']); // Jangan timpa jika kosong
        }

        $db = \Config\Database::connect();
        
        // Pastikan data ada
        $builder = $db->table($tabel);
        $existing = $builder->where('id', $id)->get()->getRow();
        if (!$existing) {
            return $this->failNotFound("Data dengan ID $id tidak ditemukan di tabel '$tabel'.");
        }

        // Validasi ekstra khusus user_role
        if ($tabel === 'user_role') {
            // Proteksi agar role root tidak bisa diubah menjadi role lain atau diganti parameternya
            $existingRoleData = $db->table('roles')->where('id', $existing->role_id)->get()->getRow();
            if ($existingRoleData && strtolower($existingRoleData->nama_role) === 'root') {
                return $this->failForbidden("Hak akses 'root' dilindungi dan tidak boleh diubah melalui endpoint ini.");
            }

            $roleIdToCheck = isset($input['role_id']) ? $input['role_id'] : $existing->role_id;
            $role = $db->table('roles')->where('id', $roleIdToCheck)->get()->getRow();
            $isRoot = $role && strtolower($role->nama_role) === 'root';
            
            if ($role && strtolower($role->nama_role) === 'member') {
                return $this->fail("Peran 'member' adalah peran default sistem dan tidak perlu ditambahkan secara eksplisit.");
            }

            $usahaIdToCheck = array_key_exists('usaha_id', $input) ? $input['usaha_id'] : $existing->usaha_id;
            if (!$isRoot && empty($usahaIdToCheck)) {
                return $this->fail("Usaha wajib dipilih untuk peran selain Root.");
            }

            $userIdToCheck = array_key_exists('user_id', $input) ? $input['user_id'] : $existing->user_id;
            if (!empty($usahaIdToCheck) && !empty($userIdToCheck)) {
                $cekRole = $db->table('user_role')
                              ->where('user_id', $userIdToCheck)
                              ->where('usaha_id', $usahaIdToCheck)
                              ->where('id !=', (int)$id)
                              ->get()->getRow();
                if ($cekRole) {
                    return $this->respond([
                        'status' => 'gagal',
                        'pesan'  => "Perubahan dibatalkan! Pengguna ini sudah memiliki role di cabang/usaha tersebut. Satu pengguna hanya boleh memiliki maksimal 1 role per usaha."
                    ], 400);
                }
            }
        }

        // Validasi ekstra khusus role_permissions
        if ($tabel === 'role_permissions') {
            $roleIdToCheck = array_key_exists('role_id', $input) ? $input['role_id'] : $existing->role_id;
            $menuIdToCheck = array_key_exists('menu_id', $input) ? $input['menu_id'] : $existing->menu_id;

            if (!empty($roleIdToCheck) && !empty($menuIdToCheck)) {
                $cekIzin = $db->table('role_permissions')
                              ->where('role_id', $roleIdToCheck)
                              ->where('menu_id', $menuIdToCheck)
                              ->where('id !=', (int)$id)
                              ->get()->getRow();
                if ($cekIzin) {
                    return $this->respond([
                        'status' => 'gagal',
                        'pesan'  => "Perubahan dibatalkan! Role tersebut sudah memiliki hak akses untuk menu ini. 1 Role tidak boleh memiliki lebih dari 1 aturan untuk menu yang sama."
                    ], 400);
                }
            }
        }

        // Validasi ekstra khusus unit (nama unik per usaha)
        if ($tabel === 'unit') {
            $usahaIdToCheck = array_key_exists('usaha_id', $input) ? $input['usaha_id'] : $existing->usaha_id;
            $namaToCheck = isset($input['nama_unit']) ? $input['nama_unit'] : $existing->nama_unit;
            
            $cekUnit = $db->table('unit')
                         ->where('usaha_id', $usahaIdToCheck)
                         ->where('nama_unit', $namaToCheck)
                         ->where('id !=', (int)$id)
                         ->get()->getRow();
            if ($cekUnit) {
                return $this->respond([
                    'status' => 'gagal',
                    'pesan'  => "Nama unit '{$namaToCheck}' sudah ada di cabang/usaha ini. Silakan gunakan nama lain."
                ], 400);
            }
        }
        
        // Validasi ekstra khusus shift (Keunikan nama_shift per usaha_id)
        if ($tabel === 'shift') {
            $usahaIdToCheck = array_key_exists('usaha_id', $input) ? $input['usaha_id'] : $existing->usaha_id;
            $namaShiftToCheck = isset($input['nama_shift']) ? $input['nama_shift'] : $existing->nama_shift;

            if (!empty($usahaIdToCheck) && !empty($namaShiftToCheck)) {
                $cekShift = $db->table('shift')
                               ->where('usaha_id', $usahaIdToCheck)
                               ->where('nama_shift', $namaShiftToCheck)
                               ->where('id !=', (int)$id)
                               ->get()->getRow();
                if ($cekShift) {
                    return $this->respond([
                        'status' => 'gagal',
                        'pesan'  => "Nama shift '{$namaShiftToCheck}' sudah terdaftar untuk usaha ini. Silakan gunakan nama shift lain."
                    ], 400);
                }
            }
        }

        // Validasi ekstra khusus iot_alokasi (Requirement #1)
        if ($tabel === 'iot_alokasi') {
            $iotId = $input['iot_id'] ?? null;
            if ($iotId && $iotId != $existing->iot_id) {
                $device = $db->table('iot')->where('id', $iotId)->get()->getRow();
                if (!$device) {
                    return $this->respond([
                        'status' => 'gagal',
                        'pesan'  => 'Perangkat IoT tidak ditemukan.'
                    ], 400);
                }
                if ($device->is_aktif == 0) {
                    return $this->respond([
                        'status' => 'gagal',
                        'pesan'  => "Pembaruan alokasi dibatalkan! Perangkat IoT '{$device->nama_perangkat}' sedang dinonaktifkan di gudang."
                    ], 400);
                }
                $existingAlokasi = $db->table('iot_alokasi')->where('iot_id', $iotId)->where('id !=', (int)$id)->countAllResults();
                if ($existingAlokasi > 0) {
                    return $this->respond([
                        'status' => 'gagal',
                        'pesan'  => "Pembaruan alokasi dibatalkan! Perangkat IoT '{$device->nama_perangkat}' sudah dialokasikan ke cabang/usaha lain."
                    ], 400);
                }
            }
        }

        // Validasi ekstra khusus perizinan (Memastikan karyawan pemohon 1 usaha dengan penyunting)
        if ($tabel === 'perizinan') {
            $karyawanId = $input['karyawan_id'] ?? $existing->karyawan_id;
            $penggantiId = array_key_exists('karyawan_pengganti_id', $input) ? $input['karyawan_pengganti_id'] : $existing->karyawan_pengganti_id;

            // Reset status pengajuan jika diedit kembali setelah ditolak oleh pengganti atau ditolak oleh atasan
            if (in_array($existing->status, ['ditolak_pengganti', 'ditolak'])) {
                if ($penggantiId && (int)$penggantiId > 0) {
                    $input['status'] = 'menunggu_pengganti';
                } else {
                    $input['status'] = 'menunggu_persetujuan';
                }
            }

            if ($karyawanId && $usahaId !== null) {
                $cekKaryawanUsaha = $db->table('user_role')
                                      ->where('user_id', $karyawanId)
                                      ->where('usaha_id', $usahaId)
                                      ->countAllResults();
                if ($cekKaryawanUsaha === 0) {
                    return $this->respond([
                        'status' => 'gagal',
                        'pesan'  => 'Operasi dibatalkan! Karyawan yang dipilih tidak terdaftar di cabang/usaha Anda.'
                    ], 400);
                }
            }
            if ($karyawanId && $penggantiId && (int)$penggantiId > 0) {
                // Ambil daftar usaha_id milik pemohon
                $usahaPemohon = $db->table('user_role')->select('usaha_id')->where('user_id', $karyawanId)->get()->getResultArray();
                $idsPemohon = array_filter(array_column($usahaPemohon, 'usaha_id'));

                // Ambil daftar usaha_id milik pengganti
                $usahaPengganti = $db->table('user_role')->select('usaha_id')->where('user_id', $penggantiId)->get()->getResultArray();
                $idsPengganti = array_filter(array_column($usahaPengganti, 'usaha_id'));

                // Cari irisan usaha di antara keduanya
                $irisan = array_intersect($idsPemohon, $idsPengganti);
                if (empty($irisan)) {
                    return $this->respond([
                        'status' => 'gagal',
                        'pesan'  => 'Operasi dibatalkan! Karyawan pengganti harus terdaftar di cabang/usaha yang sama dengan pemohon.'
                    ], 400);
                }
            }
        }

        // Deteksi Bentrok Jadwal saat Mengubah Lembur
        if ($tabel === 'lembur') {
            $karyawanId = $input['karyawan_id'] ?? null;
            $tanggal = $input['tanggal'] ?? null;
            $jamMulai = $input['jam_mulai'] ?? null;
            $jamSelesai = $input['jam_selesai'] ?? null;

            if ($karyawanId && $tanggal && $jamMulai && $jamSelesai) {
                $hariMap = [
                    'Sunday' => 'Minggu', 'Monday' => 'Senin', 'Tuesday' => 'Selasa',
                    'Wednesday' => 'Rabu', 'Thursday' => 'Kamis', 'Friday' => 'Jumat',
                    'Saturday' => 'Sabtu'
                ];
                $namaHari = $hariMap[date('l', strtotime($tanggal))] ?? null;

                // Cek apakah hari ini terdaftar sebagai libur di jadwal_karyawan
                $liburQuery = $db->table('jadwal_karyawan')
                                 ->where('karyawan_id', $karyawanId)
                                 ->where('hari', $namaHari)
                                 ->get()->getRow();

                if (!$liburQuery) {
                    // Karyawan terjadwal masuk. Ambil jam shiftnya.
                    $jadwalKerja = $db->table('jadwal_karyawan')
                                      ->select('shift.jam_mulai, shift.jam_selesai')
                                      ->join('shift', 'shift.id = jadwal_karyawan.shift_id')
                                      ->where('jadwal_karyawan.karyawan_id', $karyawanId)
                                      ->where('jadwal_karyawan.hari IS NULL')
                                      ->get()->getResult();

                    foreach ($jadwalKerja as $jk) {
                        $startA = strtotime($jamMulai);
                        $endA = strtotime($jamSelesai);
                        $startB = strtotime($jk->jam_mulai);
                        $endB = strtotime($jk->jam_selesai);

                        if ($startA < $endB && $endA > $startB) {
                            return $this->respond([
                                'status' => 'gagal',
                                'pesan'  => "Pengubahan lembur gagal! Jam lembur ($jamMulai - $jamSelesai) bertabrakan dengan jadwal shift reguler karyawan ($jk->jam_mulai - $jk->jam_selesai)."
                            ], 400);
                        }
                    }
                }
            }
        }

        // Bersihkan field JOIN yang tidak ada di tabel asli (dikirim dari response ambilData yang di-JOIN)
        if ($tabel === 'iot_alokasi') {
            $fieldJoin = ['nama_perangkat', 'tipe_perangkat', 'mac_address', 'iot_is_aktif', 'nama_unit', 'nama_usaha'];
            foreach ($fieldJoin as $f) {
                unset($input[$f]);
            }
        }
        if ($tabel === 'shift') {
            unset($input['nama_usaha']);
        }
        if ($tabel === 'jadwal_karyawan') {
            $fieldJoin = ['nama_karyawan', 'nama_shift', 'nama_usaha', 'nama_original', 'tanggal', 'is_lembur', 'jam_mulai', 'jam_selesai', 'original_karyawan_id'];
            foreach ($fieldJoin as $f) {
                unset($input[$f]);
            }
        }
        if ($tabel === 'absensi') {
            $fieldJoin = ['nama_karyawan', 'nama_shift', 'shift_jam_mulai', 'shift_jam_selesai', 'nama_usaha'];
            foreach ($fieldJoin as $f) {
                unset($input[$f]);
            }
        }
        if ($tabel === 'kriteria_poin') {
            unset($input['nama_usaha']);
        }
        if ($tabel === 'points') {
            $fieldJoin = ['nama_karyawan', 'nama_pemberi_poin', 'nama_usaha'];
            foreach ($fieldJoin as $f) {
                unset($input[$f]);
            }
        }
        if ($tabel === 'perizinan') {
            $fieldJoin = ['nama_karyawan', 'nama_pengganti', 'nama_penyetuju', 'nama_usaha', 'role_pemohon'];
            foreach ($fieldJoin as $f) {
                unset($input[$f]);
            }

            // A. Proses Upload Berkas Baru (jika ada)
            $namaFile = $this->prosesUploadBukti();
            if ($namaFile) {
                $input['dokumen_bukti'] = $namaFile;
            }

            // B. Otorisasi Transisi Status Perizinan Bertingkat
            $roleUser = strtolower($penggunaAktif['role'] ?? 'member');
            $userId   = $penggunaAktif['uid'];

            if (isset($input['status']) && $input['status'] !== $existing->status) {
                $statusLama = $existing->status;
                $statusBaru = $input['status'];

                // 1. Kasus: Menunggu persetujuan karyawan pengganti
                if ($statusLama === 'menunggu_pengganti') {
                    if ($existing->karyawan_pengganti_id != $userId) {
                        return $this->failForbidden('Hanya karyawan pengganti yang ditunjuk yang berwenang memberikan persetujuan tugas pengganti.');
                    }
                    if (!in_array($statusBaru, ['menunggu_persetujuan', 'ditolak_pengganti'])) {
                        return $this->failValidationError('Transisi status tidak valid untuk persetujuan pengganti.');
                    }
                }

                // 2. Kasus: Menunggu persetujuan Supervisor
                if ($statusLama === 'menunggu_persetujuan') {
                    if (!in_array($roleUser, ['root', 'owner', 'supervisor'])) {
                        return $this->failForbidden('Hanya Supervisor, Owner, atau Root yang berwenang menyetujui/menolak izin.');
                    }
                    if (!in_array($statusBaru, ['disetujui', 'ditolak'])) {
                        return $this->failValidationError('Transisi status tidak valid untuk keputusan atasan.');
                    }
                }

            }
        }

        // Generic cleanup: remove any fields that do not exist in the database table
        $fields = $db->getFieldNames($tabel);
        foreach ($input as $k => $v) {
            if (!in_array($k, $fields)) {
                unset($input[$k]);
            }
        }

        if ($db->fieldExists('updated_at', $tabel)) {
            $input['updated_at'] = date('Y-m-d H:i:s');
        }

        if ($builder->where('id', $id)->update($input)) {
            // Hook Notifikasi PWA & Riwayat untuk Perubahan Izin
            if ($tabel === 'perizinan' && isset($input['status']) && $input['status'] !== $existing->status) {
                $statusBaru = $input['status'];
                $tglIzin = date('d-m-Y', strtotime($existing->tanggal));
                $pemohon = $db->table('users')->where('id', $existing->karyawan_id)->get()->getRow();
                $namaPemohon = $pemohon ? $pemohon->nama : 'Karyawan';
                
                // A. Karyawan pengganti menerima/menolak permintaan
                if ($statusBaru === 'menunggu_persetujuan') {
                    $pengganti = $db->table('users')->where('id', $existing->karyawan_pengganti_id)->get()->getRow();
                    $namaPengganti = $pengganti ? $pengganti->nama : 'Karyawan pengganti';
                    
                    if (\App\Modules\Notification\Services\NotificationService::isAktif($existing->usaha_id, 'notif_perizinan_persetujuan')) {
                        \App\Modules\Notification\Services\NotificationService::kirim(
                            $existing->usaha_id,
                            "Pengganti Shift Bersedia",
                            "{$namaPengganti} bersedia menggantikan shift {$namaPemohon} untuk tanggal {$tglIzin}. Menunggu persetujuan atasan.",
                            "beranda"
                        );
                    }
                }
                
                if ($statusBaru === 'ditolak_pengganti') {
                    $pengganti = $db->table('users')->where('id', $existing->karyawan_pengganti_id)->get()->getRow();
                    $namaPengganti = $pengganti ? $pengganti->nama : 'Karyawan pengganti';
                    
                    if (\App\Modules\Notification\Services\NotificationService::isAktif($existing->usaha_id, 'notif_perizinan_persetujuan')) {
                        \App\Modules\Notification\Services\NotificationService::kirim(
                            $existing->usaha_id,
                            "Pengganti Shift Menolak",
                            "{$namaPengganti} menolak permintaan pengganti shift {$namaPemohon} untuk tanggal {$tglIzin}.",
                            "beranda"
                        );
                    }
                }
                
                // B. Atasan menyetujui/menolak izin
                if ($statusBaru === 'disetujui') {
                    if (\App\Modules\Notification\Services\NotificationService::isAktif($existing->usaha_id, 'notif_perizinan_persetujuan')) {
                        \App\Modules\Notification\Services\NotificationService::kirim(
                            $existing->usaha_id,
                            "Pengajuan Izin Disetujui",
                            "Pengajuan izin {$namaPemohon} untuk tanggal {$tglIzin} telah disetujui oleh atasan.",
                            "beranda"
                        );
                    }
                }

                if ($statusBaru === 'ditolak') {
                    $catatan = !empty($input['catatan_atasan']) ? " dengan catatan: \"" . $input['catatan_atasan'] . "\"" : "";
                    if (\App\Modules\Notification\Services\NotificationService::isAktif($existing->usaha_id, 'notif_perizinan_persetujuan')) {
                        \App\Modules\Notification\Services\NotificationService::kirim(
                            $existing->usaha_id,
                            "Pengajuan Izin Ditolak",
                            "Pengajuan izin {$namaPemohon} untuk tanggal {$tglIzin} telah ditolak oleh atasan{$catatan}.",
                            "beranda"
                        );
                    }
                }
            }

            return $this->respond([
                'status' => 'sukses',
                'pesan'  => 'Data berhasil diubah.'
            ]);
        }

        return $this->fail("Gagal mengubah data.");
    }

    // Hapus data dari tabel tertentu
    public function hapusData($tabel, $id)
    {
        if (!in_array($tabel, $this->daftarTabel)) {
            return $this->failNotFound("Tabel '$tabel' tidak ditemukan atau tidak diizinkan.");
        }

        $db = \Config\Database::connect();
        $builder = $db->table($tabel);
        
        $existing = $builder->where('id', $id)->get()->getRow();
        if (!$existing) {
            return $this->failNotFound("Data dengan ID $id tidak ditemukan di tabel '$tabel'.");
        }

        // Aturan khusus penghapusan perizinan (Hanya Atasan dan Karyawan Pemohon)
        if ($tabel === 'perizinan') {
            $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
            $roleUser = strtolower($penggunaAktif['role'] ?? 'member');
            $userId   = $penggunaAktif['uid'];

            $isAtasan = in_array($roleUser, ['root', 'owner', 'supervisor']);
            $isPemohon = ((int)$existing->karyawan_id === (int)$userId);

            if (!$isAtasan && !$isPemohon) {
                return $this->failForbidden('Operasi ditolak! Hanya Atasan dan Karyawan Pemohon yang berwenang membatalkan/menghapus pengajuan ini.');
            }

            // Pemohon bisa menghapus kapanpun KECUALI atasan sudah menyetujuinya
            if ($isPemohon && !$isAtasan) {
                if ($existing->status === 'disetujui') {
                    return $this->failForbidden('Penghapusan dibatalkan! Pengajuan telah disetujui oleh atasan. Hanya atasan yang berhak menghapus saat ini.');
                }
            }
        }
        if ($tabel === 'kebersihan_tugas') {
            if ($existing->status === 'selesai') {
                return $this->respond([
                    'status' => 'gagal',
                    'pesan'  => 'Tugas kebersihan yang sudah selesai tidak dapat dihapus.'
                ], 400);
            }
        }

        // Proteksi Root dan Role yang Terpakai
        if ($tabel === 'roles') {
            if (strtolower($existing->nama_role) === 'root') {
                return $this->failForbidden("Role 'root' adalah peran sistem inti dan tidak boleh dihapus.");
            }

            // Cek keterkaitan data
            $terpakaiUser = $db->table('user_role')->where('role_id', $id)->countAllResults();
            $terpakaiMenu = $db->table('role_permissions')->where('role_id', $id)->countAllResults();
            
            if ($terpakaiUser > 0 || $terpakaiMenu > 0) {
                return $this->respond([
                    'status' => 'gagal',
                    'pesan'  => "Penghapusan dibatalkan! Role '{$existing->nama_role}' tidak dapat dihapus karena masih digunakan oleh {$terpakaiUser} pengguna dan terkait dengan {$terpakaiMenu} hak akses menu."
                ], 400);
            }
        }

        if ($tabel === 'user_role') {
            $roleData = $db->table('roles')->where('id', $existing->role_id)->get()->getRow();
            if ($roleData && strtolower($roleData->nama_role) === 'root') {
                return $this->failForbidden("Hak akses 'root' tidak boleh dicabut/dihapus dari pengguna melalui endpoint ini.");
            }
        }

        if ($tabel === 'users') {
            // Cek apakah user memiliki peran root
            $rootRole = $db->table('user_role')
                           ->join('roles', 'roles.id = user_role.role_id')
                           ->where('user_role.user_id', $existing->id)
                           ->where('roles.nama_role', 'root')
                           ->get()->getRow();
            if ($rootRole) {
                return $this->failForbidden("Pengguna dengan akses 'root' dilindungi oleh sistem dan tidak boleh dihapus.");
            }
        }

        if ($tabel === 'usaha') {
            $terpakaiUnit = $db->table('unit')->where('usaha_id', $id)->countAllResults();
            $terpakaiUser = $db->table('user_role')->where('usaha_id', $id)->countAllResults();
            $terpakaiIot = $db->table('iot_alokasi')->where('usaha_id', $id)->countAllResults();

            if ($terpakaiUnit > 0 || $terpakaiUser > 0 || $terpakaiIot > 0) {
                $detail = [];
                if ($terpakaiUnit > 0) $detail[] = "{$terpakaiUnit} unit usaha";
                if ($terpakaiUser > 0) $detail[] = "{$terpakaiUser} peran pengguna";
                if ($terpakaiIot > 0) $detail[] = "{$terpakaiIot} alokasi perangkat IoT";
                
                $pesanDetail = implode(", ", $detail);

                return $this->respond([
                    'status' => 'gagal',
                    'pesan'  => "Penghapusan dibatalkan! Usaha '{$existing->nama_usaha}' tidak dapat dihapus karena masih terkait dengan: {$pesanDetail}."
                ], 400);
            }
        }

        if ($tabel === 'unit') {
            $terpakaiUser = $db->table('user_role')->where('unit_id', $id)->countAllResults();

            if ($terpakaiUser > 0) {
                return $this->respond([
                    'status' => 'gagal',
                    'pesan'  => "Penghapusan dibatalkan! Unit '{$existing->nama_unit}' tidak dapat dihapus karena masih digunakan oleh {$terpakaiUser} peran pengguna."
                ], 400);
            }
        }

        if ($tabel === 'iot') {
            $terpakaiAlokasi = $db->table('iot_alokasi')->where('iot_id', $id)->countAllResults();
            if ($terpakaiAlokasi > 0) {
                $alokasiInfo = $db->table('iot_alokasi')
                                  ->select('usaha.nama_usaha')
                                  ->join('usaha', 'usaha.id = iot_alokasi.usaha_id')
                                  ->where('iot_alokasi.iot_id', $id)
                                  ->get()->getRow();
                $namaUsaha = $alokasiInfo ? $alokasiInfo->nama_usaha : 'Usaha Lain';
                return $this->respond([
                    'status' => 'gagal',
                    'pesan'  => "Penghapusan dibatalkan! Perangkat '{$existing->nama_perangkat}' tidak dapat dihapus karena masih teralokasi pada usaha '{$namaUsaha}'."
                ], 400);
            }
        }

        if ($tabel === 'iot_alokasi') {
            $device = $db->table('iot')->where('id', $existing->iot_id)->get()->getRow();
            $namaPerangkat = $device ? $device->nama_perangkat : 'Alat';

            if ($existing->is_aktif == 1) {
                return $this->respond([
                    'status' => 'gagal',
                    'pesan'  => "Penghapusan alokasi dibatalkan! Status alokasi perangkat '{$namaPerangkat}' masih Aktif."
                ], 400);
            }
            if ($existing->status_penggunaan === 'dipakai') {
                return $this->respond([
                    'status' => 'gagal',
                    'pesan'  => "Penghapusan alokasi dibatalkan! Perangkat '{$namaPerangkat}' masih dalam penggunaan (Dipakai)."
                ], 400);
            }
            if ($existing->status_relay == 1) {
                return $this->respond([
                    'status' => 'gagal',
                    'pesan'  => "Penghapusan alokasi dibatalkan! Status relay perangkat '{$namaPerangkat}' masih menyala (ON)."
                ], 400);
            }
            if (!empty($existing->unit_id)) {
                return $this->respond([
                    'status' => 'gagal',
                    'pesan'  => "Penghapusan alokasi dibatalkan! Perangkat '{$namaPerangkat}' sudah dialokasikan/terkait dengan unit cabang."
                ], 400);
            }
        }

        if ($tabel === 'perizinan') {
            $proses = $builder->where('id', $id)->update([
                'deleted_at' => date('Y-m-d H:i:s')
            ]);
        } else {
            $proses = $builder->where('id', $id)->delete();
        }

        if ($proses) {
            return $this->respond([
                'status' => 'sukses',
                'pesan'  => 'Data berhasil dihapus.'
            ]);
        }

        return $this->fail("Gagal menghapus data.");
    }

    // Pembaruan urutan menu massal (bulk reorder)
    public function urutkanMenus()
    {
        $input = $this->request->getJSON(true);
        if (empty($input) || !is_array($input)) {
            return $this->fail("Data tidak valid.");
        }

        $db = \Config\Database::connect();
        $db->transStart();

        foreach ($input as $item) {
            $db->table('menus')
               ->where('id', $item['id'])
               ->update(['urutan' => $item['urutan']]);
        }

        $db->transComplete();

        if ($db->transStatus() === false) {
            return $this->fail("Gagal memperbarui urutan menu.");
        }

        return $this->respond([
            'status' => 'sukses',
            'pesan'  => 'Urutan menu berhasil diperbarui.'
        ]);
    }

    /**
     * Helper untuk memproses upload dan kompresi bukti perizinan
     */
    private function prosesUploadBukti()
    {
        $file = $this->request->getFile('dokumen_bukti');
        if ($file && $file->isValid() && !$file->hasMoved()) {
            $namaBaru = $file->getRandomName();
            $targetDir = WRITEPATH . 'uploads/perizinan/';
            
            if (!is_dir($targetDir)) {
                mkdir($targetDir, 0777, true);
            }

            $mime = $file->getMimeType();
            if (in_array($mime, ['image/jpeg', 'image/png', 'image/webp'])) {
                $tempPath = $file->getTempName();
                try {
                    \Config\Services::image()
                        ->withFile($tempPath)
                        ->resize(1200, 1200, true, 'height')
                        ->save($targetDir . $namaBaru, 70);
                } catch (\Throwable $e) {
                    // Jika kompresi gagal (karena library GD tidak aktif), pindahkan langsung
                    $file->move($targetDir, $namaBaru);
                }
            } else {
                $file->move($targetDir, $namaBaru);
            }
            
            return $namaBaru;
        }
        return null;
    }

    /**
     * GET /api/manajemen/ambil-bukti/perizinan/{namaFile}
     * Men-stream berkas bukti perizinan secara aman.
     */
    public function ambilBuktiPerizinan($namaFile)
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();
        if (!$penggunaAktif) {
            return $this->failUnauthorized('Akses ditolak. Token tidak valid.');
        }

        $userId = $penggunaAktif['uid'];
        $role   = strtolower($penggunaAktif['role'] ?? 'member');

        $db = \Config\Database::connect();
        // Cari data perizinan terkait berkas ini
        $perizinan = $db->table('perizinan')
                        ->where('dokumen_bukti', $namaFile)
                        ->get()->getRow();

        if (!$perizinan) {
            return $this->failNotFound('Berkas bukti tidak ditemukan dalam catatan sistem.');
        }

        // Validasi Otorisasi Keamanan:
        // Owner, Supervisor, dan Root boleh melihat semua berkas.
        // Kasir/Karyawan hanya boleh melihat jika dia adalah Pemohon atau Pengganti.
        $bolehAkses = false;
        if (in_array($role, ['root', 'owner', 'supervisor'])) {
            $bolehAkses = true;
        } else {
            if ($perizinan->karyawan_id == $userId || $perizinan->karyawan_pengganti_id == $userId) {
                $bolehAkses = true;
            }
        }

        if (!$bolehAkses) {
            return $this->failForbidden('Anda tidak memiliki hak akses untuk melihat berkas bukti perizinan ini.');
        }

        $filePath = WRITEPATH . 'uploads/perizinan/' . $namaFile;
        if (!file_exists($filePath)) {
            return $this->failNotFound('File fisik tidak ditemukan di server.');
        }

        $mimeType = mime_content_type($filePath);
        $fileContent = file_get_contents($filePath);

        return $this->response
            ->setHeader('Content-Type', $mimeType)
            ->setHeader('Content-Disposition', 'inline; filename="' . $namaFile . '"')
            ->setBody($fileContent);
    }
}
