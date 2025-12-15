-- =====================================================
-- Script pour vérifier la structure de yj_histo_fiche
-- =====================================================
-- Exécuter ce script AVANT migrate_yj_histo_fiche_to_historique.sql
-- pour identifier les colonnes disponibles

USE `crm`;

-- 1. Vérifier si la table existe
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN 'OK - Table yj_histo_fiche existe'
        ELSE 'ERREUR - Table yj_histo_fiche n''existe pas'
    END as verification_table
FROM information_schema.tables 
WHERE table_schema = DATABASE() 
  AND table_name = 'yj_histo_fiche';

-- 2. Afficher toutes les colonnes avec leurs types
SELECT 
    COLUMN_NAME as nom_colonne,
    DATA_TYPE as type_donnee,
    CHARACTER_MAXIMUM_LENGTH as longueur_max,
    IS_NULLABLE as nullable,
    COLUMN_DEFAULT as valeur_par_defaut,
    ORDINAL_POSITION as position
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'yj_histo_fiche'
ORDER BY ORDINAL_POSITION;

-- 3. Afficher la structure complète (CREATE TABLE)
SHOW CREATE TABLE `yj_histo_fiche`;

-- 4. Afficher quelques exemples de données
SELECT * FROM `yj_histo_fiche` LIMIT 5;

-- 5. Compter le nombre total d'enregistrements
SELECT COUNT(*) as total_enregistrements FROM `yj_histo_fiche`;

-- 6. Identifier les colonnes qui pourraient contenir l'ID de la fiche
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    CASE 
        WHEN COLUMN_NAME LIKE '%fiche%' OR COLUMN_NAME = 'id' THEN 'PROBABLE ID_FICHE'
        ELSE ''
    END as note
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'yj_histo_fiche'
  AND (COLUMN_NAME LIKE '%fiche%' OR COLUMN_NAME = 'id');

-- 7. Identifier les colonnes qui pourraient contenir l'état
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    CASE 
        WHEN COLUMN_NAME LIKE '%etat%' OR COLUMN_NAME LIKE '%statut%' THEN 'PROBABLE ÉTAT'
        ELSE ''
    END as note
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'yj_histo_fiche'
  AND (COLUMN_NAME LIKE '%etat%' OR COLUMN_NAME LIKE '%statut%');

-- 8. Identifier les colonnes de date
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    CASE 
        WHEN COLUMN_NAME LIKE '%date%' OR COLUMN_NAME LIKE '%heure%' OR COLUMN_NAME LIKE '%time%' 
        THEN 'PROBABLE DATE'
        ELSE ''
    END as note
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'yj_histo_fiche'
  AND (COLUMN_NAME LIKE '%date%' OR COLUMN_NAME LIKE '%heure%' OR COLUMN_NAME LIKE '%time%');

