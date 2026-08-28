<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/logger.php';

$data = json_decode(file_get_contents("php://input"));
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $role = isset($_GET['role']) ? $_GET['role'] : 'user';
    $user_id = isset($_GET['user_id']) ? $_GET['user_id'] : 0;
    
    // 1. Fetch Events (Work Shifts, Meetings, etc.)
    if ($role === 'admin') {
        $queryEvents = "SELECT e.*, u.full_name as user_name, u.profile_picture FROM events e JOIN users u ON e.user_id = u.id";
        $stmtEvents = $conn->prepare($queryEvents);
        $stmtEvents->execute();
    } else {
        $queryEvents = "SELECT e.*, u.full_name as user_name, u.profile_picture FROM events e JOIN users u ON e.user_id = u.id WHERE e.status = 'approved' OR e.user_id = :user_id";
        $stmtEvents = $conn->prepare($queryEvents);
        $stmtEvents->execute([':user_id' => $user_id]);
    }
    $events = $stmtEvents->fetchAll(PDO::FETCH_ASSOC);

    // 2. Fetch Leaves and map them to virtual single-day events
    if ($role === 'admin') {
        $queryLeaves = "SELECT lr.*, u.full_name as user_name, u.profile_picture FROM leave_requests lr JOIN users u ON lr.user_id = u.id WHERE lr.status = 'approved'";
        $stmtLeaves = $conn->prepare($queryLeaves);
        $stmtLeaves->execute();
    } else {
        // Users see their own (even pending) + everyone else's approved
        $queryLeaves = "SELECT lr.*, u.full_name as user_name, u.profile_picture FROM leave_requests lr JOIN users u ON lr.user_id = u.id WHERE lr.status = 'approved' OR lr.user_id = :user_id";
        $stmtLeaves = $conn->prepare($queryLeaves);
        $stmtLeaves->execute([':user_id' => $user_id]);
    }
    $leaves = $stmtLeaves->fetchAll(PDO::FETCH_ASSOC);

    $virtualLeaveEvents = [];
    foreach ($leaves as $leave) {
        $start = new DateTime($leave['start_date']);
        $end = new DateTime($leave['end_date']);
        $end->modify('+1 day'); // include end date
        
        $interval = DateInterval::createFromDateString('1 day');
        $period = new DatePeriod($start, $interval, $end);
        
        $leaveTypeAbbr = '';
        if ($leave['leave_type'] === 'Leave') $leaveTypeAbbr = 'VL';
        elseif ($leave['leave_type'] === 'Sick Leave') $leaveTypeAbbr = 'SL';
        elseif ($leave['leave_type'] === 'Paid Day Off') $leaveTypeAbbr = 'PDO';
        else $leaveTypeAbbr = $leave['leave_type'];

        foreach ($period as $dt) {
            $virtualLeaveEvents[] = [
                'id' => 'leave_' . $leave['id'] . '_' . $dt->format('Y-m-d'),
                'user_id' => $leave['user_id'],
                'user_name' => $leave['user_name'],
                'profile_picture' => $leave['profile_picture'],
                'title' => $leave['leave_type'],
                'description' => $leave['reason'],
                'event_date' => $dt->format('Y-m-d'),
                'event_type' => $leaveTypeAbbr,
                'status' => $leave['status'],
                'created_at' => $leave['created_at'],
                'schedule_option' => 'none',
                '_isVirtual' => true // flag so frontend knows it's not a real events table row
            ];
        }
    }

    // 3. Fetch Holidays and map them to virtual events
    $queryHolidays = "SELECT * FROM holidays WHERE is_observed = 1";
    $stmtHolidays = $conn->prepare($queryHolidays);
    $stmtHolidays->execute();
    $holidays = $stmtHolidays->fetchAll(PDO::FETCH_ASSOC);
    
    $virtualHolidayEvents = [];
    foreach ($holidays as $holiday) {
        $virtualHolidayEvents[] = [
            'id' => 'holiday_' . $holiday['id'],
            'user_id' => 0, // System wide
            'user_name' => 'System',
            'title' => $holiday['name'],
            'description' => 'Company Holiday',
            'event_date' => $holiday['holiday_date'],
            'event_type' => 'Holiday', // Let frontend handle mapping to HL if needed
            'status' => 'approved',
            'created_at' => $holiday['created_at'],
            'schedule_option' => 'none',
            '_isHoliday' => true,
            '_isVirtual' => true
        ];
    }

    // Merge and sort
    $allEvents = array_merge($events, $virtualLeaveEvents, $virtualHolidayEvents);
    usort($allEvents, function($a, $b) {
        return strtotime($a['event_date']) - strtotime($b['event_date']);
    });
    
    echo json_encode(["status" => "success", "data" => $allEvents]);
} 
elseif ($method === 'POST') {
    $user_id = $data->user_id;
    $title = $data->title;
    $description = $data->description ?? '';
    $event_date = $data->event_date;
    $event_type = $data->event_type ?? 'Other';
    
    $is_admin_assigning = isset($data->is_admin_assigning) ? $data->is_admin_assigning : false;
    $status = $data->status ?? 'pending';
    $approved_by_name = null;
    if ($is_admin_assigning) {
        $status = 'approved';
        $approved_by_name = $data->admin_name ?? 'System Administrator';
    }

    $schedule_option = $data->schedule_option ?? null;

    // Check if a schedule already exists for the user on this date
    $checkEventQuery = "SELECT id FROM events WHERE user_id = :user_id AND event_date = :event_date AND status != 'rejected' LIMIT 1";
    $checkEventStmt = $conn->prepare($checkEventQuery);
    $checkEventStmt->execute([':user_id' => $user_id, ':event_date' => $event_date]);
    
    $checkLeaveQuery = "SELECT id FROM leave_requests WHERE user_id = :user_id AND :event_date BETWEEN start_date AND end_date AND status != 'rejected' LIMIT 1";
    $checkLeaveStmt = $conn->prepare($checkLeaveQuery);
    $checkLeaveStmt->execute([':user_id' => $user_id, ':event_date' => $event_date]);
    
    if ($checkEventStmt->fetch() || $checkLeaveStmt->fetch()) {
        echo json_encode(["status" => "error", "message" => "A schedule already exists for this date. Please edit the existing schedule to avoid duplication."]);
        exit;
    }

    if ($event_type === 'VL') {
        $year = date('Y', strtotime($event_date));
        $checkLimitStmt = $conn->prepare("SELECT COUNT(*) as request_count FROM leave_requests WHERE user_id = :user_id AND YEAR(start_date) = :year");
        $checkLimitStmt->execute([':user_id' => $user_id, ':year' => $year]);
        $requestCount = $checkLimitStmt->fetch(PDO::FETCH_ASSOC)['request_count'];

        if ($requestCount >= 3 && !$is_admin_assigning) {
            echo json_encode(["status" => "error", "message" => "You have reached the maximum limit of 3 leave requests for this year."]);
            exit;
        }

        $reason = trim($description) === '' ? 'Leave via Calendar' : $description;

        $query = "INSERT INTO leave_requests (user_id, leave_type, start_date, end_date, total_days, reason, status) VALUES (:user_id, 'Leave', :start_date, :end_date, 1, :reason, :status)";
        $stmt = $conn->prepare($query);
        try {
            $stmt->execute([
                ':user_id' => $user_id,
                ':start_date' => $event_date,
                ':end_date' => $event_date,
                ':reason' => $reason,
                ':status' => $status
            ]);

            if ($is_admin_assigning) {
                logAction($conn, $user_id, 'ASSIGN_LEAVE', "Administrator assigned a Leave for {$event_date}.");
                $notif_message = "Admin has assigned a Leave for " . date('M d, Y', strtotime($event_date)) . ".";
                $notif_stmt = $conn->prepare("INSERT INTO notifications (user_id, type, message) VALUES (:user_id, 'info', :message)");
                $notif_stmt->execute([
                    ':user_id' => $user_id,
                    ':message' => $notif_message
                ]);
            } else {
                logAction($conn, $user_id, 'SUBMIT_LEAVE', "Employee submitted a Leave for {$event_date} via Calendar.");
            }

            echo json_encode(["status" => "success", "message" => "Leave request created successfully"]);
        } catch(PDOException $e) {
            echo json_encode(["status" => "error", "message" => "Could not create leave request: " . $e->getMessage()]);
        }
        exit;
    }

    if (in_array($event_type, ['SL', 'PDO', 'Holiday'])) {
        echo json_encode(["status" => "error", "message" => "Leaves and Holidays must be managed through their respective modules."]);
        exit;
    }

    $query = "INSERT INTO events (user_id, title, description, event_date, event_type, status, approved_by_name, schedule_option) VALUES (:user_id, :title, :description, :event_date, :event_type, :status, :approved_by_name, :schedule_option)";
    $stmt = $conn->prepare($query);
    try {
        $stmt->execute([
            ':user_id' => $user_id,
            ':title' => $title, 
            ':description' => $description, 
            ':event_date' => $event_date,
            ':event_type' => $event_type,
            ':status' => $status,
            ':approved_by_name' => $approved_by_name,
            ':schedule_option' => $schedule_option
        ]);
        
        if ($is_admin_assigning) {
            logAction($conn, $user_id, 'ASSIGN_SCHEDULE', "Administrator successfully assigned a new {$event_type} schedule for the date {$event_date}.");
            $notif_message = "Admin has assigned a new {$event_type} for " . date('M d, Y', strtotime($event_date)) . ".";
            $notif_stmt = $conn->prepare("INSERT INTO notifications (user_id, type, message) VALUES (:user_id, 'info', :message)");
            $notif_stmt->execute([
                ':user_id' => $user_id,
                ':message' => $notif_message
            ]);
        } else {
            logAction($conn, $user_id, 'SUBMIT_REQUEST', "Employee successfully submitted a new request for {$event_type} on the date {$event_date}.");
        }
        
        echo json_encode(["status" => "success", "message" => "Event created successfully"]);
    } catch(PDOException $e) {
        echo json_encode(["status" => "error", "message" => "Could not create event: " . $e->getMessage()]);
    }
}
elseif ($method === 'PUT') {
    $event_id = $data->id;

    if (strpos($event_id, 'leave_') === 0) {
        $parts = explode('_', $event_id);
        $leave_id = $parts[1];

        if (isset($data->action) && $data->action === 'edit') {
            $event_date = $data->event_date;
            $status = $data->status ?? null;
            $new_event_type = $data->event_type ?? 'VL';
            $user_id = $data->user_id ?? 0;
            $title = $data->title ?? '';
            $description = $data->description ?? '';
            $schedule_option = $data->schedule_option ?? null;

            if ($new_event_type !== 'VL' && $new_event_type !== 'SL' && $new_event_type !== 'PDO' && $new_event_type !== 'Holiday') {
                // Converting from Leave to WS/Other
                // 1. Delete the leave request
                $del = $conn->prepare("DELETE FROM leave_requests WHERE id = :id");
                $del->execute([':id' => $leave_id]);
                
                // 2. Insert into events
                $ins = $conn->prepare("INSERT INTO events (user_id, title, description, event_date, event_type, status, schedule_option) VALUES (:user_id, :title, :description, :event_date, :event_type, :status, :schedule_option)");
                $ins->execute([
                    ':user_id' => $user_id,
                    ':title' => $title,
                    ':description' => $description,
                    ':event_date' => $event_date,
                    ':event_type' => $new_event_type,
                    ':status' => $status ?? 'pending',
                    ':schedule_option' => $schedule_option
                ]);
                echo json_encode(["status" => "success", "message" => "Converted to {$new_event_type} successfully"]);
                exit;
            }
            
            $query = "UPDATE leave_requests SET start_date = :event_date, end_date = :event_date, total_days = 1";
            if ($status) {
                $query .= ", status = :status";
            }
            $query .= " WHERE id = :id";
            
            $stmt = $conn->prepare($query);
            try {
                $params = [':event_date' => $event_date, ':id' => $leave_id];
                if ($status) {
                    $params[':status'] = $status;
                }
                $stmt->execute($params);
                echo json_encode(["status" => "success", "message" => "Leave request updated successfully via calendar"]);
            } catch(PDOException $e) {
                echo json_encode(["status" => "error", "message" => "Could not update leave: " . $e->getMessage()]);
            }
        } else {
            $status = $data->status;
            $query = "UPDATE leave_requests SET status = :status";
            $admin_remarks = '';
            if ($status === 'approved' && isset($data->approved_by_name)) {
                $admin_remarks = 'Approved by ' . $data->approved_by_name . ' via Calendar';
                $query .= ", admin_remarks = :admin_remarks";
            }
            $query .= " WHERE id = :id";
            
            $stmt = $conn->prepare($query);
            try {
                $params = [':status' => $status, ':id' => $leave_id];
                if ($status === 'approved' && isset($data->approved_by_name)) {
                    $params[':admin_remarks'] = $admin_remarks;
                }
                $stmt->execute($params);
                
                if ($status === 'approved') {
                    $getLeave = $conn->prepare("SELECT user_id, leave_type, start_date, total_days FROM leave_requests WHERE id = :id");
                    $getLeave->execute([':id' => $leave_id]);
                    $leaveData = $getLeave->fetch(PDO::FETCH_ASSOC);
                    
                    if ($leaveData) {
                        $updBalance = "UPDATE leave_balances SET used_days = used_days + :days WHERE user_id = :user_id AND leave_type = :leave_type AND year = :year";
                        $bStmt = $conn->prepare($updBalance);
                        $bStmt->execute([
                            ':days' => $leaveData['total_days'],
                            ':user_id' => $leaveData['user_id'],
                            ':leave_type' => $leaveData['leave_type'],
                            ':year' => date('Y', strtotime($leaveData['start_date']))
                        ]);
                    }
                }
                
                echo json_encode(["status" => "success", "message" => "Leave status updated via calendar"]);
            } catch(PDOException $e) {
                echo json_encode(["status" => "error", "message" => "Could not update leave status: " . $e->getMessage()]);
            }
        }
        exit;
    }
    if (isset($data->action) && $data->action === 'edit') {
        $title = $data->title ?? '';
        $description = $data->description ?? '';
        $event_date = $data->event_date ?? '';
        $event_type = $data->event_type ?? 'Other';
        $user_id = $data->user_id ?? 0;
        $schedule_option = $data->schedule_option ?? null;
        
        $status = $data->status ?? null;
        $is_admin = isset($data->is_admin) ? $data->is_admin : false;
        
        if (in_array($event_type, ['SL', 'PDO', 'Holiday'])) {
            echo json_encode(["status" => "error", "message" => "Leaves and Holidays must be managed through their respective modules."]);
            exit;
        }

        if ($event_type === 'VL') {
            // Converting from WS to VL
            // 1. Delete the event
            $del = $conn->prepare("DELETE FROM events WHERE id = :id");
            $del->execute([':id' => $event_id]);
            
            // 2. Insert into leave_requests
            $reason = trim($description) === '' ? 'Leave via Calendar' : $description;
            $ins = $conn->prepare("INSERT INTO leave_requests (user_id, leave_type, start_date, end_date, total_days, reason, status) VALUES (:user_id, 'Leave', :start_date, :end_date, 1, :reason, :status)");
            $ins->execute([
                ':user_id' => $user_id,
                ':start_date' => $event_date,
                ':end_date' => $event_date,
                ':reason' => $reason,
                ':status' => $status ?? 'pending'
            ]);
            echo json_encode(["status" => "success", "message" => "Converted to Leave successfully"]);
            exit;
        }

        // Check if event is currently approved
        $checkStmt = $conn->prepare("SELECT status FROM events WHERE id = :id");
        $checkStmt->execute([':id' => $event_id]);
        $currentEvent = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if (!$is_admin && $currentEvent && $currentEvent['status'] === 'approved') {
            // It's already approved. Create a NEW pending request linked to this one
            $query = "INSERT INTO events (user_id, title, description, event_date, event_type, status, reschedule_for_event_id, schedule_option) VALUES (:user_id, :title, :description, :event_date, :event_type, 'pending', :original_id, :schedule_option)";
            $stmt = $conn->prepare($query);
            try {
                $stmt->execute([
                    ':user_id' => $user_id,
                    ':title' => $title,
                    ':description' => $description,
                    ':event_date' => $event_date,
                    ':event_type' => $event_type,
                    ':original_id' => $event_id,
                    ':schedule_option' => $schedule_option
                ]);
                
                $getOrig = $conn->prepare("SELECT event_date FROM events WHERE id = :orig_id");
                $getOrig->execute([':orig_id' => $event_id]);
                $origEvent = $getOrig->fetch(PDO::FETCH_ASSOC);
                if ($origEvent) {
                    $oldDate = $origEvent['event_date'];
                    $insertAttendance = $conn->prepare("INSERT INTO attendance (user_id, date, status, total_hours, earnings) VALUES (:user_id, :old_date, 'Rescheduled', 0, 0) ON DUPLICATE KEY UPDATE status = 'Rescheduled'");
                    $insertAttendance->execute([':user_id' => $user_id, ':old_date' => $oldDate]);
                }

                echo json_encode(["status" => "success", "message" => "Reschedule request created successfully"]);
            } catch(PDOException $e) {
                echo json_encode(["status" => "error", "message" => "Could not create reschedule request: " . $e->getMessage()]);
            }
        } else {
            // It's pending/rejected, just update in place
            if ($status) {
                $query = "UPDATE events SET title = :title, description = :description, event_date = :event_date, event_type = :event_type, user_id = :user_id, status = :status, schedule_option = :schedule_option WHERE id = :id";
            } else {
                $query = "UPDATE events SET title = :title, description = :description, event_date = :event_date, event_type = :event_type, user_id = :user_id, schedule_option = :schedule_option WHERE id = :id";
            }
            $stmt = $conn->prepare($query);
            try {
                $params = [
                    ':title' => $title,
                    ':description' => $description,
                    ':event_date' => $event_date,
                    ':event_type' => $event_type,
                    ':user_id' => $user_id,
                    ':schedule_option' => $schedule_option,
                    ':id' => $event_id
                ];
                if ($status) {
                    $params[':status'] = $status;
                }
                $stmt->execute($params);
                
                $modifier_id = isset($data->modifier_id) ? $data->modifier_id : $user_id;
                if ($is_admin) {
                    logAction($conn, $modifier_id, 'EDIT_SCHEDULE', "Admin edited schedule (Event ID: {$event_id}) for Employee ID {$user_id}.");
                } else {
                    logAction($conn, $user_id, 'EDIT_REQUEST', "Employee edited their schedule request (Event ID: {$event_id}).");
                }

                echo json_encode(["status" => "success", "message" => "Event updated successfully"]);
            } catch(PDOException $e) {
                echo json_encode(["status" => "error", "message" => "Could not update event details: " . $e->getMessage()]);
            }
        }
    } else {
        $status = $data->status;
        
        // Fetch event info to know who to notify
        $stmt = $conn->prepare("SELECT user_id, title, description, event_date, event_type, reschedule_for_event_id FROM events WHERE id = :id");
        $stmt->execute([':id' => $event_id]);
        $event = $stmt->fetch(PDO::FETCH_ASSOC);

        $approved_by_name = $data->approved_by_name ?? null;

        // If this is an approval for a reschedule request
        if ($status === 'approved' && $event && !empty($event['reschedule_for_event_id'])) {
            $getOrig = $conn->prepare("SELECT event_date FROM events WHERE id = :orig_id");
            $getOrig->execute([':orig_id' => $event['reschedule_for_event_id']]);
            $origEvent = $getOrig->fetch(PDO::FETCH_ASSOC);
            $oldDate = $origEvent['event_date'];

            $updateOrig = $conn->prepare("UPDATE events SET title = :title, description = :description, event_date = :event_date, event_type = :event_type, approved_by_name = :approved_by_name WHERE id = :orig_id");
            try {
                $updateOrig->execute([
                    ':title' => $event['title'],
                    ':description' => $event['description'],
                    ':event_date' => $event['event_date'],
                    ':event_type' => $event['event_type'],
                    ':approved_by_name' => $approved_by_name,
                    ':orig_id' => $event['reschedule_for_event_id']
                ]);
                
                $insertAttendance = $conn->prepare("INSERT INTO attendance (user_id, date, status, total_hours, earnings) VALUES (:user_id, :old_date, 'Rescheduled', 0, 0) ON DUPLICATE KEY UPDATE status = 'Rescheduled'");
                $insertAttendance->execute([':user_id' => $event['user_id'], ':old_date' => $oldDate]);
                
                // Delete the temporary reschedule request row
                $conn->prepare("DELETE FROM events WHERE id = :id")->execute([':id' => $event_id]);
                
                $admin_id = isset($data->admin_id) ? $data->admin_id : 0; 
                logAction($conn, $admin_id, 'APPROVE_RESCHEDULE', "Administrator approved the reschedule request, which was applied to the original calendar event ID {$event['reschedule_for_event_id']}.");
                
                $notif_message = "Your reschedule request \"{$event['title']}\" was approved and applied.";
                $notif_stmt = $conn->prepare("INSERT INTO notifications (user_id, type, message) VALUES (:user_id, 'success', :message)");
                $notif_stmt->execute([
                    ':user_id' => $event['user_id'],
                    ':message' => $notif_message
                ]);
                
                echo json_encode(["status" => "success", "message" => "Reschedule applied to original event"]);
                exit;
            } catch(PDOException $e) {
                echo json_encode(["status" => "error", "message" => "Could not apply reschedule: " . $e->getMessage()]);
                exit;
            }
        }

        $query = "UPDATE events SET status = :status";
        if ($approved_by_name && $status === 'approved') {
            $query .= ", approved_by_name = :approved_by_name";
        }
        $query .= " WHERE id = :id";
        
        $stmt = $conn->prepare($query);
        try {
            $params = [':status' => $status, ':id' => $event_id];
            if ($approved_by_name && $status === 'approved') {
                $params[':approved_by_name'] = $approved_by_name;
            }
            $stmt->execute($params);
            
            if ($status === 'rejected' && $event && !empty($event['reschedule_for_event_id'])) {
                $getOrig = $conn->prepare("SELECT event_date FROM events WHERE id = :orig_id");
                $getOrig->execute([':orig_id' => $event['reschedule_for_event_id']]);
                $origEvent = $getOrig->fetch(PDO::FETCH_ASSOC);
                if ($origEvent) {
                    $oldDate = $origEvent['event_date'];
                    $delAtt = $conn->prepare("DELETE FROM attendance WHERE user_id = :user_id AND date = :old_date AND status = 'Rescheduled'");
                    $delAtt->execute([':user_id' => $event['user_id'], ':old_date' => $oldDate]);
                }
            }

            $admin_id = isset($data->admin_id) ? $data->admin_id : 0; 
            logAction($conn, $admin_id, 'UPDATE_REQUEST', "Administrator updated the status of the calendar request (Event ID: {$event_id}) to: {$status}.");
            
            if ($event) {
                $notif_type = $status === 'approved' ? 'success' : 'error';
                $notif_message = "Your request \"{$event['title']}\" was {$status}.";
                $notif_stmt = $conn->prepare("INSERT INTO notifications (user_id, type, message) VALUES (:user_id, :type, :message)");
                $notif_stmt->execute([
                    ':user_id' => $event['user_id'],
                    ':type' => $notif_type,
                    ':message' => $notif_message
                ]);
            }
            
            echo json_encode(["status" => "success", "message" => "Event status updated"]);
        } catch(PDOException $e) {
            echo json_encode(["status" => "error", "message" => "Could not update event status"]);
        }
    }
}
elseif ($method === 'DELETE') {
    // Determine event ID and user ID from the request
    // It can come from URL parameters (e.g. ?id=1&user_id=1) since DELETE often uses query string,
    // or from body if sent as JSON. Let's support both.
    $event_id = isset($_GET['id']) ? $_GET['id'] : (is_object($data) && isset($data->id) ? $data->id : null);
    $user_id = isset($_GET['user_id']) ? $_GET['user_id'] : (is_object($data) && isset($data->user_id) ? $data->user_id : null);
    
    if (!$event_id || !$user_id) {
        echo json_encode(["status" => "error", "message" => "Missing parameters"]);
        exit;
    }

    if (strpos($event_id, 'leave_') === 0) {
        $parts = explode('_', $event_id);
        $leave_id = $parts[1];
        
        $query = "DELETE FROM leave_requests WHERE id = :id";
        $stmt = $conn->prepare($query);
        try {
            $stmt->execute([':id' => $leave_id]);
            logAction($conn, $user_id, 'CANCEL_LEAVE', "User deleted their leave request via calendar.");
            echo json_encode(["status" => "success", "message" => "Leave request deleted successfully via calendar"]);
        } catch(PDOException $e) {
            echo json_encode(["status" => "error", "message" => "Could not delete leave request via calendar"]);
        }
        exit;
    }
    
    $is_admin = isset($_GET['is_admin']) && $_GET['is_admin'] === 'true' || (is_object($data) && isset($data->is_admin) && $data->is_admin);
    
    if (!$is_admin) {
        if (!$user_id) {
            echo json_encode(["status" => "error", "message" => "Missing user parameter for non-admin"]);
            exit;
        }
        $stmt = $conn->prepare("SELECT status FROM events WHERE id = :id AND user_id = :user_id");
        $stmt->execute([':id' => $event_id, ':user_id' => $user_id]);
        $event = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$event) {
            echo json_encode(["status" => "error", "message" => "Event not found or unauthorized"]);
            exit;
        }
        

    }
    
    $fetchStmt = $conn->prepare("SELECT user_id, reschedule_for_event_id FROM events WHERE id = :id");
    $fetchStmt->execute([':id' => $event_id]);
    $delEvent = $fetchStmt->fetch(PDO::FETCH_ASSOC);

    $query = "DELETE FROM events WHERE id = :id";
    $stmt = $conn->prepare($query);
    try {
        $stmt->execute([':id' => $event_id]);

        if ($delEvent && !empty($delEvent['reschedule_for_event_id'])) {
            $getOrig = $conn->prepare("SELECT event_date FROM events WHERE id = :orig_id");
            $getOrig->execute([':orig_id' => $delEvent['reschedule_for_event_id']]);
            $origEvent = $getOrig->fetch(PDO::FETCH_ASSOC);
            if ($origEvent) {
                $oldDate = $origEvent['event_date'];
                $delAtt = $conn->prepare("DELETE FROM attendance WHERE user_id = :user_id AND date = :old_date AND status = 'Rescheduled'");
                $delAtt->execute([':user_id' => $delEvent['user_id'], ':old_date' => $oldDate]);
            }
        }

        logAction($conn, $user_id, 'CANCEL_REQUEST', "User cancelled and deleted their calendar request (Event ID: {$event_id}).");
        echo json_encode(["status" => "success", "message" => "Request cancelled successfully"]);
    } catch(PDOException $e) {
        echo json_encode(["status" => "error", "message" => "Could not cancel request"]);
    }
}
?>
