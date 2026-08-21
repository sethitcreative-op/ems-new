<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/logger.php';

$method = $_SERVER['REQUEST_METHOD'];

// Function to handle image upload
function uploadProfilePicture($file) {
    $target_dir = "../../frontend/public/img/profiles/";
    if (!file_exists($target_dir)) {
        mkdir($target_dir, 0777, true);
    }
    $file_extension = strtolower(pathinfo($file["name"], PATHINFO_EXTENSION));
    // Check if it's an image
    $check = getimagesize($file["tmp_name"]);
    if($check !== false) {
        $new_filename = uniqid() . '.' . $file_extension;
        $target_file = $target_dir . $new_filename;
        if (move_uploaded_file($file["tmp_name"], $target_file)) {
            return "img/profiles/" . $new_filename;
        }
    }
    return null;
}

if ($method === 'POST') {
    $id = $_POST['id'] ?? null;
    if (!$id) {
        echo json_encode(["status" => "error", "message" => "User ID is required."]);
        exit;
    }

    $username = $_POST['username'] ?? '';
    $full_name = $_POST['full_name'] ?? '';
    $password = $_POST['password'] ?? '';
    $sex = $_POST['sex'] ?? null;
    
    $profile_picture = null;
    if (isset($_FILES['profile_picture']) && $_FILES['profile_picture']['error'] == 0) {
        $profile_picture = uploadProfilePicture($_FILES['profile_picture']);
    }

    // Check if username already exists for another user
    $check_query = "SELECT id FROM users WHERE username = :username AND id != :id";
    $check_stmt = $conn->prepare($check_query);
    $check_stmt->execute([':username' => $username, ':id' => $id]);
    
    if ($check_stmt->rowCount() > 0) {
        echo json_encode(["status" => "error", "message" => "Username already taken."]);
        exit;
    }

    $query = "UPDATE users SET username=:username, full_name=:name, sex=:sex";
    $params = [':username'=>$username, ':name'=>$full_name, ':sex'=>$sex, ':id'=>$id];

    if (!empty($password)) {
        $password_hash = password_hash($password, PASSWORD_BCRYPT);
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
        $fetch_query = "SELECT id, username, role, full_name, hourly_rate, profile_picture, sex, created_at FROM users WHERE id = :id";
        $fetch_stmt = $conn->prepare($fetch_query);
        $fetch_stmt->execute([':id' => $id]);
        $updated_user = $fetch_stmt->fetch(PDO::FETCH_ASSOC);

        logAction($conn, $id, 'UPDATE_PROFILE', "User {$username} updated their profile.");

        echo json_encode(["status" => "success", "message" => "Profile updated successfully", "user" => $updated_user]);
    } catch(PDOException $e) {
        echo json_encode(["status" => "error", "message" => "Could not update profile", "error" => $e->getMessage()]);
    }
} 
// Keep old PUT for backward compatibility if needed by other components
elseif ($method === 'PUT') {
    $data = json_decode(file_get_contents("php://input"));
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
        
        $fetch_query = "SELECT id, username, role, full_name, hourly_rate, profile_picture, created_at FROM users WHERE id = :id";
        $fetch_stmt = $conn->prepare($fetch_query);
        $fetch_stmt->execute([':id' => $id]);
        $updated_user = $fetch_stmt->fetch(PDO::FETCH_ASSOC);

        logAction($conn, $id, 'UPDATE_PROFILE', "User {$username} updated their profile.");

        echo json_encode(["status" => "success", "message" => "Profile updated successfully", "user" => $updated_user]);
    } catch(PDOException $e) {
        echo json_encode(["status" => "error", "message" => "Could not update profile", "error" => $e->getMessage()]);
    }
} else {
    echo json_encode(["status" => "error", "message" => "Invalid request method."]);
}
?>
