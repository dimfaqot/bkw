<?php
// Force display errors
ini_set('display_errors', 1);
error_reporting(E_ALL);

use Config\Paths;

define('ENVIRONMENT', 'development');
defined('CI_DEBUG') || define('CI_DEBUG', true);
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
define('WRITEPATH', realpath(rtrim($paths->writableDirectory, '\\/ ')) . DIRECTORY_SEPARATOR);

require ROOTPATH . 'vendor/autoload.php';
require SYSTEMPATH . 'Common.php';
require APPPATH . 'Config/Constants.php';
require APPPATH . 'Config/Services.php';

$dotenv = new \CodeIgniter\Config\DotEnv(ROOTPATH);
$dotenv->load();

$db = \Config\Database::connect();

header('Content-Type: text/plain');

try {
    // Alter table user_role to make usaha_id nullable (fixes migration discrepancy)
    echo "Altering user_role schema...\n";
    $db->query("ALTER TABLE user_role MODIFY COLUMN usaha_id INT(11) UNSIGNED NULL");
    echo "user_role schema updated successfully.\n\n";

    // 1. Insert User Dim
    $userExists = $db->table('users')->where('wa', '085175006585')->countAllResults();
    if ($userExists === 0) {
        $db->table('users')->insert([
            'id' => 1,
            'nama' => 'Dim',
            'email' => 'fqt@gmail.com',
            'wa' => '085175006585',
            'password' => '$2y$10$nCNpQBv2hA/RPxLmZgYTZeZXgq6h2Yd8XzG/aEf2R9vAUEPVUMa0K',
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s')
        ]);
        echo "User 'Dim' seeded successfully.\n";
    } else {
        echo "User 'Dim' already exists.\n";
    }

    // 2. Assign root role
    $roleExists = $db->table('user_role')->where(['user_id' => 1, 'role_id' => 1])->countAllResults();
    if ($roleExists === 0) {
        // Find if user_role table has a auto_increment or simple composite PK
        $db->table('user_role')->insert([
            'user_id' => 1,
            'role_id' => 1,
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s')
        ]);
        echo "Root role assigned to 'Dim' successfully.\n";
    } else {
        echo "Root role already assigned.\n";
    }
    
} catch (\Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n" . $e->getTraceAsString() . "\n";
}
