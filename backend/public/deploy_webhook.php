<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

// Script Webhook Deployment Otomatis BKW
// Ambil token dari query string untuk keamanan
$tokenRahasia = 'bkw_auto_deploy_key_2026_super_aman';
$tokenRequest = $_GET['token'] ?? '';

if ($tokenRequest !== $tokenRahasia) {
    header('HTTP/1.1 403 Forbidden');
    exit('Akses Ditolak: Token keamanan salah atau tidak disertakan.');
}

header('Content-Type: text/plain');

if (!function_exists('shell_exec')) {
    exit("Error: Fungsi PHP 'shell_exec' dinonaktifkan di server web Niagahoster Anda demi keamanan. Kita tidak bisa menggunakan PHP shell_exec di browser.");
}
echo "=== MEMULAI AUTO DEPLOYMENT ===\n\n";

// 1. Tarik perubahan terbaru dari GitHub
echo "1. Menarik update dari GitHub...\n";
$outputGit = shell_exec('cd /home/u1733924/repositories/bkw && git pull 2>&1');
echo $outputGit . "\n";

// 2. Sinkronisasi Frontend
echo "2. Menyalin file Frontend ke subdomain...\n";
$outputFrontend = shell_exec('rsync -av --delete /home/u1733924/repositories/bkw/frontend/dist/ /home/u1733924/public_html/bkw.walisongosragen.com/ 2>&1');
echo $outputFrontend . "\n";

// 3. Sinkronisasi Backend
echo "3. Menyalin file Backend ke subdomain...\n";
$outputBackend = shell_exec('rsync -av --delete /home/u1733924/repositories/bkw/backend/public/ /home/u1733924/public_html/api-bkw.walisongosragen.com/ 2>&1');
echo $outputBackend . "\n";

echo "=== AUTO DEPLOYMENT SELESAI ===\n";
