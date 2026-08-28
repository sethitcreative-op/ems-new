<?php
require_once '../config/cors.php';
require_once '../config/database.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Only admins should ideally fetch logs, maybe add token validation if token logic exists
    // For now, this just fetches the logs
    
    // Ensure table exists for safety
    $createTableQuery = "CREATE TABLE IF NOT EXISTS system_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        action VARCHAR(50) NOT NULL,
        description TEXT,
        ip_address VARCHAR(45) NULL,
        user_agent TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )";
    $conn->exec($createTableQuery);

    // Check if an action filter is provided
    $action_filter = isset($_GET['action']) ? $_GET['action'] : '';
    $user_filter = isset($_GET['user_id']) ? $_GET['user_id'] : '';
    
    $query = "SELECT l.*, u.full_name as user_name FROM system_logs l LEFT JOIN users u ON l.user_id = u.id";
    $conditions = [];
    $params = [];
    
    if ($action_filter) {
        $conditions[] = "l.action = :action";
        $params[':action'] = $action_filter;
    }
    
    if ($user_filter) {
        $conditions[] = "l.user_id = :user_id";
        $params[':user_id'] = $user_filter;
    }
    
    if (count($conditions) > 0) {
        $query .= " WHERE " . implode(" AND ", $conditions);
    }
    
    $query .= " ORDER BY l.created_at DESC LIMIT 500";
    
    $stmt = $conn->prepare($query);
    foreach($params as $key => &$val) {
        $stmt->bindParam($key, $val);
    }
    
    $stmt->execute();
    $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode(["status" => "success", "data" => $logs]);
} elseif ($method === 'POST') {
    require_once '../config/logger.php';
    $data = json_decode(file_get_contents("php://input"));
    $user_id = $data->user_id ?? 0;
    $action = $data->action ?? '';
    $description = $data->description ?? '';

    if (!$user_id || !$action || !$description) {
        echo json_encode(["status" => "error", "message" => "Missing parameters for logging"]);
        exit;
    }

    $success = logAction($conn, $user_id, $action, $description);
    if ($success) {
        echo json_encode(["status" => "success", "message" => "Log saved"]);
    } else {
        echo json_encode(["status" => "error", "message" => "Failed to save log"]);
    }
} else {
    echo json_encode(["status" => "error", "message" => "Method not allowed"]);
}
?>
