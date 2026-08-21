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

try {
    $conn = new PDO("mysql:host={$host};port={$port};dbname={$db_name}", $username, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Auto-create government_ids table
    $query = "CREATE TABLE IF NOT EXISTS government_ids (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        id_type VARCHAR(100) NOT NULL,
        id_number VARCHAR(100) NOT NULL,
        file_path VARCHAR(255) NOT NULL,
        status ENUM('verified', 'pending') DEFAULT 'pending',
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )";
    $conn->exec($query);

    // Ensure uploads directory exists
    $uploadDir = __DIR__ . '/../uploads/gov_ids';
    if (!file_exists($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }
} catch(PDOException $exception) {
    echo "Connection error: " . $exception->getMessage();
}
?>
