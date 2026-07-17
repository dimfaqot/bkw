<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

header('Content-Type: text/plain');

$writablePath = '/home/u1733924/repositories/bkw/backend/writable';
$cachePath = $writablePath . '/cache';

echo "=== DIAGNOSIS IZIN FOLDER ===\n\n";

// 1. Cek folder writable
echo "1. Mengecek folder 'writable':\n";
if (file_exists($writablePath)) {
    echo "   - Eksis: YA\n";
    echo "   - Tipe: " . (is_dir($writablePath) ? "Direktori" : "File") . "\n";
    echo "   - Izin (Numeric): " . substr(sprintf('%o', fileperms($writablePath)), -4) . "\n";
    echo "   - Dapat Dibaca: " . (is_readable($writablePath) ? "YA" : "TIDAK") . "\n";
    echo "   - Dapat Ditulisi: " . (is_writable($writablePath) ? "YA" : "TIDAK") . "\n";
    if (function_exists('posix_getpwuid')) {
        echo "   - Owner: " . posix_getpwuid(fileowner($writablePath))['name'] . "\n";
    }
} else {
    echo "   - Eksis: TIDAK DITEMUKAN!\n";
}

echo "\n";

// 2. Cek folder cache
echo "2. Mengecek folder 'writable/cache':\n";
if (file_exists($cachePath)) {
    echo "   - Eksis: YA\n";
    echo "   - Tipe: " . (is_dir($cachePath) ? "Direktori" : "File") . "\n";
    echo "   - Izin (Numeric): " . substr(sprintf('%o', fileperms($cachePath)), -4) . "\n";
    echo "   - Dapat Dibaca: " . (is_readable($cachePath) ? "YA" : "TIDAK") . "\n";
    echo "   - Dapat Ditulisi: " . (is_writable($cachePath) ? "YA" : "TIDAK") . "\n";
    if (function_exists('posix_getpwuid')) {
        echo "   - Owner: " . posix_getpwuid(fileowner($cachePath))['name'] . "\n";
    }
} else {
    echo "   - Eksis: TIDAK DITEMUKAN!\n";
    echo "   - Mencoba membuat folder 'cache'...\n";
    if (mkdir($cachePath, 0755, true)) {
        echo "     -> Berhasil dibuat!\n";
    } else {
        echo "     -> Gagal membuat folder!\n";
    }
}

echo "\n";

// 3. Tes Tulis File Langsung
echo "3. Mencoba menulis file uji coba ke 'writable/cache/uji.txt':\n";
$testFile = $cachePath . '/uji.txt';
error_clear_last();
$writeResult = @file_put_contents($testFile, 'tes_tulis');

if ($writeResult !== false) {
    echo "   -> SUKSES! File berhasil ditulisi.\n";
    @unlink($testFile);
} else {
    $err = error_get_last();
    echo "   -> GAGAL!\n";
    echo "   -> Detail Error PHP: " . ($err ? $err['message'] : 'Tidak ada pesan error PHP') . "\n";
}

echo "\n";
echo "=== SELESAI ===\n";
