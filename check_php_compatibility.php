<?php
/**
 * Script de vérification de compatibilité PHP pour l'intégration Vicidial -> CRM
 * À exécuter sur le serveur d'application pour vérifier les prérequis
 */

// ============================================
// 1. CONFIGURATION
// ============================================
$REQUIRED_PHP_VERSION = '7.4.0';
$REQUIRED_EXTENSIONS = ['mysqli', 'curl', 'json'];
$REQUIRED_FUNCTIONS = ['mysqli_connect', 'curl_init', 'json_encode', 'json_decode'];

// ============================================
// 2. VÉRIFICATIONS
// ============================================
$checks = [];
$allPassed = true;

// Version PHP
$phpVersion = phpversion();
$checks['php_version'] = [
    'name' => 'Version PHP',
    'required' => $REQUIRED_PHP_VERSION,
    'current' => $phpVersion,
    'status' => version_compare($phpVersion, $REQUIRED_PHP_VERSION, '>='),
    'message' => version_compare($phpVersion, $REQUIRED_PHP_VERSION, '>=') 
        ? 'OK' 
        : "Version PHP insuffisante. Requis: {$REQUIRED_PHP_VERSION}, Actuel: {$phpVersion}"
];
if (!$checks['php_version']['status']) $allPassed = false;

// Extensions PHP
foreach ($REQUIRED_EXTENSIONS as $ext) {
    $loaded = extension_loaded($ext);
    $checks["ext_{$ext}"] = [
        'name' => "Extension {$ext}",
        'required' => 'Oui',
        'current' => $loaded ? 'Chargée' : 'Non chargée',
        'status' => $loaded,
        'message' => $loaded ? 'OK' : "Extension {$ext} non chargée"
    ];
    if (!$loaded) $allPassed = false;
}

// Fonctions PHP
foreach ($REQUIRED_FUNCTIONS as $func) {
    $exists = function_exists($func);
    $checks["func_{$func}"] = [
        'name' => "Fonction {$func}",
        'required' => 'Oui',
        'current' => $exists ? 'Disponible' : 'Non disponible',
        'status' => $exists,
        'message' => $exists ? 'OK' : "Fonction {$func} non disponible"
    ];
    if (!$exists) $allPassed = false;
}

// Permissions d'écriture (pour le cache)
$cacheDir = __DIR__ . '/cache';
$checks['cache_dir'] = [
    'name' => 'Répertoire cache',
    'required' => 'Écriture autorisée',
    'current' => is_dir($cacheDir) ? 'Existe' : 'Inexistant',
    'status' => is_dir($cacheDir) && is_writable($cacheDir),
    'message' => (is_dir($cacheDir) && is_writable($cacheDir)) 
        ? 'OK' 
        : "Le répertoire cache doit être créable/écritable: {$cacheDir}"
];

// Test de connexion MySQL
$testMysql = false;
$mysqlError = '';
try {
    $testConn = @new mysqli('localhost', 'cron', '1234', 'asterisk');
    if ($testConn->connect_error) {
        $mysqlError = $testConn->connect_error;
    } else {
        $testMysql = true;
        $testConn->close();
    }
} catch (Exception $e) {
    $mysqlError = $e->getMessage();
}

$checks['mysql_connection'] = [
    'name' => 'Connexion MySQL (Vicidial)',
    'required' => 'localhost / cron / asterisk',
    'current' => $testMysql ? 'Connecté' : 'Échec',
    'status' => $testMysql,
    'message' => $testMysql ? 'OK' : "Impossible de se connecter: {$mysqlError}"
];

// Test CURL
$testCurl = false;
$curlError = '';
if (function_exists('curl_init')) {
    $ch = curl_init();
    if ($ch !== false) {
        curl_setopt($ch, CURLOPT_URL, 'https://crm.jwsgroup.fr');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
        
        $result = @curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);
        
        $testCurl = ($httpCode > 0);
    }
}

$checks['curl_connection'] = [
    'name' => 'Connexion CURL (API CRM)',
    'required' => 'https://crm.jwsgroup.fr accessible',
    'current' => $testCurl ? 'Accessible' : 'Inaccessible',
    'status' => $testCurl,
    'message' => $testCurl ? 'OK' : "Impossible d'accéder à l'API: {$curlError}"
];

// Test JSON
$testJson = false;
$jsonError = '';
try {
    $testData = ['test' => 'data', 'number' => 123];
    $encoded = json_encode($testData);
    $decoded = json_decode($encoded, true);
    $testJson = ($encoded !== false && $decoded === $testData);
    if (!$testJson) {
        $jsonError = json_last_error_msg();
    }
} catch (Exception $e) {
    $jsonError = $e->getMessage();
}

$checks['json_functions'] = [
    'name' => 'Fonctions JSON',
    'required' => 'json_encode/json_decode fonctionnels',
    'current' => $testJson ? 'Fonctionnel' : 'Défaillant',
    'status' => $testJson,
    'message' => $testJson ? 'OK' : "Erreur JSON: {$jsonError}"
];

// Mémoire disponible
$memoryLimit = ini_get('memory_limit');
$memoryLimitBytes = return_bytes($memoryLimit);
$checks['memory_limit'] = [
    'name' => 'Limite mémoire PHP',
    'required' => '>= 128M recommandé',
    'current' => $memoryLimit,
    'status' => $memoryLimitBytes >= 134217728, // 128MB
    'message' => ($memoryLimitBytes >= 134217728) 
        ? 'OK' 
        : "Limite mémoire faible: {$memoryLimit}. Recommandé: 128M minimum"
];

// Timeout d'exécution
$maxExecutionTime = ini_get('max_execution_time');
$checks['max_execution_time'] = [
    'name' => 'Temps d\'exécution max',
    'required' => '>= 30 secondes',
    'current' => $maxExecutionTime . ' secondes',
    'status' => ($maxExecutionTime >= 30 || $maxExecutionTime == 0),
    'message' => (($maxExecutionTime >= 30 || $maxExecutionTime == 0))
        ? 'OK'
        : "Timeout trop court: {$maxExecutionTime}s. Recommandé: 30s minimum"
];

// Fonction helper pour convertir memory_limit
function return_bytes($val) {
    $val = trim($val);
    $last = strtolower($val[strlen($val)-1]);
    $val = (int)$val;
    switch($last) {
        case 'g': $val *= 1024;
        case 'm': $val *= 1024;
        case 'k': $val *= 1024;
    }
    return $val;
}

// ============================================
// 3. AFFICHAGE DES RÉSULTATS
// ============================================
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vérification Compatibilité PHP</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 900px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        .summary { padding: 15px; margin: 20px 0; border-radius: 5px; font-size: 18px; font-weight: bold; }
        .summary.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .summary.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #3498db; color: white; }
        .status-ok { color: #28a745; font-weight: bold; }
        .status-error { color: #dc3545; font-weight: bold; }
        .info { background: #e7f3ff; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #2196F3; }
        .warning { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Vérification de Compatibilité PHP</h1>
        
        <div class="summary <?php echo $allPassed ? 'success' : 'error'; ?>">
            <?php echo $allPassed ? '✓ Tous les tests sont passés' : '✗ Certains tests ont échoué'; ?>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>Vérification</th>
                    <th>Requis</th>
                    <th>Actuel</th>
                    <th>Statut</th>
                    <th>Message</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($checks as $check): ?>
                    <tr>
                        <td><strong><?php echo htmlspecialchars($check['name']); ?></strong></td>
                        <td><?php echo htmlspecialchars($check['required']); ?></td>
                        <td><?php echo htmlspecialchars($check['current']); ?></td>
                        <td class="<?php echo $check['status'] ? 'status-ok' : 'status-error'; ?>">
                            <?php echo $check['status'] ? '✓ OK' : '✗ ÉCHEC'; ?>
                        </td>
                        <td><?php echo htmlspecialchars($check['message']); ?></td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
        
        <div class="info">
            <strong>Informations système:</strong><br>
            • PHP Version: <?php echo phpversion(); ?><br>
            • Serveur: <?php echo $_SERVER['SERVER_SOFTWARE'] ?? 'N/A'; ?><br>
            • OS: <?php echo PHP_OS; ?><br>
            • Mémoire utilisée: <?php echo round(memory_get_usage() / 1024 / 1024, 2); ?> MB<br>
            • Mémoire pic: <?php echo round(memory_get_peak_usage() / 1024 / 1024, 2); ?> MB<br>
            • Répertoire script: <?php echo __DIR__; ?><br>
            • Répertoire cache: <?php echo __DIR__ . '/cache'; ?>
        </div>
        
        <?php if (!$allPassed): ?>
            <div class="warning">
                <strong>⚠️ Actions recommandées:</strong><br>
                <ul>
                    <?php foreach ($checks as $check): ?>
                        <?php if (!$check['status']): ?>
                            <li><?php echo htmlspecialchars($check['message']); ?></li>
                        <?php endif; ?>
                    <?php endforeach; ?>
                </ul>
            </div>
        <?php endif; ?>
        
        <div class="info">
            <strong>📝 Notes importantes:</strong><br>
            • Assurez-vous que le répertoire <code>cache/</code> existe et est accessible en écriture<br>
            • Vérifiez que les credentials MySQL (Vicidial) sont corrects<br>
            • Configurez le token API dans le script principal<br>
            • En production, désactivez <code>display_errors</code> et configurez les logs d'erreurs
        </div>
    </div>
</body>
</html>

