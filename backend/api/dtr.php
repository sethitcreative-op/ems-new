<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/logger.php';

$data = json_decode(file_get_contents("php://input"));
$action = isset($_GET['action']) ? $_GET['action'] : (isset($data->action) ? $data->action : '');

if ($action === 'clock_in') {
    $user_id = $data->user_id;
    
    // Use client's local time and date to match their system clock
    $client_time = isset($data->client_time) ? $data->client_time : date('H:i:s');
    $client_date = isset($data->client_date) ? $data->client_date : date('Y-m-d');
    $client_datetime = $client_date . ' ' . $client_time;
    
    $query = "INSERT INTO attendance (user_id, date, am_in) VALUES (:user_id, :client_date, :client_datetime) 
              ON DUPLICATE KEY UPDATE am_in = IF(am_in IS NULL, VALUES(am_in), am_in)";
    $stmt = $conn->prepare($query);
    $stmt->execute([':user_id' => $user_id, ':client_date' => $client_date, ':client_datetime' => $client_datetime]);
    logAction($conn, $user_id, 'DTR_CLOCK_IN', "Clocked in at {$client_datetime}");
    echo json_encode(["status" => "success", "message" => "Clocked in successfully"]);
    
} elseif ($action === 'clock_out') {
    $user_id = $data->user_id;
    
    // Use client's local time and date to match their system clock
    $client_time = isset($data->client_time) ? $data->client_time : date('H:i:s');
    $client_date = isset($data->client_date) ? $data->client_date : date('Y-m-d');
    $client_datetime = $client_date . ' ' . $client_time;
    
    // Fetch the latest active shift (pm_out IS NULL) for the user
    $fetch_query = "SELECT a.id, a.am_in, u.hourly_rate FROM attendance a JOIN users u ON a.user_id = u.id WHERE a.user_id = :user_id AND a.pm_out IS NULL ORDER BY a.date DESC LIMIT 1";
    $fetch_stmt = $conn->prepare($fetch_query);
    $fetch_stmt->execute([':user_id' => $user_id]);
    $record = $fetch_stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($record && $record['am_in']) {
        // Calculate total hours using the full DATETIME difference
        $am_in_seconds = strtotime($record['am_in']);
        $pm_out_seconds = strtotime($client_datetime);
        $diff_seconds = max(0, $pm_out_seconds - $am_in_seconds);
        $total_hours = round($diff_seconds / 3600, 2);
        $earnings = round($total_hours * $record['hourly_rate'], 2);
        
        $query = "UPDATE attendance 
                  SET pm_out = :client_datetime, 
                      total_hours = :total_hours,
                      earnings = :earnings
                  WHERE id = :id";
        $stmt = $conn->prepare($query);
        $stmt->execute([
            ':client_datetime' => $client_datetime,
            ':total_hours' => $total_hours,
            ':earnings' => $earnings,
            ':id' => $record['id']
        ]);
        logAction($conn, $user_id, 'DTR_CLOCK_OUT', "Clocked out at {$client_datetime} (Hours: {$total_hours})");
        echo json_encode(["status" => "success", "message" => "Clocked out successfully"]);
    } else {
        echo json_encode(["status" => "error", "message" => "No Active Shift found."]);
    }

} elseif ($action === 'get_records') {
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
