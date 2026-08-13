<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/logger.php';

$data = json_decode(file_get_contents("php://input"));
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $role = isset($_GET['role']) ? $_GET['role'] : 'user';
    $user_id = isset($_GET['user_id']) ? $_GET['user_id'] : 0;
    
    if ($role === 'admin') {
        $query = "SELECT e.*, u.full_name as user_name FROM events e JOIN users u ON e.user_id = u.id ORDER BY event_date ASC";
        $stmt = $conn->prepare($query);
        $stmt->execute();
    } else {
        $query = "SELECT e.*, u.full_name as user_name FROM events e JOIN users u ON e.user_id = u.id WHERE e.status = 'approved' OR e.user_id = :user_id ORDER BY event_date ASC";
        $stmt = $conn->prepare($query);
        $stmt->execute([':user_id' => $user_id]);
    }
    
    $events = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(["status" => "success", "data" => $events]);
} 
elseif ($method === 'POST') {
    $user_id = $data->user_id;
    $title = $data->title;
    $description = $data->description ?? '';
    $event_date = $data->event_date;
    $event_type = $data->event_type ?? 'Other';
    
    $is_admin_assigning = isset($data->is_admin_assigning) ? $data->is_admin_assigning : false;
    $status = $data->status ?? 'pending';
    if ($is_admin_assigning) {
        $status = 'approved';
    }

    $query = "INSERT INTO events (user_id, title, description, event_date, event_type, status) VALUES (:user_id, :title, :description, :event_date, :event_type, :status)";
    $stmt = $conn->prepare($query);
    try {
        $stmt->execute([
            ':user_id' => $user_id,
            ':title' => $title, 
            ':description' => $description, 
            ':event_date' => $event_date,
            ':event_type' => $event_type,
            ':status' => $status
        ]);
        
        if ($is_admin_assigning) {
            logAction($conn, $user_id, 'ASSIGN_SCHEDULE', "Admin assigned {$event_type} for {$event_date}.");
            $notif_message = "Admin has assigned a new {$event_type} for " . date('M d, Y', strtotime($event_date)) . ".";
            $notif_stmt = $conn->prepare("INSERT INTO notifications (user_id, type, message) VALUES (:user_id, 'info', :message)");
            $notif_stmt->execute([
                ':user_id' => $user_id,
                ':message' => $notif_message
            ]);
        } else {
            logAction($conn, $user_id, 'SUBMIT_REQUEST', "Submitted {$event_type} request for {$event_date}.");
        }
        
        echo json_encode(["status" => "success", "message" => "Event created successfully"]);
    } catch(PDOException $e) {
        echo json_encode(["status" => "error", "message" => "Could not create event: " . $e->getMessage()]);
    }
}
elseif ($method === 'PUT') {
    $event_id = $data->id;
    if (isset($data->action) && $data->action === 'edit') {
        $title = $data->title ?? '';
        $description = $data->description ?? '';
        $event_date = $data->event_date ?? '';
        $event_type = $data->event_type ?? 'Other';
        $user_id = $data->user_id ?? 0;
        
        $query = "UPDATE events SET title = :title, description = :description, event_date = :event_date, event_type = :event_type, user_id = :user_id WHERE id = :id";
        $stmt = $conn->prepare($query);
        try {
            $stmt->execute([
                ':title' => $title,
                ':description' => $description,
                ':event_date' => $event_date,
                ':event_type' => $event_type,
                ':user_id' => $user_id,
                ':id' => $event_id
            ]);
            echo json_encode(["status" => "success", "message" => "Event updated successfully"]);
        } catch(PDOException $e) {
            echo json_encode(["status" => "error", "message" => "Could not update event details: " . $e->getMessage()]);
        }
    } else {
        $status = $data->status;
        
        // Fetch event info to know who to notify
        $stmt = $conn->prepare("SELECT user_id, title FROM events WHERE id = :id");
        $stmt->execute([':id' => $event_id]);
        $event = $stmt->fetch(PDO::FETCH_ASSOC);

        $query = "UPDATE events SET status = :status WHERE id = :id";
        $stmt = $conn->prepare($query);
        try {
            $stmt->execute([':status' => $status, ':id' => $event_id]);
            
            $admin_id = isset($data->admin_id) ? $data->admin_id : 0; 
            logAction($conn, $admin_id, 'UPDATE_REQUEST', "Updated request ID {$event_id} status to {$status}.");
            
            if ($event) {
                $notif_type = $status === 'approved' ? 'success' : 'error';
                $notif_message = "Your request \"{$event['title']}\" was {$status}.";
                $notif_stmt = $conn->prepare("INSERT INTO notifications (user_id, type, message) VALUES (:user_id, :type, :message)");
                $notif_stmt->execute([
                    ':user_id' => $event['user_id'],
                    ':type' => $notif_type,
                    ':message' => $notif_message
                ]);
            }
            
            echo json_encode(["status" => "success", "message" => "Event status updated"]);
        } catch(PDOException $e) {
            echo json_encode(["status" => "error", "message" => "Could not update event status"]);
        }
    }
}
elseif ($method === 'DELETE') {
    // Determine event ID and user ID from the request
    // It can come from URL parameters (e.g. ?id=1&user_id=1) since DELETE often uses query string,
    // or from body if sent as JSON. Let's support both.
    $event_id = isset($_GET['id']) ? $_GET['id'] : (is_object($data) && isset($data->id) ? $data->id : null);
    $user_id = isset($_GET['user_id']) ? $_GET['user_id'] : (is_object($data) && isset($data->user_id) ? $data->user_id : null);
    
    if (!$event_id || !$user_id) {
        echo json_encode(["status" => "error", "message" => "Missing parameters"]);
        exit;
    }
    
    $is_admin = isset($_GET['is_admin']) && $_GET['is_admin'] === 'true' || (is_object($data) && isset($data->is_admin) && $data->is_admin);
    
    if (!$is_admin) {
        if (!$user_id) {
            echo json_encode(["status" => "error", "message" => "Missing user parameter for non-admin"]);
            exit;
        }
        $stmt = $conn->prepare("SELECT status FROM events WHERE id = :id AND user_id = :user_id");
        $stmt->execute([':id' => $event_id, ':user_id' => $user_id]);
        $event = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$event) {
            echo json_encode(["status" => "error", "message" => "Event not found or unauthorized"]);
            exit;
        }
        
        if ($event['status'] !== 'pending') {
            echo json_encode(["status" => "error", "message" => "Only pending requests can be cancelled"]);
            exit;
        }
    }
    
    $query = "DELETE FROM events WHERE id = :id";
    $stmt = $conn->prepare($query);
    try {
        $stmt->execute([':id' => $event_id]);
        logAction($conn, $user_id, 'CANCEL_REQUEST', "Cancelled pending request ID {$event_id}.");
        echo json_encode(["status" => "success", "message" => "Request cancelled successfully"]);
    } catch(PDOException $e) {
        echo json_encode(["status" => "error", "message" => "Could not cancel request"]);
    }
}
?>
