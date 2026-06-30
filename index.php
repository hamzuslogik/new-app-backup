<?php
/**
 * Intégration Vicidial -> CRM
 * Version corrigée pour serveur d'application
 * 
 * CONFIGURATION:
 * - Le fichier vicidial_config.php contient la configuration de connexion à Vicidial
 * - Copiez vicidial_config.php.example vers vicidial_config.php et modifiez les valeurs
 * - Les variables d'environnement peuvent surcharger les valeurs du fichier de config
 */

// ============================================
// 1. CONFIGURATION SÉCURISÉE
// ============================================
// Désactiver l'affichage des erreurs en production
$isDevelopment = (getenv('APP_ENV') === 'development' || isset($_GET['debug']));
ini_set('display_errors', $isDevelopment ? 1 : 0);
ini_set('display_startup_errors', $isDevelopment ? 1 : 0);
error_reporting($isDevelopment ? E_ALL : E_ALL & ~E_DEPRECATED & ~E_STRICT);

// Logs d'erreurs (utiliser le log système si le répertoire logs n'existe pas)
$logFile = __DIR__ . '/logs/php_errors.log';
if (!is_dir(__DIR__ . '/logs/') || !is_writable(__DIR__ . '/logs/')) {
    // Utiliser le log système par défaut
    $logFile = null; // Laisser PHP utiliser le log par défaut
}
if ($logFile) {
    ini_set('error_log', $logFile);
}
ini_set('log_errors', 1);

// Désactiver le cache navigateur
header("Cache-Control: no-cache, no-store, must-revalidate");
header("Pragma: no-cache");
header("Expires: 0");

// ============================================
// 1.5. GESTION DES SESSIONS
// ============================================
// Démarrer la session
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Gestion de la déconnexion
if (isset($_GET['logout'])) {
    session_destroy();
    header('Location: ' . str_replace('?logout=1', '', $_SERVER['PHP_SELF']));
    exit;
}

// ============================================
// 2. CONFIGURATION
// ============================================
// Charger le fichier de configuration
$configFile = __DIR__ . '/vicidial_config.php';
if (!file_exists($configFile)) {
    die("ERREUR: Fichier de configuration introuvable: {$configFile}. Veuillez creer le fichier vicidial_config.php.");
}

$CONFIG = require $configFile;

// Extraire les configurations
$VICIDIAL_CONFIG = $CONFIG['vicidial'] ?? [];
$CRM_CONFIG = $CONFIG['crm'] ?? [];
$CACHE_CONFIG = $CONFIG['cache'] ?? [
    'enabled' => true,
    'duration' => 300,
    'directory' => __DIR__ . '/cache/'
];

// Validation de la configuration Vicidial
if (empty($VICIDIAL_CONFIG['host']) || empty($VICIDIAL_CONFIG['database'])) {
    die("ERREUR: Configuration Vicidial incomplete. Verifiez le fichier vicidial_config.php.");
}

// ============================================
// 3. INITIALISATION
// ============================================
$error = '';
$success = '';
$notice = '';
$loginError = '';
$vicidialData = null;
$agent = isset($_SESSION['agent']) ? trim($_SESSION['agent']) : '';
$agentUser = null; // Stocker les données de l'utilisateur récupéré par pseudo

// Créer les répertoires nécessaires (sans générer d'erreur si permissions insuffisantes)
$directories = [
    $CACHE_CONFIG['directory'],
    __DIR__ . '/logs/'
];

foreach ($directories as $dir) {
    if (!is_dir($dir)) {
        // Utiliser @ pour supprimer le warning si les permissions ne sont pas suffisantes
        if (!@mkdir($dir, 0755, true)) {
            // Ne pas générer d'erreur, juste logger silencieusement
            error_log("[WARNING] Impossible de créer le répertoire: {$dir} - Le script continuera sans cache/logs locaux");
        } else {
            // Vérifier que le répertoire est accessible en écriture
            if (!is_writable($dir)) {
                error_log("[WARNING] Répertoire créé mais non accessible en écriture: {$dir}");
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
    
    $host = $VICIDIAL_CONFIG['host'];
    $port = $VICIDIAL_CONFIG['port'] ?? 3306;
    $user = $VICIDIAL_CONFIG['user'];
    $password = $VICIDIAL_CONFIG['password'];
    $database = $VICIDIAL_CONFIG['database'];
    $charset = $VICIDIAL_CONFIG['charset'] ?? 'utf8mb4';
    $serverName = $VICIDIAL_CONFIG['server_name'] ?? 'Vicidial';
    
    writeLog("Connexion a la base Vicidial sur {$serverName} ({$host}:{$port})...");
    
    // Construire le host avec le port si nécessaire
    $hostWithPort = ($port != 3306) ? "{$host}:{$port}" : $host;
    
    $conn = @new mysqli(
        $host,
        $user,
        $password,
        $database,
        $port
    );
    
    if ($conn->connect_error) {
        writeLog("ERREUR connexion Vicidial ({$serverName}): " . $conn->connect_error);
        throw new Exception("Erreur connexion base de donnees Vicidial ({$serverName}): " . $conn->connect_error);
    }
    
    $conn->set_charset($charset);
    writeLog("Connexion Vicidial etablie sur {$serverName}");
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
    
    // Vérifier le cache
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
    
    // Récupérer depuis API
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
        CURLOPT_SSL_VERIFYPEER => true, // Sécurité: vérifier le certificat SSL
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

// Fonction pour récupérer un utilisateur par pseudo depuis l'API
function getUserByPseudo($pseudo) {
    global $CRM_CONFIG;
    
    if (empty($pseudo)) {
        writeLog("ERREUR: Pseudo vide pour getUserByPseudo");
        return null;
    }
    
    writeLog("Recuperation utilisateur par pseudo: " . $pseudo);
    
    $token = $CRM_CONFIG['api_token'];
    if (empty($token)) {
        writeLog("ERREUR: Token API vide");
        return null;
    }
    
    // Utiliser le nouveau endpoint avec paramètre pseudo
    $apiUrl = rtrim($CRM_CONFIG['api_url'], '/') . '/management/utilisateurs?pseudo=' . urlencode($pseudo);
    
    if (!function_exists('curl_init')) {
        writeLog("ERREUR: Extension CURL non disponible");
        return null;
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
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_FAILONERROR => true
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    
    if (curl_errno($ch)) {
        writeLog("ERREUR CURL getUserByPseudo: " . $curlError);
        curl_close($ch);
        return null;
    }
    
    curl_close($ch);
    
    writeLog("Reponse HTTP getUserByPseudo: " . $httpCode);
    
    if ($httpCode !== 200) {
        writeLog("ERREUR: Code HTTP " . $httpCode . " pour getUserByPseudo");
        return null;
    }
    
    if (empty($response)) {
        writeLog("ERREUR: Reponse vide pour getUserByPseudo");
        return null;
    }
    
    $data = @json_decode($response, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        writeLog("ERREUR JSON getUserByPseudo: " . json_last_error_msg());
        return null;
    }
    
    if (!isset($data['success']) || $data['success'] !== true || !isset($data['data'])) {
        writeLog("ERREUR: Structure de donnees invalide pour getUserByPseudo");
        return null;
    }
    
    // Si data est un objet (utilisateur unique), le retourner
    // Si data est un tableau, prendre le premier élément
    $user = is_array($data['data']) && isset($data['data'][0]) ? $data['data'][0] : $data['data'];
    
    if (isset($user['id'])) {
        writeLog("Utilisateur trouve: ID " . $user['id'] . " - Pseudo: " . ($user['pseudo'] ?? 'N/A'));
        return $user;
    }
    
    writeLog("ERREUR: Utilisateur non trouve ou ID manquant");
    return null;
}

// Fonction de validation et nettoyage des données
function sanitizeInput($data) {
    if (is_array($data)) {
        return array_map('sanitizeInput', $data);
    }
    return htmlspecialchars(strip_tags(trim($data)), ENT_QUOTES, 'UTF-8');
}

// Fonction d'authentification agent Vicidial (pseudo + mot de passe)
function authenticateAgentInVicidial($agentPseudo, $agentPass) {
    if (empty($agentPseudo) || $agentPass === null || $agentPass === '') {
        return false;
    }

    try {
        $conn = connectVicidialDB();

        $sql = "SELECT user, pass FROM vicidial_users WHERE user = ? LIMIT 1";
        $stmt = $conn->prepare($sql);

        if ($stmt === false) {
            $conn->close();
            return false;
        }

        $stmt->bind_param("s", $agentPseudo);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();

        $stmt->close();
        $conn->close();

        if (!$row || !isset($row['pass'])) {
            return false;
        }

        return hash_equals((string) $row['pass'], (string) $agentPass);
    } catch (Exception $e) {
        writeLog("ERREUR authentification agent: " . $e->getMessage());
        return false;
    }
}

// ============================================
// 5. TRAITEMENT DE LA CONNEXION
// ============================================
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['login'])) {
    writeLog("Tentative de connexion");

    $loginAgent = isset($_POST['agent']) ? trim($_POST['agent']) : '';
    $loginPass = isset($_POST['agent_pass']) ? (string) $_POST['agent_pass'] : '';

    if (empty($loginAgent)) {
        $loginError = "Le pseudo agent est requis";
        writeLog("ERREUR: Pseudo agent vide");
    } elseif ($loginPass === '') {
        $loginError = "Le mot de passe agent est requis";
        writeLog("ERREUR: Mot de passe agent vide pour: " . $loginAgent);
    } elseif (authenticateAgentInVicidial($loginAgent, $loginPass)) {
        $_SESSION['agent'] = $loginAgent;
        writeLog("Connexion reussie pour agent: " . $loginAgent);
        header('Location: ' . $_SERVER['PHP_SELF']);
        exit;
    } else {
        $loginError = "Pseudo ou mot de passe incorrect.";
        writeLog("ERREUR: Echec authentification agent: " . $loginAgent);
    }
}

// ============================================
// 6. TRAITEMENT PRINCIPAL (si connecté)
// ============================================
writeLog("Demarrage script - Agent: " . ($agent ?: 'non defini'));

// Si l'utilisateur n'est pas connecté, afficher la page de connexion
if (empty($agent)) {
    // Afficher la page de connexion
    ?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <title>Connexion - CRM Integration</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 0; 
            padding: 0; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        .login-container { 
            background: white; 
            padding: 40px; 
            border-radius: 10px; 
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            width: 100%;
            max-width: 400px;
        }
        h1 { 
            color: #2c3e50; 
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #3498db;
            padding-bottom: 15px;
        }
        .alert { 
            padding: 12px; 
            margin: 15px 0; 
            border-radius: 4px; 
        }
        .alert-error { 
            background: #f8d7da; 
            color: #721c24; 
            border: 1px solid #f5c6cb; 
        }
        .form-group { 
            margin-bottom: 20px; 
        }
        label { 
            display: block; 
            margin-bottom: 8px; 
            font-weight: bold; 
            color: #2c3e50; 
        }
        input[type="text"],
        input[type="password"] { 
            width: 100%; 
            padding: 12px; 
            border: 2px solid #ddd; 
            border-radius: 5px; 
            box-sizing: border-box;
            font-size: 16px;
            transition: border-color 0.3s;
        }
        input[type="text"]:focus,
        input[type="password"]:focus {
            outline: none;
            border-color: #3498db;
        }
        .btn { 
            width: 100%;
            padding: 12px 20px; 
            border: none; 
            border-radius: 5px; 
            cursor: pointer; 
            font-size: 16px;
            font-weight: bold;
            transition: background 0.3s;
        }
        .btn-primary { 
            background: #3498db; 
            color: white; 
        }
        .btn-primary:hover { 
            background: #2980b9; 
        }
        .info-text {
            text-align: center;
            color: #7f8c8d;
            font-size: 14px;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <h1>Connexion Agent</h1>
        
        <?php if ($loginError): ?>
            <div class="alert alert-error">
                <strong>Erreur:</strong> <?php echo htmlspecialchars($loginError); ?>
            </div>
        <?php endif; ?>
        
        <form method="POST" action="">
            <input type="hidden" name="login" value="1">
            <div class="form-group">
                <label for="agent">Pseudo Agent <span style="color: #e74c3c;">*</span></label>
                <input type="text" id="agent" name="agent" required autofocus 
                       placeholder="Entrez votre pseudo agent" 
                       value="<?php echo isset($_POST['agent']) ? htmlspecialchars($_POST['agent']) : ''; ?>"
                       autocomplete="username">
            </div>

            <div class="form-group">
                <label for="agent_pass">Mot de passe <span style="color: #e74c3c;">*</span></label>
                <input type="password" id="agent_pass" name="agent_pass" required
                       placeholder="Mot de passe Vicidial"
                       autocomplete="current-password">
            </div>
            
            <button type="submit" class="btn btn-primary">Se connecter</button>
        </form>
        
        <p class="info-text">
            Identifiants Vicidial (table vicidial_users) : pseudo et mot de passe agent.
        </p>
    </div>
</body>
</html>
    <?php
    exit;
}

// Gérer le rechargement de la dernière fiche OK
$reloadFiche = isset($_GET['reload']) || isset($_GET['load_last']);

// Récupérer les données Vicidial
// Charger automatiquement la dernière fiche OK au chargement de la page ou sur demande
if (!empty($agent) && ($reloadFiche || empty($vicidialData))) {
    $startTime = microtime(true);
    
    try {
        $vicidialConn = connectVicidialDB();
        
        // Requête sécurisée avec prepared statement
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
        
        writeLog("Execution requete SQL pour recuperer la derniere fiche OK");
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
            // Afficher un message si c'est un rechargement explicite
            if (isset($_GET['load_last']) && empty($success) && empty($error)) {
                $success = "Derniere fiche OK chargee.";
            }
        } else {
            if (isset($_GET['load_last'])) {
                $error = "Aucun lead qualifie 'OK' trouve pour l'agent: " . htmlspecialchars($agent);
            }
            writeLog("Aucun lead OK trouve pour l'agent: " . $agent);
        }
        
        $stmt->close();
        $vicidialConn->close();
        
        $queryTime = round((microtime(true) - $startTime) * 1000, 2);
        writeLog("Temps requete Vicidial: " . $queryTime . "ms");
        
    } catch (Exception $e) {
        $error = "Erreur Vicidial: " . $e->getMessage();
        writeLog("EXCEPTION: " . $e->getMessage());
    }
}

// Récupérer les listes depuis le CRM
writeLog("Recuperation des listes CRM...");
$startTime = microtime(true);

$typeContrats = getListFromAPIWithCache('type-contrat');
$produits = getListFromAPIWithCache('produits');

$apiTime = round((microtime(true) - $startTime) * 1000, 2);
writeLog("Temps total API/cache: " . $apiTime . "ms");

// Vérifier si les données sont valides
if (!is_array($typeContrats)) $typeContrats = [];
if (!is_array($produits)) $produits = [];

writeLog("Resultats: Contrats=" . count($typeContrats) . ", Produits=" . count($produits));

// Récupérer l'utilisateur par pseudo depuis l'API CRM
if (!empty($agent)) {
    writeLog("Recuperation utilisateur CRM par pseudo: " . $agent);
    $agentUser = getUserByPseudo($agent);
    if ($agentUser && isset($agentUser['id'])) {
        writeLog("Utilisateur CRM trouve: ID " . $agentUser['id']);
    } else {
        writeLog("ATTENTION: Utilisateur CRM non trouve pour le pseudo: " . $agent);
    }
}

// ============================================
// 7. TRAITEMENT DU FORMULAIRE
// ============================================
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    writeLog("Traitement formulaire POST");
    
    try {
        $token = $CRM_CONFIG['api_token'];
        if (empty($token)) {
            throw new Exception("Token API non configure");
        }
        
        // Validation et nettoyage des données
        $ficheData = [
            'nom' => sanitizeInput($_POST['nom'] ?? ''),
            'prenom' => sanitizeInput($_POST['prenom'] ?? ''),
            'tel' => sanitizeInput($_POST['telephone'] ?? ''),
            'gsm1' => sanitizeInput($_POST['gsm'] ?? ''),
            'adresse' => sanitizeInput($_POST['adresse'] ?? ''),
            'cp' => sanitizeInput($_POST['code_postal'] ?? ''),
            'ville' => sanitizeInput($_POST['ville'] ?? ''),
        ];
        
        // Ajouter l'ID de l'agent si disponible
        if ($agentUser && isset($agentUser['id'])) {
            $ficheData['id_agent'] = intval($agentUser['id']);
            writeLog("ID agent ajoute a la fiche: " . $ficheData['id_agent']);
            
            // Ajouter l'ID du centre de l'agent si disponible
            if (isset($agentUser['centre']) && !empty($agentUser['centre'])) {
                $ficheData['id_centre'] = intval($agentUser['centre']);
                writeLog("ID centre de l'agent ajoute a la fiche: " . $ficheData['id_centre']);
            } else {
                writeLog("ATTENTION: Centre de l'agent non disponible pour la fiche");
            }
        } else {
            writeLog("ATTENTION: ID agent non disponible pour la fiche");
        }
        
        // Ajouter l'état final BRUT (id 53)
        $ficheData['id_etat_final'] = 53;
        writeLog("Etat final BRUT (id 53) ajoute a la fiche");
        
        // Validation des champs requis
        // Tous les champs sont optionnels : aucune validation bloquante côté serveur.
        
        // Ajouter les données optionnelles avec validation
        $professionMr = !empty(trim($_POST['profession_mr'] ?? '')) ? sanitizeInput($_POST['profession_mr']) : null;
        $professionMadame = !empty(trim($_POST['profession_madame'] ?? '')) ? sanitizeInput($_POST['profession_madame']) : null;

        $optionalFields = [
            'date_appel' => !empty($_POST['date_appel']) ? date('c', strtotime($_POST['date_appel'])) : null,
            'situation_conjugale' => !empty($_POST['situation_conjugale']) ? sanitizeInput($_POST['situation_conjugale']) : null,
            'age_mr' => !empty($_POST['age_mr']) ? sanitizeInput($_POST['age_mr']) : null,
            'age_madame' => !empty($_POST['age_madame']) ? sanitizeInput($_POST['age_madame']) : null,
            'nb_enfants' => !empty($_POST['nb_enfants']) ? intval($_POST['nb_enfants']) : null,
            'profession_mr' => $professionMr,
            'profession_madame' => $professionMadame,
            'type_contrat_mr' => !empty($_POST['type_contrat_mr']) ? intval($_POST['type_contrat_mr']) : null,
            'type_contrat_madame' => !empty($_POST['type_contrat_madame']) ? intval($_POST['type_contrat_madame']) : null,
            'entretien_avec' => !empty($_POST['entretien_avec']) ? sanitizeInput($_POST['entretien_avec']) : null,
            'proprietaire_maison' => !empty($_POST['proprietaire_maison']) ? sanitizeInput($_POST['proprietaire_maison']) : null,
            'revenu_foyer' => !empty($_POST['revenu_foyer']) ? sanitizeInput($_POST['revenu_foyer']) : null,
            'etude' => !empty($_POST['etude']) ? sanitizeInput($_POST['etude']) : null,
            'details_etude' => (!empty($_POST['etude']) && strtoupper($_POST['etude']) === 'OUI' && !empty(trim($_POST['details_etude'] ?? '')))
                ? sanitizeInput($_POST['details_etude']) : null,
            'consommation_electricite' => !empty($_POST['consommation_electricite']) ? sanitizeInput($_POST['consommation_electricite']) : null,
            'commentaire' => !empty($_POST['commentaire_agent']) ? sanitizeInput($_POST['commentaire_agent']) : null,
            // Produit
            'produit' => !empty($_POST['produit']) ? intval($_POST['produit']) : null,
            // Champs PV
            'orientation_toiture' => !empty($_POST['orientation_toiture']) ? sanitizeInput($_POST['orientation_toiture']) : null,
            'zones_ombres' => !empty($_POST['zones_ombres']) ? sanitizeInput($_POST['zones_ombres']) : null,
            'site_classe' => !empty($_POST['site_classe']) ? sanitizeInput($_POST['site_classe']) : null
        ];
        
        // Filtrer les champs nuls
        foreach ($optionalFields as $key => $value) {
            if ($value !== null && $value !== '') {
                $ficheData[$key] = $value;
            }
        }
        
        writeLog("Donnees a envoyer: " . json_encode($ficheData, JSON_UNESCAPED_UNICODE));
        
        // Envoyer à l'API
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
            CURLOPT_SSL_VERIFYPEER => true, // Sécurité
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
        
        // Acceptation automatique (règle regles_autorisation, doublon téléphone)
        if (isset($responseData['success']) && $responseData['success'] &&
            !empty($responseData['data']['autoApproved'])) {
            $message = $responseData['message'] ?? 'Fiche acceptee automatiquement (regle d\'autorisation).';
            writeLog('AUTO APPROBATION: ' . $message);
            $_SESSION['success_message'] = $message;
            header('Location: ' . $_SERVER['PHP_SELF'] . '?reload=1');
            exit;
        }

        // Vérifier si une demande d'insertion existe déjà (pas de création)
        if (isset($responseData['success']) && $responseData['success'] && 
            isset($responseData['data']['existingDemande']) && $responseData['data']['existingDemande']) {
            $message = "Fiche existante, une demande d'insertion a ete envoyee au backoffice.";
            writeLog("DEMANDE D'INSERTION EXISTANTE: " . $message);
            // Rediriger pour éviter la resoumission - stocker comme notice (rouge)
            $_SESSION['notice_message'] = $message;
            header('Location: ' . $_SERVER['PHP_SELF'] . '?reload=1');
            exit;
        }
        
        // Vérifier si une demande d'insertion a été créée (fiche existante)
        if (isset($responseData['success']) && $responseData['success'] && 
            isset($responseData['data']['demandeCreated']) && $responseData['data']['demandeCreated']) {
            $demandeId = $responseData['data']['demandeId'] ?? null;
            $existingFicheId = $responseData['data']['existingFicheId'] ?? null;
            $message = "Fiche existante, une demande d'insertion a ete envoyee au backoffice.";
            writeLog("DEMANDE D'INSERTION CREE: " . $message . " (demandeId=" . ($demandeId ?? 'N/A') . ", existingFicheId=" . ($existingFicheId ?? 'N/A') . ")");
            // Rediriger pour éviter la resoumission - stocker comme notice (rouge)
            $_SESSION['notice_message'] = $message;
            header('Location: ' . $_SERVER['PHP_SELF'] . '?reload=1');
            exit;
        } elseif ($httpCode === 201) {
            // Fiche créée avec succès
            if (isset($responseData['success']) && $responseData['success']) {
                $message = "Fiche inseree avec succes.";
                writeLog("SUCCES: " . $message);
                // Rediriger pour éviter la resoumission
                $_SESSION['success_message'] = $message;
                header('Location: ' . $_SERVER['PHP_SELF'] . '?reload=1');
                exit;
            } else {
                throw new Exception("Reponse API indique un echec: " . 
                                  ($responseData['message'] ?? 'Erreur inconnue'));
            }
        } else {
            // Erreur
            $errorMsg = $responseData['message'] ?? "Erreur HTTP $httpCode";
            throw new Exception($errorMsg);
        }
        
    } catch (Exception $e) {
        $error = $e->getMessage();
        writeLog("ERREUR creation fiche: " . $error);
        // Stocker l'erreur en session pour l'afficher après redirection
        $_SESSION['error_message'] = $error;
        header('Location: ' . $_SERVER['PHP_SELF'] . '?reload=1');
        exit;
    }
}

// Récupérer les messages de session (après redirection POST-REDIRECT-GET)
if (isset($_SESSION['success_message'])) {
    $success = $_SESSION['success_message'];
    unset($_SESSION['success_message']);
}
if (isset($_SESSION['notice_message'])) {
    $notice = $_SESSION['notice_message'];
    unset($_SESSION['notice_message']);
}
if (isset($_SESSION['error_message'])) {
    $error = $_SESSION['error_message'];
    unset($_SESSION['error_message']);
}

// ============================================
// 8. AFFICHAGE HTML
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
    <title>Création Fiche CRM - Vicidial</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1000px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        .alert { padding: 10px; margin: 10px 0; border-radius: 4px; }
        .alert-error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .alert-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .alert-notice { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
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
        .debug-info { background: #f8f9fa; padding: 10px; border: 1px dashed #6c757d; margin: 10px 0; font-size: 12px; color: #6c757d; }
        .header-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .btn-secondary { background: #95a5a6; color: white; padding: 8px 16px; text-decoration: none; display: inline-block; }
        .btn-secondary:hover { background: #7f8c8d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header-actions">
            <div>
                <h1 style="margin: 0; border: none; padding: 0;">Création de Fiche CRM</h1>
                <p style="margin: 5px 0 0 0;">
                    Agent: <strong><?php echo htmlspecialchars($agent); ?></strong>
                    <?php if ($agentUser && isset($agentUser['id'])): ?>
                        <span style="color: #7f8c8d; font-size: 0.95em;">(ID CRM: <?php echo (int) $agentUser['id']; ?>)</span>
                    <?php endif; ?>
                </p>
            </div>
            <div style="display: flex; gap: 10px;">
                <a href="?load_last=1" class="btn btn-secondary" style="background: #27ae60;">Charger la dernière fiche OK</a>
                <a href="?logout=1" class="btn btn-secondary">Déconnexion</a>
            </div>
        </div>
        
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
        
        <?php if ($notice): ?>
            <div class="alert alert-notice">
                <strong>Notice:</strong> <?php echo htmlspecialchars($notice); ?>
            </div>
        <?php endif; ?>
        
        <?php if ($success): ?>
            <div class="alert alert-success">
                <strong>Succès:</strong> <?php echo htmlspecialchars($success); ?>
            </div>
        <?php endif; ?>
        
        <?php if ($vicidialData): ?>
            <div class="vicidial-info">
                <strong>Dernière fiche qualifiée (Vicidial):</strong><br>
                Nom: <?php echo htmlspecialchars($vicidialData['last_name']); ?> | 
                Prénom: <?php echo htmlspecialchars($vicidialData['first_name']); ?> | 
                Téléphone: <?php echo htmlspecialchars($vicidialData['phone_number']); ?> |
                Dernière modif: <?php echo htmlspecialchars($vicidialData['modify_date'] ?? 'N/A'); ?>
            </div>
        <?php endif; ?>
        
        <form method="POST" action="">
            <!-- Informations Vicidial -->
            <div class="form-section">
                <div class="section-title">Informations depuis Vicidial</div>
                <div class="form-grid">
                    <div class="form-group">
                        <label>Nom</label>
                        <input type="text" name="nom" value="<?php echo htmlspecialchars($vicidialData['last_name'] ?? ''); ?>">
                    </div>
                    <div class="form-group">
                        <label>Prénom</label>
                        <input type="text" name="prenom" value="<?php echo htmlspecialchars($vicidialData['first_name'] ?? ''); ?>">
                    </div>
                    <div class="form-group">
                        <label>Téléphone</label>
                        <input type="tel" name="telephone" value="<?php echo htmlspecialchars($vicidialData['phone_number'] ?? ''); ?>">
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
                        <input type="datetime-local" name="date_appel" value="<?php 
                            $modifyDate = $vicidialData['modify_date'] ?? null;
                            if (!empty($modifyDate) && ($ts = strtotime($modifyDate)) !== false) {
                                echo date('Y-m-d\TH:i', $ts);
                            } else {
                                echo date('Y-m-d\TH:i');
                            }
                        ?>">
                    </div>
                </div>
            </div>
            
            <!-- Critères Client -->
            <div class="form-section">
                <div class="section-title">Critères Client</div>
                <div class="form-grid">
                    <div class="form-group">
                        <label>Situation Conjugale</label>
                        <select name="situation_conjugale" id="situation_conjugale">
                            <option value="">-- Sélectionner --</option>
                            <option value="Célibataire">Célibataire</option>
                            <option value="Marié(e)">Marié(e)</option>
                            <option value="Concubinage">Concubinage</option>
                            <option value="Divorcé(e)">Divorcé(e)</option>
                            <option value="Veuf(ve)">Veuf(ve)</option>
                        </select>
                    </div>
                    <div class="form-group cond-required-if-couple">
                        <label>Âge M.</label>
                        <input type="text" name="age_mr" placeholder="Ex: 45">
                    </div>
                    <div class="form-group cond-required-if-couple">
                        <label>Âge Mme</label>
                        <input type="text" name="age_madame" placeholder="Ex: 42">
                    </div>
                    <div class="form-group">
                        <label>Nombre d'Enfants</label>
                        <input type="number" name="nb_enfants" min="0" value="0">
                    </div>
                    <div class="form-group cond-required-if-couple">
                        <label>Profession M.</label>
                        <input type="text" name="profession_mr" placeholder="Saisir une profession..." autocomplete="off" value="">
                    </div>
                    <div class="form-group cond-required-if-couple">
                        <label>Profession Mme</label>
                        <input type="text" name="profession_madame" placeholder="Saisir une profession..." autocomplete="off" value="">
                    </div>
                    <div class="form-group cond-required-if-couple">
                        <label>Type Contrat M.</label>
                        <select name="type_contrat_mr">
                            <option value="">-- Sélectionner --</option>
                            <?php foreach ($typeContrats as $contrat): ?>
                                <option value="<?php echo htmlspecialchars($contrat['id']); ?>">
                                    <?php echo htmlspecialchars($contrat['nom']); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="form-group cond-required-if-couple">
                        <label>Type Contrat Mme</label>
                        <select name="type_contrat_madame">
                            <option value="">-- Sélectionner --</option>
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
                            <option value="">-- Sélectionner --</option>
                            <option value="Monsieur">Monsieur</option>
                            <option value="Madame">Madame</option>
                            <option value="Couple">Couple</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Propriétaire Maison</label>
                        <select name="proprietaire_maison">
                            <option value="">-- Sélectionner --</option>
                            <option value="MR">MR</option>
                            <option value="MME">MME</option>
                            <option value="LES DEUX">LES DEUX</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Revenu du Foyer</label>
                        <input type="text" name="revenu_foyer" placeholder="Ex: 3000-5000€">
                    </div>
                </div>
            </div>
            
            <!-- Critères Techniques -->
            <div class="form-section">
                <div class="section-title">Critères Techniques</div>
                <div class="form-grid">
                    <div class="form-group">
                        <label>Produit</label>
                        <select name="produit" id="produit" onchange="toggleProductFields()">
                            <option value="">-- Sélectionner --</option>
                            <?php foreach ($produits as $produit): ?>
                                <option value="<?php echo htmlspecialchars($produit['id']); ?>" 
                                        data-nom="<?php echo htmlspecialchars(strtoupper($produit['nom'] ?? '')); ?>">
                                    <?php echo htmlspecialchars($produit['nom']); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Déjà fait une étude</label>
                        <select name="etude" id="etude" onchange="toggleEtudeDetails()">
                            <option value="">-- Sélectionner --</option>
                            <option value="OUI">OUI</option>
                            <option value="NON">NON</option>
                        </select>
                    </div>
                    <div class="form-group champ-etude-details" style="display: none;">
                        <label>Détails étude</label>
                        <input type="text" name="details_etude" placeholder="Préciser les détails de l'étude...">
                    </div>
                    
                    <!-- Champs spécifiques PV -->
                    <div class="form-group champ-pv" style="display: none;">
                        <label>Consommation Électricité (€)</label>
                        <input type="text" name="consommation_electricite" placeholder="Ex: 800 €/an">
                    </div>
                    <div class="form-group champ-pv" style="display: none;">
                        <label>Orientation Toiture</label>
                        <input type="text" name="orientation_toiture" placeholder="Ex: Sud, Nord-Est...">
                    </div>
                    <div class="form-group champ-pv" style="display: none;">
                        <label>Zones d'Ombres</label>
                        <input type="text" name="zones_ombres" placeholder="Décrire les zones d'ombres">
                    </div>
                    <div class="form-group champ-pv" style="display: none;">
                        <label>Site Classé</label>
                        <select name="site_classe">
                            <option value="">-- Sélectionner --</option>
                            <option value="OUI">OUI</option>
                            <option value="NON">NON</option>
                        </select>
                    </div>
                    
                    <div class="form-group full-width">
                        <label>Commentaire Agent</label>
                        <textarea name="commentaire_agent" placeholder="Notes supplémentaires..."></textarea>
                    </div>
                </div>
            </div>
            
            <div class="form-actions">
                <button type="submit" class="btn btn-primary">Créer la Fiche</button>
            </div>
        </form>
    </div>
    
    <script>
        // Tous les champs sont optionnels : on ne fait que retirer les éventuels attributs `required`
        // qui auraient pu être ajoutés ailleurs (sécurité, on n'en ajoute jamais).
        function setRequiredInContainer(container, required) {
            const inputs = container.querySelectorAll('input, select, textarea');
            inputs.forEach(function(el) {
                el.removeAttribute('required');
            });
        }
        function toggleEtudeDetails() {
            const etudeSelect = document.getElementById('etude');
            const detailsBlock = document.querySelector('.champ-etude-details');
            if (!etudeSelect || !detailsBlock) return;
            const isOui = etudeSelect.value === 'OUI';
            detailsBlock.style.display = isOui ? 'block' : 'none';
            if (!isOui) {
                const input = detailsBlock.querySelector('input[name="details_etude"]');
                if (input) input.value = '';
            }
        }

        function toggleProductFields() {
            const produitSelect = document.getElementById('produit');
            if (!produitSelect) return;
            
            const selectedOption = produitSelect.options[produitSelect.selectedIndex];
            const produitNom = selectedOption ? selectedOption.getAttribute('data-nom') : '';
            
            const champsPV = document.querySelectorAll('.champ-pv');
            
            champsPV.forEach(function(champ) {
                champ.style.display = 'none';
                setRequiredInContainer(champ, false);
            });
            
            if (produitNom === 'PV') {
                champsPV.forEach(function(champ) {
                    champ.style.display = 'block';
                    setRequiredInContainer(champ, true);
                });
            }
        }
        
        // Tous les champs sont optionnels : on s'assure qu'aucun attribut `required`
        // n'est ajouté en fonction de la situation conjugale.
        function updateRequiredCoupleFields() {
            var professionMadameInput = document.querySelector('input[name="profession_madame"]');
            var typeContratMrSelect = document.querySelector('select[name="type_contrat_mr"]');
            if (professionMadameInput) professionMadameInput.removeAttribute('required');
            if (typeContratMrSelect) typeContratMrSelect.removeAttribute('required');
        }
        
        // Appeler la fonction au chargement de la page si un produit est déjà sélectionné
        document.addEventListener('DOMContentLoaded', function() {
            toggleProductFields();
            toggleEtudeDetails();
            updateRequiredCoupleFields();
            var sitSelect = document.getElementById('situation_conjugale');
            if (sitSelect) sitSelect.addEventListener('change', updateRequiredCoupleFields);
        });
    </script>
</body>
</html>
<?php
// Fin du script
$totalTime = round((microtime(true) - ($_SERVER['REQUEST_TIME_FLOAT'] ?? microtime(true))) * 1000, 2);
writeLog("Script termine - Temps total: " . $totalTime . "ms");
?>


