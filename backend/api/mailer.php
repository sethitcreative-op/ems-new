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

// Require PHPMailer (Manual Installation from GitHub)
// require '../vendor/autoload.php'; // (Commented out Composer)

require 'PHPMailer/Exception.php';
require 'PHPMailer/PHPMailer.php';
require 'PHPMailer/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// Configure your different sender accounts and their corresponding Google App Passwords here
$senderCredentials = [
    'seth.itcreative@impactproph.com' => 'crty ovbj jlet rcyj',
    'hr@gmail.com' => 'your-hr-password',
    'payroll@gmail.com' => 'your-payroll-password',
    // Add more mapping if needed. For Hostinger, these should preferably be your actual domain emails 
    // e.g., 'admin@yourdomain.com' => 'password'
];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Return only the email addresses for the frontend dropdown
    $emails = array_keys($senderCredentials);
    echo json_encode(["status" => "success", "emails" => $emails]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $from_email = $_POST['from_email'] ?? '';
    $recipient = $_POST['recipient'] ?? '';
    $subject = $_POST['subject'] ?? '';
    $message = $_POST['message'] ?? '';

    if (empty($recipient) || empty($subject) || empty($message) || empty($from_email)) {
        echo json_encode(["status" => "error", "message" => "All fields including from_email are required."]);
        exit;
    }

    // Check if the requested sender exists in our configuration
    if (!array_key_exists($from_email, $senderCredentials)) {
        echo json_encode(["status" => "error", "message" => "Invalid sender account selected."]);
        exit;
    }

    $senderPassword = $senderCredentials[$from_email];

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

    // Configure PHPMailer to send the email using Gmail SMTP (since you are using @gmail.com accounts).
    $mail = new PHPMailer(true);

    try {
        // Server settings
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';                 // Gmail SMTP server
        $mail->SMTPAuth   = true;
        $mail->Username   = $from_email;                      // Dynamically set Username (e.g. hr@gmail.com)
        $mail->Password   = $senderPassword;                  // Dynamically set App Password
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;      // Enable implicit TLS encryption
        $mail->Port       = 465;                              // TCP port to connect to

        // Recipients
        $mail->setFrom($from_email, 'EMS System');            // Dynamically set From Address
        $mail->addAddress($recipient);                        // Add a recipient

        // Attachments
        if ($hasAttachment) {
            $mail->addAttachment($fileTmpPath, $attachmentName);
        }

        // Content
        $mail->isHTML(true);                                  // Set email format to HTML
        $mail->Subject = $subject;
        $mail->Body    = nl2br(htmlspecialchars($message));
        $mail->AltBody = $message;

        $mail->send();
        
        echo json_encode([
            "status" => "success", 
            "message" => "Email has been sent successfully.",
            "details" => [
                "to" => $recipient,
                "subject" => $subject,
                "has_attachment" => $hasAttachment,
                "attachment_name" => $attachmentName
            ]
        ]);
    } catch (Exception $e) {
        echo json_encode([
            "status" => "error", 
            "message" => "Message could not be sent. Mailer Error: {$mail->ErrorInfo}"
        ]);
    }

} else {
    echo json_encode(["status" => "error", "message" => "Invalid request method."]);
}
?>
