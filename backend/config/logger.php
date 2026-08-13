<?php
// backend/config/logger.php
require_once 'database.php';

function logAction($conn, $user_id, $action, $description) {
    try {
        $query = "INSERT INTO system_logs (user_id, action, description) VALUES (:user_id, :action, :description)";
        $stmt = $conn->prepare($query);
        
        $stmt->bindParam(':user_id', $user_id);
        $stmt->bindParam(':action', $action);
        $stmt->bindParam(':description', $description);
        
        return $stmt->execute();
    } catch(PDOException $exception) {
        // Silently fail or log to error log to avoid breaking main functionality
        error_log("Failed to insert system log: " . $exception->getMessage());
        return false;
    }
}
?>
