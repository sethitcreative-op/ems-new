<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/logger.php';

$data = json_decode(file_get_contents("php://input"));

if(isset($data->action) && $data->action === 'login') {
    $username = $data->username;
    $password = $data->password;

    $query = "SELECT * FROM users WHERE username = :username LIMIT 0,1";
    $stmt = $conn->prepare($query);
    $stmt->bindParam(':username', $username);
    $stmt->execute();
    
    if($stmt->rowCount() > 0) {
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if(password_verify($password, $row['password_hash'])) {
            // Simple token simulation for demo purposes
            $token = base64_encode(json_encode([
                "id" => $row['id'], 
                "role" => $row['role'],
                "full_name" => $row['full_name'],
                "hourly_rate" => $row['hourly_rate']
            ]));
            
            // Log the login action
            logAction($conn, $row['id'], 'LOGIN', "User logged in successfully.");
            
            echo json_encode(["status" => "success", "token" => $token, "user" => $row]);
        } else {
            echo json_encode(["status" => "error", "message" => "Invalid password."]);
        }
    } else {
        echo json_encode(["status" => "error", "message" => "User not found."]);
    }
}
?>
