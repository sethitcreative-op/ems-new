<?php
// backend/config/database.php

// -------------------------------------------------------------------------
// 1. LOCAL XAMPP CONFIGURATION (USE THIS FOR DEVELOPMENT)
// -------------------------------------------------------------------------
$host = "localhost"; 
$db_name = "ems_db"; // You must create this database in http://localhost/phpmyadmin
$username = "root";  // Default XAMPP username
$password = "";      // Default XAMPP password is empty
$port = 3306; 

// -------------------------------------------------------------------------
// 2. HOSTINGER CONFIGURATION (UNCOMMENT THIS RIGHT BEFORE UPLOADING)
// -------------------------------------------------------------------------
//$host = "localhost"; // Keep as localhost when hosted ON Hostinger
//$db_name = "u416162286_ems_db";
//$username = "u416162286_ems_db";
//$password = "iMPACTPROPH2026";
//$port = 3306;

// Set global PHP timezone
date_default_timezone_set('America/New_York');

try {
    $conn = new PDO("mysql:host={$host};port={$port};dbname={$db_name}", $username, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Set MySQL timezone to match PHP timezone
    $offset = (new DateTime())->format('P');
    $conn->exec("SET time_zone = '{$offset}';");
   

    // Ensure uploads directory exists
    $uploadDir = __DIR__ . '/../uploads/gov_ids';
    if (!file_exists($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }
} catch(PDOException $exception) {
    echo "Connection error: " . $exception->getMessage();
}
?>
