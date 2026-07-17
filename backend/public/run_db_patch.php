<?php
try {
    $pdo = new PDO("mysql:host=localhost;dbname=bkw;charset=utf8mb4", "root", "");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    header('Content-Type: text/plain');

    echo "1. Checking if column usaha_id exists...\n";
    $stmt = $pdo->query("SHOW COLUMNS FROM perizinan LIKE 'usaha_id'");
    $exists = $stmt->fetch();
    
    if ($exists) {
        echo "Column 'usaha_id' exists. Dropping it first for a clean migration...\n";
        try {
            $pdo->exec("ALTER TABLE perizinan DROP FOREIGN KEY fk_perizinan_usaha");
            echo "Dropped foreign key fk_perizinan_usaha.\n";
        } catch (Exception $e) {
            echo "No foreign key to drop or failed: " . $e->getMessage() . "\n";
        }
        $pdo->exec("ALTER TABLE perizinan DROP COLUMN usaha_id");
        echo "Dropped column 'usaha_id'.\n";
    } else {
        echo "Column 'usaha_id' does not exist.\n";
    }

    echo "2. Adding column 'usaha_id'...\n";
    $pdo->exec("ALTER TABLE perizinan ADD COLUMN usaha_id INT(11) UNSIGNED NULL AFTER status");
    echo "Column 'usaha_id' added successfully.\n";

    echo "3. Adding foreign key constraint...\n";
    $pdo->exec("ALTER TABLE perizinan ADD CONSTRAINT fk_perizinan_usaha FOREIGN KEY (usaha_id) REFERENCES usaha(id) ON DELETE CASCADE ON UPDATE CASCADE");
    echo "Foreign key constraint added successfully.\n";

    echo "4. Backfilling data...\n";
    $pdo->exec("UPDATE perizinan p JOIN user_role ur ON ur.user_id = p.karyawan_id SET p.usaha_id = ur.usaha_id WHERE p.usaha_id IS NULL");
    echo "Data backfilled successfully.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
