-- =====================================================
-- Script pour mettre à jour id_fiche dans la table signature
-- en cherchant dans la table fiches par numéro de téléphone
-- Base de données: crm
-- =====================================================
-- 
-- Ce script :
-- 1. Prend les numéros de téléphone (tel) de la table signature
-- 2. Cherche dans la table fiches les lignes correspondantes où archive = 0
-- 3. Met à jour id_fiche dans signature avec l'ID trouvé (la fiche la plus récente si plusieurs)
--
-- =====================================================

USE `crm`;

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_SAFE_UPDATES = 0;

-- =====================================================
-- MISE À JOUR DES SIGNATURES
-- =====================================================

-- Version compatible MySQL 5.7 / MariaDB (sans ROW_NUMBER)
-- Mise à jour en prenant la fiche avec l'ID le plus élevé par tel (archive = 0)
UPDATE signature s
INNER JOIN (
    SELECT 
        f.tel,
        f.id
    FROM fiches f
    INNER JOIN (
        SELECT 
            tel,
            MAX(id) as max_id
        FROM fiches
        WHERE (archive = 0 OR archive IS NULL)
          AND tel IS NOT NULL
          AND tel != ''
        GROUP BY tel
    ) f_max ON f.tel = f_max.tel AND f.id = f_max.max_id
    WHERE (f.archive = 0 OR f.archive IS NULL)
) f ON f.tel = s.tel
SET s.id_fiche = f.id
WHERE (s.id_fiche IS NULL OR s.id_fiche = 0)
  AND s.tel IS NOT NULL
  AND s.tel != ''
  AND s.tel = f.tel;

-- =====================================================
-- CORRECTION : Supprimer id_fiche si la fiche est archivée
-- =====================================================

UPDATE signature s
INNER JOIN fiches f ON s.id_fiche = f.id
SET s.id_fiche = NULL
WHERE s.id_fiche IS NOT NULL
  AND s.id_fiche > 0
  AND f.archive = 1;

-- =====================================================
-- RÉSUMÉ
-- =====================================================

SELECT 
    '=== RÉSUMÉ ===' as info;

SELECT 
    COUNT(*) as total_signatures_avec_id_fiche
FROM signature
WHERE id_fiche IS NOT NULL AND id_fiche > 0;

SELECT 
    COUNT(*) as signatures_sans_id_fiche
FROM signature
WHERE (id_fiche IS NULL OR id_fiche = 0)
  AND tel IS NOT NULL
  AND tel != '';

SET SQL_SAFE_UPDATES = 1;
SET FOREIGN_KEY_CHECKS = 1;

SELECT '✅ Script terminé' as message;
