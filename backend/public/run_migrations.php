<?php
// Force display errors
ini_set('display_errors', 1);
error_reporting(E_ALL);

// Define path constants manually so CI4 migrations service can load
define('ENVIRONMENT', 'development');

use Config\Paths;

// Load Paths
define('FCPATH', __DIR__ . DIRECTORY_SEPARATOR);
if (file_exists(FCPATH . '../app/Config/Paths.php')) {
    require FCPATH . '../app/Config/Paths.php';
} else {
    require FCPATH . '../../repositories/bkw/backend/app/Config/Paths.php';
}
$paths = new Paths();

// Define necessary CI4 constants manually
define('APPPATH', realpath(rtrim($paths->appDirectory, '\\/ ')) . DIRECTORY_SEPARATOR);
define('SYSTEMPATH', realpath(rtrim($paths->systemDirectory, '\\/ ')) . DIRECTORY_SEPARATOR);
define('ROOTPATH', realpath(APPPATH . '../') . DIRECTORY_SEPARATOR);
define('WRITEPATH', realpath(rtrim($paths->writableDirectory, '\\/ ')) . DIRECTORY_SEPARATOR);

// Load Composer autoloader
require ROOTPATH . 'vendor/autoload.php';

// Load path constants defined by application
if (file_exists(APPPATH . 'Config/Constants.php')) {
    require APPPATH . 'Config/Constants.php';
}

// Load Common functions
require SYSTEMPATH . 'Common.php';

// Load Config\Services
require APPPATH . 'Config/Services.php';

// Load the DotEnv class and load .env manually
$dotenv = new \CodeIgniter\Config\DotEnv(ROOTPATH);
$dotenv->load();

// Load autoloader helper
$loader = \Config\Services::autoloader();
$loader->initialize(new \Config\Autoload(), new \Config\Modules());
$loader->register();

// Run migrations programmatically
$runner = \Config\Services::migrations();
header('Content-Type: text/plain');

try {
    echo "Running migrations...\n";
    if ($runner->latest()) {
        echo "Migrations successfully run!\n";
    } else {
        echo "No migrations needed or already up to date.\n";
    }
} catch (\Throwable $e) {
    echo "Migration Error: " . $e->getMessage() . "\n" . $e->getTraceAsString() . "\n";
}

// Run seeders
$seeder = \Config\Database::seeder();
$seeders = ['RoleSeeder', 'MenuSeeder', 'SeedMenuKebersihan', 'SeedAreaKebersihan', 'SeedKriteriaPoinKebersihan'];

echo "\nRunning seeders...\n";
foreach ($seeders as $s) {
    try {
        echo "- Seeding {$s}: ";
        $seeder->call($s);
        echo "Success\n";
    } catch (\Throwable $e) {
        echo "Failed: " . $e->getMessage() . "\n";
    }
}
