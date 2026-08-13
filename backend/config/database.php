<?php
// backend/config/database.php
$host = "localhost";
$db_name = "u416162286_ems_db";
$username = "u416162286_ems_db";
$password = "iMPACTPROPH2026";

try {
    $conn = new PDO("mysql:host={$host};dbname={$db_name}", $username, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $exception) {
    echo "Connection error: " . $exception->getMessage();
}
?>
