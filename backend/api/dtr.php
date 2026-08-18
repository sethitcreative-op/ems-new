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
    logAction($conn, $user_id, 'DTR_CLOCK_IN', "Clocked in at {$server_datetime}");
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
        logAction($conn, $user_id, 'DTR_CLOCK_OUT', "Clocked out at {$server_datetime} (Hours: {$total_hours})");
        echo json_encode(["status" => "success", "message" => "Clocked out successfully"]);
    } else {
        echo json_encode(["status" => "error", "message" => "No Active Shift found."]);
    }

} elseif ($action === 'get_records') {
    $server_date = date('Y-m-d');
    
    // Auto-close past open shifts (forgot to PM OUT) up to 23:59:59 of that day
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
}
?>
