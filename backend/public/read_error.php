<?php
header('Content-Type: text/plain');
$logFile = '/home/u1733924/public_html/api-bkw.walisongosragen.com/error_log';

if (!file_exists($logFile)) {
    // Try parent directory
    $logFile = '/home/u1733924/repositories/bkw/backend/public/error_log';
}

if (!file_exists($logFile)) {
    exit("File error_log tidak ditemukan.");
}

$lines = file($logFile);
$lastLines = array_slice($lines, -50);
echo implode("", $lastLines);
