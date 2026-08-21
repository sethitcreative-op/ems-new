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
        
        $result = $stmt->execute();
        
        // Broadcast notification to all admins
        try {
            $adminQuery = "SELECT id FROM users WHERE role = 'admin'";
            $adminStmt = $conn->prepare($adminQuery);
            $adminStmt->execute();
            $admins = $adminStmt->fetchAll(PDO::FETCH_ASSOC);

            if (count($admins) > 0) {
                $notifQuery = "INSERT INTO notifications (user_id, type, message) VALUES (:user_id, :type, :message)";
                $notifStmt = $conn->prepare($notifQuery);
                
                $type = 'activity';
                $timestamp = date('H:i:s');
                
                foreach ($admins as $admin) {
                    $notifStmt->execute([
                        ':user_id' => $admin['id'],
                        ':type' => $type,
                        ':message' => $description . " (" . $timestamp . ")"
                    ]);
                }
            }
        } catch(PDOException $e) {
            error_log("Failed to insert admin notifications: " . $e->getMessage());
        }
        
        return $result;
    } catch(PDOException $exception) {
        // Silently fail or log to error log to avoid breaking main functionality
        error_log("Failed to insert system log: " . $exception->getMessage());
        return false;
    }
}
?>
