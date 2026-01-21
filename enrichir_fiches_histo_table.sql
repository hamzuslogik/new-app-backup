-- =====================================================
-- Script pour enrichir la table fiches_histo
-- avec les colonnes nécessaires pour l'affichage de l'historique
-- =====================================================
--
-- PROBLÈME IDENTIFIÉ :
-- La table fiches_histo ne stocke actuellement que :
--   - id_fiche, id_etat, date_rdv_time, date_creation
--
-- Mais le frontend a besoin de beaucoup plus d'informations pour afficher
-- l'historique correctement (confirmateur, commentaire, dates, Phase 3, etc.)
--
-- Le backend enrichit actuellement avec les données ACTUELLES de la fiche,
-- ce qui ne reflète pas l'historique réel.
--
-- SOLUTION :
-- Ajouter les colonnes nécessaires pour stocker les valeurs au moment
-- du changement d'état.
--
-- =====================================================

USE `crm`;

-- =====================================================
-- ÉTAPE 1 : Vérifier la structure actuelle
-- =====================================================

SELECT 
    '=== STRUCTURE ACTUELLE DE fiches_histo ===' as info;

SELECT 
    COLUMN_NAME as nom_colonne,
    DATA_TYPE as type_donnee,
    IS_NULLABLE as nullable,
    COLUMN_DEFAULT as valeur_par_defaut
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'fiches_histo'
ORDER BY ORDINAL_POSITION;

-- =====================================================
-- ÉTAPE 2 : Ajouter les colonnes nécessaires
-- =====================================================
-- 
-- Colonnes à ajouter (par ordre de priorité) :
-- 
-- PRIORITÉ HAUTE (utilisées fréquemment dans l'affichage) :
-- - id_confirmateur, id_confirmateur_2, id_confirmateur_3
-- - conf_commentaire_produit
-- - date_appel_time, date_sign_time
-- - id_sous_etat
-- - id_commercial
-- - ph3_installateur
--
-- PRIORITÉ MOYENNE (utilisées pour les états SIGNER) :
-- - ph3_pac, ph3_type, ph3_prix, ph3_puissance
-- - ph3_consommation, ph3_bonus_30, ph3_mensualite
-- - ph3_nbr_annee_finance, ph3_ballon, ph3_alimentation
-- - credit_immobilier, credit_autre, valeur_mensualite
--
-- PRIORITÉ BASSE (peuvent rester enrichies depuis la fiche actuelle) :
-- - Les autres champs (profession, type_contrat, revenu, etc.)
--

-- Vérifier quelles colonnes existent déjà
SET @has_id_confirmateur = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'id_confirmateur');
SET @has_id_confirmateur_2 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'id_confirmateur_2');
SET @has_id_confirmateur_3 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'id_confirmateur_3');
SET @has_conf_commentaire_produit = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'conf_commentaire_produit');
SET @has_date_appel_time = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'date_appel_time');
SET @has_date_sign_time = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'date_sign_time');
SET @has_id_sous_etat = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'id_sous_etat');
SET @has_id_commercial = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'id_commercial');
SET @has_ph3_installateur = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'ph3_installateur');
SET @has_ph3_pac = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'ph3_pac');
SET @has_ph3_type = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'ph3_type');
SET @has_ph3_prix = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'ph3_prix');
SET @has_ph3_puissance = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'ph3_puissance');
SET @has_ph3_consommation = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'ph3_consommation');
SET @has_ph3_bonus_30 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'ph3_bonus_30');
SET @has_ph3_mensualite = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'ph3_mensualite');
SET @has_ph3_nbr_annee_finance = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'ph3_nbr_annee_finance');
SET @has_ph3_ballon = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'ph3_ballon');
SET @has_ph3_alimentation = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'ph3_alimentation');
SET @has_credit_immobilier = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'credit_immobilier');
SET @has_credit_autre = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'credit_autre');
SET @has_valeur_mensualite = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'valeur_mensualite');
SET @has_conf_rdv_avec = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fiches_histo' AND COLUMN_NAME = 'conf_rdv_avec');

-- Afficher les colonnes détectées
SELECT 
    '=== COLONNES DÉTECTÉES ===' as info,
    @has_id_confirmateur as has_id_confirmateur,
    @has_id_confirmateur_2 as has_id_confirmateur_2,
    @has_id_confirmateur_3 as has_id_confirmateur_3,
    @has_conf_commentaire_produit as has_conf_commentaire_produit,
    @has_date_appel_time as has_date_appel_time,
    @has_date_sign_time as has_date_sign_time,
    @has_id_sous_etat as has_id_sous_etat,
    @has_id_commercial as has_id_commercial,
    @has_ph3_installateur as has_ph3_installateur,
    @has_ph3_pac as has_ph3_pac,
    @has_ph3_type as has_ph3_type,
    @has_ph3_prix as has_ph3_prix,
    @has_ph3_puissance as has_ph3_puissance,
    @has_ph3_consommation as has_ph3_consommation,
    @has_ph3_bonus_30 as has_ph3_bonus_30,
    @has_ph3_mensualite as has_ph3_mensualite,
    @has_ph3_nbr_annee_finance as has_ph3_nbr_annee_finance,
    @has_ph3_ballon as has_ph3_ballon,
    @has_ph3_alimentation as has_ph3_alimentation,
    @has_credit_immobilier as has_credit_immobilier,
    @has_credit_autre as has_credit_autre,
    @has_valeur_mensualite as has_valeur_mensualite,
    @has_conf_rdv_avec as has_conf_rdv_avec;

-- =====================================================
-- Ajouter les colonnes manquantes (priorité haute)
-- =====================================================
-- 
-- Exécutez chaque ALTER TABLE séparément pour éviter les erreurs
-- si une colonne existe déjà
--

-- =====================================================
-- REQUÊTES ALTER TABLE À EXÉCUTER (VERSION AUTOMATIQUE)
-- =====================================================
-- 
-- Cette section ajoute automatiquement les colonnes manquantes
-- en utilisant des procédures stockées temporaires.
-- 
-- INSTRUCTIONS :
-- 1. Exécutez d'abord la section "ÉTAPE 1" pour voir la structure actuelle
-- 2. Exécutez la section "ÉTAPE 2" pour voir quelles colonnes existent déjà
-- 3. Exécutez cette section pour ajouter automatiquement les colonnes manquantes
--

-- =====================================================
-- Ajouter les colonnes manquantes (VERSION AVEC PROCÉDURE)
-- =====================================================
-- 
-- Cette version utilise une procédure stockée qui ne retourne pas de résultats
-- pour éviter les problèmes de synchronisation.
-- 
-- INSTRUCTIONS :
-- 1. Exécutez d'abord la section "ÉTAPE 1" pour voir la structure actuelle
-- 2. Exécutez la section "ÉTAPE 2" pour voir quelles colonnes existent déjà
-- 3. Exécutez cette section pour ajouter automatiquement les colonnes manquantes
--

-- Créer une procédure qui n'exécute que si la colonne n'existe pas (sans retourner de résultats)
DELIMITER $$

DROP PROCEDURE IF EXISTS `add_column_silent`$$

CREATE PROCEDURE `add_column_silent`(
    IN table_name VARCHAR(64),
    IN column_name VARCHAR(64),
    IN column_definition TEXT
)
BEGIN
    DECLARE column_exists INT DEFAULT 0;
    
    SELECT COUNT(*) INTO column_exists
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = table_name
      AND COLUMN_NAME = column_name;
    
    IF column_exists = 0 THEN
        SET @sql = CONCAT('ALTER TABLE `', table_name, '` ADD COLUMN ', column_definition);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$

DROP PROCEDURE IF EXISTS `add_index_silent`$$

CREATE PROCEDURE `add_index_silent`(
    IN table_name VARCHAR(64),
    IN index_name VARCHAR(64),
    IN column_name VARCHAR(64)
)
BEGIN
    DECLARE index_exists INT DEFAULT 0;
    
    SELECT COUNT(*) INTO index_exists
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = table_name
      AND INDEX_NAME = index_name;
    
    IF index_exists = 0 THEN
        SET @sql = CONCAT('ALTER TABLE `', table_name, '` ADD INDEX `', index_name, '` (`', column_name, '`)');
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$

DELIMITER ;

SELECT '=== AJOUT DES COLONNES (PRIORITÉ HAUTE) ===' as info;

-- Ajouter les colonnes manquantes (PRIORITÉ HAUTE)
CALL add_column_silent('fiches_histo', 'id_confirmateur', '`id_confirmateur` int(11) DEFAULT NULL AFTER `id_etat`');
CALL add_column_silent('fiches_histo', 'id_confirmateur_2', '`id_confirmateur_2` int(11) DEFAULT NULL AFTER `id_confirmateur`');
CALL add_column_silent('fiches_histo', 'id_confirmateur_3', '`id_confirmateur_3` int(11) DEFAULT NULL AFTER `id_confirmateur_2`');
CALL add_column_silent('fiches_histo', 'conf_commentaire_produit', '`conf_commentaire_produit` text CHARACTER SET utf8 DEFAULT NULL AFTER `id_confirmateur_3`');
CALL add_column_silent('fiches_histo', 'date_appel_time', '`date_appel_time` datetime DEFAULT NULL AFTER `date_rdv_time`');
CALL add_column_silent('fiches_histo', 'date_sign_time', '`date_sign_time` datetime DEFAULT NULL AFTER `date_appel_time`');
CALL add_column_silent('fiches_histo', 'id_sous_etat', '`id_sous_etat` int(11) DEFAULT NULL AFTER `date_sign_time`');
CALL add_column_silent('fiches_histo', 'id_commercial', '`id_commercial` int(11) DEFAULT NULL AFTER `id_sous_etat`');
CALL add_column_silent('fiches_histo', 'ph3_installateur', '`ph3_installateur` int(11) DEFAULT NULL AFTER `id_commercial`');

-- Ajouter les colonnes Phase 3 (PRIORITÉ MOYENNE)
SELECT '=== AJOUT DES COLONNES PHASE 3 (PRIORITÉ MOYENNE) ===' as info;

CALL add_column_silent('fiches_histo', 'ph3_pac', '`ph3_pac` varchar(255) CHARACTER SET utf8 DEFAULT NULL AFTER `ph3_installateur`');
CALL add_column_silent('fiches_histo', 'ph3_type', '`ph3_type` varchar(255) CHARACTER SET utf8 DEFAULT NULL AFTER `ph3_pac`');
CALL add_column_silent('fiches_histo', 'ph3_prix', '`ph3_prix` decimal(10,2) DEFAULT NULL AFTER `ph3_type`');
CALL add_column_silent('fiches_histo', 'ph3_puissance', '`ph3_puissance` varchar(255) CHARACTER SET utf8 DEFAULT NULL AFTER `ph3_prix`');
CALL add_column_silent('fiches_histo', 'ph3_consommation', '`ph3_consommation` decimal(10,2) DEFAULT NULL AFTER `ph3_puissance`');
CALL add_column_silent('fiches_histo', 'ph3_bonus_30', '`ph3_bonus_30` decimal(10,2) DEFAULT NULL AFTER `ph3_consommation`');

CALL add_column_silent('fiches_histo', 'ph3_mensualite', '`ph3_mensualite` decimal(10,2) DEFAULT NULL AFTER `ph3_bonus_30`');
CALL add_column_silent('fiches_histo', 'ph3_nbr_annee_finance', '`ph3_nbr_annee_finance` int(11) DEFAULT NULL AFTER `ph3_mensualite`');
CALL add_column_silent('fiches_histo', 'ph3_ballon', '`ph3_ballon` varchar(255) CHARACTER SET utf8 DEFAULT NULL AFTER `ph3_nbr_annee_finance`');
CALL add_column_silent('fiches_histo', 'ph3_alimentation', '`ph3_alimentation` varchar(255) CHARACTER SET utf8 DEFAULT NULL AFTER `ph3_ballon`');
CALL add_column_silent('fiches_histo', 'credit_immobilier', '`credit_immobilier` varchar(255) CHARACTER SET utf8 DEFAULT NULL AFTER `ph3_alimentation`');
CALL add_column_silent('fiches_histo', 'credit_autre', '`credit_autre` varchar(255) CHARACTER SET utf8 DEFAULT NULL AFTER `credit_immobilier`');
CALL add_column_silent('fiches_histo', 'valeur_mensualite', '`valeur_mensualite` decimal(10,2) DEFAULT NULL AFTER `credit_autre`');
CALL add_column_silent('fiches_histo', 'conf_rdv_avec', '`conf_rdv_avec` varchar(255) CHARACTER SET utf8 DEFAULT NULL AFTER `valeur_mensualite`');

-- Ajouter des index pour améliorer les performances
SELECT '=== AJOUT DES INDEX ===' as info;

CALL add_index_silent('fiches_histo', 'idx_id_confirmateur', 'id_confirmateur');
CALL add_index_silent('fiches_histo', 'idx_id_commercial', 'id_commercial');
CALL add_index_silent('fiches_histo', 'idx_id_sous_etat', 'id_sous_etat');
CALL add_index_silent('fiches_histo', 'idx_date_appel_time', 'date_appel_time');
CALL add_index_silent('fiches_histo', 'idx_date_sign_time', 'date_sign_time');

-- Nettoyer les procédures temporaires
DROP PROCEDURE IF EXISTS `add_column_silent`;
DROP PROCEDURE IF EXISTS `add_index_silent`;

-- =====================================================
-- ÉTAPE 3 : Vérifier la nouvelle structure
-- =====================================================

SELECT 
    '=== NOUVELLE STRUCTURE DE fiches_histo ===' as info;

SELECT 
    COLUMN_NAME as nom_colonne,
    DATA_TYPE as type_donnee,
    IS_NULLABLE as nullable,
    COLUMN_DEFAULT as valeur_par_defaut,
    COLUMN_KEY as cle
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'fiches_histo'
ORDER BY ORDINAL_POSITION;

-- =====================================================
-- ÉTAPE 4 : Statistiques
-- =====================================================
-- 
-- Cette section affiche des statistiques de base.
-- Les statistiques sur les nouvelles colonnes seront disponibles
-- après leur ajout via les ALTER TABLE ci-dessus.
--

SELECT 
    '=== STATISTIQUES DE BASE ===' as info,
    COUNT(*) as total_lignes,
    COUNT(DISTINCT id_fiche) as total_fiches,
    COUNT(CASE WHEN id_etat IS NOT NULL THEN 1 END) as lignes_avec_etat,
    COUNT(CASE WHEN date_rdv_time IS NOT NULL THEN 1 END) as lignes_avec_date_rdv,
    COUNT(CASE WHEN date_creation IS NOT NULL THEN 1 END) as lignes_avec_date_creation
FROM `fiches_histo`;

-- Statistiques sur les nouvelles colonnes (uniquement si elles existent)
-- Décommentez cette section APRÈS avoir ajouté les colonnes
/*
SELECT 
    '=== STATISTIQUES SUR LES NOUVELLES COLONNES ===' as info,
    COUNT(CASE WHEN id_confirmateur IS NOT NULL THEN 1 END) as lignes_avec_confirmateur,
    COUNT(CASE WHEN conf_commentaire_produit IS NOT NULL THEN 1 END) as lignes_avec_commentaire,
    COUNT(CASE WHEN date_appel_time IS NOT NULL THEN 1 END) as lignes_avec_date_appel,
    COUNT(CASE WHEN date_sign_time IS NOT NULL THEN 1 END) as lignes_avec_date_signature,
    COUNT(CASE WHEN id_sous_etat IS NOT NULL THEN 1 END) as lignes_avec_sous_etat,
    COUNT(CASE WHEN ph3_pac IS NOT NULL THEN 1 END) as lignes_avec_ph3_pac
FROM `fiches_histo`;
*/

-- =====================================================
-- NOTES IMPORTANTES
-- =====================================================
--
-- 1. Après l'exécution de ce script, il faudra modifier le backend pour :
--    - Stocker ces valeurs lors de la création d'une entrée historique
--    - Ne plus enrichir avec les données actuelles de la fiche
--
-- 2. Les données existantes dans fiches_histo auront NULL pour ces nouvelles colonnes
--    (c'est normal, elles seront remplies pour les nouvelles entrées)
--
-- 3. Pour les données existantes, on peut éventuellement :
--    - Les laisser telles quelles (NULL)
--    - Ou créer un script de migration pour les remplir depuis la table fiches
--      (mais cela ne reflétera pas l'historique réel, seulement l'état actuel)
--
-- 4. Le frontend continuera de fonctionner car il gère déjà les valeurs NULL
--
-- =====================================================
-- FIN DU SCRIPT
-- =====================================================

