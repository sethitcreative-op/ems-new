<?php
require_once '../config/cors.php';
require_once '../config/database.php';
require_once '../config/logger.php';

$data = json_decode(file_get_contents("php://input"));
$method = $_SERVER['REQUEST_METHOD'];

/**
 * Compute the observed date for a holiday.
 * If it falls on Saturday, observed on Friday.
 * If it falls on Sunday, observed on Monday.
 */
function getObservedDate(DateTime $date) {
    $dow = (int) $date->format('w'); // 0=Sun, 6=Sat
    $observed = clone $date;
    $isObserved = false;
    if ($dow === 6) { // Saturday -> Friday
        $observed->modify('-1 day');
        $isObserved = true;
    } elseif ($dow === 0) { // Sunday -> Monday
        $observed->modify('+1 day');
        $isObserved = true;
    }
    return ['date' => $observed, 'is_observed' => $isObserved];
}

/**
 * Generate all 11 US Federal Holidays for a given year.
 */
function generateUSHolidays($year) {
    $holidays = [];

    // 1. New Year's Day - January 1
    $d = new DateTime("$year-01-01");
    $obs = getObservedDate($d);
    $holidays[] = ['name' => "New Year's Day", 'date' => $obs['date']->format('Y-m-d'), 'is_observed' => $obs['is_observed']];

    // 2. Martin Luther King Jr. Day - 3rd Monday of January
    $d = new DateTime("third monday of january $year");
    $holidays[] = ['name' => 'Martin Luther King Jr. Day', 'date' => $d->format('Y-m-d'), 'is_observed' => false];

    // 3. Presidents' Day - 3rd Monday of February
    $d = new DateTime("third monday of february $year");
    $holidays[] = ['name' => "Presidents' Day", 'date' => $d->format('Y-m-d'), 'is_observed' => false];

    // 4. Memorial Day - Last Monday of May
    $d = new DateTime("last monday of may $year");
    $holidays[] = ['name' => 'Memorial Day', 'date' => $d->format('Y-m-d'), 'is_observed' => false];

    // 5. Juneteenth - June 19
    $d = new DateTime("$year-06-19");
    $obs = getObservedDate($d);
    $holidays[] = ['name' => 'Juneteenth', 'date' => $obs['date']->format('Y-m-d'), 'is_observed' => $obs['is_observed']];

    // 6. Independence Day - July 4
    $d = new DateTime("$year-07-04");
    $obs = getObservedDate($d);
    $holidays[] = ['name' => 'Independence Day', 'date' => $obs['date']->format('Y-m-d'), 'is_observed' => $obs['is_observed']];

    // 7. Labor Day - 1st Monday of September
    $d = new DateTime("first monday of september $year");
    $holidays[] = ['name' => 'Labor Day', 'date' => $d->format('Y-m-d'), 'is_observed' => false];

    // 8. Columbus Day - 2nd Monday of October
    $d = new DateTime("second monday of october $year");
    $holidays[] = ['name' => 'Columbus Day', 'date' => $d->format('Y-m-d'), 'is_observed' => false];

    // 9. Veterans Day - November 11
    $d = new DateTime("$year-11-11");
    $obs = getObservedDate($d);
    $holidays[] = ['name' => 'Veterans Day', 'date' => $obs['date']->format('Y-m-d'), 'is_observed' => $obs['is_observed']];

    // 10. Thanksgiving - 4th Thursday of November
    $d = new DateTime("fourth thursday of november $year");
    $holidays[] = ['name' => 'Thanksgiving', 'date' => $d->format('Y-m-d'), 'is_observed' => false];

    // 11. Christmas Day - December 25
    $d = new DateTime("$year-12-25");
    $obs = getObservedDate($d);
    $holidays[] = ['name' => 'Christmas Day', 'date' => $obs['date']->format('Y-m-d'), 'is_observed' => $obs['is_observed']];

    return $holidays;
}

// =====================================================================
// GET - Fetch holidays (optional ?year=XXXX filter, or ?check_year=XXXX)
// =====================================================================
if ($method === 'GET') {
    // check_year: returns just a count (used for auto-seed check)
    if (isset($_GET['check_year'])) {
        $year = (int) $_GET['check_year'];
        $stmt = $conn->prepare("SELECT COUNT(*) as cnt FROM holidays WHERE year = :year");
        $stmt->execute([':year' => $year]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        echo json_encode(["status" => "success", "count" => (int)$row['cnt']]);
        exit;
    }

    $query = "SELECT * FROM holidays";
    $params = [];

    if (isset($_GET['year'])) {
        $query .= " WHERE year = :year";
        $params[':year'] = (int) $_GET['year'];
    }

    $query .= " ORDER BY holiday_date ASC";

    $stmt = $conn->prepare($query);
    $stmt->execute($params);
    $holidays = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(["status" => "success", "data" => $holidays]);
}

// =====================================================================
// POST - Seed holidays for a year OR add a custom holiday
// =====================================================================
elseif ($method === 'POST') {
    $action = $data->action ?? '';

    if ($action === 'seed') {
        // Auto-seed all US federal holidays for a given year
        $year = (int) ($data->year ?? date('Y'));

        $holidays = generateUSHolidays($year);
        $inserted = 0;
        $skipped = 0;

        $stmt = $conn->prepare(
            "INSERT INTO holidays (name, holiday_date, year, is_observed) VALUES (:name, :holiday_date, :year, :is_observed)
             ON DUPLICATE KEY UPDATE holiday_date = VALUES(holiday_date), is_observed = VALUES(is_observed)"
        );

        foreach ($holidays as $h) {
            try {
                $stmt->execute([
                    ':name' => $h['name'],
                    ':holiday_date' => $h['date'],
                    ':year' => $year,
                    ':is_observed' => $h['is_observed'] ? 1 : 0
                ]);
                if ($stmt->rowCount() > 0) {
                    $inserted++;
                } else {
                    $skipped++;
                }
            } catch (PDOException $e) {
                $skipped++;
            }
        }

        echo json_encode([
            "status" => "success",
            "message" => "Seeded {$inserted} holidays for {$year}. {$skipped} already existed.",
            "inserted" => $inserted,
            "skipped" => $skipped
        ]);
    } else {
        // Add a custom holiday
        $name = $data->name ?? '';
        $holiday_date = $data->holiday_date ?? '';

        if (!$name || !$holiday_date) {
            echo json_encode(["status" => "error", "message" => "Name and date are required"]);
            exit;
        }

        $year = (int) date('Y', strtotime($holiday_date));

        $stmt = $conn->prepare(
            "INSERT INTO holidays (name, holiday_date, year, is_observed) VALUES (:name, :holiday_date, :year, 0)"
        );
        try {
            $stmt->execute([
                ':name' => $name,
                ':holiday_date' => $holiday_date,
                ':year' => $year
            ]);
            echo json_encode(["status" => "success", "message" => "Holiday '{$name}' added successfully"]);
        } catch (PDOException $e) {
            echo json_encode(["status" => "error", "message" => "Could not add holiday: " . $e->getMessage()]);
        }
    }
}

// =====================================================================
// PUT - Edit an existing holiday
// =====================================================================
elseif ($method === 'PUT') {
    $id = $data->id ?? 0;
    $name = $data->name ?? '';
    $holiday_date = $data->holiday_date ?? '';

    if (!$id || !$name || !$holiday_date) {
        echo json_encode(["status" => "error", "message" => "ID, name, and date are required"]);
        exit;
    }

    $year = (int) date('Y', strtotime($holiday_date));

    $stmt = $conn->prepare(
        "UPDATE holidays SET name = :name, holiday_date = :holiday_date, year = :year WHERE id = :id"
    );
    try {
        $stmt->execute([
            ':name' => $name,
            ':holiday_date' => $holiday_date,
            ':year' => $year,
            ':id' => $id
        ]);
        echo json_encode(["status" => "success", "message" => "Holiday updated successfully"]);
    } catch (PDOException $e) {
        echo json_encode(["status" => "error", "message" => "Could not update holiday: " . $e->getMessage()]);
    }
}

// =====================================================================
// DELETE - Remove a holiday
// =====================================================================
elseif ($method === 'DELETE') {
    $id = isset($_GET['id']) ? (int) $_GET['id'] : (is_object($data) && isset($data->id) ? (int) $data->id : 0);

    if (!$id) {
        echo json_encode(["status" => "error", "message" => "Holiday ID is required"]);
        exit;
    }

    $stmt = $conn->prepare("DELETE FROM holidays WHERE id = :id");
    try {
        $stmt->execute([':id' => $id]);
        echo json_encode(["status" => "success", "message" => "Holiday deleted successfully"]);
    } catch (PDOException $e) {
        echo json_encode(["status" => "error", "message" => "Could not delete holiday: " . $e->getMessage()]);
    }
}
?>
