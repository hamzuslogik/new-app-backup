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
-- REQUÊTES ALTER TABLE À EXÉCUTER
-- =====================================================
-- 
-- INSTRUCTIONS :
-- 1. Exécutez d'abord la section "ÉTAPE 1" pour voir la structure actuelle
-- 2. Exécutez la section "ÉTAPE 2" pour voir quelles colonnes existent déjà
-- 3. Décommentez et exécutez UNE PAR UNE les requêtes ALTER TABLE ci-dessous
--    seulement pour les colonnes qui n'existent pas (has_xxx = 0)
-- 4. Si une requête échoue avec "Duplicate column name", c'est normal, passez à la suivante
--

-- Colonnes confirmateurs et commentaire (PRIORITÉ HAUTE)
-- Décommentez seulement si @has_id_confirmateur = 0
/*
ALTER TABLE `fiches_histo` ADD COLUMN `id_confirmateur` int(11) DEFAULT NULL AFTER `id_etat`;
ALTER TABLE `fiches_histo` ADD COLUMN `id_confirmateur_2` int(11) DEFAULT NULL AFTER `id_confirmateur`;
ALTER TABLE `fiches_histo` ADD COLUMN `id_confirmateur_3` int(11) DEFAULT NULL AFTER `id_confirmateur_2`;
ALTER TABLE `fiches_histo` ADD COLUMN `conf_commentaire_produit` text CHARACTER SET utf8 DEFAULT NULL AFTER `id_confirmateur_3`;
*/

-- Colonnes dates (PRIORITÉ HAUTE)
-- Décommentez seulement si @has_date_appel_time = 0 ou @has_date_sign_time = 0
/*
ALTER TABLE `fiches_histo` ADD COLUMN `date_appel_time` datetime DEFAULT NULL AFTER `date_rdv_time`;
ALTER TABLE `fiches_histo` ADD COLUMN `date_sign_time` datetime DEFAULT NULL AFTER `date_appel_time`;
*/

-- Colonnes autres (PRIORITÉ HAUTE)
-- Décommentez seulement si les colonnes n'existent pas
/*
ALTER TABLE `fiches_histo` ADD COLUMN `id_sous_etat` int(11) DEFAULT NULL AFTER `date_sign_time`;
ALTER TABLE `fiches_histo` ADD COLUMN `id_commercial` int(11) DEFAULT NULL AFTER `id_sous_etat`;
ALTER TABLE `fiches_histo` ADD COLUMN `ph3_installateur` int(11) DEFAULT NULL AFTER `id_commercial`;
*/

-- Colonnes Phase 3 (PRIORITÉ MOYENNE)
-- Décommentez seulement si les colonnes n'existent pas
/*
ALTER TABLE `fiches_histo` ADD COLUMN `ph3_pac` varchar(255) CHARACTER SET utf8 DEFAULT NULL AFTER `ph3_installateur`;
ALTER TABLE `fiches_histo` ADD COLUMN `ph3_type` varchar(255) CHARACTER SET utf8 DEFAULT NULL AFTER `ph3_pac`;
ALTER TABLE `fiches_histo` ADD COLUMN `ph3_prix` decimal(10,2) DEFAULT NULL AFTER `ph3_type`;
ALTER TABLE `fiches_histo` ADD COLUMN `ph3_puissance` varchar(255) CHARACTER SET utf8 DEFAULT NULL AFTER `ph3_prix`;
ALTER TABLE `fiches_histo` ADD COLUMN `ph3_consommation` decimal(10,2) DEFAULT NULL AFTER `ph3_puissance`;
ALTER TABLE `fiches_histo` ADD COLUMN `ph3_bonus_30` decimal(10,2) DEFAULT NULL AFTER `ph3_consommation`;
ALTER TABLE `fiches_histo` ADD COLUMN `ph3_mensualite` decimal(10,2) DEFAULT NULL AFTER `ph3_bonus_30`;
ALTER TABLE `fiches_histo` ADD COLUMN `ph3_nbr_annee_finance` int(11) DEFAULT NULL AFTER `ph3_mensualite`;
ALTER TABLE `fiches_histo` ADD COLUMN `ph3_ballon` varchar(255) CHARACTER SET utf8 DEFAULT NULL AFTER `ph3_nbr_annee_finance`;
ALTER TABLE `fiches_histo` ADD COLUMN `ph3_alimentation` varchar(255) CHARACTER SET utf8 DEFAULT NULL AFTER `ph3_ballon`;
ALTER TABLE `fiches_histo` ADD COLUMN `credit_immobilier` varchar(255) CHARACTER SET utf8 DEFAULT NULL AFTER `ph3_alimentation`;
ALTER TABLE `fiches_histo` ADD COLUMN `credit_autre` varchar(255) CHARACTER SET utf8 DEFAULT NULL AFTER `credit_immobilier`;
ALTER TABLE `fiches_histo` ADD COLUMN `valeur_mensualite` decimal(10,2) DEFAULT NULL AFTER `credit_autre`;
ALTER TABLE `fiches_histo` ADD COLUMN `conf_rdv_avec` varchar(255) CHARACTER SET utf8 DEFAULT NULL AFTER `valeur_mensualite`;
*/

-- Ajouter des index pour améliorer les performances
-- Ces requêtes échoueront silencieusement si les index existent déjà (c'est normal)
/*
ALTER TABLE `fiches_histo` ADD INDEX `idx_id_confirmateur` (`id_confirmateur`);
ALTER TABLE `fiches_histo` ADD INDEX `idx_id_commercial` (`id_commercial`);
ALTER TABLE `fiches_histo` ADD INDEX `idx_id_sous_etat` (`id_sous_etat`);
ALTER TABLE `fiches_histo` ADD INDEX `idx_date_appel_time` (`date_appel_time`);
ALTER TABLE `fiches_histo` ADD INDEX `idx_date_sign_time` (`date_sign_time`);
*/

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

SELECT 
    '=== STATISTIQUES ===' as info,
    COUNT(*) as total_lignes,
    COUNT(DISTINCT id_fiche) as total_fiches,
    COUNT(CASE WHEN id_confirmateur IS NOT NULL THEN 1 END) as lignes_avec_confirmateur,
    COUNT(CASE WHEN conf_commentaire_produit IS NOT NULL THEN 1 END) as lignes_avec_commentaire,
    COUNT(CASE WHEN date_appel_time IS NOT NULL THEN 1 END) as lignes_avec_date_appel,
    COUNT(CASE WHEN date_sign_time IS NOT NULL THEN 1 END) as lignes_avec_date_signature
FROM `fiches_histo`;

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

