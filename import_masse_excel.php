<?php
declare(strict_types=1);

session_start();

$configPath = __DIR__ . '/import_masse_excel.config.php';
if (!file_exists($configPath)) {
    http_response_code(500);
    echo "Config introuvable. Copiez import_masse_excel.config.php.example vers import_masse_excel.config.php";
    exit;
}
$config = require $configPath;

$autoloadPath = __DIR__ . '/vendor/autoload.php';
if (!file_exists($autoloadPath)) {
    http_response_code(500);
    echo "Dependance manquante: PhpSpreadsheet. Lancez: composer require phpoffice/phpspreadsheet";
    exit;
}
require_once $autoloadPath;

use PhpOffice\PhpSpreadsheet\IOFactory;

function db(array $cfg): PDO
{
    $db = $cfg['db'];
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=%s',
        $db['host'],
        (int)$db['port'],
        $db['database'],
        $db['charset'] ?? 'utf8mb4'
    );
    return new PDO($dsn, $db['username'], $db['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
}

function normalize_key(string $s): string
{
    $s = function_exists('mb_strtolower') ? trim(mb_strtolower($s, 'UTF-8')) : trim(strtolower($s));
    $replacements = ['é' => 'e', 'è' => 'e', 'ê' => 'e', 'à' => 'a', 'ç' => 'c', 'ù' => 'u', 'ï' => 'i', 'î' => 'i', 'ô' => 'o'];
    $s = strtr($s, $replacements);
    $s = preg_replace('/[^a-z0-9]/', '', $s) ?? '';
    return $s;
}

function clean_phone($value): string
{
    if ($value === null) {
        return '';
    }
    $s = trim((string)$value);
    if ($s === '' || strtolower($s) === 'null' || strtolower($s) === 'undefined' || strtoupper($s) === 'N/A') {
        return '';
    }
    if (stripos($s, 'e+') !== false) {
        $num = (float)$s;
        if ($num > 0) {
            $s = number_format($num, 0, '', '');
        }
    }
    $digits = preg_replace('/\D+/', '', $s) ?? '';
    if ($digits === '') {
        return '';
    }
    if (strlen($digits) === 9) {
        $digits = '0' . $digits;
    }
    return $digits;
}

function parse_excel(string $filePath): array
{
    $spreadsheet = IOFactory::load($filePath);
    $sheet = $spreadsheet->getSheet(0);
    $rows = $sheet->toArray('', true, true, false);
    if (count($rows) === 0) {
        return [[], []];
    }
    $headers = array_map(static fn($h) => trim((string)$h), $rows[0]);
    $data = [];
    for ($i = 1; $i < count($rows); $i++) {
        $row = $rows[$i];
        $assoc = [];
        $hasValue = false;
        foreach ($headers as $idx => $header) {
            $key = $header !== '' ? $header : 'COL_' . ($idx + 1);
            $value = trim((string)($row[$idx] ?? ''));
            if ($value !== '') {
                $hasValue = true;
            }
            $assoc[$key] = $value;
        }
        if ($hasValue) {
            $data[] = $assoc;
        }
    }
    return [$headers, $data];
}

function first_matching_key(array $row, string $wanted): ?string
{
    $nw = normalize_key($wanted);
    foreach ($row as $k => $_) {
        if (normalize_key((string)$k) === $nw) {
            return (string)$k;
        }
    }
    return null;
}

function get_table_columns(PDO $pdo, string $tableName): array
{
    $sql = "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table
            ORDER BY ORDINAL_POSITION";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':table' => $tableName]);
    $rows = $stmt->fetchAll();
    $cols = [];
    foreach ($rows as $r) {
        $cols[$r['COLUMN_NAME']] = [
            'type' => strtolower((string)$r['DATA_TYPE']),
            'nullable' => ((string)$r['IS_NULLABLE']) === 'YES',
            'default' => $r['COLUMN_DEFAULT'],
        ];
    }
    return $cols;
}

$dbFields = [
    'nom', 'prenom', 'adresse', 'cp', 'ville', 'tel', 'gsm1', 'gsm2', 'email', 'commentaire'
];
$autoMapAliases = [
    'nom' => ['nom', 'lastname', 'last_name'],
    'prenom' => ['prenom', 'firstname', 'first_name'],
    'adresse' => ['adresse', 'address', 'address1'],
    'cp' => ['cp', 'codepostal', 'postalcode', 'zip'],
    'ville' => ['ville', 'city'],
    'tel' => ['tel', 'telephone', 'phone', 'mobile', 'portable'],
    'gsm1' => ['gsm1', 'gsm', 'mobile1', 'tel2', 'telephone2'],
    'gsm2' => ['gsm2', 'mobile2', 'tel3', 'telephone3'],
    'email' => ['email', 'mail'],
    'commentaire' => ['commentaire', 'comment', 'notes', 'note'],
];

$step = 'upload';
$message = '';
$preview = [];
$headers = [];
$result = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    try {
        if ($action === 'upload') {
            if (!isset($_FILES['excel']) || $_FILES['excel']['error'] !== UPLOAD_ERR_OK) {
                throw new RuntimeException('Fichier invalide.');
            }
            $tmpDir = __DIR__ . '/uploads';
            if (!is_dir($tmpDir)) {
                mkdir($tmpDir, 0775, true);
            }
            $ext = strtolower(pathinfo($_FILES['excel']['name'], PATHINFO_EXTENSION));
            if (!in_array($ext, ['xlsx', 'xls'], true)) {
                throw new RuntimeException('Le fichier doit etre .xlsx ou .xls');
            }
            $dest = $tmpDir . '/import_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
            if (!move_uploaded_file($_FILES['excel']['tmp_name'], $dest)) {
                throw new RuntimeException('Echec upload fichier.');
            }

            [$headers, $rows] = parse_excel($dest);
            if (count($rows) === 0) {
                throw new RuntimeException('Aucune ligne exploitable dans le fichier.');
            }

            $_SESSION['import_file'] = $dest;
            $_SESSION['import_headers'] = $headers;
            $_SESSION['import_preview'] = array_slice($rows, 0, 10);
            $step = 'mapping';
            $preview = $_SESSION['import_preview'];
            $message = count($rows) . " lignes detectees.";
        } elseif ($action === 'import') {
            $filePath = $_SESSION['import_file'] ?? null;
            if (!$filePath || !file_exists($filePath)) {
                throw new RuntimeException('Session import expiree. Rechargez le fichier.');
            }

            $mapping = $_POST['map'] ?? [];
            $nomCentre = trim((string)($_POST['nom_centre'] ?? ''));
            $produit = (int)($_POST['produit'] ?? 0);
            if ($nomCentre === '' || $produit <= 0) {
                throw new RuntimeException('nom_centre et produit sont obligatoires.');
            }

            [$headers, $rows] = parse_excel($filePath);
            $pdo = db($config);
            $tableCols = get_table_columns($pdo, 'yj_fiche');
            if (empty($tableCols)) {
                throw new RuntimeException('Table yj_fiche introuvable.');
            }

            $existingPhones = [];
            $stmtPhones = $pdo->query("SELECT id, nom, prenom, tel, gsm1, gsm2, etat_final, date_insertion
                                       FROM yj_fiche
                                       WHERE archive = 0
                                         AND ((tel IS NOT NULL AND tel != '')
                                           OR (gsm1 IS NOT NULL AND gsm1 != '')
                                           OR (gsm2 IS NOT NULL AND gsm2 != ''))");
            foreach ($stmtPhones as $f) {
                foreach (['tel', 'gsm1', 'gsm2'] as $k) {
                    $p = clean_phone($f[$k] ?? '');
                    if ($p !== '') {
                        $existingPhones[$p] = $f;
                    }
                }
            }

            $inserted = 0;
            $duplicates = 0;
            $errors = 0;
            $notInserted = [];

            $pdo->beginTransaction();
            foreach ($rows as $row) {
                try {
                    $fiche = ['nom' => '', 'prenom' => '', 'adresse' => '', 'cp' => '', 'ville' => '', 'tel' => '', 'gsm1' => '', 'gsm2' => '', 'email' => '', 'commentaire' => ''];
                    foreach ($dbFields as $field) {
                        $column = trim((string)($mapping[$field] ?? ''));
                        if ($column === '') {
                            continue;
                        }
                        $realKey = first_matching_key($row, $column);
                        $value = (string)($realKey !== null ? ($row[$realKey] ?? '') : '');
                        $fiche[$field] = trim($value);
                    }

                    $fiche['tel'] = clean_phone($fiche['tel']);
                    $fiche['gsm1'] = clean_phone($fiche['gsm1']);
                    $fiche['gsm2'] = clean_phone($fiche['gsm2']);

                    if ($fiche['cp'] !== '') {
                        $cpDigits = preg_replace('/\D+/', '', $fiche['cp']) ?? '';
                        if (strlen($cpDigits) === 4) {
                            $cpDigits = '0' . $cpDigits;
                        }
                        if ($cpDigits !== '' && strlen($cpDigits) !== 5) {
                            throw new RuntimeException('Code postal invalide');
                        }
                        $fiche['cp'] = $cpDigits;
                    }

                    if ($fiche['tel'] === '' && $fiche['gsm1'] === '' && $fiche['gsm2'] === '') {
                        throw new RuntimeException('Aucun telephone (tel/gsm1/gsm2)');
                    }

                    $dupPhone = '';
                    foreach ([$fiche['tel'], $fiche['gsm1'], $fiche['gsm2']] as $p) {
                        if ($p !== '' && isset($existingPhones[$p])) {
                            $dupPhone = $p;
                            break;
                        }
                    }
                    if ($dupPhone !== '') {
                        $duplicates++;
                        $existing = $existingPhones[$dupPhone];
                        $notInserted[] = [
                            'nom' => $fiche['nom'],
                            'prenom' => $fiche['prenom'],
                            'tel' => $dupPhone,
                            'raison' => 'Fiche existante archive=0',
                            'etat_actuel' => $existing['etat_final'] ?? '',
                            'date_insertion_existante' => $existing['date_insertion'] ?? '',
                        ];
                        continue;
                    }

                    $nowTime = date('Y-m-d H:i:s');
                    $insertData = [];
                    foreach ($tableCols as $colName => $meta) {
                        if ($colName === 'id') {
                            continue;
                        }
                        if ($colName === 'nom') { $insertData[$colName] = $fiche['nom']; continue; }
                        if ($colName === 'prenom') { $insertData[$colName] = $fiche['prenom']; continue; }
                        if ($colName === 'Adresse') { $insertData[$colName] = $fiche['adresse']; continue; }
                        if ($colName === 'cp') { $insertData[$colName] = $fiche['cp']; continue; }
                        if ($colName === 'ville') { $insertData[$colName] = $fiche['ville']; continue; }
                        if ($colName === 'tel') { $insertData[$colName] = $fiche['tel']; continue; }
                        if ($colName === 'gsm1') { $insertData[$colName] = $fiche['gsm1']; continue; }
                        if ($colName === 'gsm2') { $insertData[$colName] = $fiche['gsm2']; continue; }
                        if ($colName === 'commentaire') { $insertData[$colName] = $fiche['commentaire']; continue; }
                        if ($colName === 'nom_agent') { $insertData[$colName] = 'AG001'; continue; }
                        if ($colName === 'nom_centre') { $insertData[$colName] = $nomCentre; continue; }
                        if ($colName === 'conf_produit') { $insertData[$colName] = (string)$produit; continue; }
                        if ($colName === 'archive') { $insertData[$colName] = 0; continue; }
                        if ($colName === 'date_insertion') { $insertData[$colName] = $nowTime; continue; }
                        if ($colName === 'etat_final') { $insertData[$colName] = 'EN-ATTENTE'; continue; }

                        if ($meta['default'] !== null) {
                            $insertData[$colName] = $meta['default'];
                            continue;
                        }
                        if ($meta['nullable']) {
                            $insertData[$colName] = null;
                            continue;
                        }
                        $type = $meta['type'];
                        if (in_array($type, ['int', 'integer', 'bigint', 'smallint', 'tinyint', 'mediumint', 'decimal', 'float', 'double'], true)) {
                            $insertData[$colName] = 0;
                        } elseif (in_array($type, ['datetime', 'timestamp'], true)) {
                            $insertData[$colName] = $nowTime;
                        } elseif ($type === 'date') {
                            $insertData[$colName] = date('Y-m-d');
                        } else {
                            $insertData[$colName] = '';
                        }
                    }

                    $cols = array_keys($insertData);
                    $placeholders = array_map(static fn($c) => ':' . $c, $cols);
                    $insertSql = "INSERT INTO yj_fiche (`" . implode('`,`', $cols) . "`) VALUES (" . implode(',', $placeholders) . ")";
                    $stmtInsert = $pdo->prepare($insertSql);
                    $stmtInsert->execute(array_combine($placeholders, array_values($insertData)));

                    foreach ([$fiche['tel'], $fiche['gsm1'], $fiche['gsm2']] as $p) {
                        if ($p !== '') {
                            $existingPhones[$p] = ['etat_final' => 'EN-ATTENTE', 'date_insertion' => $nowTime];
                        }
                    }
                    $inserted++;
                } catch (Throwable $e) {
                    $errors++;
                    $notInserted[] = [
                        'nom' => $row[$mapping['nom'] ?? ''] ?? '',
                        'prenom' => $row[$mapping['prenom'] ?? ''] ?? '',
                        'tel' => $row[$mapping['tel'] ?? ''] ?? ($row[$mapping['gsm1'] ?? ''] ?? ''),
                        'raison' => $e->getMessage(),
                    ];
                }
            }

            $pdo->commit();
            $result = [
                'total' => count($rows),
                'inserted' => $inserted,
                'duplicates' => $duplicates,
                'errors' => $errors,
                'notInserted' => $notInserted,
            ];
            $step = 'done';
        }
    } catch (Throwable $e) {
        $message = 'Erreur: ' . $e->getMessage();
    }
}

$sessionHeaders = $_SESSION['import_headers'] ?? [];
$sessionPreview = $_SESSION['import_preview'] ?? [];
if ($step === 'upload' && !empty($sessionHeaders) && !empty($sessionPreview)) {
    $step = 'mapping';
    $headers = $sessionHeaders;
    $preview = $sessionPreview;
} else {
    $headers = $headers ?: $sessionHeaders;
    $preview = $preview ?: $sessionPreview;
}

function selected($a, $b): string { return ((string)$a === (string)$b) ? 'selected' : ''; }
?>
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Import en masse Excel (PHP)</title>
  <style>
    body{font-family:Arial,sans-serif;background:#f6f7fb;margin:0;padding:24px}
    .box{background:#fff;border:1px solid #ddd;border-radius:8px;padding:16px;margin-bottom:16px}
    h1{margin-top:0}
    table{border-collapse:collapse;width:100%}
    th,td{border:1px solid #ddd;padding:6px;font-size:13px}
    .row{display:flex;gap:12px;flex-wrap:wrap}
    .col{flex:1;min-width:180px}
    label{display:block;margin-bottom:6px;font-weight:600}
    input,select,button{width:100%;padding:8px;box-sizing:border-box}
    .btn{background:#0f62fe;color:#fff;border:0;border-radius:6px;cursor:pointer}
    .alert{padding:10px;border-radius:6px;background:#fff3cd;border:1px solid #ffecb5}
  </style>
</head>
<body>
  <h1>Import en masse Excel (PHP)</h1>
  <?php if ($message !== ''): ?><div class="alert"><?php echo htmlspecialchars($message); ?></div><?php endif; ?>

  <?php if ($step === 'upload'): ?>
    <div class="box">
      <form method="post" enctype="multipart/form-data">
        <input type="hidden" name="action" value="upload">
        <label>Fichier Excel (.xlsx/.xls)</label>
        <input type="file" name="excel" accept=".xlsx,.xls" required>
        <br><br>
        <button class="btn" type="submit">Charger et previsualiser</button>
      </form>
    </div>
  <?php endif; ?>

  <?php if ($step === 'mapping'): ?>
    <div class="box">
      <h3>Mapping colonnes</h3>
      <form method="post">
        <input type="hidden" name="action" value="import">
        <div class="row">
          <div class="col"><label>nom_centre</label><input type="text" name="nom_centre" required></div>
          <div class="col"><label>produit (id)</label><input type="number" name="produit" required></div>
        </div>
        <br>
        <div class="row">
          <?php foreach ($dbFields as $field): ?>
            <?php
              $default = '';
              foreach ($headers as $h) {
                  foreach (($autoMapAliases[$field] ?? [$field]) as $alias) {
                      if (normalize_key($h) === normalize_key($alias)) {
                          $default = $h;
                          break 2;
                      }
                  }
              }
            ?>
            <div class="col">
              <label><?php echo htmlspecialchars($field); ?></label>
              <select name="map[<?php echo htmlspecialchars($field); ?>]">
                <option value="">-- non mappe --</option>
                <?php foreach ($headers as $h): ?>
                  <option value="<?php echo htmlspecialchars($h); ?>" <?php echo selected($default, $h); ?>><?php echo htmlspecialchars($h); ?></option>
                <?php endforeach; ?>
              </select>
            </div>
          <?php endforeach; ?>
        </div>
        <br>
        <br>
        <button class="btn" type="submit">Importer</button>
      </form>
    </div>

    <div class="box">
      <h3>Previsualisation (10 premieres lignes)</h3>
      <table>
        <thead><tr><?php foreach ($headers as $h): ?><th><?php echo htmlspecialchars((string)$h); ?></th><?php endforeach; ?></tr></thead>
        <tbody>
          <?php foreach ($preview as $r): ?>
            <tr><?php foreach ($headers as $h): ?><td><?php echo htmlspecialchars((string)($r[$h] ?? '')); ?></td><?php endforeach; ?></tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  <?php endif; ?>

  <?php if ($step === 'done' && is_array($result)): ?>
    <div class="box">
      <h3>Resultat import</h3>
      <p>Total: <?php echo (int)$result['total']; ?> | Inseres: <?php echo (int)$result['inserted']; ?> | Doublons: <?php echo (int)$result['duplicates']; ?> | Erreurs: <?php echo (int)$result['errors']; ?></p>
      <?php if (!empty($result['notInserted'])): ?>
        <table>
          <thead><tr><th>Nom</th><th>Prenom</th><th>Tel</th><th>Raison</th><th>Etat actuel</th><th>Date insertion existante</th></tr></thead>
          <tbody>
          <?php foreach ($result['notInserted'] as $ni): ?>
            <tr>
              <td><?php echo htmlspecialchars((string)($ni['nom'] ?? '')); ?></td>
              <td><?php echo htmlspecialchars((string)($ni['prenom'] ?? '')); ?></td>
              <td><?php echo htmlspecialchars((string)($ni['tel'] ?? '')); ?></td>
              <td><?php echo htmlspecialchars((string)($ni['raison'] ?? '')); ?></td>
              <td><?php echo htmlspecialchars((string)($ni['etat_actuel'] ?? '')); ?></td>
              <td><?php echo htmlspecialchars((string)($ni['date_insertion_existante'] ?? '')); ?></td>
            </tr>
          <?php endforeach; ?>
          </tbody>
        </table>
      <?php endif; ?>
    </div>
  <?php endif; ?>
</body>
</html>

