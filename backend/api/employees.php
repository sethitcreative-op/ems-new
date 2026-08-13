<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/logger.php';

$data = json_decode(file_get_contents("php://input"));
$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : '';

if ($method === 'GET' && $action === 'list') {
    $query = "SELECT id, username, role, full_name, hourly_rate, profile_picture, created_at FROM users";
    $stmt = $conn->prepare($query);
    $stmt->execute();
    $employees = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(["status" => "success", "data" => $employees]);
} 
elseif ($method === 'POST') {
    // Create new employee
    $username = $data->username;
    $password_hash = password_hash($data->password, PASSWORD_BCRYPT);
    $role = $data->role ?? 'user';
    $full_name = $data->full_name;
    $hourly_rate = $data->hourly_rate;
    $profile_picture = $data->profile_picture ?? null;

    $query = "INSERT INTO users (username, password_hash, role, full_name, hourly_rate, profile_picture) VALUES (:username, :pass, :role, :name, :rate, :pic)";
    $stmt = $conn->prepare($query);
    try {
        $stmt->execute([':username'=>$username, ':pass'=>$password_hash, ':role'=>$role, ':name'=>$full_name, ':rate'=>$hourly_rate, ':pic'=>$profile_picture]);
        $new_id = $conn->lastInsertId();
        logAction($conn, $new_id, 'CREATE_EMPLOYEE', "Employee {$username} created.");
        echo json_encode(["status" => "success", "message" => "Employee created successfully"]);
    } catch(PDOException $e) {
        echo json_encode(["status" => "error", "message" => "Could not create employee"]);
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
elseif ($method === 'PUT') {
    // Update existing employee
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
?>
