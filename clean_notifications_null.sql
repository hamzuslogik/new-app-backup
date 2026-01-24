-- =====================================================
-- Script pour nettoyer les notifications NULL
-- Base de données: crm
-- =====================================================

USE `crm`;

-- =====================================================
-- ÉTAPE 1 : Identifier les notifications NULL
-- =====================================================

-- Afficher les notifications avec des valeurs NULL critiques
SELECT 
  id,
  type,
  id_fiche,
  message,
  destination,
  date_creation,
  lu,
  metadata,
  action,
  CASE 
    WHEN type IS NULL OR type = '' THEN 'type NULL'
    WHEN message IS NULL OR message = '' THEN 'message NULL'
    WHEN destination IS NULL THEN 'destination NULL'
    WHEN date_creation IS NULL THEN 'date_creation NULL'
    ELSE 'OK'
  END as probleme
FROM notifications
WHERE type IS NULL 
   OR type = ''
   OR message IS NULL 
   OR message = ''
   OR destination IS NULL
   OR date_creation IS NULL
ORDER BY date_creation DESC;

-- Compter les notifications NULL
SELECT 
  COUNT(*) as total_notifications_null,
  SUM(CASE WHEN type IS NULL OR type = '' THEN 1 ELSE 0 END) as type_null,
  SUM(CASE WHEN message IS NULL OR message = '' THEN 1 ELSE 0 END) as message_null,
  SUM(CASE WHEN destination IS NULL THEN 1 ELSE 0 END) as destination_null,
  SUM(CASE WHEN date_creation IS NULL THEN 1 ELSE 0 END) as date_creation_null
FROM notifications
WHERE type IS NULL 
   OR type = ''
   OR message IS NULL 
   OR message = ''
   OR destination IS NULL
   OR date_creation IS NULL;

-- =====================================================
-- ÉTAPE 2 : Supprimer les notifications invalides
-- =====================================================
-- ATTENTION : Exécuter avec précaution, vérifier d'abord avec la requête ci-dessus

-- Supprimer les notifications avec des valeurs NULL critiques
DELETE FROM notifications
WHERE type IS NULL 
   OR type = ''
   OR message IS NULL 
   OR message = ''
   OR destination IS NULL
   OR date_creation IS NULL;

-- =====================================================
-- ÉTAPE 3 : Vérifier qu'il ne reste plus de notifications NULL
-- =====================================================

SELECT COUNT(*) as notifications_null_restantes
FROM notifications
WHERE type IS NULL 
   OR type = ''
   OR message IS NULL 
   OR message = ''
   OR destination IS NULL
   OR date_creation IS NULL;

-- =====================================================
-- FIN DU SCRIPT
-- =====================================================

