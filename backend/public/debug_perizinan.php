<?php
define('FCPATH', __DIR__ . DIRECTORY_SEPARATOR);
require __DIR__ . '/../app/Config/Paths.php';
$paths = new Config\Paths();
require __DIR__ . '/../system/bootstrap.php';

$db = \Config\Database::connect();
$fields = $db->getFieldNames('perizinan');
header('Content-Type: text/plain');
echo "Database: " . $db->getDatabase() . "\n";
echo "Fields:\n";
print_r($fields);
