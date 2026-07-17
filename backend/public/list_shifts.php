<?php
$pdo = new PDO("mysql:host=localhost;dbname=bkw;charset=utf8mb4", "root", "");
$stmt = $pdo->query("SELECT * FROM shift");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
