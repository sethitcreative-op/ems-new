<?php
// backend/config/logger.php
require_once 'database.php';

function logAction($conn, $user_id, $action, $description) {
    try {
        $ip_address = $_SERVER['REMOTE_ADDR'] ?? 'Unknown IP';
        $user_agent = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown Device';

        $query = "INSERT INTO system_logs (user_id, action, description, ip_address, user_agent) VALUES (:user_id, :action, :description, :ip, :ua)";
        $stmt = $conn->prepare($query);
        
        $stmt->bindParam(':user_id', $user_id);
        $stmt->bindParam(':action', $action);
        $stmt->bindParam(':description', $description);
        $stmt->bindParam(':ip', $ip_address);
        $stmt->bindParam(':ua', $user_agent);
        
        $result = $stmt->execute();
        
        return $result;
    } catch(PDOException $exception) {
        // Silently fail or log to error log to avoid breaking main functionality
        error_log("Failed to insert system log: " . $exception->getMessage());
        return false;
    }
}
?>
