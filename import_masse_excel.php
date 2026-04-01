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

$phpCfg = $config['php'] ?? [];
if (!empty($phpCfg['memory_limit'])) {
    @ini_set('memory_limit', (string)$phpCfg['memory_limit']);
}
if (isset($phpCfg['max_execution_time'])) {
    @ini_set('max_execution_time', (string)$phpCfg['max_execution_time']);
}

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
    $reader = IOFactory::createReaderForFile($filePath);
    if (method_exists($reader, 'setReadDataOnly')) {
        $reader->setReadDataOnly(true);
    }
    if (method_exists($reader, 'setReadEmptyCells')) {
        $reader->setReadEmptyCells(false);
    }
    $spreadsheet = $reader->load($filePath);
    $sheet = $spreadsheet->getSheet(0);
    $rows = $sheet->toArray('', true, true, false);
    if (method_exists($spreadsheet, 'disconnectWorksheets')) {
        $spreadsheet->disconnectWorksheets();
    }
    unset($spreadsheet, $reader);
    if (function_exists('gc_collect_cycles')) {
        gc_collect_cycles();
    }

    if (count($rows) === 0) {
        return [[], []];
    }
    $headers = array_map(static function ($h) {
        return trim((string)$h);
    }, $rows[0]);
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
    unset($rows);
    if (function_exists('gc_collect_cycles')) {
        gc_collect_cycles();
    }
    return [$headers, $data];
}

/**
 * Doublon yj_fiche archive=0 : un numero importe correspond a tel/gsm1/gsm2 en base (comparaison exacte apres clean_phone cote import).
 * Les numeros en base doivent etre stockes au meme format (chiffres, ex. 0612345678) pour que le mode sql soit fiable.
 */
function find_existing_yj_fiche_by_phones(PDO $pdo, string $tel, string $gsm1, string $gsm2): ?array
{
    $nums = array_values(array_unique(array_filter([$tel, $gsm1, $gsm2], static function ($v) {
        return $v !== '';
    })));
    if ($nums === []) {
        return null;
    }
    $parts = [];
    $params = [];
    foreach ($nums as $n) {
        $parts[] = '(tel = ? OR gsm1 = ? OR gsm2 = ?)';
        $params[] = $n;
        $params[] = $n;
        $params[] = $n;
    }
    $sql = 'SELECT id, nom_centre, etat_final, date_insertion FROM yj_fiche WHERE archive = 0 AND (' . implode(' OR ', $parts) . ') LIMIT 1';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch();
    return $row === false ? null : $row;
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

function get_mapped_cell_value(array $row, string $excelColumn): string
{
    if ($excelColumn === '') {
        return '';
    }
    $realKey = first_matching_key($row, $excelColumn);
    if ($realKey !== null) {
        return trim((string)($row[$realKey] ?? ''));
    }
    return trim((string)($row[$excelColumn] ?? ''));
}

function coerce_for_yj_column($value, array $meta)
{
    $t = $meta['type'];
    if (in_array($t, ['int', 'integer', 'bigint', 'smallint', 'tinyint', 'mediumint'], true)) {
        return (int)$value;
    }
    if (in_array($t, ['decimal', 'float', 'double'], true)) {
        return $value === '' ? 0 : 0 + (float)$value;
    }
    return (string)$value;
}

function normalize_excel_datetime($value): string
{
    $s = trim((string)$value);
    if ($s === '') {
        return '';
    }

    // Excel serial date/time value (e.g. 45259.5)
    if (is_numeric($s)) {
        $serial = (float)$s;
        if ($serial > 0) {
            $unix = (int)round(($serial - 25569) * 86400);
            if ($unix > 0) {
                return gmdate('Y-m-d H:i:s', $unix);
            }
        }
    }

    $s = str_replace('T', ' ', $s);
    $s = preg_replace('/\s+/', ' ', $s) ?? $s;

    // dd/mm/yyyy [hh:mm[:ss]]
    if (preg_match('/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/', $s, $m)) {
        $h = isset($m[4]) ? (int)$m[4] : 0;
        $i = isset($m[5]) ? (int)$m[5] : 0;
        $sec = isset($m[6]) ? (int)$m[6] : 0;
        return sprintf('%04d-%02d-%02d %02d:%02d:%02d', (int)$m[3], (int)$m[2], (int)$m[1], $h, $i, $sec);
    }

    // yyyy-mm-dd [hh:mm[:ss]]
    if (preg_match('/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/', $s, $m)) {
        $h = isset($m[4]) ? (int)$m[4] : 0;
        $i = isset($m[5]) ? (int)$m[5] : 0;
        $sec = isset($m[6]) ? (int)$m[6] : 0;
        return sprintf('%04d-%02d-%02d %02d:%02d:%02d', (int)$m[1], (int)$m[2], (int)$m[3], $h, $i, $sec);
    }

    $ts = strtotime($s);
    if ($ts !== false) {
        return date('Y-m-d H:i:s', $ts);
    }

    return '';
}

function suggest_map_header(string $dbCol, array $headers, array $autoMapAliases): string
{
    foreach ($headers as $h) {
        if (normalize_key((string)$h) === normalize_key($dbCol)) {
            return (string)$h;
        }
    }
    foreach ($headers as $h) {
        foreach (($autoMapAliases[$dbCol] ?? []) as $alias) {
            if (normalize_key((string)$h) === normalize_key((string)$alias)) {
                return (string)$h;
            }
        }
    }
    return '';
}

function build_yj_insert_row(array $tableCols, array $mappedRow, string $nomCentre, string $nowTime): array
{
    $insertData = [];
    foreach ($tableCols as $colName => $meta) {
        if ($colName === 'id') {
            continue;
        }
        if ($colName === 'nom_agent') {
            $insertData[$colName] = 'AG001';
            continue;
        }
        if ($colName === 'nom_centre') {
            $insertData[$colName] = $nomCentre;
            continue;
        }
        if ($colName === 'archive') {
            $insertData[$colName] = 0;
            continue;
        }
        if ($colName === 'date_insertion') {
            $insertData[$colName] = $nowTime;
            continue;
        }
        if ($colName === 'date_heure_playning' || $colName === 'date_heure_mod') {
            $insertData[$colName] = '';
            continue;
        }
        if ($colName === 'etat_final') {
            $insertData[$colName] = 'EN-ATTENTE';
            continue;
        }
        if ($colName === 'date_heure_appel') {
            $insertData[$colName] = normalize_excel_datetime($mappedRow['date_heure_appel'] ?? '');
            continue;
        }

        if (array_key_exists($colName, $mappedRow)) {
            $v = $mappedRow[$colName];
            if ($v !== null && $v !== '') {
                $insertData[$colName] = coerce_for_yj_column($v, $meta);
                continue;
            }
        }

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
    return $insertData;
}

function collect_mapped_yj_row(array $row, array $mapping, array $commentaireMergeHeaders, array $allowedDbCols): array
{
    $out = [];
    foreach ($allowedDbCols as $dbCol) {
        $excelCol = trim((string)($mapping[$dbCol] ?? ''));
        if ($excelCol === '') {
            continue;
        }
        $out[$dbCol] = get_mapped_cell_value($row, $excelCol);
    }

    $parts = [];
    $base = trim((string)($out['commentaire'] ?? ''));
    if ($base !== '') {
        $parts[] = $base;
    }
    foreach ($commentaireMergeHeaders as $header) {
        $header = trim((string)$header);
        if ($header === '') {
            continue;
        }
        $v = get_mapped_cell_value($row, $header);
        if ($v !== '') {
            $parts[] = $v;
        }
    }
    $out['commentaire'] = implode(' / ', $parts);

    return $out;
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

function clear_import_session(): void
{
    $oldFile = $_SESSION['import_file'] ?? null;
    if (is_string($oldFile) && $oldFile !== '' && file_exists($oldFile)) {
        @unlink($oldFile);
    }
    unset($_SESSION['import_file'], $_SESSION['import_headers'], $_SESSION['import_preview']);
}

$yjFieldsCoord = ['civ', 'nom', 'prenom', 'tel', 'gsm1', 'gsm2', 'Adresse', 'cp', 'ville', 'commentaire'];

$yjFieldsPerso = [
    'profession_mr', 'profession_mme', 'age_mr', 'age_mme', 'enfant_encharge', 'situation_conju', 'revenu', 'credit',
    'credit_autre', 'credit_immobilier', 'site_classe', 'zones_ombres', 'chemines', 'nb_chemines', 'surface_disponible',
    'motif_qualification', 'nom_commercial', 'nom_commercial_2', 'id_commercial', 'nom_confirmateur', 'nom_confirmateur_2',
    'nom_confirmateur_3', 'id_confirmateur', 'id_agent', 'id_qualite', 'nom_qualite', 'id_centre', 'entretient',
    'conf_presence_couple', 'conf_revenu', 'conf_credit', 'pac_propritaire_maison', 'adresse_ip', 'exportation', 'favorite',
    'color', 'PENALITE', 'DETAIL_PENALITE', 'observation_qualite', 'valider',
];

$yjFieldsTechnique = [
    'maison_orientation', 'etude', 'etude_observation', 'installation', 'installation_type', 'installation_annee',
    'installation_production', 'installation_prix', 'etat_qualite', 'date_heure_appel', 'date_heure_playning', 'sous_etat',
    'conf_rdv_avec', 'conf_prise_autre_personne', 'conf_profession_monsieur', 'conf_profession', 'conf_profession_detail',
    'conf_profession_madame', 'conf_profession_mme', 'conf_profession_detail_mme', 'conf_deja_fait_etude', 'conf_detail_etude',
    'conf_deja_installe', 'conf_type_installation', 'conf_annee_installation', 'conf_production_installation',
    'conf_prix_installation', 'conf_annulee_precedemment', 'conf_annulee_precedemment_par', 'conf_energie',
    'conf_consommations', 'conf_consommation_chauffage', 'conf_commentaire_produit', 'pac_consomation', 'pac_surface_habitable',
    'pac_nombre_pieces', 'pac_age_maison', 'pac_annee_chauf', 'pac_surface_chauf', 'ph3_pac', 'ph3_attente', 'ph3_alimentation',
    'ph3_type', 'ph3_prix', 'ph3_puissance', 'ph3_ballon', 'ph3_nbr_unite', 'ph3_nbr_group', 'ph3_rr_model', 'ph3_installateur',
    'ph3_mensualite', 'ph3_bonus_15', 'ph3_bonus_30', 'decalage', 'valeur_mensualite', 'nbr_annee_finance', 'cq_etat',
    'cq_dossier', 'cq_observations', 'cq_date_modif', 'ph3_marque_pac', 'ph3_marque_ballon', 'Isolation',
];

$yjAllMapFields = array_values(array_unique(array_merge($yjFieldsCoord, $yjFieldsPerso, $yjFieldsTechnique)));

$autoMapAliases = [
    'nom' => ['nom', 'lastname', 'last_name'],
    'prenom' => ['prenom', 'firstname', 'first_name'],
    'Adresse' => ['adresse', 'address', 'address1'],
    'cp' => ['cp', 'codepostal', 'postalcode', 'zip'],
    'ville' => ['ville', 'city'],
    'tel' => ['tel', 'telephone', 'phone', 'mobile', 'portable'],
    'gsm1' => ['gsm1', 'gsm', 'mobile1', 'tel2', 'telephone2'],
    'gsm2' => ['gsm2', 'mobile2', 'tel3', 'telephone3'],
    'commentaire' => ['commentaire', 'comment', 'notes', 'note'],
    'civ' => ['civ', 'civilite', 'title'],
    'conf_consommations' => ['consommation', 'conso'],
    'conf_produit' => ['conf_produit', 'produit', 'product', 'type_produit'],
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
            clear_import_session();
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
            $commentaireMerge = isset($_POST['commentaire_merge']) && is_array($_POST['commentaire_merge'])
                ? $_POST['commentaire_merge'] : [];
            $nomCentre = trim((string)($_POST['nom_centre'] ?? ''));
            $idCentreForm = trim((string)($_POST['id_centre'] ?? ''));
            $confProduitForm = trim((string)($_POST['conf_produit'] ?? ''));
            if ($nomCentre === '' || $idCentreForm === '' || !ctype_digit($idCentreForm)) {
                throw new RuntimeException('nom_centre et id_centre (entier) sont obligatoires.');
            }

            [$headers, $rows] = parse_excel($filePath);
            $pdo = db($config);
            $tableCols = get_table_columns($pdo, 'yj_fiche');
            if (empty($tableCols)) {
                throw new RuntimeException('Table yj_fiche introuvable.');
            }
            $allowedMapCols = array_values(array_intersect($yjAllMapFields, array_keys($tableCols)));

            $dupMode = strtolower((string)($config['duplicate_check'] ?? 'memory'));
            $existingPhones = [];
            if ($dupMode === 'memory') {
                $stmtPhones = $pdo->query("SELECT id, nom, prenom, tel, gsm1, gsm2, etat_final, date_insertion
                                           , nom_centre
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
                unset($stmtPhones);
            }

            // Numeros deja inseres pendant ce run (transaction pas encore visible en SQL)
            $phonesInsertedThisRun = [];

            $inserted = 0;
            $duplicates = 0;
            $errors = 0;
            $notInserted = [];

            $pdo->beginTransaction();
            foreach ($rows as $row) {
                try {
                    $mappedRow = collect_mapped_yj_row($row, $mapping, $commentaireMerge, $allowedMapCols);

                    foreach (['tel', 'gsm1', 'gsm2'] as $ph) {
                        if (array_key_exists($ph, $mappedRow)) {
                            $mappedRow[$ph] = clean_phone($mappedRow[$ph]);
                        }
                    }
                    $tel = $mappedRow['tel'] ?? '';
                    $gsm1 = $mappedRow['gsm1'] ?? '';
                    $gsm2 = $mappedRow['gsm2'] ?? '';

                    if (array_key_exists('cp', $mappedRow) && $mappedRow['cp'] !== '') {
                        $cpDigits = preg_replace('/\D+/', '', (string)$mappedRow['cp']) ?? '';
                        if (strlen($cpDigits) === 4) {
                            $cpDigits = '0' . $cpDigits;
                        }
                        if ($cpDigits !== '' && strlen($cpDigits) !== 5) {
                            throw new RuntimeException('Code postal invalide');
                        }
                        $mappedRow['cp'] = $cpDigits;
                    }

                    if (!isset($mappedRow['id_centre']) || trim((string)$mappedRow['id_centre']) === '') {
                        $mappedRow['id_centre'] = $idCentreForm;
                    }
                    if ($confProduitForm !== '' && (!isset($mappedRow['conf_produit']) || trim((string)$mappedRow['conf_produit']) === '')) {
                        $mappedRow['conf_produit'] = $confProduitForm;
                    }

                    if ($tel === '' && $gsm1 === '' && $gsm2 === '') {
                        throw new RuntimeException('Aucun telephone (tel/gsm1/gsm2)');
                    }

                    $dupPhone = '';
                    $existing = null;
                    foreach ([$tel, $gsm1, $gsm2] as $p) {
                        if ($p !== '' && isset($phonesInsertedThisRun[$p])) {
                            $dupPhone = $p;
                            $existing = $phonesInsertedThisRun[$p];
                            break;
                        }
                    }
                    if ($dupPhone === '' && $dupMode === 'memory') {
                        foreach ([$tel, $gsm1, $gsm2] as $p) {
                            if ($p !== '' && isset($existingPhones[$p])) {
                                $dupPhone = $p;
                                $existing = $existingPhones[$p];
                                break;
                            }
                        }
                    } elseif ($dupPhone === '' && $dupMode === 'sql') {
                        $existing = find_existing_yj_fiche_by_phones($pdo, $tel, $gsm1, $gsm2);
                        if ($existing !== null) {
                            $dupPhone = $tel !== '' ? $tel : ($gsm1 !== '' ? $gsm1 : $gsm2);
                        }
                    }
                    if ($dupPhone !== '' && $existing !== null) {
                        $duplicates++;
                        $notInserted[] = [
                            'existing_id' => $existing['id'] ?? null,
                            'nom' => $mappedRow['nom'] ?? '',
                            'prenom' => $mappedRow['prenom'] ?? '',
                            'tel' => $dupPhone,
                            'raison' => isset($phonesInsertedThisRun[$dupPhone]) ? 'Doublon dans le fichier (deja insere)' : 'Fiche existante archive=0',
                            'nom_centre' => $existing['nom_centre'] ?? '',
                            'etat_actuel' => $existing['etat_final'] ?? '',
                            'date_insertion_existante' => $existing['date_insertion'] ?? '',
                        ];
                        continue;
                    }

                    $nowTime = date('Y-m-d H:i:s');
                    $insertData = build_yj_insert_row($tableCols, $mappedRow, $nomCentre, $nowTime);

                    $cols = array_keys($insertData);
                    $placeholders = array_map(static function ($c) {
                        return ':' . $c;
                    }, $cols);
                    $insertSql = "INSERT INTO yj_fiche (`" . implode('`,`', $cols) . "`) VALUES (" . implode(',', $placeholders) . ")";
                    $stmtInsert = $pdo->prepare($insertSql);
                    $stmtInsert->execute(array_combine($placeholders, array_values($insertData)));

                    $runMeta = ['etat_final' => 'EN-ATTENTE', 'date_insertion' => $nowTime];
                    foreach ([$tel, $gsm1, $gsm2] as $p) {
                        if ($p !== '') {
                            $phonesInsertedThisRun[$p] = $runMeta;
                            if ($dupMode === 'memory') {
                                $existingPhones[$p] = $runMeta;
                            }
                        }
                    }
                    $inserted++;
                } catch (Throwable $e) {
                    $errors++;
                    $nomCol = trim((string)($mapping['nom'] ?? ''));
                    $preCol = trim((string)($mapping['prenom'] ?? ''));
                    $telCol = trim((string)($mapping['tel'] ?? ''));
                    $gsmCol = trim((string)($mapping['gsm1'] ?? ''));
                    $notInserted[] = [
                        'nom' => $nomCol !== '' ? get_mapped_cell_value($row, $nomCol) : '',
                        'prenom' => $preCol !== '' ? get_mapped_cell_value($row, $preCol) : '',
                        'tel' => $telCol !== '' ? get_mapped_cell_value($row, $telCol) : ($gsmCol !== '' ? get_mapped_cell_value($row, $gsmCol) : ''),
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
            $_SESSION['last_import_result'] = $result;
            $step = 'done';
            clear_import_session();
        } elseif ($action === 'archive') {
            $ficheId = (int)($_POST['fiche_id'] ?? 0);
            if ($ficheId <= 0) {
                throw new RuntimeException('ID fiche invalide pour archivage.');
            }

            $pdo = db($config);
            $stmt = $pdo->prepare("UPDATE yj_fiche SET archive = 1 WHERE id = :id");
            $stmt->execute([':id' => $ficheId]);

            if ($stmt->rowCount() > 0) {
                $message = "Fiche #{$ficheId} archivee.";
            } else {
                $message = "Aucune fiche archivee pour l'ID #{$ficheId}.";
            }

            $result = $_SESSION['last_import_result'] ?? null;
            if (is_array($result) && !empty($result['notInserted']) && is_array($result['notInserted'])) {
                $result['notInserted'] = array_values(array_filter($result['notInserted'], static function ($row) use ($ficheId) {
                    return (int)($row['existing_id'] ?? 0) !== $ficheId;
                }));
                $_SESSION['last_import_result'] = $result;
            }
            $step = 'done';
        }
    } catch (Throwable $e) {
        $message = 'Erreur: ' . $e->getMessage();
    }
} else {
    clear_import_session();
}

$sessionHeaders = $_SESSION['import_headers'] ?? [];
$sessionPreview = $_SESSION['import_preview'] ?? [];
$headers = $headers ?: $sessionHeaders;
$preview = $preview ?: $sessionPreview;
if ($result === null && isset($_SESSION['last_import_result']) && is_array($_SESSION['last_import_result'])) {
    $result = $_SESSION['last_import_result'];
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
    .mapping-section h4{margin:18px 0 10px;color:#333;border-bottom:1px solid #ddd;padding-bottom:6px}
    select[multiple]{min-height:140px;font-size:13px}
    .col-map{flex:1;min-width:200px;max-width:340px}
    .help-small{font-size:12px;color:#555;margin-top:6px}
  </style>
</head>
<body>
  <h1>Import en masse Excel (PHP)</h1>
  <?php if ($message !== ''): ?><div class="alert"><?php echo htmlspecialchars($message); ?></div><?php endif; ?>

  <div class="box">
    <form method="post" enctype="multipart/form-data">
      <input type="hidden" name="action" value="upload">
      <label>Fichier Excel (.xlsx/.xls)</label>
      <input type="file" name="excel" accept=".xlsx,.xls" required>
      <br><br>
      <button class="btn" type="submit">Charger et previsualiser</button>
    </form>
  </div>

  <?php if ($step === 'mapping'): ?>
    <div class="box">
      <h3>Mapping colonnes</h3>
      <form method="post">
        <input type="hidden" name="action" value="import">
        <div class="row">
          <div class="col"><label>nom_centre</label><input type="text" name="nom_centre" required></div>
          <div class="col"><label>id_centre</label><input type="number" name="id_centre" required step="1" title="ID centre (integer)"></div>
          <div class="col"><label>conf_produit (texte, défaut)</label><input type="text" name="conf_produit" placeholder="Si aucune colonne Excel n’est mappée sur conf_produit"></div>
        </div>
        <p class="help-small">Les fiches importées ont pour <code>etat_final</code> la valeur <strong>EN-ATTENTE</strong>. <code>conf_produit</code> en base est un libellé (varchar), pas un identifiant numérique — vous pouvez le mapper depuis une colonne Excel ou utiliser le champ défaut ci-dessus. <code>id_centre</code> du formulaire s’applique à chaque ligne si la colonne <code>id_centre</code> n’est pas renseignée pour cette ligne.</p>
        <br>

        <div class="mapping-section">
          <h4>Coordonnées et identité</h4>
          <div class="row">
            <?php foreach ($yjFieldsCoord as $dbCol): ?>
              <?php $def = suggest_map_header($dbCol, $headers, $autoMapAliases); ?>
              <div class="col col-map">
                <label><?php echo htmlspecialchars($dbCol); ?></label>
                <select name="map[<?php echo htmlspecialchars($dbCol); ?>]">
                  <option value="">-- non mappe --</option>
                  <?php foreach ($headers as $h): ?>
                    <option value="<?php echo htmlspecialchars($h); ?>" <?php echo selected($def, $h); ?>><?php echo htmlspecialchars($h); ?></option>
                  <?php endforeach; ?>
                </select>
              </div>
            <?php endforeach; ?>
          </div>
        </div>

        <div class="mapping-section">
          <h4>Commentaire : colonnes supplémentaires (multiselect)</h4>
          <p class="help-small">Les valeurs des colonnes choisies sont ajoutées au commentaire, dans l’ordre, séparées par <strong>espace / espace</strong> (<code> / </code>). Maintenez Ctrl (ou Cmd) pour en sélectionner plusieurs. La colonne mappée sur <code>commentaire</code> ci‑dessus reste en premier si elle est renseignée.</p>
          <select name="commentaire_merge[]" multiple size="10">
            <?php foreach ($headers as $h): ?>
              <option value="<?php echo htmlspecialchars($h); ?>"><?php echo htmlspecialchars($h); ?></option>
            <?php endforeach; ?>
          </select>
        </div>

        <div class="mapping-section">
          <h4>Critères personnels (yj_fiche)</h4>
          <div class="row">
            <?php foreach ($yjFieldsPerso as $dbCol): ?>
              <?php $def = suggest_map_header($dbCol, $headers, $autoMapAliases); ?>
              <div class="col col-map">
                <label><?php echo htmlspecialchars($dbCol); ?></label>
                <select name="map[<?php echo htmlspecialchars($dbCol); ?>]">
                  <option value="">-- non mappe --</option>
                  <?php foreach ($headers as $h): ?>
                    <option value="<?php echo htmlspecialchars($h); ?>" <?php echo selected($def, $h); ?>><?php echo htmlspecialchars($h); ?></option>
                  <?php endforeach; ?>
                </select>
              </div>
            <?php endforeach; ?>
          </div>
        </div>

        <div class="mapping-section">
          <h4>Critères techniques (yj_fiche)</h4>
          <div class="row">
            <?php foreach ($yjFieldsTechnique as $dbCol): ?>
              <?php $def = suggest_map_header($dbCol, $headers, $autoMapAliases); ?>
              <div class="col col-map">
                <label><?php echo htmlspecialchars($dbCol); ?></label>
                <select name="map[<?php echo htmlspecialchars($dbCol); ?>]">
                  <option value="">-- non mappe --</option>
                  <?php foreach ($headers as $h): ?>
                    <option value="<?php echo htmlspecialchars($h); ?>" <?php echo selected($def, $h); ?>><?php echo htmlspecialchars($h); ?></option>
                  <?php endforeach; ?>
                </select>
              </div>
            <?php endforeach; ?>
          </div>
        </div>

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
          <thead><tr><th>Nom</th><th>Prenom</th><th>Tel</th><th>Raison</th><th>Nom centre</th><th>Etat actuel</th><th>Date insertion existante</th><th>Action</th></tr></thead>
          <tbody>
          <?php foreach ($result['notInserted'] as $ni): ?>
            <tr>
              <td><?php echo htmlspecialchars((string)($ni['nom'] ?? '')); ?></td>
              <td><?php echo htmlspecialchars((string)($ni['prenom'] ?? '')); ?></td>
              <td><?php echo htmlspecialchars((string)($ni['tel'] ?? '')); ?></td>
              <td><?php echo htmlspecialchars((string)($ni['raison'] ?? '')); ?></td>
              <td><?php echo htmlspecialchars((string)($ni['nom_centre'] ?? '')); ?></td>
              <td><?php echo htmlspecialchars((string)($ni['etat_actuel'] ?? '')); ?></td>
              <td><?php echo htmlspecialchars((string)($ni['date_insertion_existante'] ?? '')); ?></td>
              <td>
                <?php if (!empty($ni['existing_id'])): ?>
                  <form method="post" style="margin:0">
                    <input type="hidden" name="action" value="archive">
                    <input type="hidden" name="fiche_id" value="<?php echo (int)$ni['existing_id']; ?>">
                    <button class="btn" type="submit">Archiver</button>
                  </form>
                <?php endif; ?>
              </td>
            </tr>
          <?php endforeach; ?>
          </tbody>
        </table>
      <?php endif; ?>
    </div>
  <?php endif; ?>
</body>
</html>

