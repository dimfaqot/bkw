<?php
$db = new mysqli('localhost', 'root', '', 'bkw');
$res = $db->query("SELECT nama_role FROM roles");
while ($row = $res->fetch_assoc()) {
    echo $row['nama_role'] . "\n";
}
