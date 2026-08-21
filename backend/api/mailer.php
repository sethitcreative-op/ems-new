<?php
// send_email.php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// In a real application, you would require PHPMailer here.
// require '../vendor/autoload.php';
// use PHPMailer\PHPMailer\PHPMailer;
// use PHPMailer\PHPMailer\Exception;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $recipient = $_POST['recipient'] ?? '';
    $subject = $_POST['subject'] ?? '';
    $message = $_POST['message'] ?? '';

    if (empty($recipient) || empty($subject) || empty($message)) {
        echo json_encode(["status" => "error", "message" => "All fields are required."]);
        exit;
    }

    $hasAttachment = false;
    $attachmentName = '';

    // Handle File Uploads (Attachments)
    if (isset($_FILES['attachment']) && $_FILES['attachment']['error'] === UPLOAD_ERR_OK) {
        $fileTmpPath = $_FILES['attachment']['tmp_name'];
        $fileName = $_FILES['attachment']['name'];
        $fileType = $_FILES['attachment']['type'];

        // Allow only specific types (PDF, Images)
        $allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif'];
        if (in_array($fileType, $allowedTypes)) {
            $hasAttachment = true;
            $attachmentName = $fileName;
        } else {
            echo json_encode(["status" => "error", "message" => "Invalid file type. Only PDF and images are allowed."]);
            exit;
        }
    }

    // TODO: Configure PHPMailer to send the actual email using Hostinger SMTP.
    // For now, this is a placeholder that simulates a successful email send
    // so the frontend functions correctly during testing.

    // Simulate success response
    echo json_encode([
        "status" => "success", 
        "message" => "Email successfully scheduled for sending.",
        "details" => [
            "to" => $recipient,
            "subject" => $subject,
            "has_attachment" => $hasAttachment,
            "attachment_name" => $attachmentName
        ]
    ]);

} else {
    echo json_encode(["status" => "error", "message" => "Invalid request method."]);
}
?>
