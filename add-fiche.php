<?php
/**
 * Int�gration Vicidial -> CRM
 * Version corrig�e pour serveur d'application
 */

// ============================================
// 1. CONFIGURATION S�CURIS�E
// ============================================
// D�sactiver l'affichage des erreurs en production
$isDevelopment = (getenv('APP_ENV') === 'development' || isset($_GET['debug']));
ini_set('display_errors', $isDevelopment ? 1 : 0);
ini_set('display_startup_errors', $isDevelopment ? 1 : 0);
error_reporting($isDevelopment ? E_ALL : E_ALL & ~E_DEPRECATED & ~E_STRICT);

// Logs d'erreurs (utiliser le log syst�me si le r�pertoire logs n'existe pas)
$logFile = __DIR__ . '/logs/php_errors.log';
if (!is_dir(__DIR__ . '/logs/') || !is_writable(__DIR__ . '/logs/')) {
    // Utiliser le log syst�me par d�faut
    $logFile = null; // Laisser PHP utiliser le log par d�faut
}
if ($logFile) {
    ini_set('error_log', $logFile);
}
ini_set('log_errors', 1);

// D�sactiver le cache navigateur
header("Cache-Control: no-cache, no-store, must-revalidate");
header("Pragma: no-cache");
header("Expires: 0");

// ============================================
// 2. CONFIGURATION (� externaliser dans un fichier .env)
// ============================================
$VICIDIAL_CONFIG = [
    'host' => getenv('VICIDIAL_DB_HOST') ?: 'localhost',
    'user' => getenv('VICIDIAL_DB_USER') ?: 'cron',
    'password' => getenv('VICIDIAL_DB_PASSWORD') ?: '1234',
    'database' => getenv('VICIDIAL_DB_NAME') ?: 'asterisk'
];

$CRM_CONFIG = [
    'api_url' => getenv('CRM_API_URL') ?: 'https://crm.jwsgroup.fr/api',
    'api_token' => getenv('CRM_API_TOKEN') ?: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImlhdCI6MTc2NDc2MzYxMywiZXhwIjoxNzY1MzY4NDEzfQ.w-Ppf4kgN8IqyI7C5-0PgwVWEl3CO3soxhpehqiKQQY' // � configurer via variable d'environnement
];

$CACHE_CONFIG = [
    'enabled' => true,
    'duration' => 300, // 5 minutes
    'directory' => __DIR__ . '/cache/'
];

// ============================================
// 3. INITIALISATION
// ============================================
$error = '';
$success = '';
$vicidialData = null;
$agent = isset($_GET['user']) ? trim($_GET['user']) : '';

// Cr�er les r�pertoires n�cessaires (sans g�n�rer d'erreur si permissions insuffisantes)
$directories = [
    $CACHE_CONFIG['directory'],
    __DIR__ . '/logs/'
];

foreach ($directories as $dir) {
    if (!is_dir($dir)) {
        // Utiliser @ pour supprimer le warning si les permissions ne sont pas suffisantes
        if (!@mkdir($dir, 0755, true)) {
            // Ne pas g�n�rer d'erreur, juste logger silencieusement
            error_log("[WARNING] Impossible de cr�er le r�pertoire: {$dir} - Le script continuera sans cache/logs locaux");
        } else {
            // V�rifier que le r�pertoire est accessible en �criture
            if (!is_writable($dir)) {
                error_log("[WARNING] R�pertoire cr�� mais non accessible en �criture: {$dir}");
            }
        }
    }
}

// ============================================
// 4. FONCTIONS
// ============================================
function writeLog($message) {
    $cleanMessage = preg_replace('/[^\x20-\x7E\n\r]/', '', $message);
    error_log("[CRM_INTEGRATION] " . $cleanMessage);
}

function connectVicidialDB() {
    global $VICIDIAL_CONFIG;
    
    writeLog("Connexion a la base Vicidial...");
    
    $conn = @new mysqli(
        $VICIDIAL_CONFIG['host'],
        $VICIDIAL_CONFIG['user'],
        $VICIDIAL_CONFIG['password'],
        $VICIDIAL_CONFIG['database']
    );
    
    if ($conn->connect_error) {
        writeLog("ERREUR connexion Vicidial: " . $conn->connect_error);
        throw new Exception("Erreur connexion base de donnees: " . $conn->connect_error);
    }
    
    $conn->set_charset("utf8mb4");
    writeLog("Connexion Vicidial etablie");
    return $conn;
}

function getListFromAPIWithCache($endpoint) {
    global $CACHE_CONFIG;
    
    writeLog("Recuperation: " . $endpoint);
    
    if (!$CACHE_CONFIG['enabled']) {
        return getListFromAPI($endpoint);
    }
    
    $cacheFile = $CACHE_CONFIG['directory'] . md5($endpoint) . '.cache';
    
    if (!is_dir($CACHE_CONFIG['directory'])) {
        writeLog("ERREUR: Repertoire cache inexistant");
        return getListFromAPI($endpoint);
    }
    
    // V�rifier le cache
    if (file_exists($cacheFile) && is_readable($cacheFile)) {
        $cacheAge = time() - filemtime($cacheFile);
        if ($cacheAge < $CACHE_CONFIG['duration']) {
            writeLog("Utilisation du cache pour: " . $endpoint);
            $content = @file_get_contents($cacheFile);
            if ($content !== false) {
                $data = @json_decode($content, true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($data)) {
                    return $data;
                }
            }
        }
    }
    
    // R�cup�rer depuis API
    $data = getListFromAPI($endpoint);
    
    // Sauvegarder dans le cache
    if (!empty($data) && is_array($data) && is_writable($CACHE_CONFIG['directory'])) {
        $result = @file_put_contents($cacheFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        if ($result !== false) {
            writeLog("Cache mis a jour pour: " . $endpoint);
        }
    }
    
    return $data;
}

function getListFromAPI($endpoint) {
    global $CRM_CONFIG;
    
    writeLog("Appel API: " . $endpoint);
    
    $token = $CRM_CONFIG['api_token'];
    if (empty($token)) {
        writeLog("ERREUR: Token API vide");
        return [];
    }
    
    $apiUrl = rtrim($CRM_CONFIG['api_url'], '/') . '/management/' . $endpoint;
    
    if (!function_exists('curl_init')) {
        writeLog("ERREUR: Extension CURL non disponible");
        return [];
    }
    
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $apiUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTPGET => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $token,
            'Accept: application/json',
            'User-Agent: CRM-Integration/1.0'
        ],
        CURLOPT_SSL_VERIFYPEER => true, // S�curit�: v�rifier le certificat SSL
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_FAILONERROR => true
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    
    if (curl_errno($ch)) {
        writeLog("ERREUR CURL: " . $curlError);
        curl_close($ch);
        return [];
    }
    
    curl_close($ch);
    
    writeLog("Reponse HTTP: " . $httpCode);
    
    if ($httpCode !== 200) {
        writeLog("ERREUR: Code HTTP " . $httpCode);
        return [];
    }
    
    if (empty($response)) {
        writeLog("ERREUR: Reponse vide");
        return [];
    }
    
    $data = @json_decode($response, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        writeLog("ERREUR JSON: " . json_last_error_msg());
        return [];
    }
    
    if (!isset($data['success']) || $data['success'] !== true || !isset($data['data'])) {
        writeLog("ERREUR: Structure de donnees invalide");
        return [];
    }
    
    writeLog("Succes: " . $endpoint . " - " . count($data['data']) . " elements");
    return $data['data'];
}

// Fonction de validation et nettoyage des donn�es
function sanitizeInput($data) {
    if (is_array($data)) {
        return array_map('sanitizeInput', $data);
    }
    return htmlspecialchars(strip_tags(trim($data)), ENT_QUOTES, 'UTF-8');
}

// ============================================
// 5. TRAITEMENT PRINCIPAL
// ============================================
writeLog("Demarrage script - Agent: " . ($agent ?: 'non defini'));

// R�cup�rer les donn�es Vicidial
if (!empty($agent)) {
    $startTime = microtime(true);
    
    try {
        $vicidialConn = connectVicidialDB();
        
        // Requ�te s�curis�e avec prepared statement
        $sql = "SELECT 
                    lead_id,
                    first_name,
                    last_name,
                    phone_number,
                    alt_phone,
                    address1,
                    address2,
                    city,
                    state,
                    postal_code,
                    country_code,
                    entry_date,
                    status,
                    comments,
                    user,
                    modify_date
                FROM vicidial_list 
                WHERE status = 'OK' 
                  AND user = ?
                ORDER BY modify_date DESC, entry_date DESC 
                LIMIT 1";
        
        writeLog("Execution requete SQL");
        $stmt = $vicidialConn->prepare($sql);
        
        if ($stmt === false) {
            throw new Exception("Erreur preparation requete: " . $vicidialConn->error);
        }
        
        $stmt->bind_param("s", $agent);
        
        if (!$stmt->execute()) {
            throw new Exception("Erreur execution requete: " . $stmt->error);
        }
        
        $result = $stmt->get_result();
        
        if ($result->num_rows > 0) {
            $vicidialData = $result->fetch_assoc();
            writeLog("Lead trouve: ID " . $vicidialData['lead_id']);
        } else {
            $error = "Aucun lead qualifie 'OK' trouve pour l'agent: " . htmlspecialchars($agent);
            writeLog($error);
        }
        
        $stmt->close();
        $vicidialConn->close();
        
        $queryTime = round((microtime(true) - $startTime) * 1000, 2);
        writeLog("Temps requete Vicidial: " . $queryTime . "ms");
        
    } catch (Exception $e) {
        $error = "Erreur Vicidial: " . $e->getMessage();
        writeLog("EXCEPTION: " . $e->getMessage());
    }
} else {
    $error = "Parametre 'user' manquant";
    writeLog($error);
}

// R�cup�rer les listes depuis le CRM
writeLog("Recuperation des listes CRM...");
$startTime = microtime(true);

$professions = getListFromAPIWithCache('professions');
$typeContrats = getListFromAPIWithCache('type-contrat');
$modeChauffages = getListFromAPIWithCache('mode-chauffage');

$apiTime = round((microtime(true) - $startTime) * 1000, 2);
writeLog("Temps total API/cache: " . $apiTime . "ms");

// V�rifier si les donn�es sont valides
if (!is_array($professions)) $professions = [];
if (!is_array($typeContrats)) $typeContrats = [];
if (!is_array($modeChauffages)) $modeChauffages = [];

writeLog("Resultats: Professions=" . count($professions) . ", Contrats=" . count($typeContrats) . ", Chauffages=" . count($modeChauffages));

// ============================================
// 6. TRAITEMENT DU FORMULAIRE
// ============================================
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    writeLog("Traitement formulaire POST");
    
    try {
        $token = $CRM_CONFIG['api_token'];
        if (empty($token)) {
            throw new Exception("Token API non configure");
        }
        
        // Validation et nettoyage des donn�es
        $ficheData = [
            'nom' => sanitizeInput($_POST['nom'] ?? ''),
            'prenom' => sanitizeInput($_POST['prenom'] ?? ''),
            'tel' => sanitizeInput($_POST['telephone'] ?? ''),
            'gsm1' => sanitizeInput($_POST['gsm'] ?? ''),
            'adresse' => sanitizeInput($_POST['adresse'] ?? ''),
            'cp' => sanitizeInput($_POST['code_postal'] ?? ''),
            'ville' => sanitizeInput($_POST['ville'] ?? ''),
        ];
        
        // Validation des champs requis
        if (empty($ficheData['nom']) || empty($ficheData['prenom']) || empty($ficheData['tel'])) {
            throw new Exception("Les champs nom, prenom et telephone sont obligatoires");
        }
        
        // Ajouter les donn�es optionnelles avec validation
        $optionalFields = [
            'date_appel' => !empty($_POST['date_appel']) ? date('c', strtotime($_POST['date_appel'])) : null,
            'situation_conjugale' => !empty($_POST['situation_conjugale']) ? sanitizeInput($_POST['situation_conjugale']) : null,
            'age_mr' => !empty($_POST['age_mr']) ? intval($_POST['age_mr']) : null,
            'age_madame' => !empty($_POST['age_madame']) ? intval($_POST['age_madame']) : null,
            'nb_enfants' => !empty($_POST['nb_enfants']) ? intval($_POST['nb_enfants']) : null,
            'profession_mr' => !empty($_POST['profession_mr']) ? intval($_POST['profession_mr']) : null,
            'profession_madame' => !empty($_POST['profession_madame']) ? intval($_POST['profession_madame']) : null,
            'type_contrat_mr' => !empty($_POST['type_contrat_mr']) ? intval($_POST['type_contrat_mr']) : null,
            'type_contrat_madame' => !empty($_POST['type_contrat_madame']) ? intval($_POST['type_contrat_madame']) : null,
            'entretien_avec' => !empty($_POST['entretien_avec']) ? sanitizeInput($_POST['entretien_avec']) : null,
            'proprietaire_maison' => !empty($_POST['proprietaire_maison']) ? sanitizeInput($_POST['proprietaire_maison']) : null,
            'revenu_foyer' => !empty($_POST['revenu_foyer']) ? sanitizeInput($_POST['revenu_foyer']) : null,
            'etude' => !empty($_POST['etude']) ? sanitizeInput($_POST['etude']) : null,
            'mode_chauffage' => !empty($_POST['mode_chauffage']) ? intval($_POST['mode_chauffage']) : null,
            'annee_systeme_chauffage' => !empty($_POST['annee_systeme_chauffage']) ? intval($_POST['annee_systeme_chauffage']) : null,
            'surface_habitable' => !empty($_POST['surface_habitable']) ? sanitizeInput($_POST['surface_habitable']) : null,
            'surface_chauffee' => !empty($_POST['surface_chauffee']) ? sanitizeInput($_POST['surface_chauffee']) : null,
            'consommation_chauffage' => !empty($_POST['consommation_chauffage']) ? sanitizeInput($_POST['consommation_chauffage']) : null,
            'nb_pieces' => !empty($_POST['nb_pieces']) ? intval($_POST['nb_pieces']) : null,
            'commentaire' => !empty($_POST['commentaire_agent']) ? sanitizeInput($_POST['commentaire_agent']) : null
        ];
        
        // Filtrer les champs nuls
        foreach ($optionalFields as $key => $value) {
            if ($value !== null && $value !== '') {
                $ficheData[$key] = $value;
            }
        }
        
        writeLog("Donnees a envoyer: " . json_encode($ficheData, JSON_UNESCAPED_UNICODE));
        
        // Envoyer � l'API
        $apiUrl = rtrim($CRM_CONFIG['api_url'], '/') . '/fiches';
        $jsonData = json_encode($ficheData, JSON_UNESCAPED_UNICODE);
        
        if ($jsonData === false) {
            throw new Exception("Erreur encodage JSON: " . json_last_error_msg());
        }
        
        writeLog("Envoi a: " . $apiUrl);
        
        $ch = curl_init($apiUrl);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $jsonData,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $token,
                'Content-Type: application/json',
                'Accept: application/json',
                'Content-Length: ' . strlen($jsonData)
            ],
            CURLOPT_SSL_VERIFYPEER => true, // S�curit�
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_FAILONERROR => true
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        
        if (curl_errno($ch)) {
            throw new Exception("Erreur CURL: " . $curlError);
        }
        
        curl_close($ch);
        
        writeLog("Reponse HTTP creation fiche: " . $httpCode);
        
        $responseData = @json_decode($response, true);
        
        if ($httpCode === 201) {
            if (isset($responseData['success']) && $responseData['success']) {
                $success = "Fiche creee avec succes! ID: " . ($responseData['data']['id'] ?? 'N/A');
                writeLog("SUCCES: " . $success);
            } else {
                throw new Exception("Reponse API indique un echec: " . 
                                  ($responseData['message'] ?? 'Erreur inconnue'));
            }
        } else {
            $errorMsg = $responseData['message'] ?? "Erreur HTTP $httpCode";
            throw new Exception($errorMsg);
        }
        
    } catch (Exception $e) {
        $error = $e->getMessage();
        writeLog("ERREUR creation fiche: " . $error);
    }
}

// ============================================
// 7. AFFICHAGE HTML
// ============================================
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <title>Cr�ation Fiche CRM - Vicidial</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1000px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        .alert { padding: 10px; margin: 10px 0; border-radius: 4px; }
        .alert-error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .alert-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .alert-info { background: #cce7ff; color: #004085; border: 1px solid #b3d7ff; }
        .form-section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .section-title { background: #3498db; color: white; padding: 10px; margin: -15px -15px 15px -15px; border-radius: 4px 4px 0 0; }
        .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; }
        .form-group { margin-bottom: 15px; }
        .form-group.full-width { grid-column: 1 / -1; }
        label { display: block; margin-bottom: 5px; font-weight: bold; color: #2c3e50; }
        .required { color: #e74c3c; }
        input, select, textarea { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
        textarea { min-height: 80px; resize: vertical; }
        .form-actions { margin-top: 20px; text-align: right; }
        .btn { padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
        .btn-primary { background: #3498db; color: white; }
        .btn-primary:hover { background: #2980b9; }
        .vicidial-info { background: #e8f4f8; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .api-status { background: #fff3cd; padding: 10px; border-radius: 4px; margin: 10px 0; }
        .debug-info { background: #f8f9fa; padding: 10px; border: 1px dashed #6c757d; margin: 10px 0; font-size: 12px; color: #6c757d; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Cr�ation de Fiche CRM</h1>
        <p>Agent: <strong><?php echo htmlspecialchars($agent); ?></strong></p>
        
        <?php if ($isDevelopment): ?>
        <div class="debug-info">
            <strong>Debug:</strong> 
            PHP Version: <?php echo phpversion(); ?> | 
            Memory: <?php echo round(memory_get_usage() / 1024 / 1024, 2); ?>MB |
            Peak: <?php echo round(memory_get_peak_usage() / 1024 / 1024, 2); ?>MB
        </div>
        <?php endif; ?>
        
        <?php if ($error): ?>
            <div class="alert alert-error">
                <strong>Erreur:</strong> <?php echo htmlspecialchars($error); ?>
            </div>
        <?php endif; ?>
        
        <?php if ($success): ?>
            <div class="alert alert-success">
                <strong>Succ�s:</strong> <?php echo htmlspecialchars($success); ?>
            </div>
        <?php endif; ?>
        
        <div class="api-status">
            <strong>Statut des donn�es:</strong><br>
            � Professions: <?php echo count($professions); ?> disponibles<br>
            � Types de contrat: <?php echo count($typeContrats); ?> disponibles<br>
            � Modes de chauffage: <?php echo count($modeChauffages); ?> disponibles
        </div>
        
        <?php if ($vicidialData): ?>
            <div class="vicidial-info">
                <strong>Lead Vicidial trouv�:</strong><br>
                ID: <?php echo $vicidialData['lead_id']; ?> | 
                Nom: <?php echo htmlspecialchars($vicidialData['last_name']); ?> | 
                Pr�nom: <?php echo htmlspecialchars($vicidialData['first_name']); ?> | 
                T�l�phone: <?php echo htmlspecialchars($vicidialData['phone_number']); ?> |
                Derni�re modif: <?php echo htmlspecialchars($vicidialData['modify_date'] ?? 'N/A'); ?>
            </div>
        <?php endif; ?>
        
        <form method="POST" action="">
            <!-- Informations Vicidial -->
            <div class="form-section">
                <div class="section-title">Informations depuis Vicidial</div>
                <div class="form-grid">
                    <div class="form-group">
                        <label>Nom <span class="required">*</span></label>
                        <input type="text" name="nom" value="<?php echo htmlspecialchars($vicidialData['last_name'] ?? ''); ?>" required>
                    </div>
                    <div class="form-group">
                        <label>Pr�nom <span class="required">*</span></label>
                        <input type="text" name="prenom" value="<?php echo htmlspecialchars($vicidialData['first_name'] ?? ''); ?>" required>
                    </div>
                    <div class="form-group">
                        <label>T�l�phone <span class="required">*</span></label>
                        <input type="tel" name="telephone" value="<?php echo htmlspecialchars($vicidialData['phone_number'] ?? ''); ?>" required>
                    </div>
                    <div class="form-group">
                        <label>GSM</label>
                        <input type="tel" name="gsm" value="<?php echo htmlspecialchars($vicidialData['alt_phone'] ?? ''); ?>">
                    </div>
                    <div class="form-group full-width">
                        <label>Adresse</label>
                        <input type="text" name="adresse" value="<?php 
                            $adresse = trim(($vicidialData['address1'] ?? '') . ' ' . ($vicidialData['address2'] ?? ''));
                            echo htmlspecialchars($adresse);
                        ?>">
                    </div>
                    <div class="form-group">
                        <label>Code Postal</label>
                        <input type="text" name="code_postal" value="<?php echo htmlspecialchars($vicidialData['postal_code'] ?? ''); ?>">
                    </div>
                    <div class="form-group">
                        <label>Ville</label>
                        <input type="text" name="ville" value="<?php echo htmlspecialchars($vicidialData['city'] ?? ''); ?>">
                    </div>
                </div>
            </div>
            
            <!-- Informations d'appel -->
            <div class="form-section">
                <div class="section-title">Informations d'Appel</div>
                <div class="form-grid">
                    <div class="form-group">
                        <label>Date et Heure d'Appel</label>
                        <input type="datetime-local" name="date_appel" value="<?php echo date('Y-m-d\TH:i'); ?>">
                    </div>
                </div>
            </div>
            
            <!-- Crit�res Client -->
            <div class="form-section">
                <div class="section-title">Crit�res Client</div>
                <div class="form-grid">
                    <div class="form-group">
                        <label>Situation Conjugale</label>
                        <select name="situation_conjugale">
                            <option value="">-- S�lectionner --</option>
                            <option value="C�libataire">C�libataire</option>
                            <option value="Mari�(e)">Mari�(e)</option>
                            <option value="Concubinage">Concubinage</option>
                            <option value="Divorc�(e)">Divorc�(e)</option>
                            <option value="Veuf(ve)">Veuf(ve)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>�ge M.</label>
                        <input type="number" name="age_mr" min="18" max="120">
                    </div>
                    <div class="form-group">
                        <label>�ge Mme</label>
                        <input type="number" name="age_madame" min="18" max="120">
                    </div>
                    <div class="form-group">
                        <label>Nombre d'Enfants</label>
                        <input type="number" name="nb_enfants" min="0" value="0">
                    </div>
                    <div class="form-group">
                        <label>Profession M.</label>
                        <select name="profession_mr">
                            <option value="">-- S�lectionner --</option>
                            <?php foreach ($professions as $prof): ?>
                                <option value="<?php echo htmlspecialchars($prof['id']); ?>">
                                    <?php echo htmlspecialchars($prof['nom']); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Profession Mme</label>
                        <select name="profession_madame">
                            <option value="">-- S�lectionner --</option>
                            <?php foreach ($professions as $prof): ?>
                                <option value="<?php echo htmlspecialchars($prof['id']); ?>">
                                    <?php echo htmlspecialchars($prof['nom']); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Type Contrat M.</label>
                        <select name="type_contrat_mr">
                            <option value="">-- S�lectionner --</option>
                            <?php foreach ($typeContrats as $contrat): ?>
                                <option value="<?php echo htmlspecialchars($contrat['id']); ?>">
                                    <?php echo htmlspecialchars($contrat['nom']); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Type Contrat Mme</label>
                        <select name="type_contrat_madame">
                            <option value="">-- S�lectionner --</option>
                            <?php foreach ($typeContrats as $contrat): ?>
                                <option value="<?php echo htmlspecialchars($contrat['id']); ?>">
                                    <?php echo htmlspecialchars($contrat['nom']); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Entretien avec</label>
                        <select name="entretien_avec">
                            <option value="">-- S�lectionner --</option>
                            <option value="Monsieur">Monsieur</option>
                            <option value="Madame">Madame</option>
                            <option value="Couple">Couple</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Propri�taire Maison</label>
                        <select name="proprietaire_maison">
                            <option value="">-- S�lectionner --</option>
                            <option value="OUI">OUI</option>
                            <option value="NON">NON</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Revenu du Foyer</label>
                        <input type="text" name="revenu_foyer" placeholder="Ex: 3000-5000�">
                    </div>
                </div>
            </div>
            
            <!-- Crit�res Techniques -->
            <div class="form-section">
                <div class="section-title">Crit�res Techniques</div>
                <div class="form-grid">
                    <div class="form-group">
                        <label>D�j� fait une �tude</label>
                        <select name="etude">
                            <option value="">-- S�lectionner --</option>
                            <option value="OUI">OUI</option>
                            <option value="NON">NON</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Mode de Chauffage</label>
                        <select name="mode_chauffage">
                            <option value="">-- S�lectionner --</option>
                            <?php foreach ($modeChauffages as $mode): ?>
                                <option value="<?php echo htmlspecialchars($mode['id']); ?>">
                                    <?php echo htmlspecialchars($mode['nom']); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Ann�e Syst�me Chauffage</label>
                        <input type="number" name="annee_systeme_chauffage" min="1900" max="<?php echo date('Y'); ?>">
                    </div>
                    <div class="form-group">
                        <label>Surface Habitable (m�)</label>
                        <input type="text" name="surface_habitable" placeholder="Ex: 120">
                    </div>
                    <div class="form-group">
                        <label>Surface Chauff�e (m�)</label>
                        <input type="text" name="surface_chauffee" placeholder="Ex: 100">
                    </div>
                    <div class="form-group">
                        <label>Consommation Chauffage</label>
                        <input type="text" name="consommation_chauffage" placeholder="Ex: 15000 kWh/an">
                    </div>
                    <div class="form-group">
                        <label>Nombre de Pi�ces</label>
                        <input type="number" name="nb_pieces" min="1">
                    </div>
                    <div class="form-group full-width">
                        <label>Commentaire Agent</label>
                        <textarea name="commentaire_agent" placeholder="Notes suppl�mentaires..."></textarea>
                    </div>
                </div>
            </div>
            
            <div class="form-actions">
                <button type="submit" class="btn btn-primary">Cr�er la Fiche</button>
            </div>
        </form>
    </div>
</body>
</html>
<?php
// Fin du script
$totalTime = round((microtime(true) - ($_SERVER['REQUEST_TIME_FLOAT'] ?? microtime(true))) * 1000, 2);
writeLog("Script termine - Temps total: " . $totalTime . "ms");
?>

