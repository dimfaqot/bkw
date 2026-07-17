<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

use Config\Paths;

define('ENVIRONMENT', 'development');
define('FCPATH', __DIR__ . DIRECTORY_SEPARATOR);

if (file_exists(FCPATH . '../app/Config/Paths.php')) {
    require FCPATH . '../app/Config/Paths.php';
} else {
    require FCPATH . '../../repositories/bkw/backend/app/Config/Paths.php';
}
$paths = new Paths();

define('APPPATH', realpath(rtrim($paths->appDirectory, '\\/ ')) . DIRECTORY_SEPARATOR);
define('SYSTEMPATH', realpath(rtrim($paths->systemDirectory, '\\/ ')) . DIRECTORY_SEPARATOR);
define('ROOTPATH', realpath(APPPATH . '../') . DIRECTORY_SEPARATOR);

require ROOTPATH . 'vendor/autoload.php';
require SYSTEMPATH . 'Common.php';
require APPPATH . 'Config/Constants.php';
require APPPATH . 'Config/Services.php';

$dotenv = new \CodeIgniter\Config\DotEnv(ROOTPATH);
$dotenv->load();

$db = \Config\Database::connect();

header('Content-Type: text/plain');
echo "Database terhubung: " . $db->getDatabase() . "\n";

try {
    $tables = $db->listTables();
    echo "Jumlah tabel ditemukan: " . count($tables) . "\n\n";
    foreach ($tables as $table) {
        echo "- " . $table . "\n";
    }
} catch (\Throwable $e) {
    echo "Error membaca tabel: " . $e->getMessage() . "\n";
}
