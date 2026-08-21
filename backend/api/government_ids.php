<?php
require_once '../config/cors.php';
require_once '../config/database.php';

$method = $_SERVER['REQUEST_METHOD'];

// Helper to return JSON and exit
function respond($status, $message, $data = null) {
    $response = ['status' => $status, 'message' => $message];
    if ($data !== null) {
        $response['data'] = $data;
    }
    echo json_encode($response);
    exit;
}

if ($method === 'GET') {
    $user_id = isset($_GET['user_id']) ? $_GET['user_id'] : 0;
    
    if (!$user_id) {
        respond('error', 'User ID is required');
    }
    
    $query = "SELECT * FROM government_ids WHERE user_id = :user_id ORDER BY uploaded_at DESC";
    $stmt = $conn->prepare($query);
    $stmt->execute([':user_id' => $user_id]);
    
    $ids = $stmt->fetchAll(PDO::FETCH_ASSOC);
    respond('success', 'IDs retrieved successfully', $ids);
} 
elseif ($method === 'POST') {
    $user_id = $_POST['user_id'] ?? 0;
    $id_type = $_POST['id_type'] ?? '';
    $id_number = $_POST['id_number'] ?? '';
    
    if (!$user_id || !$id_type || !$id_number) {
        respond('error', 'Missing required fields (user_id, id_type, id_number)');
    }
    
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        respond('error', 'No file uploaded or upload error');
    }
    
    $file = $_FILES['file'];
    
    // Validate file type
    $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (!in_array($file['type'], $allowedTypes)) {
        respond('error', 'Invalid file type. Only JPG, PNG, GIF, and PDF are allowed.');
    }
    
    // Create unique filename
    $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
    $filename = uniqid('govid_') . '_' . time() . '.' . $extension;
    $uploadDir = __DIR__ . '/../uploads/gov_ids/';
    
    // Ensure directory exists (database.php already does this, but good practice)
    if (!file_exists($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }
    
    $destination = $uploadDir . $filename;
    
    if (move_uploaded_file($file['tmp_name'], $destination)) {
        $file_path = 'uploads/gov_ids/' . $filename;
        
        $query = "INSERT INTO government_ids (user_id, id_type, id_number, file_path) VALUES (:user_id, :id_type, :id_number, :file_path)";
        $stmt = $conn->prepare($query);
        
        try {
            $stmt->execute([
                ':user_id' => $user_id,
                ':id_type' => $id_type,
                ':id_number' => $id_number,
                ':file_path' => $file_path
            ]);
            
            $insertedId = $conn->lastInsertId();
            
            // Log action
            $logQuery = "INSERT INTO system_logs (user_id, action, description) VALUES (:uid, 'UPLOAD_GOV_ID', :desc)";
            $logStmt = $conn->prepare($logQuery);
            $logStmt->execute([
                ':uid' => $user_id,
                ':desc' => "Uploaded a new $id_type"
            ]);
            
            respond('success', 'Government ID uploaded successfully', ['id' => $insertedId, 'file_path' => $file_path]);
        } catch(PDOException $e) {
            // Delete uploaded file if DB insert fails
            if (file_exists($destination)) {
                unlink($destination);
            }
            respond('error', 'Database error: ' . $e->getMessage());
        }
    } else {
        respond('error', 'Failed to move uploaded file');
    }
}
elseif ($method === 'DELETE') {
    $id = isset($_GET['id']) ? $_GET['id'] : 0;
    
    if (!$id) {
        respond('error', 'ID is required');
    }
    
    // Get file path first
    $query = "SELECT file_path FROM government_ids WHERE id = :id";
    $stmt = $conn->prepare($query);
    $stmt->execute([':id' => $id]);
    $record = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($record) {
        $fullPath = __DIR__ . '/../' . $record['file_path'];
        
        $delQuery = "DELETE FROM government_ids WHERE id = :id";
        $delStmt = $conn->prepare($delQuery);
        
        try {
            $delStmt->execute([':id' => $id]);
            
            // Delete file
            if (file_exists($fullPath)) {
                unlink($fullPath);
            }
            
            respond('success', 'Government ID deleted successfully');
        } catch(PDOException $e) {
            respond('error', 'Database error: ' . $e->getMessage());
        }
    } else {
        respond('error', 'Record not found');
    }
}
?>
