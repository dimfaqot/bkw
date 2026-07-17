<?php

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

class RoleFilter implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        $penggunaAktif = \App\Modules\Auth\Filters\JWTFilter::getPenggunaAktif();

        if (!$penggunaAktif) {
            return \Config\Services::response()->setJSON([
                'status' => 'gagal',
                'pesan'  => 'Sesi tidak valid atau belum login.'
            ])->setStatusCode(401);
        }

        $roleName = $penggunaAktif['role'];
        $roleId = $penggunaAktif['role_id'] ?? null;

        // Root bypass
        if (strtolower($roleName) === 'root') {
            return;
        }

        // URI segment mapping: /api/manajemen/[ambil|tambah|ubah|hapus]/[nama_tabel]/...
        $uri = $request->getUri();
        $segments = $uri->getSegments();

        // Cari segment aksi dan tabel
        // Index: 0=api, 1=manajemen, 2=aksi, 3=tabel
        $aksi = isset($segments[2]) ? $segments[2] : null;
        $tabel = isset($segments[3]) ? $segments[3] : null;

        if (!$aksi || !$tabel) {
            return \Config\Services::response()->setJSON([
                'status' => 'gagal',
                'pesan'  => 'URL tidak lengkap.'
            ])->setStatusCode(400);
        }

        $db = \Config\Database::connect();

        // Cari menu-menu yang diizinkan untuk di-fetch (bypass relasional saat membaca)
        $tabelBypass = [$tabel];
        if ($aksi === 'ambil') {
            if ($tabel === 'users') {
                $tabelBypass[] = 'user_role';
                $tabelBypass[] = 'jadwal_karyawan';
                $tabelBypass[] = 'absensi';
                $tabelBypass[] = 'points';
            } else if ($tabel === 'shift') {
                $tabelBypass[] = 'jadwal_karyawan';
                $tabelBypass[] = 'absensi';
            } else if ($tabel === 'usaha') {
                $tabelBypass[] = 'unit';
                $tabelBypass[] = 'user_role';
                $tabelBypass[] = 'iot_alokasi';
                $tabelBypass[] = 'shift';
                $tabelBypass[] = 'jadwal_karyawan';
                $tabelBypass[] = 'absensi';
                $tabelBypass[] = 'kriteria_poin';
                $tabelBypass[] = 'points';
            } else if ($tabel === 'unit') {
                $tabelBypass[] = 'user_role';
                $tabelBypass[] = 'iot_alokasi';
            } else if ($tabel === 'roles') {
                $tabelBypass[] = 'user_role';
                $tabelBypass[] = 'role_permissions';
            } else if ($tabel === 'menus') {
                $tabelBypass[] = 'role_permissions';
            } else if ($tabel === 'iot') {
                $tabelBypass[] = 'iot_alokasi';
            } else if ($tabel === 'kriteria_poin') {
                $tabelBypass[] = 'points';
            } else if ($tabel === 'jadwal_karyawan') {
                $tabelBypass[] = 'absensi';
            }
        }

        $menus = $db->table('menus')->whereIn('tabel', $tabelBypass)->where('is_aktif', 1)->get()->getResultArray();
        
        if (empty($menus)) {
            return \Config\Services::response()->setJSON([
                'status' => 'gagal',
                'pesan'  => "Fitur untuk '$tabel' tidak ditemukan atau tidak diizinkan di sistem."
            ])->setStatusCode(403);
        }

        $menuIds = array_column($menus, 'id');

        // Ambil izin dari role_permissions
        $daftarIzin = $db->table('role_permissions')
                         ->where('role_id', $roleId)
                         ->whereIn('menu_id', $menuIds)
                         ->get()->getResultArray();

        if (empty($daftarIzin)) {
            return \Config\Services::response()->setJSON([
                'status' => 'gagal',
                'pesan'  => 'Anda tidak memiliki hak akses untuk fitur ini.'
            ])->setStatusCode(403);
        }

        $bolehLanjut = false;
        $pesanTolak = "Akses ditolak.";
        
        switch ($aksi) {
            case 'ambil':
                // Diizinkan jika salah satu relasi memiliki izin baca
                foreach ($daftarIzin as $izin) {
                    if ($izin['can_read'] == 1) {
                        $bolehLanjut = true;
                        break;
                    }
                }
                $pesanTolak = "Anda tidak memiliki izin membaca data.";
                break;
            case 'tambah':
                // Khusus aksi manipulasi data, harus memiliki izin langsung pada tabel tujuan
                $menuTujuan = $db->table('menus')->where('tabel', $tabel)->where('is_aktif', 1)->get()->getRowArray();
                if ($menuTujuan) {
                    foreach ($daftarIzin as $izin) {
                        if ($izin['menu_id'] == $menuTujuan['id'] && $izin['can_create'] == 1) {
                            $bolehLanjut = true;
                            break;
                        }
                    }
                }
                $pesanTolak = "Anda tidak memiliki izin menambahkan data.";
                break;
            case 'ubah':
                $menuTujuan = $db->table('menus')->where('tabel', $tabel)->where('is_aktif', 1)->get()->getRowArray();
                if ($menuTujuan) {
                    foreach ($daftarIzin as $izin) {
                        if ($izin['menu_id'] == $menuTujuan['id'] && $izin['can_update'] == 1) {
                            $bolehLanjut = true;
                            break;
                        }
                    }
                }
                $pesanTolak = "Anda tidak memiliki izin mengubah data.";
                break;
            case 'hapus':
                $menuTujuan = $db->table('menus')->where('tabel', $tabel)->where('is_aktif', 1)->get()->getRowArray();
                if ($menuTujuan) {
                    foreach ($daftarIzin as $izin) {
                        if ($izin['menu_id'] == $menuTujuan['id'] && $izin['can_delete'] == 1) {
                            $bolehLanjut = true;
                            break;
                        }
                    }
                }
                $pesanTolak = "Anda tidak memiliki izin menghapus data.";
                break;
        }
        
        if (!$bolehLanjut) {
            return \Config\Services::response()->setJSON([
                'status' => 'gagal',
                'pesan'  => $pesanTolak
            ])->setStatusCode(403);
        }
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
        // Do nothing
    }
}
