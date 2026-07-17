<?php
$db = new mysqli('localhost', 'root', '', 'bkw');
if ($db->connect_error) die('Connection failed: ' . $db->connect_error);

// Try to add the column
$result = $db->query('ALTER TABLE role_permissions ADD COLUMN is_aktif TINYINT(1) NOT NULL DEFAULT 1;');
if ($result) {
    echo "Column added successfully!";
} else {
    // If it fails, maybe it already exists
    echo "Error or already exists: " . $db->error;
}
