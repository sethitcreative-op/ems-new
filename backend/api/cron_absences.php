<?php
date_default_timezone_set('America/New_York');
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/logger.php';

// Allow trigger via CLI or GET/POST request
$dateToCheck = isset($_GET['date']) ? $_GET['date'] : date('Y-m-d', strtotime('-1 day'));

try {
    // Get all users
    $query = "SELECT id FROM users";
    $stmt = $conn->prepare($query);
    $stmt->execute();
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $absentCount = 0;
    foreach ($users as $user) {
        $user_id = $user['id'];
        
        $targetStatus = 'Absent';

        // 1. Check for Holiday
        $holQuery = "SELECT id FROM holidays WHERE holiday_date = :dateToCheck";
        $holStmt = $conn->prepare($holQuery);
        $holStmt->execute([':dateToCheck' => $dateToCheck]);
        if ($holStmt->fetch(PDO::FETCH_ASSOC)) {
            $targetStatus = 'Holiday';
        } else {
            // 2. Check for Approved Leave
            $leaveQuery = "SELECT id FROM events WHERE user_id = :user_id AND event_date = :dateToCheck AND status = 'approved' AND event_type IN ('VL', 'SL', 'PDO', 'Birthday', 'Meeting', 'Holiday')";
            $leaveStmt = $conn->prepare($leaveQuery);
            $leaveStmt->execute([':user_id' => $user_id, ':dateToCheck' => $dateToCheck]);
            if ($leaveStmt->fetch(PDO::FETCH_ASSOC)) {
                $targetStatus = 'Leave';
            }
        }

        // Check if the user has an attendance record for the specific date
        $checkQuery = "SELECT id, am_in, pm_out, status FROM attendance WHERE user_id = :user_id AND date = :dateToCheck";
        $checkStmt = $conn->prepare($checkQuery);
        $checkStmt->execute([':user_id' => $user_id, ':dateToCheck' => $dateToCheck]);
        $record = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if (!$record) {
            // Missed both AM/PM punch - create record with target status
            $insertQuery = "INSERT INTO attendance (user_id, date, status, total_hours, earnings) VALUES (:user_id, :dateToCheck, :status, 0, 0)";
            $insertStmt = $conn->prepare($insertQuery);
            $insertStmt->execute([':user_id' => $user_id, ':dateToCheck' => $dateToCheck, ':status' => $targetStatus]);
            if ($targetStatus === 'Absent') $absentCount++;
        } else {
            $currentStatus = $record['status'];
            // If no punches exist and current status is not a protected state
            if (!$record['am_in'] && !$record['pm_out']) {
                $protectedStatuses = ['Rescheduled', 'Leave', 'Holiday'];
                if (!in_array($currentStatus, $protectedStatuses) && $currentStatus !== $targetStatus) {
                    $updateQuery = "UPDATE attendance SET status = :status WHERE id = :id";
                    $updateStmt = $conn->prepare($updateQuery);
                    $updateStmt->execute([':status' => $targetStatus, ':id' => $record['id']]);
                    if ($targetStatus === 'Absent') $absentCount++;
                }
            }
        }
    }

    echo json_encode(["status" => "success", "message" => "Marked {$absentCount} users as Absent for {$dateToCheck} (US Time)"]);
} catch (PDOException $e) {
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>
