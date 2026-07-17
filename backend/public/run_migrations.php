<?php
// Force display errors
ini_set('display_errors', 1);
error_reporting(E_ALL);

use CodeIgniter\Boot;
use Config\Paths;

// Set FCPATH
define('FCPATH', __DIR__ . DIRECTORY_SEPARATOR);
if (getcwd() . DIRECTORY_SEPARATOR !== FCPATH) {
    chdir(FCPATH);
}

// Load paths
if (file_exists(FCPATH . '../app/Config/Paths.php')) {
    require FCPATH . '../app/Config/Paths.php';
} else {
    require FCPATH . '../../repositories/bkw/backend/app/Config/Paths.php';
}

$paths = new Paths();
require $paths->systemDirectory . '/Boot.php';

// Define ENVIRONMENT constant directly as development to force detailed error display for this script
if (!defined('ENVIRONMENT')) {
    define('ENVIRONMENT', 'development');
}

// Bootstrap the CI4 framework in console context
Boot::bootConsole($paths);
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
