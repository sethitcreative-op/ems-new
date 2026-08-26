<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/logger.php';

$data = json_decode(file_get_contents("php://input"));
$method = $_SERVER['REQUEST_METHOD'];
$currentYear = date('Y');

/**
 * Sync the attendance table with an approved leave.
 *
 * @param PDO    $conn
 * @param int    $user_id
 * @param string $start_date  YYYY-MM-DD
 * @param string $end_date    YYYY-MM-DD
 * @param bool   $approve     true = insert Leave rows, false = remove them
 */
function syncAttendanceForLeave($conn, $user_id, $start_date, $end_date, $approve) {
    $current = new DateTime($start_date);
    $last    = new DateTime($end_date);

    while ($current <= $last) {
        $dateStr = $current->format('Y-m-d');

        if ($approve) {
            // Upsert a Leave row (only if there is no real clock-in for that day)
            $conn->prepare("
                INSERT INTO attendance (user_id, date, status, total_hours, earnings)
                VALUES (:uid, :dt, 'Leave', 0, 0)
                ON DUPLICATE KEY UPDATE
                    status = IF(am_in IS NULL, 'Leave', status)
            ")->execute([':uid' => $user_id, ':dt' => $dateStr]);
        } else {
            // Revert Leave rows back to Absent (only if they have no real clock-in)
            $conn->prepare("
                UPDATE attendance
                SET status = 'Absent'
                WHERE user_id = :uid
                  AND date    = :dt
                  AND status  = 'Leave'
                  AND am_in IS NULL
            ")->execute([':uid' => $user_id, ':dt' => $dateStr]);
        }

        $current->modify('+1 day');
    }
}


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
    $year = date('Y', strtotime($start_date));

    // Check limit of 3 leave requests per year
    $checkLimitStmt = $conn->prepare("SELECT COUNT(*) as request_count FROM leave_requests WHERE user_id = :user_id AND YEAR(start_date) = :year");
    $checkLimitStmt->execute([':user_id' => $user_id, ':year' => $year]);
    $requestCount = $checkLimitStmt->fetch(PDO::FETCH_ASSOC)['request_count'];

    if ($requestCount >= 3) {
        echo json_encode(["status" => "error", "message" => "You have reached the maximum limit of 3 leave requests for this year."]);
        exit;
    }
    
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

            // --- Sync DTR attendance table ---
            // Fetch the full start/end dates from the just-updated record
            $syncStmt = $conn->prepare("SELECT start_date, end_date FROM leave_requests WHERE id = :id");
            $syncStmt->execute([':id' => $id]);
            $syncRow = $syncStmt->fetch(PDO::FETCH_ASSOC);
            if ($syncRow) {
                syncAttendanceForLeave(
                    $conn, $user_id,
                    $syncRow['start_date'], $syncRow['end_date'],
                    $status === 'approved'
                );
            }

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
    elseif ($action === 'update_request') {
        // Admin edit of a leave request's details + status
        $id           = $data->id;
        $leave_type   = $data->leave_type;
        $start_date   = $data->start_date;
        $end_date     = $data->end_date;
        $total_days   = $data->total_days;
        $reason       = $data->reason;
        $status       = $data->status;
        $admin_remarks = $data->admin_remarks ?? '';
        $user_id      = $data->user_id;

        try {
            $conn->beginTransaction();

            // Fetch old record to handle balance adjustments
            $oldStmt = $conn->prepare("SELECT * FROM leave_requests WHERE id = :id");
            $oldStmt->execute([':id' => $id]);
            $old = $oldStmt->fetch(PDO::FETCH_ASSOC);

            $query = "UPDATE leave_requests SET leave_type=:leave_type, start_date=:start_date, end_date=:end_date,
                      total_days=:total_days, reason=:reason, status=:status, admin_remarks=:admin_remarks WHERE id=:id";
            $stmt = $conn->prepare($query);
            $stmt->execute([
                ':leave_type'    => $leave_type,
                ':start_date'    => $start_date,
                ':end_date'      => $end_date,
                ':total_days'    => $total_days,
                ':reason'        => $reason,
                ':status'        => $status,
                ':admin_remarks' => $admin_remarks,
                ':id'            => $id
            ]);

            // Adjust balances: reverse old if was approved, apply new if now approved
            $oldYear = date('Y', strtotime($old['start_date']));
            if ($old['status'] === 'approved') {
                $conn->prepare("UPDATE leave_balances SET used_days = used_days - :days WHERE user_id=:uid AND leave_type=:lt AND year=:yr")
                     ->execute([':days' => $old['total_days'], ':uid' => $user_id, ':lt' => $old['leave_type'], ':yr' => $oldYear]);
            }
            if ($status === 'approved') {
                $newYear = date('Y', strtotime($start_date));
                $conn->prepare("UPDATE leave_balances SET used_days = used_days + :days WHERE user_id=:uid AND leave_type=:lt AND year=:yr")
                     ->execute([':days' => $total_days, ':uid' => $user_id, ':lt' => $leave_type, ':yr' => $newYear]);
            }

            $conn->commit();

            // --- Sync DTR attendance table ---
            // 1. Clear old Leave rows for the old date range
            if ($old['status'] === 'approved') {
                syncAttendanceForLeave($conn, $user_id, $old['start_date'], $old['end_date'], false);
            }
            // 2. Apply new Leave rows if the new status is approved
            if ($status === 'approved') {
                syncAttendanceForLeave($conn, $user_id, $start_date, $end_date, true);
            }

            $admin_id = $data->admin_id ?? 0;
            logAction($conn, $admin_id, 'EDIT_LEAVE', "Administrator edited leave request ID {$id}.");

            echo json_encode(["status" => "success", "message" => "Leave request updated successfully"]);
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
elseif ($method === 'DELETE') {
    $id = isset($_GET['id']) ? intval($_GET['id']) : 0;
    $admin_id = isset($_GET['admin_id']) ? intval($_GET['admin_id']) : 0;

    if (!$id) {
        echo json_encode(["status" => "error", "message" => "Invalid leave request ID"]);
        exit;
    }

    try {
        $conn->beginTransaction();

        // Fetch the request before deleting so we can reverse balance
        $selStmt = $conn->prepare("SELECT * FROM leave_requests WHERE id = :id");
        $selStmt->execute([':id' => $id]);
        $req = $selStmt->fetch(PDO::FETCH_ASSOC);

        if (!$req) {
            $conn->rollBack();
            echo json_encode(["status" => "error", "message" => "Leave request not found"]);
            exit;
        }

        // If request was approved, reverse the used_days
        if ($req['status'] === 'approved') {
            $yr = date('Y', strtotime($req['start_date']));
            $conn->prepare("UPDATE leave_balances SET used_days = used_days - :days WHERE user_id=:uid AND leave_type=:lt AND year=:yr")
                 ->execute([':days' => $req['total_days'], ':uid' => $req['user_id'], ':lt' => $req['leave_type'], ':yr' => $yr]);
        }

        $delStmt = $conn->prepare("DELETE FROM leave_requests WHERE id = :id");
        $delStmt->execute([':id' => $id]);

        $conn->commit();

        // --- Sync DTR attendance table ---
        // Remove Leave attendance rows that were created for this leave
        if ($req['status'] === 'approved') {
            syncAttendanceForLeave($conn, $req['user_id'], $req['start_date'], $req['end_date'], false);
        }

        logAction($conn, $admin_id, 'DELETE_LEAVE', "Administrator deleted leave request ID {$id} for user ID {$req['user_id']}.");

        echo json_encode(["status" => "success", "message" => "Leave request deleted successfully"]);
    } catch (PDOException $e) {
        $conn->rollBack();
        echo json_encode(["status" => "error", "message" => $e->getMessage()]);
    }
}
?>
