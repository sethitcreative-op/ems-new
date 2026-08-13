<?php
require_once '../config/cors.php';
require_once '../config/database.php';

$data = json_decode(file_get_contents("php://input"));
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'PUT') {
    if (!isset($data->id)) {
        echo json_encode(["status" => "error", "message" => "User ID is required."]);
        exit;
    }

    $id = $data->id;
    $username = $data->username;
    $full_name = $data->full_name;
    $profile_picture = isset($data->profile_picture) ? $data->profile_picture : null;

    // Check if username already exists for another user
    $check_query = "SELECT id FROM users WHERE username = :username AND id != :id";
    $check_stmt = $conn->prepare($check_query);
    $check_stmt->execute([':username' => $username, ':id' => $id]);
    
    if ($check_stmt->rowCount() > 0) {
        echo json_encode(["status" => "error", "message" => "Username already taken."]);
        exit;
    }

    $query = "UPDATE users SET username=:username, full_name=:name";
    $params = [':username'=>$username, ':name'=>$full_name, ':id'=>$id];

    if (!empty($data->password)) {
        $password_hash = password_hash($data->password, PASSWORD_BCRYPT);
        $query .= ", password_hash=:pass";
        $params[':pass'] = $password_hash;
    }
    
    if ($profile_picture !== null) {
        $query .= ", profile_picture=:pic";
        $params[':pic'] = $profile_picture;
    }

    $query .= " WHERE id=:id";

    $stmt = $conn->prepare($query);
    try {
        $stmt->execute($params);
        
        // Fetch updated user to send back
        $fetch_query = "SELECT id, username, role, full_name, hourly_rate, profile_picture, created_at FROM users WHERE id = :id";
        $fetch_stmt = $conn->prepare($fetch_query);
        $fetch_stmt->execute([':id' => $id]);
        $updated_user = $fetch_stmt->fetch(PDO::FETCH_ASSOC);

        echo json_encode(["status" => "success", "message" => "Profile updated successfully", "user" => $updated_user]);
    } catch(PDOException $e) {
        echo json_encode(["status" => "error", "message" => "Could not update profile", "error" => $e->getMessage()]);
    }
} else {
    echo json_encode(["status" => "error", "message" => "Invalid request method."]);
}
?>
