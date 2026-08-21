<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/logger.php';

$data = json_decode(file_get_contents("php://input"));
$method = $_SERVER['REQUEST_METHOD'];
$currentYear = date('Y');

if ($method === 'GET') {
    $action = isset($_GET['action']) ? $_GET['action'] : '';
    
    if ($action === 'balances') {
        $user_id = isset($_GET['user_id']) ? $_GET['user_id'] : 0;
        
        // Ensure balance exists for current year
        $checkStmt = $conn->prepare("SELECT * FROM leave_balances WHERE user_id = :user_id AND year = :year");
        $checkStmt->execute([':user_id' => $user_id, ':year' => $currentYear]);
        $balances = $checkStmt->fetchAll(PDO::FETCH_ASSOC);
        
        if (count($balances) === 0 && $user_id != 0) {
            // Initialize default balances (e.g., 0 for now)
            $initStmt = $conn->prepare("INSERT INTO leave_balances (user_id, leave_type, total_days, used_days, year) VALUES (:user_id, 'Vacation Leave', 0, 0, :year)");
            $initStmt->execute([':user_id' => $user_id, ':year' => $currentYear]);
            
            $checkStmt->execute([':user_id' => $user_id, ':year' => $currentYear]);
            $balances = $checkStmt->fetchAll(PDO::FETCH_ASSOC);
        }
        echo json_encode(["status" => "success", "data" => $balances]);
    } 
    elseif ($action === 'requests') {
        $role = isset($_GET['role']) ? $_GET['role'] : 'user';
        $user_id = isset($_GET['user_id']) ? $_GET['user_id'] : 0;
        
        if ($role === 'admin') {
            $query = "SELECT lr.*, u.full_name as user_name FROM leave_requests lr JOIN users u ON lr.user_id = u.id ORDER BY created_at DESC";
            $stmt = $conn->prepare($query);
            $stmt->execute();
        } else {
            $query = "SELECT lr.*, u.full_name as user_name FROM leave_requests lr JOIN users u ON lr.user_id = u.id WHERE lr.user_id = :user_id ORDER BY created_at DESC";
            $stmt = $conn->prepare($query);
            $stmt->execute([':user_id' => $user_id]);
        }
        
        $requests = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(["status" => "success", "data" => $requests]);
    }
} 
elseif ($method === 'POST') {
    $user_id = $data->user_id;
    $leave_type = $data->leave_type;
    $start_date = $data->start_date;
    $end_date = $data->end_date;
    $total_days = $data->total_days;
    $reason = $data->reason;
    
    $query = "INSERT INTO leave_requests (user_id, leave_type, start_date, end_date, total_days, reason, status) VALUES (:user_id, :leave_type, :start_date, :end_date, :total_days, :reason, 'pending')";
    $stmt = $conn->prepare($query);
    try {
        $stmt->execute([
            ':user_id' => $user_id,
            ':leave_type' => $leave_type,
            ':start_date' => $start_date,
            ':end_date' => $end_date,
            ':total_days' => $total_days,
            ':reason' => $reason
        ]);
        
        logAction($conn, $user_id, 'SUBMIT_LEAVE', "Employee successfully submitted a {$leave_type} request for {$total_days} days (From {$start_date} to {$end_date}).");
        
        echo json_encode(["status" => "success", "message" => "Leave request submitted successfully"]);
    } catch (PDOException $e) {
        echo json_encode(["status" => "error", "message" => $e->getMessage()]);
    }
}
elseif ($method === 'PUT') {
    $action = $data->action ?? '';
    
    if ($action === 'update_status') {
        $id = $data->id;
        $status = $data->status;
        $admin_remarks = $data->admin_remarks ?? '';
        $user_id = $data->user_id;
        $leave_type = $data->leave_type;
        $total_days = $data->total_days;
        
        try {
            $conn->beginTransaction();
            
            $query = "UPDATE leave_requests SET status = :status, admin_remarks = :admin_remarks WHERE id = :id";
            $stmt = $conn->prepare($query);
            $stmt->execute([
                ':status' => $status,
                ':admin_remarks' => $admin_remarks,
                ':id' => $id
            ]);
            
            if ($status === 'approved') {
                $updBalance = "UPDATE leave_balances SET used_days = used_days + :days WHERE user_id = :user_id AND leave_type = :leave_type AND year = :year";
                $bStmt = $conn->prepare($updBalance);
                $bStmt->execute([
                    ':days' => $total_days,
                    ':user_id' => $user_id,
                    ':leave_type' => $leave_type,
                    ':year' => date('Y', strtotime($data->start_date))
                ]);
            }
            
            $conn->commit();
            
            // Log Action for the admin who updated it.
            // Ideally we'd get admin_id from the request, but if not we can use user_id or a general log.
            $admin_id = $data->admin_id ?? 0;
            logAction($conn, $admin_id, 'UPDATE_LEAVE', "Administrator updated leave request ID {$id} to status '{$status}'.");

            echo json_encode(["status" => "success", "message" => "Leave request updated"]);
        } catch (PDOException $e) {
            $conn->rollBack();
            echo json_encode(["status" => "error", "message" => $e->getMessage()]);
        }
    }
    elseif ($action === 'update_balance') {
        $user_id = $data->user_id;
        $leave_type = $data->leave_type;
        $total_days = $data->total_days;
        $year = $data->year ?? $currentYear;
        
        $query = "INSERT INTO leave_balances (user_id, leave_type, total_days, used_days, year) 
                  VALUES (:user_id, :leave_type, :total_days, 0, :year) 
                  ON DUPLICATE KEY UPDATE total_days = :total_days";
        $stmt = $conn->prepare($query);
        try {
            $stmt->execute([
                ':user_id' => $user_id,
                ':leave_type' => $leave_type,
                ':total_days' => $total_days,
                ':year' => $year
            ]);
            
            $admin_id = $data->admin_id ?? 0;
            logAction($conn, $admin_id, 'UPDATE_BALANCE', "Administrator updated the {$leave_type} balance for year {$year} to {$total_days} days.");

            echo json_encode(["status" => "success", "message" => "Leave balance updated"]);
        } catch (PDOException $e) {
            echo json_encode(["status" => "error", "message" => $e->getMessage()]);
        }
    }
}
?>
