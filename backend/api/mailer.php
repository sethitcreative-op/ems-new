<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json");

// Always return JSON — catch fatal errors before they produce HTML
set_exception_handler(function($e) {
    echo json_encode(["status" => "error", "message" => "Server error: " . $e->getMessage()]);
    exit;
});

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Require PHPMailer (Manual Installation)
require 'PHPMailer/Exception.php';
require 'PHPMailer/PHPMailer.php';
require 'PHPMailer/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// ─────────────────────────────────────────────────────────────────────────────
// SENDER CREDENTIALS
// For Hostinger domain emails → uses smtp.hostinger.com automatically.
// For @gmail.com accounts    → uses smtp.gmail.com + an App Password.
// ─────────────────────────────────────────────────────────────────────────────
$senderCredentials = [
    // Hostinger domain emails — use the actual email login password
    'seth.itcreative@impactproph.com'    => 'crty ovbj jlet rcyj',
    'harvey.itcreative@impactproph.com'  => 'crty ovbj jlet rcyj',

    // Gmail accounts — use a Google App Password (not your regular password)
    // 'hr@gmail.com'      => 'xxxx xxxx xxxx xxxx',
    // 'payroll@gmail.com' => 'xxxx xxxx xxxx xxxx',
];

// ─────────────────────────────────────────────────────────────────────────────
// Resolve SMTP settings based on the sender email domain
// ─────────────────────────────────────────────────────────────────────────────
function getSmtpSettings(string $email): array {
    $domain = strtolower(substr($email, strpos($email, '@') + 1));

    if ($domain === 'gmail.com') {
        return [
            'host'       => 'smtp.gmail.com',
            'port'       => 465,
            'encryption' => PHPMailer::ENCRYPTION_SMTPS,
        ];
    }

    // Default: Hostinger SMTP for all custom domain emails
    return [
        'host'       => 'smtp.hostinger.com',
        'port'       => 465,
        'encryption' => PHPMailer::ENCRYPTION_SMTPS,
    ];
}

// ─────────────────────────────────────────────────────────────────────────────
// GET — return list of configured sender emails for the frontend dropdown
// ─────────────────────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $emails = array_keys($senderCredentials);
    echo json_encode(["status" => "success", "emails" => $emails]);
    exit;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — send the email
// ─────────────────────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $from_email = trim($_POST['from_email'] ?? '');
    $recipient  = trim($_POST['recipient']  ?? '');
    $subject    = trim($_POST['subject']    ?? '');
    $message    = trim($_POST['message']    ?? '');

    // Validate required fields
    if (empty($recipient) || empty($subject) || empty($message) || empty($from_email)) {
        echo json_encode(["status" => "error", "message" => "All fields (from, to, subject, message) are required."]);
        exit;
    }

    // Validate sender is configured
    if (!array_key_exists($from_email, $senderCredentials)) {
        echo json_encode(["status" => "error", "message" => "Sender '{$from_email}' is not configured in the system."]);
        exit;
    }

    $senderPassword = $senderCredentials[$from_email];
    $smtpSettings   = getSmtpSettings($from_email);

    // Handle optional file attachment
    $hasAttachment  = false;
    $fileTmpPath    = '';
    $attachmentName = '';

    if (isset($_FILES['attachment']) && $_FILES['attachment']['error'] === UPLOAD_ERR_OK) {
        $fileTmpPath = $_FILES['attachment']['tmp_name'];
        $fileName    = $_FILES['attachment']['name'];
        $fileType    = $_FILES['attachment']['type'];

        $allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif'];
        if (!in_array($fileType, $allowedTypes)) {
            echo json_encode(["status" => "error", "message" => "Invalid file type. Only PDF and images are allowed."]);
            exit;
        }

        $hasAttachment  = true;
        $attachmentName = $fileName;
    }

    // ── Send via PHPMailer ────────────────────────────────────────────────────
    $mail = new PHPMailer(true);

    try {
        // SMTP configuration (auto-resolved by email domain)
        $mail->isSMTP();
        $mail->Host       = $smtpSettings['host'];
        $mail->SMTPAuth   = true;
        $mail->Username   = $from_email;
        $mail->Password   = $senderPassword;
        $mail->SMTPSecure = $smtpSettings['encryption'];
        $mail->Port       = $smtpSettings['port'];

        // Optional: disable SSL cert verification for shared hosting environments
        $mail->SMTPOptions = [
            'ssl' => [
                'verify_peer'       => false,
                'verify_peer_name'  => false,
                'allow_self_signed' => true,
            ],
        ];

        // Recipients
        $mail->setFrom($from_email, 'EMS WorkTrack');
        $mail->addAddress($recipient);

        // Attachment
        if ($hasAttachment) {
            $mail->addAttachment($fileTmpPath, $attachmentName);
        }

        // Content
        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body    = $message; // Already HTML from the rich-text editor
        $mail->AltBody = strip_tags($message);

        $mail->send();

        echo json_encode([
            "status"  => "success",
            "message" => "Email sent successfully.",
            "details" => [
                "from"            => $from_email,
                "to"              => $recipient,
                "subject"         => $subject,
                "smtp_host"       => $smtpSettings['host'],
                "has_attachment"  => $hasAttachment,
                "attachment_name" => $attachmentName,
            ],
        ]);

    } catch (Exception $e) {
        echo json_encode([
            "status"  => "error",
            "message" => "Could not send email. SMTP Error: " . $mail->ErrorInfo,
        ]);
    }

} else {
    echo json_encode(["status" => "error", "message" => "Invalid request method."]);
}
?>
