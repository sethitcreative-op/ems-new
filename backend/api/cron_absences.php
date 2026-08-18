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
        
        // Check if the user has an attendance record for the specific date
        $checkQuery = "SELECT id, am_in, pm_out, status FROM attendance WHERE user_id = :user_id AND date = :dateToCheck";
        $checkStmt = $conn->prepare($checkQuery);
        $checkStmt->execute([':user_id' => $user_id, ':dateToCheck' => $dateToCheck]);
        $record = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if (!$record) {
            // Missed both AM/PM punch - create an Absent record
            $insertQuery = "INSERT INTO attendance (user_id, date, status, total_hours, earnings) VALUES (:user_id, :dateToCheck, 'Absent', 0, 0)";
            $insertStmt = $conn->prepare($insertQuery);
            $insertStmt->execute([':user_id' => $user_id, ':dateToCheck' => $dateToCheck]);
            $absentCount++;
        } else if (!$record['am_in'] && !$record['pm_out'] && $record['status'] !== 'Absent') {
            // Exists but both empty and not marked as Absent yet
            $updateQuery = "UPDATE attendance SET status = 'Absent' WHERE id = :id";
            $updateStmt = $conn->prepare($updateQuery);
            $updateStmt->execute([':id' => $record['id']]);
            $absentCount++;
        }
    }

    echo json_encode(["status" => "success", "message" => "Marked {$absentCount} users as Absent for {$dateToCheck} (US Time)"]);
} catch (PDOException $e) {
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>
