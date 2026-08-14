<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/logger.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : '';

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

if ($method === 'GET' && $action === 'list') {
    $query = "SELECT id, username, role, full_name, hourly_rate, profile_picture, email, phone, address, id_number, created_at FROM users";
    $stmt = $conn->prepare($query);
    $stmt->execute();
    $employees = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(["status" => "success", "data" => $employees]);
} 
elseif ($method === 'POST') {
    // Determine if request is multipart/form-data or json
    $input = file_get_contents("php://input");
    $data = json_decode($input);
    
    $isUpdate = isset($_POST['_method']) && $_POST['_method'] === 'PUT';
    
    $username = $_POST['username'] ?? ($data->username ?? '');
    $password = $_POST['password'] ?? ($data->password ?? '');
    $role = $_POST['role'] ?? ($data->role ?? 'user');
    $full_name = $_POST['full_name'] ?? ($data->full_name ?? '');
    $hourly_rate = $_POST['hourly_rate'] ?? ($data->hourly_rate ?? 0);
    $id = $_POST['id'] ?? ($data->id ?? null);
    
    // New fields
    $email = $_POST['email'] ?? ($data->email ?? null);
    $phone = $_POST['phone'] ?? ($data->phone ?? null);
    $address = $_POST['address'] ?? ($data->address ?? null);
    $id_number = $_POST['id_number'] ?? ($data->id_number ?? null);
    
    $profile_picture = null;
    if (isset($_FILES['profile_picture']) && $_FILES['profile_picture']['error'] == 0) {
        $profile_picture = uploadProfilePicture($_FILES['profile_picture']);
    }

    if ($isUpdate) {
        // Update existing employee
        $query = "UPDATE users SET username=:username, role=:role, full_name=:name, hourly_rate=:rate, email=:email, phone=:phone, address=:address, id_number=:id_number";
        $params = [':username'=>$username, ':role'=>$role, ':name'=>$full_name, ':rate'=>$hourly_rate, ':email'=>$email, ':phone'=>$phone, ':address'=>$address, ':id_number'=>$id_number, ':id'=>$id];
        
        if (!empty($password)) {
            $password_hash = password_hash($password, PASSWORD_BCRYPT);
            $query .= ", password_hash=:pass";
            $params[':pass'] = $password_hash;
        }
        if ($profile_picture) {
            $query .= ", profile_picture=:pic";
            $params[':pic'] = $profile_picture;
        }
        $query .= " WHERE id=:id";

        $stmt = $conn->prepare($query);
        try {
            $stmt->execute($params);
            logAction($conn, $id, 'UPDATE_EMPLOYEE', "Employee {$username} updated.");
            echo json_encode(["status" => "success", "message" => "Employee updated successfully", "profile_picture" => $profile_picture]);
        } catch(PDOException $e) {
            echo json_encode(["status" => "error", "message" => "Could not update employee", "error" => $e->getMessage()]);
        }
    } else {
        // Create new employee
        $password_hash = password_hash($password, PASSWORD_BCRYPT);
        
        $query = "INSERT INTO users (username, password_hash, role, full_name, hourly_rate, profile_picture, email, phone, address, id_number) VALUES (:username, :pass, :role, :name, :rate, :pic, :email, :phone, :address, :id_number)";
        $stmt = $conn->prepare($query);
        try {
            $stmt->execute([':username'=>$username, ':pass'=>$password_hash, ':role'=>$role, ':name'=>$full_name, ':rate'=>$hourly_rate, ':pic'=>$profile_picture, ':email'=>$email, ':phone'=>$phone, ':address'=>$address, ':id_number'=>$id_number]);
            $new_id = $conn->lastInsertId();
            logAction($conn, $new_id, 'CREATE_EMPLOYEE', "Employee {$username} created.");
            echo json_encode(["status" => "success", "message" => "Employee created successfully", "profile_picture" => $profile_picture]);
        } catch(PDOException $e) {
            echo json_encode(["status" => "error", "message" => "Could not create employee", "error" => $e->getMessage()]);
        }
    }
}
elseif ($method === 'DELETE') {
    $id = isset($_GET['id']) ? $_GET['id'] : null;
    if($id) {
        $query = "DELETE FROM users WHERE id = :id";
        $stmt = $conn->prepare($query);
        $stmt->execute([':id' => $id]);
        logAction($conn, $id, 'DELETE_EMPLOYEE', "Employee ID {$id} deleted.");
        echo json_encode(["status" => "success", "message" => "Employee deleted"]);
    }
}
// Keep old PUT for backward compatibility if any other frontend parts use it for JSON updates
elseif ($method === 'PUT') {
    $input = file_get_contents("php://input");
    $data = json_decode($input);
    if($data && isset($data->id)) {
        $id = $data->id;
        $username = $data->username;
        $role = $data->role ?? 'user';
        $full_name = $data->full_name;
        $hourly_rate = $data->hourly_rate;

        if (!empty($data->password)) {
            $password_hash = password_hash($data->password, PASSWORD_BCRYPT);
            $query = "UPDATE users SET username=:username, password_hash=:pass, role=:role, full_name=:name, hourly_rate=:rate WHERE id=:id";
            $params = [':username'=>$username, ':pass'=>$password_hash, ':role'=>$role, ':name'=>$full_name, ':rate'=>$hourly_rate, ':id'=>$id];
        } else {
            $query = "UPDATE users SET username=:username, role=:role, full_name=:name, hourly_rate=:rate WHERE id=:id";
            $params = [':username'=>$username, ':role'=>$role, ':name'=>$full_name, ':rate'=>$hourly_rate, ':id'=>$id];
        }

        $stmt = $conn->prepare($query);
        try {
            $stmt->execute($params);
            logAction($conn, $id, 'UPDATE_EMPLOYEE', "Employee {$username} updated.");
            echo json_encode(["status" => "success", "message" => "Employee updated successfully"]);
        } catch(PDOException $e) {
            echo json_encode(["status" => "error", "message" => "Could not update employee", "error" => $e->getMessage()]);
        }
    }
}
?>
