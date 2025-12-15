<?php
/**
 * Configuration Vicidial
 * 
 * Ce fichier contient la configuration pour la connexion à la base de données Vicidial.
 * Modifiez les valeurs ci-dessous selon votre environnement.
 * 
 * IMPORTANT: Ne pas commiter ce fichier avec des mots de passe en production.
 */

return [
    // Configuration de la base de données Vicidial
    'vicidial' => [
        // Adresse du serveur de base de données Vicidial
        'host' => getenv('VICIDIAL_DB_HOST') ?: 'localhost',
        
        // Port de connexion MySQL (par défaut 3306)
        'port' => getenv('VICIDIAL_DB_PORT') ?: 3306,
        
        // Nom d'utilisateur pour la connexion à la base de données
        'user' => getenv('VICIDIAL_DB_USER') ?: 'cron',
        
        // Mot de passe pour la connexion à la base de données
        'password' => getenv('VICIDIAL_DB_PASSWORD') ?: '1234',
        
        // Nom de la base de données Vicidial
        'database' => getenv('VICIDIAL_DB_NAME') ?: 'asterisk',
        
        // Charset pour la connexion (recommandé: utf8mb4)
        'charset' => 'utf8mb4',
        
        // Timeout de connexion en secondes
        'connect_timeout' => 10,
        
        // Description du serveur (optionnel, pour information)
        'description' => 'Serveur Vicidial Principal',
        
        // Nom du serveur (optionnel, pour logs)
        'server_name' => 'Vicidial-Server-1'
    ],
    
    // Configuration CRM (conservée pour compatibilité)
    'crm' => [
        'api_url' => getenv('CRM_API_URL') ?: 'https://crm.jwsgroup.fr/api',
        'api_token' => getenv('CRM_API_TOKEN') ?: ''
    ],
    
    // Configuration du cache
    'cache' => [
        'enabled' => true,
        'duration' => 300, // 5 minutes en secondes
        'directory' => __DIR__ . '/cache/'
    ]
];

