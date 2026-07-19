<?php

namespace App\Modules\Notification\Services;

use Minishlink\WebPush\WebPush;
use Minishlink\WebPush\Subscription;
use Config\Vapid;

class NotificationService
{
    /**
     * Mengirimkan notifikasi aplikasi dan Web Push (PWA) secara global satu Cabang/Usaha.
     * 
     * @param int $usahaId ID usaha/cabang penerima notifikasi
     * @param string $judul Judul notifikasi
     * @param string $pesan Isi pesan notifikasi
     * @param string|null $tautan Link navigasi di aplikasi (opsional)
     * @return bool
     */
    public static function kirim($usahaId, $judul, $pesan, $tautan = null)
    {
        $db = \Config\Database::connect();
        $now = date('Y-m-d H:i:s');

        // 1. Simpan ke database riwayat notifikasi global cabang
        $dataNotif = [
            'usaha_id'    => $usahaId,
            'judul'       => $judul,
            'pesan'       => $pesan,
            'tautan'      => $tautan,
            'created_at'  => $now,
            'updated_at'  => $now
        ];
        $db->table('notifikasi')->insert($dataNotif);

        // 2. Ambil subskripsi perangkat milik seluruh karyawan di usaha_id ini
        $subs = $db->table('push_subscriptions ps')
                   ->select('ps.*')
                   ->join('user_role ur', 'ur.user_id = ps.karyawan_id')
                   ->where('ur.usaha_id', $usahaId)
                   ->get()->getResult();

        if (empty($subs)) {
            return true; // Tidak ada subskripsi aktif, selesai secara aman
        }

        // 3. Kirim Web Push (PWA)
        try {
            $config = new Vapid();
            
            // Atur konfigurasi OpenSSL secara aman di Windows
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
            $timeout = 2; // Batasi waktu tunggu maksimal 2 detik agar tidak mendeadlock PHP server
            $clientOptions = [
                'connect_timeout' => 2 // Batasi waktu koneksi maksimal 2 detik
            ];
            $webPush = new WebPush($auth, $defaultOptions, $timeout, $clientOptions);
            $payload = json_encode([
                'title' => $judul,
                'body'  => $pesan,
                'link'  => $tautan
            ]);

            foreach ($subs as $sub) {
                $subscription = Subscription::create([
                    'endpoint' => $sub->endpoint,
                    'keys' => [
                        'p256dh' => $sub->p256dh,
                        'auth'   => $sub->auth
                    ]
                ]);

                $webPush->queueNotification($subscription, $payload);
            }

            // Jalankan pengiriman antrean push
            foreach ($webPush->flush() as $report) {
                if (!$report->isSuccess()) {
                    // Jika subskripsi kedaluwarsa atau tidak valid (expired/gone),
                    // hapus dari database secara otomatis agar tidak membebani server
                    if ($report->isSubscriptionExpired()) {
                        $db->table('push_subscriptions')
                           ->where('endpoint', $report->getEndpoint())
                           ->delete();
                    }
                }
            }
        } catch (\Throwable $e) {
            // Tulis log error push agar tidak merusak flow utama aplikasi jika terjadi kendala environment
            log_message('error', 'Push Notification error: ' . $e->getMessage());
        }

        return true;
    }

    /**
     * Memeriksa apakah suatu jenis notifikasi diaktifkan untuk cabang (usaha_id) ini.
     * 
     * @param int|null $usahaId ID usaha/cabang
     * @param string $kunci Kunci pengaturan notifikasi
     * @return bool
     */
    public static function isAktif($usahaId, $kunci)
    {
        $db = \Config\Database::connect();
        
        // 1. Cek pengaturan spesifik cabang jika ada
        if ($usahaId !== null) {
            $setting = $db->table('pengaturan_notifikasi')
                          ->where('usaha_id', $usahaId)
                          ->where('kunci', $kunci)
                          ->get()->getRow();
            if ($setting) {
                return (int)$setting->nilai === 1;
            }
        }
        
        // 2. Fallback ke default sistem (global)
        $default = $db->table('pengaturan_notifikasi')
                      ->where('usaha_id', null)
                      ->where('kunci', $kunci)
                      ->get()->getRow();
                      
        return $default ? (int)$default->nilai === 1 : true;
    }
}
