-- =====================================================
-- Script de création de la table fiches_histo
-- avec la structure enrichie pour l'historique complet
-- =====================================================
--
-- Ce script :
-- 1. Supprime la table fiches_histo si elle existe
-- 2. Crée la nouvelle table avec toutes les colonnes nécessaires
-- 3. Ajoute les index pour améliorer les performances
--
-- =====================================================

USE `crm`;

-- =====================================================
-- ÉTAPE 1 : Supprimer la table existante
-- =====================================================

DROP TABLE IF EXISTS `fiches_histo`;

-- =====================================================
-- ÉTAPE 2 : Créer la nouvelle table avec structure enrichie
-- =====================================================

CREATE TABLE `fiches_histo` (
  -- Colonnes de base
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_fiche` int(11) DEFAULT NULL,
  `id_etat` int(11) DEFAULT NULL,
  
  -- Colonnes confirmateurs (PRIORITÉ HAUTE)
  `id_confirmateur` int(11) DEFAULT NULL,
  `id_confirmateur_2` int(11) DEFAULT NULL,
  `id_confirmateur_3` int(11) DEFAULT NULL,
  `conf_commentaire_produit` text CHARACTER SET utf8 DEFAULT NULL,
  `conf_rdv_avec` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  
  -- Colonnes dates
  `date_rdv_time` datetime DEFAULT NULL,
  `date_appel_time` datetime DEFAULT NULL,
  `date_sign_time` datetime DEFAULT NULL,
  `date_creation` datetime DEFAULT NULL,
  
  -- Colonnes autres (PRIORITÉ HAUTE)
  `id_sous_etat` int(11) DEFAULT NULL,
  `id_commercial` int(11) DEFAULT NULL,
  `ph3_installateur` int(11) DEFAULT NULL,
  
  -- Colonnes Phase 3 (PRIORITÉ MOYENNE)
  `ph3_pac` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `ph3_type` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `ph3_prix` decimal(10,2) DEFAULT NULL,
  `ph3_puissance` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `ph3_consommation` decimal(10,2) DEFAULT NULL,
  `ph3_bonus_30` decimal(10,2) DEFAULT NULL,
  `ph3_mensualite` decimal(10,2) DEFAULT NULL,
  `ph3_nbr_annee_finance` int(11) DEFAULT NULL,
  `ph3_ballon` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `ph3_alimentation` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `credit_immobilier` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `credit_autre` varchar(255) CHARACTER SET utf8 DEFAULT NULL,
  `valeur_mensualite` decimal(10,2) DEFAULT NULL,
  
  -- Clé primaire
  PRIMARY KEY (`id`),
  
  -- Index de base
  KEY `idx_id_fiche` (`id_fiche`),
  KEY `idx_id_etat` (`id_etat`),
  
  -- Index pour améliorer les performances
  KEY `idx_id_confirmateur` (`id_confirmateur`),
  KEY `idx_id_commercial` (`id_commercial`),
  KEY `idx_id_sous_etat` (`id_sous_etat`),
  KEY `idx_date_appel_time` (`date_appel_time`),
  KEY `idx_date_sign_time` (`date_sign_time`),
  KEY `idx_date_creation` (`date_creation`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- ÉTAPE 3 : Vérifier la structure créée
-- =====================================================

SELECT 
    '=== STRUCTURE DE LA NOUVELLE TABLE fiches_histo ===' as info;

SELECT 
    COLUMN_NAME as nom_colonne,
    DATA_TYPE as type_donnee,
    IS_NULLABLE as nullable,
    COLUMN_DEFAULT as valeur_par_defaut,
    COLUMN_KEY as cle,
    EXTRA as extra
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'fiches_histo'
ORDER BY ORDINAL_POSITION;

-- =====================================================
-- ÉTAPE 4 : Vérifier les index créés
-- =====================================================

SELECT 
    '=== INDEX CRÉÉS ===' as info;

SELECT 
    INDEX_NAME as nom_index,
    COLUMN_NAME as colonne,
    NON_UNIQUE as non_unique,
    SEQ_IN_INDEX as sequence
FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'fiches_histo'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;

-- =====================================================
-- NOTES IMPORTANTES
-- =====================================================
--
-- 1. Cette table stocke maintenant toutes les informations nécessaires
--    pour afficher l'historique complet d'une fiche.
--
-- 2. Lors de la création d'une nouvelle entrée historique, le backend
--    devra stocker les valeurs actuelles de la fiche dans ces colonnes
--    (et non pas enrichir après coup avec les données actuelles).
--
-- 3. Les données existantes dans l'ancienne table fiches_histo seront
--    perdues lors de l'exécution de ce script. Si vous avez besoin de
--    conserver ces données, exécutez d'abord un script de migration.
--
-- 4. Les colonnes sont organisées par ordre logique :
--    - Colonnes de base (id, id_fiche, id_etat)
--    - Colonnes confirmateurs
--    - Colonnes dates
--    - Colonnes autres
--    - Colonnes Phase 3
--
-- =====================================================
-- FIN DU SCRIPT
-- =====================================================

