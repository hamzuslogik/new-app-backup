-- =====================================================
-- Script pour mettre à jour id_fiche et date_planning dans signature
-- Base de données: crm
-- =====================================================
--
-- 1. id_fiche : à partir du tel, cherche dans fiches (archive = 0) et remplit id_fiche
--    (fiche la plus récente si plusieurs pour le même tel).
-- 2. date_planning : pour les signatures ayant un id_fiche, met à jour date_planning
--    à partir de la date RDV de la fiche (fiches.date_rdv_time). date_heure n'est pas modifié.
--    (Prérequis : colonne date_planning présente dans signature, ex. add_date_planning_to_signature.sql)
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
-- DÉTECTION : Signatures dont date_planning != date RDV de la fiche
-- =====================================================

SELECT
    '=== DÉTECTION DATE PLANNING ===' AS info;

SELECT
    COUNT(*) AS signatures_avec_ecart_date_planning
FROM signature s
INNER JOIN fiches f ON s.id_fiche = f.id
WHERE s.id_fiche IS NOT NULL
  AND s.id_fiche > 0
  AND f.date_rdv_time IS NOT NULL
  AND (s.date_planning IS NULL OR s.date_planning != f.date_rdv_time);

-- =====================================================
-- MISE À JOUR : Renseigner date_planning à partir de la date RDV de la fiche (date_heure inchangé)
-- =====================================================

UPDATE signature s
INNER JOIN fiches f ON s.id_fiche = f.id
SET s.date_planning = f.date_rdv_time
WHERE s.id_fiche IS NOT NULL
  AND s.id_fiche > 0
  AND f.date_rdv_time IS NOT NULL
  AND (s.date_planning IS NULL OR s.date_planning != f.date_rdv_time);

SELECT CONCAT('Date planning mise à jour : ', ROW_COUNT(), ' ligne(s)') AS resultat;

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

SELECT 
    COUNT(*) as signatures_date_planning_alignee
FROM signature s
INNER JOIN fiches f ON s.id_fiche = f.id
WHERE s.id_fiche IS NOT NULL AND s.id_fiche > 0
  AND f.date_rdv_time IS NOT NULL
  AND s.date_planning = f.date_rdv_time;

SET SQL_SAFE_UPDATES = 1;
SET FOREIGN_KEY_CHECKS = 1;

SELECT '✅ Script terminé' as message;
