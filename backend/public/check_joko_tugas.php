<?php
define('ENVIRONMENT', 'development');
define('FCPATH', __DIR__ . DIRECTORY_SEPARATOR);

require FCPATH . '../app/Config/Paths.php';
$paths = new Config\Paths();
require $paths->systemDirectory . '/Boot.php';
\CodeIgniter\Boot::bootWeb($paths);

\App\Modules\Auth\Filters\JWTFilter::setPenggunaAktif([
    'uid' => 6,
    'role' => 'supervisor',
    'tipe' => 'final',
    'usaha_id' => 2
]);

$controller = new \App\Modules\Absen\Controllers\Absen();
$controller->initController(
    \Config\Services::request(),
    \Config\Services::response(),
    \Config\Services::logger()
);

$res = $controller->tugasHariIni();
echo $res->getBody();
