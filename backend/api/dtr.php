<?php
date_default_timezone_set('America/New_York');
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/logger.php';

$data = json_decode(file_get_contents("php://input"));
$action = isset($_GET['action']) ? $_GET['action'] : (isset($data->action) ? $data->action : '');

if ($action === 'clock_in') {
    $user_id = $data->user_id;
    
    // Use server's reliable time to prevent time theft
    $server_time = date('H:i:s');
    $server_date = date('Y-m-d');
    $server_datetime = $server_date . ' ' . $server_time;
    
    $query = "INSERT INTO attendance (user_id, date, am_in, status) VALUES (:user_id, :server_date, :server_datetime, 'Present') 
              ON DUPLICATE KEY UPDATE am_in = IF(am_in IS NULL, VALUES(am_in), am_in), status = 'Present'";
    $stmt = $conn->prepare($query);
    $stmt->execute([':user_id' => $user_id, ':server_date' => $server_date, ':server_datetime' => $server_datetime]);
    logAction($conn, $user_id, 'DTR_CLOCK_IN', "Employee successfully clocked in for their shift at {$server_datetime}.");
    echo json_encode(["status" => "success", "message" => "Clocked in successfully"]);
    
} elseif ($action === 'clock_out') {
    $user_id = $data->user_id;
    
    // Use server's reliable time to prevent time theft
    $server_time = date('H:i:s');
    $server_date = date('Y-m-d');
    $server_datetime = $server_date . ' ' . $server_time;
    
    // Fetch the latest active shift (pm_out IS NULL) for the user for the current server date
    $fetch_query = "SELECT a.id, a.am_in, u.hourly_rate FROM attendance a JOIN users u ON a.user_id = u.id WHERE a.user_id = :user_id AND a.pm_out IS NULL AND a.date = :server_date ORDER BY a.date DESC LIMIT 1";
    $fetch_stmt = $conn->prepare($fetch_query);
    $fetch_stmt->execute([':user_id' => $user_id, ':server_date' => $server_date]);
    $record = $fetch_stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($record && $record['am_in']) {
        // Calculate total hours using the full DATETIME difference
        $am_in_seconds = strtotime($record['am_in']);
        $pm_out_seconds = strtotime($server_datetime);
        $diff_seconds = max(0, $pm_out_seconds - $am_in_seconds);
        $total_hours = round($diff_seconds / 3600, 2);
        $earnings = round($total_hours * $record['hourly_rate'], 2);
        
        $query = "UPDATE attendance 
                  SET pm_out = :server_datetime, 
                      total_hours = :total_hours,
                      earnings = :earnings
                  WHERE id = :id";
        $stmt = $conn->prepare($query);
        $stmt->execute([
            ':server_datetime' => $server_datetime,
            ':total_hours' => $total_hours,
            ':earnings' => $earnings,
            ':id' => $record['id']
        ]);
        logAction($conn, $user_id, 'DTR_CLOCK_OUT', "Employee successfully clocked out for their shift at {$server_datetime} (Total Hours Logged: {$total_hours}).");
        echo json_encode(["status" => "success", "message" => "Clocked out successfully"]);
    } else {
        echo json_encode(["status" => "error", "message" => "No Active Shift found."]);
    }

} elseif ($action === 'get_records') {
    $server_date = date('Y-m-d');
    $yesterday   = date('Y-m-d', strtotime('-1 day'));

    // ── 1. Auto-close past open shifts (forgot to PM OUT) up to 23:59:59 of that day ──
    $auto_close_query = "
        UPDATE attendance a
        JOIN users u ON a.user_id = u.id
        SET a.pm_out = CONCAT(a.date, ' 23:59:59'),
            a.total_hours = ROUND(TIMESTAMPDIFF(SECOND, a.am_in, CONCAT(a.date, ' 23:59:59')) / 3600, 2),
            a.earnings = ROUND((TIMESTAMPDIFF(SECOND, a.am_in, CONCAT(a.date, ' 23:59:59')) / 3600) * u.hourly_rate, 2)
        WHERE a.pm_out IS NULL 
          AND a.am_in IS NOT NULL 
          AND a.date < :server_date
    ";
    $auto_close_stmt = $conn->prepare($auto_close_query);
    $auto_close_stmt->execute([':server_date' => $server_date]);

    // ── 2. Auto-mark Absent for ALL past days (Mon–Sun) with no clock-in ──
    // Get all users and their earliest possible date (account creation date)
    $allUsersStmt = $conn->prepare("SELECT id, DATE(created_at) as joined_date FROM users");
    $allUsersStmt->execute();
    $allUsers = $allUsersStmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($allUsers as $u) {
        $uid        = $u['id'];
        $startDate  = $u['joined_date'] ?? '2024-01-01';

        // Batch-insert Absent for every past date with no attendance record,
        // excluding dates covered by a holiday or an approved leave request
        $autoAbsentQuery = "
            INSERT INTO attendance (user_id, date, status, total_hours, earnings)
            SELECT :uid, d.date_val, 'Absent', 0, 0
            FROM (
                SELECT DATE_ADD(:start, INTERVAL seq DAY) AS date_val
                FROM (
                    SELECT a.N + b.N * 10 + c.N * 100 AS seq
                    FROM
                        (SELECT 0 AS N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
                         UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) a,
                        (SELECT 0 AS N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
                         UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) b,
                        (SELECT 0 AS N UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
                         UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) c
                ) nums
                WHERE DATE_ADD(:start2, INTERVAL seq DAY) <= :yesterday
            ) d
            WHERE
                -- No existing attendance record
                NOT EXISTS (
                    SELECT 1 FROM attendance a2
                    WHERE a2.user_id = :uid2 AND a2.date = d.date_val
                )
                -- No holiday on that date
                AND NOT EXISTS (
                    SELECT 1 FROM holidays h
                    WHERE h.holiday_date = d.date_val
                )
                -- No approved leave request covering that date (from leave_requests table)
                AND NOT EXISTS (
                    SELECT 1 FROM leave_requests lr
                    WHERE lr.user_id = :uid3
                      AND lr.status = 'approved'
                      AND d.date_val BETWEEN lr.start_date AND lr.end_date
                )
                -- No approved calendar event (VL, SL, PDO, etc.) on that date
                AND NOT EXISTS (
                    SELECT 1 FROM events ev
                    WHERE ev.user_id = :uid4
                      AND ev.event_date = d.date_val
                      AND ev.status = 'approved'
                      AND ev.event_type IN ('VL', 'SL', 'PDO', 'Birthday', 'Meeting', 'Holiday', 'HL')
                )
                -- No pending reschedule request where this date is the ORIGINAL date being rescheduled
                AND NOT EXISTS (
                    SELECT 1 FROM events ev2
                    JOIN events ev_orig ON ev2.reschedule_for_event_id = ev_orig.id
                    WHERE ev2.user_id = :uid5
                      AND ev2.status = 'pending'
                      AND ev2.reschedule_for_event_id IS NOT NULL
                      AND ev_orig.event_date = d.date_val
                )
        ";
        $autoAbsentStmt = $conn->prepare($autoAbsentQuery);
        $autoAbsentStmt->execute([
            ':uid'       => $uid,
            ':uid2'      => $uid,
            ':uid3'      => $uid,
            ':uid4'      => $uid,
            ':uid5'      => $uid,
            ':start'     => $startDate,
            ':start2'    => $startDate,
            ':yesterday' => $yesterday
        ]);

        // Also update existing records that have no clock-in and are not in a protected status
        $updateAbsentQuery = "
            UPDATE attendance
            SET status = 'Absent'
            WHERE user_id = :uid
              AND date < :server_date
              AND am_in IS NULL
              AND status NOT IN ('Leave', 'Holiday', 'Rescheduled')
              AND NOT EXISTS (
                  SELECT 1 FROM leave_requests lr
                  WHERE lr.user_id = :uid2
                    AND lr.status = 'approved'
                    AND attendance.date BETWEEN lr.start_date AND lr.end_date
              )
        ";
        $updateAbsentStmt = $conn->prepare($updateAbsentQuery);
        $updateAbsentStmt->execute([
            ':uid'         => $uid,
            ':uid2'        => $uid,
            ':server_date' => $server_date
        ]);
    }

    $user_id = isset($_GET['user_id']) ? $_GET['user_id'] : null;
    if ($user_id) {
        $query = "SELECT a.*, u.hourly_rate FROM attendance a JOIN users u ON a.user_id = u.id WHERE a.user_id = :user_id ORDER BY a.date DESC";
        $stmt = $conn->prepare($query);
        $stmt->execute([':user_id' => $user_id]);
    } else {
        // Admin gets all
        $query = "SELECT a.*, u.full_name, u.hourly_rate FROM attendance a JOIN users u ON a.user_id = u.id ORDER BY a.date DESC";
        $stmt = $conn->prepare($query);
        $stmt->execute();
    }
    
    $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(["status" => "success", "data" => $records]);

} elseif ($action === 'edit_record') {
    // Admin Edit Record
    $record_id = $data->record_id;
    $am_in = isset($data->am_in) && $data->am_in !== '' ? $data->am_in : null;
    $pm_out = isset($data->pm_out) && $data->pm_out !== '' ? $data->pm_out : null;
    $status = isset($data->status) ? $data->status : 'Present';
    
    // Fetch user info to calculate earnings
    $fetch_query = "SELECT u.id as user_id, u.hourly_rate FROM attendance a JOIN users u ON a.user_id = u.id WHERE a.id = :record_id";
    $fetch_stmt = $conn->prepare($fetch_query);
    $fetch_stmt->execute([':record_id' => $record_id]);
    $record = $fetch_stmt->fetch(PDO::FETCH_ASSOC);

    if ($record) {
        $total_hours = 0;
        $earnings = 0;
        
        if ($am_in && $pm_out && !in_array($status, ['Absent', 'Leave', 'Holiday'])) {
            $am_in_seconds = strtotime($am_in);
            $pm_out_seconds = strtotime($pm_out);
            
            if ($pm_out_seconds < $am_in_seconds) {
                $pm_out = date('Y-m-d H:i:s', $pm_out_seconds + 86400);
                $pm_out_seconds += 86400;
            }

            $diff_seconds = max(0, $pm_out_seconds - $am_in_seconds);
            $total_hours = round($diff_seconds / 3600, 2);
            $earnings = round($total_hours * $record['hourly_rate'], 2);
        }

        $query = "UPDATE attendance SET am_in = :am_in, pm_out = :pm_out, total_hours = :total_hours, earnings = :earnings, status = :status WHERE id = :record_id";
        $stmt = $conn->prepare($query);
        $stmt->execute([
            ':am_in' => $am_in,
            ':pm_out' => $pm_out,
            ':total_hours' => $total_hours,
            ':earnings' => $earnings,
            ':status' => $status,
            ':record_id' => $record_id
        ]);
        
        // Log action (assuming admin is performing this, but we don't have admin ID in $data unless passed, we'll log against the affected user_id for simplicity or skip)
        // logAction($conn, $record['user_id'], 'DTR_ADMIN_EDIT', "Admin edited record {$record_id}");
        
        echo json_encode(["status" => "success", "message" => "Record updated successfully"]);
    } else {
        echo json_encode(["status" => "error", "message" => "Record not found"]);
    }

} elseif ($action === 'add_record') {
    // Admin Add Record
    $user_id = $data->user_id;
    $date = $data->date;
    $am_in = isset($data->am_in) && $data->am_in !== '' ? $data->am_in : null;
    $pm_out = isset($data->pm_out) && $data->pm_out !== '' ? $data->pm_out : null;
    $status = isset($data->status) ? $data->status : 'Present';
    
    $fetch_user = "SELECT hourly_rate FROM users WHERE id = :user_id";
    $fetch_stmt = $conn->prepare($fetch_user);
    $fetch_stmt->execute([':user_id' => $user_id]);
    $user = $fetch_stmt->fetch(PDO::FETCH_ASSOC);

    if ($user) {
        $total_hours = 0;
        $earnings = 0;

        if ($am_in && $pm_out && !in_array($status, ['Absent', 'Leave', 'Holiday'])) {
            $am_in_seconds = strtotime($am_in);
            $pm_out_seconds = strtotime($pm_out);
            
            if ($pm_out_seconds < $am_in_seconds) {
                $pm_out = date('Y-m-d H:i:s', $pm_out_seconds + 86400);
                $pm_out_seconds += 86400;
            }

            $diff_seconds = max(0, $pm_out_seconds - $am_in_seconds);
            $total_hours = round($diff_seconds / 3600, 2);
            $earnings = round($total_hours * $user['hourly_rate'], 2);
        }

        $query = "INSERT INTO attendance (user_id, date, am_in, pm_out, total_hours, earnings, status) 
                  VALUES (:user_id, :date, :am_in, :pm_out, :total_hours, :earnings, :status)
                  ON DUPLICATE KEY UPDATE am_in = :am_in, pm_out = :pm_out, total_hours = :total_hours, earnings = :earnings, status = :status";
        $stmt = $conn->prepare($query);
        $stmt->execute([
            ':user_id' => $user_id,
            ':date' => $date,
            ':am_in' => $am_in,
            ':pm_out' => $pm_out,
            ':total_hours' => $total_hours,
            ':earnings' => $earnings,
            ':status' => $status
        ]);
        
        echo json_encode(["status" => "success", "message" => "Record added successfully"]);
    } else {
        echo json_encode(["status" => "error", "message" => "User not found"]);
    }

} elseif ($action === 'delete_record') {
    $record_id = isset($_GET['record_id']) ? $_GET['record_id'] : (isset($data->record_id) ? $data->record_id : null);
    if ($record_id) {
        $query = "DELETE FROM attendance WHERE id = :record_id";
        $stmt = $conn->prepare($query);
        $stmt->execute([':record_id' => $record_id]);
        echo json_encode(["status" => "success", "message" => "Record deleted successfully"]);
    } else {
        echo json_encode(["status" => "error", "message" => "Record ID required"]);
    }
}
?>
