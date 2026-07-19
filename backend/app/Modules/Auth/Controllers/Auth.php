<?php

namespace App\Modules\Auth\Controllers;

use App\Controllers\BaseController;
use App\Modules\Auth\Models\UsersModel;
use App\Modules\Auth\Models\RolesModel;
use App\Modules\Auth\Models\UserRoleModel;
use Firebase\JWT\JWT;
use CodeIgniter\API\ResponseTrait;

class Auth extends BaseController
{
    use ResponseTrait;

    protected $usersModel;
    protected $rolesModel;
    protected $userRoleModel;
    protected $jwtSecret;

    public function __construct()
    {
        $this->usersModel = new UsersModel();
        $this->rolesModel = new RolesModel();
        $this->userRoleModel = new UserRoleModel();
        $this->jwtSecret = getenv('JWT_SECRET') ?: 'rahasia_jwt_bkw_2026_super_aman_1234';
    }

    /**
     * Pendaftaran Mandiri oleh User (Kolom Lengkap)
     */
    public function daftar()
    {
        $aturan = [
            'nama'     => [
                'rules'  => 'required|min_length[3]|max_length[100]',
                'errors' => [
                    'required'   => 'Nama lengkap wajib diisi.',
                    'min_length' => 'Nama lengkap minimal 3 karakter.',
                    'max_length' => 'Nama lengkap maksimal 100 karakter.'
                ]
            ],
            'email'    => [
                'rules'  => 'required|valid_email|is_unique[users.email]',
                'errors' => [
                    'required'    => 'Alamat email wajib diisi.',
                    'valid_email' => 'Format email tidak valid.',
                    'is_unique'   => 'Alamat email ini sudah terdaftar.'
                ]
            ],
            'wa'       => [
                'rules'  => 'required|min_length[8]|max_length[20]|is_unique[users.wa]',
                'errors' => [
                    'required'   => 'Nomor WhatsApp wajib diisi.',
                    'min_length' => 'Nomor WhatsApp minimal 8 angka.',
                    'max_length' => 'Nomor WhatsApp maksimal 20 angka.',
                    'is_unique'  => 'Nomor WhatsApp ini sudah terdaftar.'
                ]
            ],
            'password' => [
                'rules'  => 'required|min_length[6]',
                'errors' => [
                    'required'   => 'Kata sandi wajib diisi.',
                    'min_length' => 'Kata sandi minimal 6 karakter.'
                ]
            ]
        ];

        if (!$this->validate($aturan)) {
            return $this->respond([
                'status' => 'gagal',
                'pesan'  => 'Validasi gagal.',
                'errors' => $this->validator->getErrors()
            ], 400);
        }

        $nama = ucwords(strtolower($this->request->getVar('nama')));
        $email = strtolower($this->request->getVar('email'));
        $wa = $this->request->getVar('wa');
        $password = $this->request->getVar('password');

        $data = [
            'nama'     => $nama,
            'email'    => $email,
            'wa'       => $wa,
            'password' => password_hash($password, PASSWORD_BCRYPT),
        ];

        $userId = $this->usersModel->insert($data);

        if ($userId) {
            // Berikan peran default 'member' (buat peran member jika belum ada)
            $roleMember = $this->rolesModel->where('nama_role', 'member')->first();
            if (!$roleMember) {
                $roleId = $this->rolesModel->insert([
                    'nama_role' => 'member',
                    'deskripsi' => 'Peran pelanggan / member global'
                ]);
            } else {
                $roleId = $roleMember['id'];
            }

            return $this->respond([
                'status' => 'sukses',
                'pesan'  => 'Pendaftaran pengguna berhasil.',
                'data'   => [
                    'id'    => $userId,
                    'nama'  => $nama,
                    'email' => $email,
                    'wa'    => $wa
                ]
            ], 201);
        }

        return $this->respond([
            'status' => 'gagal',
            'pesan'  => 'Gagal menyimpan data pengguna.'
        ], 500);
    }

    /**
     * Pendaftaran terbatas oleh Kasir (Hanya nama dan wa)
     */
    public function daftarKasir()
    {
        // Cek auth (hanya staff/kasir yang boleh daftar) - pada tahap ini kita boleh melonggarkan
        // karena belum ada user awal. Kita validasi wa harus unik.
        $aturan = [
            'nama' => [
                'rules'  => 'required|min_length[3]|max_length[100]',
                'errors' => [
                    'required'   => 'Nama lengkap wajib diisi.',
                    'min_length' => 'Nama lengkap minimal 3 karakter.',
                    'max_length' => 'Nama lengkap maksimal 100 karakter.'
                ]
            ],
            'wa'   => [
                'rules'  => 'required|min_length[8]|max_length[20]|is_unique[users.wa]',
                'errors' => [
                    'required'   => 'Nomor WhatsApp wajib diisi.',
                    'min_length' => 'Nomor WhatsApp minimal 8 angka.',
                    'max_length' => 'Nomor WhatsApp maksimal 20 angka.',
                    'is_unique'  => 'Nomor WhatsApp ini sudah terdaftar oleh pengguna lain.'
                ]
            ]
        ];

        if (!$this->validate($aturan)) {
            return $this->respond([
                'status' => 'gagal',
                'pesan'  => 'Validasi gagal.',
                'errors' => $this->validator->getErrors()
            ], 400);
        }

        $nama = ucwords(strtolower($this->request->getVar('nama')));
        $wa = $this->request->getVar('wa');

        $data = [
            'nama'     => $nama,
            'wa'       => $wa,
            'email'    => null,
            'password' => null, // Password diset NULL agar wajib diubah nanti
        ];

        $userId = $this->usersModel->insert($data);

        if ($userId) {
            // Kirim respon sukses beserta petunjuk cara login pertama
            $empatDigitTerakhir = substr($wa, -4);
            return $this->respond([
                'status' => 'sukses',
                'pesan'  => 'Pengguna berhasil didaftarkan oleh kasir.',
                'data'   => [
                    'id'               => $userId,
                    'nama'             => $nama,
                    'wa'               => $wa,
                    'instruksi_login' => "Login menggunakan nomor WhatsApp: {$wa} dan password sementara (4 digit terakhir nomor WA): {$empatDigitTerakhir}"
                ]
            ], 201);
        }

        return $this->respond([
            'status' => 'gagal',
            'pesan'  => 'Gagal mendaftarkan pengguna.'
        ], 500);
    }

    /**
     * API Login Utama
     */
    public function login()
    {
        $aturan = [
            'wa'       => [
                'rules'  => 'required',
                'errors' => ['required' => 'Nomor WhatsApp wajib diisi.']
            ],
            'password' => [
                'rules'  => 'required',
                'errors' => ['required' => 'Kata sandi wajib diisi.']
            ]
        ];

        if (!$this->validate($aturan)) {
            return $this->respond([
                'status' => 'gagal',
                'pesan'  => 'Nomor WA dan password wajib diisi.',
                'errors' => $this->validator->getErrors()
            ], 400);
        }

        $wa = $this->request->getVar('wa');
        $passwordInput = $this->request->getVar('password');

        $user = $this->usersModel->where('wa', $wa)->first();

        if (!$user) {
            return $this->respond([
                'status' => 'gagal',
                'pesan'  => 'Kredensial tidak valid (User tidak ditemukan).'
            ], 401);
        }

        // 1. Cek jika password masih NULL (Didaftarkan kasir)
        if ($user['password'] === null) {
            $empatDigitTerakhir = substr($user['wa'], -4);
            if ($passwordInput !== $empatDigitTerakhir) {
                return $this->respond([
                    'status' => 'gagal',
                    'pesan'  => 'Kredensial tidak valid (Kata sandi sementara salah).'
                ], 401);
            }

            // Password sementara benar, kirim JWT sementara dan suruh buat password baru
            $waktuSelesai = time() + (60 * 15); // JWT sementara aktif 15 menit
            $payload = [
                'iat'  => time(),
                'exp'  => $waktuSelesai,
                'uid'  => $user['id'],
                'nama' => $user['nama'],
                'wa'   => $user['wa'],
                'tipe' => 'sementara' // Flag penanda token sementara
            ];

            $token = JWT::encode($payload, $this->jwtSecret, 'HS256');

            return $this->respond([
                'status'          => 'perlu_buat_password',
                'pesan'           => 'Anda login menggunakan password sementara. Silakan buat password baru Anda sekarang.',
                'token_sementara' => $token
            ], 200);
        }

        // 2. Cek password normal (Verify hash)
        if (!password_verify($passwordInput, $user['password'])) {
            return $this->respond([
                'status' => 'gagal',
                'pesan'  => 'Kredensial tidak valid (Kata sandi salah).'
            ], 401);
        }

        // 3. Cari hak akses usaha / unit / peran
        $peranUser = $this->userRoleModel->dapatkanPeranUser($user['id']);

        if (empty($peranUser)) {
            // Jika tidak ada peran, kembalikan peran default 'member'
            $waktuSelesai = time() + (3600 * 24); // JWT aktif 24 jam
            $payload = [
                'iat'      => time(),
                'exp'      => $waktuSelesai,
                'uid'      => $user['id'],
                'nama'     => $user['nama'],
                'wa'       => $user['wa'],
                'role'     => 'member',
                'tipe'     => 'final'
            ];

            $token = JWT::encode($payload, $this->jwtSecret, 'HS256');

            return $this->respond([
                'status'              => 'sukses',
                'pesan'               => 'Login berhasil sebagai member.',
                'token'               => $token,
                'user'                => [
                    'id'   => $user['id'],
                    'nama' => $user['nama'],
                    'role' => 'member'
                ]
            ], 200);
        }

        // Ambil peran pertama sebagai peran aktif (Simplifikasi RBAC)
        $peranAktif = $peranUser[0];
        // Jika user punya root, gunakan root
        foreach ($peranUser as $pu) {
            if (strtolower($pu['nama_role']) === 'root') {
                $peranAktif = $pu;
                break;
            }
        }

        $waktuSelesai = time() + (3600 * 24);
        $payload = [
            'iat'      => time(),
            'exp'      => $waktuSelesai,
            'uid'      => $user['id'],
            'nama'     => $user['nama'],
            'wa'       => $user['wa'],
            'role'     => $peranAktif['nama_role'],
            'role_id'  => $peranAktif['role_id'],
            'usaha_id' => $peranAktif['usaha_id'],
            'unit_id'  => $peranAktif['unit_id'],
            'tipe'     => 'final'
        ];

        $tokenFinal = JWT::encode($payload, $this->jwtSecret, 'HS256');

        return $this->respond([
            'status'              => 'sukses',
            'pesan'               => 'Login berhasil.',
            'token'               => $tokenFinal,
            'user'                => [
                'id'                => $user['id'],
                'nama'              => $user['nama'],
                'role'              => $peranAktif['nama_role'],
                'punya_multi_peran' => count($peranUser) > 1
            ]
        ], 200);
    }



    /**
     * Mengisi/Membuat Password pertama kali (untuk User terdaftar Kasir)
     */
    public function buatPassword()
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();

        if (!$penggunaAktif || $penggunaAktif['tipe'] !== 'sementara') {
            return $this->respond([
                'status' => 'gagal',
                'pesan'  => 'Token tidak diizinkan untuk pembuatan password baru.'
            ], 403);
        }

        $passwordBaru = $this->request->getVar('password_baru');

        if (!$passwordBaru || strlen($passwordBaru) < 6) {
            return $this->respond([
                'status' => 'gagal',
                'pesan'  => 'Password baru minimal berisi 6 karakter.'
            ], 400);
        }

        $userId = $penggunaAktif['uid'];

        // Ambil data user saat ini dan pastikan password di database memang NULL
        $user = $this->usersModel->find($userId);
        if (!$user || $user['password'] !== null) {
            return $this->respond([
                'status' => 'gagal',
                'pesan'  => 'Gagal memperbarui password (password sudah pernah dibuat sebelumnya).'
            ], 400);
        }

        $updateSuccess = $this->usersModel->update($userId, [
            'password' => password_hash($passwordBaru, PASSWORD_BCRYPT)
        ]);

        if ($updateSuccess) {
            return $this->respond([
                'status' => 'sukses',
                'pesan'  => 'Password berhasil dibuat. Silakan login kembali menggunakan password baru Anda.'
            ], 200);
        }

        return $this->respond([
            'status' => 'gagal',
            'pesan'  => 'Gagal memperbarui password di database.'
        ], 500);
    }

    /**
     * profil
     */
    public function profil()
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();

        if (!$penggunaAktif || $penggunaAktif['tipe'] !== 'final') {
            return $this->respond([
                'status' => 'gagal',
                'pesan'  => 'Akses ditolak (Token tidak valid/bukan token final).'
            ], 403);
        }

        $user = $this->usersModel->find($penggunaAktif['uid']);

        if (!$user) {
            return $this->respond([
                'status' => 'gagal',
                'pesan'  => 'User tidak ditemukan.'
            ], 404);
        }

        $roleId = $penggunaAktif['role_id'] ?? null;
        $db = \Config\Database::connect();
        
        $menus = [];
        
        if ($roleId) {
            $menus = $db->table('menus')
                ->select('menus.*, rp.can_read, rp.can_create, rp.can_update, rp.can_delete, rp.is_aktif as rp_is_aktif')
                ->join('role_permissions as rp', 'rp.menu_id = menus.id')
                ->where('rp.role_id', $roleId)
                ->where('menus.is_aktif', 1)
                ->orderBy('menus.urutan', 'ASC')
                ->get()->getResultArray();
        }

        $namaUsaha = null;
        $logoUsaha = null;
        $namaUnit = null;

        $usahaId = $penggunaAktif['usaha_id'] ?? null;
        $unitId = $penggunaAktif['unit_id'] ?? null;

        if ($usahaId) {
            $usaha = $db->table('usaha')->where('id', $usahaId)->get()->getRowArray();
            if ($usaha) {
                $namaUsaha = $usaha['nama_usaha'];
                $logoUsaha = $usaha['logo'] ?? null;
            }
        }
        
        if ($unitId) {
            $unit = $db->table('unit')->where('id', $unitId)->get()->getRowArray();
            if ($unit) {
                $namaUnit = $unit['nama_unit'];
            }
        }

        $peranUser = $this->userRoleModel->where('user_id', $user['id'])->findAll();
        $punyaMultiPeran = count($peranUser) > 1;

        return $this->respond([
            'status' => 'sukses',
            'data'   => [
                'user_id'           => $user['id'],
                'nama'              => $user['nama'],
                'email'             => $user['email'],
                'wa'                => $user['wa'],
                'usaha_id'          => $usahaId,
                'nama_usaha'        => $namaUsaha,
                'logo_usaha'        => $logoUsaha,
                'unit_id'           => $unitId,
                'nama_unit'         => $namaUnit,
                'role'              => $penggunaAktif['role'],
                'punya_multi_peran' => $punyaMultiPeran,
                'menus'             => $menus
            ]
        ], 200);
    }

    public function mintaPilihUsaha()
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();

        if (!$penggunaAktif) {
            return $this->respond([
                'status' => 'gagal',
                'pesan'  => 'Akses ditolak (Token tidak valid/bukan token final).'
            ], 403);
        }

        $db = \Config\Database::connect();

        // Jika user adalah root, ambil seluruh usaha dari database
        if (strtolower($penggunaAktif['role']) === 'root') {
            $allUsaha = $db->table('usaha')->get()->getResultArray();
            $peranUser = [];
            
            // 1. Konteks Global (Sistem Inti)
            $peranUser[] = [
                'user_id'    => $penggunaAktif['uid'],
                'usaha_id'   => null,
                'nama_usaha' => 'Global (Sistem Inti)',
                'unit_id'    => null,
                'nama_unit'  => null,
                'role_id'    => $penggunaAktif['role_id'],
                'nama_role'  => 'root'
            ];

            // 2. Konteks Usaha (Masing-masing 1)
            foreach ($allUsaha as $u) {
                $peranUser[] = [
                    'user_id'    => $penggunaAktif['uid'],
                    'usaha_id'   => $u['id'],
                    'nama_usaha' => $u['nama_usaha'],
                    'unit_id'    => null,
                    'nama_unit'  => null,
                    'role_id'    => $penggunaAktif['role_id'],
                    'nama_role'  => 'root'
                ];
            }
        } else {
            $peranUser = $this->userRoleModel->dapatkanPeranUser($penggunaAktif['uid']);
        }

        // Dapatkan token saat ini dari headers untuk diteruskan kembali
        $authHeader = $this->request->getServer('HTTP_AUTHORIZATION');
        $arr = explode(" ", $authHeader);
        $token = isset($arr[1]) ? $arr[1] : '';

        return $this->respond([
            'status'           => 'pilih_usaha',
            'token_sementara'  => $token,
            'daftar_usaha'     => $peranUser
        ], 200);
    }

    public function pilihUsaha()
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();

        if (!$penggunaAktif) {
            return $this->respond([
                'status' => 'gagal',
                'pesan'  => 'Sesi tidak valid.'
            ], 403);
        }

        $usahaId = $this->request->getVar('usaha_id');
        $unitId = $this->request->getVar('unit_id');
        $roleId = $this->request->getVar('role_id');

        $db = \Config\Database::connect();
        
        $roleAkses = null;

        // Jika user adalah root, bypass pengecekan relasi user_role dan pastikan unit/usaha itu valid
        if (strtolower($penggunaAktif['role']) === 'root') {
            // Validasi usaha_id
            $usaha = $db->table('usaha')->where('id', $usahaId ?: null)->get()->getRowArray();
            if ($usahaId && !$usaha) {
                return $this->respond([
                    'status' => 'gagal',
                    'pesan'  => 'Usaha tidak ditemukan.'
                ], 404);
            }
            
            // Validasi unit_id
            $unit = $db->table('unit')->where('id', $unitId ?: null)->get()->getRowArray();
            if ($unitId && !$unit) {
                return $this->respond([
                    'status' => 'gagal',
                    'pesan'  => 'Unit tidak ditemukan.'
                ], 404);
            }

            $roleAkses = [
                'role_id'   => $roleId,
                'nama_role' => 'root',
                'usaha_id'  => $usahaId ?: null,
                'unit_id'   => $unitId ?: null
            ];
        } else {
            // Cari role di user_role yang sesuai
            $roleAkses = $db->table('user_role')
                ->select('user_role.*, roles.nama_role')
                ->join('roles', 'roles.id = user_role.role_id')
                ->where([
                    'user_role.user_id' => $penggunaAktif['uid'],
                    'user_role.usaha_id' => $usahaId ?: null,
                    'user_role.unit_id' => $unitId ?: null,
                    'user_role.role_id' => $roleId
                ])->get()->getRowArray();
        }

        if (!$roleAkses) {
            return $this->respond([
                'status' => 'gagal',
                'pesan'  => 'Anda tidak memiliki akses untuk pilihan usaha/peran ini.'
            ], 403);
        }

        // Terbitkan token final baru
        $waktuSelesai = time() + (3600 * 24);
        $payload = [
            'iat'      => time(),
            'exp'      => $waktuSelesai,
            'uid'      => $penggunaAktif['uid'],
            'nama'     => $penggunaAktif['nama'],
            'wa'       => $penggunaAktif['wa'],
            'role'     => $roleAkses['nama_role'],
            'role_id'  => $roleAkses['role_id'],
            'usaha_id' => $roleAkses['usaha_id'],
            'unit_id'  => $roleAkses['unit_id'],
            'tipe'     => 'final'
        ];

        $tokenFinal = JWT::encode($payload, $this->jwtSecret, 'HS256');

        return $this->respond([
            'status'              => 'sukses',
            'pesan'               => 'Berhasil beralih usaha.',
            'token'               => $tokenFinal,
            'user'                => [
                'id'       => $penggunaAktif['uid'],
                'nama'     => $penggunaAktif['nama'],
                'role'     => $roleAkses['nama_role']
            ]
        ], 200);
    }
}
