<?php

namespace App\Modules\Auth\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Services;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Exception;

class JWTFilter implements FilterInterface
{
    private static ?array $penggunaAktif = null;

    public static function getPenggunaAktif(): ?array
    {
        return self::$penggunaAktif;
    }

    public static function setPenggunaAktif(?array $user): void
    {
        self::$penggunaAktif = $user;
    }

    public function before(RequestInterface $request, $arguments = null)
    {
        $authHeader = $request->getServer('HTTP_AUTHORIZATION');

        if (!$authHeader) {
            return Services::response()
                ->setJSON([
                    'status' => 'gagal',
                    'pesan'  => 'Token otentikasi tidak ditemukan.'
                ])
                ->setStatusCode(ResponseInterface::HTTP_UNAUTHORIZED);
        }

        $arr = explode(" ", $authHeader);
        $token = isset($arr[1]) ? $arr[1] : '';

        if (!$token) {
            return Services::response()
                ->setJSON([
                    'status' => 'gagal',
                    'pesan'  => 'Token otentikasi tidak valid.'
                ])
                ->setStatusCode(ResponseInterface::HTTP_UNAUTHORIZED);
        }

        try {
            $key = getenv('JWT_SECRET') ?: 'rahasia_jwt_bkw_2026_super_aman_1234';
            $decoded = JWT::decode($token, new Key($key, 'HS256'));
            
            // Simpan data user yang didecode secara statis agar bisa diakses oleh controller
            self::setPenggunaAktif((array) $decoded);
            
        } catch (Exception $e) {
            return Services::response()
                ->setJSON([
                    'status' => 'gagal',
                    'pesan'  => 'Token kedaluwarsa atau tidak valid.',
                    'error'  => $e->getMessage()
                ])
                ->setStatusCode(ResponseInterface::HTTP_UNAUTHORIZED);
        }
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
        // Tidak diperlukan tindakan setelah request
    }
}
