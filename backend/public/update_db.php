<?php
$db = new mysqli('localhost', 'root', '', 'bkw');
if ($db->connect_error) die('Connection failed: ' . $db->connect_error);

$result = $db->query('ALTER TABLE role_permissions ADD COLUMN is_aktif TINYINT(1) NOT NULL DEFAULT 1;');
if ($result) {
    echo "Column added successfully to bkw!";
} else {
    echo "Error or already exists in bkw: " . $db->error;
}
