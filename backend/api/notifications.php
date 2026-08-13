<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/logger.php';

$data = json_decode(file_get_contents("php://input"));
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $user_id = isset($_GET['user_id']) ? $_GET['user_id'] : 0;
    
    if (!$user_id) {
        echo json_encode(["status" => "error", "message" => "User ID is required"]);
        exit;
    }
    
    // Fetch notifications ordered by most recent
    $query = "SELECT * FROM notifications WHERE user_id = :user_id ORDER BY created_at DESC LIMIT 50";
    $stmt = $conn->prepare($query);
    $stmt->execute([':user_id' => $user_id]);
    
    $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(["status" => "success", "data" => $notifications]);
} 
elseif ($method === 'POST') {
    // Admin creates a notification for a user (or system creates one)
    $user_id = $data->user_id ?? 0;
    $type = $data->type ?? 'info';
    $message = $data->message ?? '';
    
    if (!$user_id || !$message) {
        echo json_encode(["status" => "error", "message" => "Missing parameters"]);
        exit;
    }
    
    $query = "INSERT INTO notifications (user_id, type, message) VALUES (:user_id, :type, :message)";
    $stmt = $conn->prepare($query);
    
    try {
        $stmt->execute([
            ':user_id' => $user_id,
            ':type' => $type,
            ':message' => $message
        ]);
        echo json_encode(["status" => "success", "message" => "Notification created", "id" => $conn->lastInsertId()]);
    } catch(PDOException $e) {
        echo json_encode(["status" => "error", "message" => "Could not create notification: " . $e->getMessage()]);
    }
}
elseif ($method === 'PUT') {
    // Mark notifications as read for a user
    $user_id = $data->user_id ?? 0;
    $notification_id = $data->id ?? null; // Optional: specific ID
    
    if (!$user_id) {
        echo json_encode(["status" => "error", "message" => "User ID is required"]);
        exit;
    }
    
    if ($notification_id) {
        $query = "UPDATE notifications SET is_read = 1 WHERE id = :id AND user_id = :user_id";
        $stmt = $conn->prepare($query);
        $stmt->execute([':id' => $notification_id, ':user_id' => $user_id]);
    } else {
        $query = "UPDATE notifications SET is_read = 1 WHERE user_id = :user_id AND is_read = 0";
        $stmt = $conn->prepare($query);
        $stmt->execute([':user_id' => $user_id]);
    }
    
    echo json_encode(["status" => "success", "message" => "Notifications marked as read"]);
}
?>
