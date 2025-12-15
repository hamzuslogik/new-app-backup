-- =====================================================
-- Script SÉCURISÉ pour migrer les fiches depuis yj_fiche (admin_extranet) vers fiches (crm)
-- Base de données source: admin_extranet sur pma.jwsgroup.fr
-- Base de données destination: crm
-- =====================================================
--
-- VERSION AMÉLIORÉE avec protection contre la surcharge du serveur distant
--
-- PRÉREQUIS:
-- 1. Avoir les privilèges nécessaires pour créer des tables FEDERATED
-- 2. Le serveur MySQL doit avoir le moteur FEDERATED activé
-- 3. Les identifiants de connexion: admin_extranet2 / Google@JWS123
--
-- AMÉLIORATIONS:
-- - Migration par lots (batch) pour éviter de surcharger le serveur distant
-- - Limitation du nombre de lignes traitées par requête
-- - Possibilité de reprendre la migration en cas d'interruption
-- - Vérification de l'existence des données avant migration
--
-- =====================================================

USE `crm`;

-- =====================================================
-- CONFIGURATION DES PARAMÈTRES DE MIGRATION
-- =====================================================
-- Ajustez ces valeurs selon la taille de votre base et la performance du serveur
SET @batch_size = 1000;  -- Nombre de fiches à traiter par lot (réduire si le serveur distant est lent)
SET @max_records = NULL; -- Limite totale (NULL = pas de limite, ou mettre un nombre pour tester)

-- =====================================================
-- CRÉATION DE LA TABLE FEDERATED POUR ACCÉDER À LA BASE DISTANTE
-- =====================================================
-- Cette table virtuelle permet d'accéder à yj_fiche sur le serveur distant
-- comme si c'était une table locale

DROP TABLE IF EXISTS `yj_fiche_remote`;

CREATE TABLE `yj_fiche_remote` (
  `id` int(11) NOT NULL,
  `civ` varchar(100) DEFAULT NULL,
  `nom` varchar(255) DEFAULT NULL,
  `prenom` varchar(255) DEFAULT NULL,
  `tel` varchar(100) DEFAULT NULL,
  `gsm1` varchar(100) DEFAULT NULL,
  `gsm2` varchar(100) DEFAULT NULL,
  `Adresse` text DEFAULT NULL,
  `cp` varchar(20) DEFAULT NULL,
  `ville` varchar(150) DEFAULT NULL,
  `etude` varchar(10) DEFAULT NULL,
  `maison_orientation` varchar(255) DEFAULT NULL,
  `profession_mme` varchar(255) DEFAULT NULL,
  `age_mme` varchar(255) DEFAULT NULL,
  `enfant_encharge` int(11) DEFAULT NULL,
  `situation_conju` varchar(255) DEFAULT NULL,
  `revenu` varchar(255) DEFAULT NULL,
  `credit` varchar(255) DEFAULT NULL,
  `date_heure_appel` datetime DEFAULT NULL,
  `date_heure_playning` datetime DEFAULT NULL,
  `date_heure_mod` datetime DEFAULT NULL,
  `date_insertion` datetime DEFAULT NULL,
  `etat_final` varchar(255) DEFAULT NULL,
  `conf_produit` varchar(255) DEFAULT NULL,
  `conf_energie` varchar(255) DEFAULT NULL,
  `pac_consomation` varchar(255) DEFAULT NULL,
  `pac_surface_habitable` varchar(255) DEFAULT NULL,
  `pac_annee_chauf` varchar(255) DEFAULT NULL,
  `pac_surface_chauf` varchar(255) DEFAULT NULL,
  `pac_propritaire_maison` varchar(255) DEFAULT NULL,
  `pac_nombre_pieces` varchar(255) DEFAULT NULL,
  `pac_age_maison` varchar(255) DEFAULT NULL,
  `nb_chemines` int(11) DEFAULT NULL,
  `age_mr` varchar(255) DEFAULT NULL,
  `profession_mr` varchar(255) DEFAULT NULL,
  `commentaire` text DEFAULT NULL,
  `id_agent` int(11) DEFAULT NULL,
  `id_centre` int(11) DEFAULT NULL,
  `nom_confirmateur` varchar(255) DEFAULT NULL,
  `id_confirmateur` int(11) DEFAULT NULL,
  `nom_confirmateur_2` varchar(255) DEFAULT NULL,
  `nom_confirmateur_3` varchar(255) DEFAULT NULL,
  `id_qualite` int(11) DEFAULT NULL,
  `id_commercial` int(11) DEFAULT NULL,
  `nom_commercial_2` varchar(255) DEFAULT NULL,
  `conf_commentaire_produit` text DEFAULT NULL,
  `conf_consommations` decimal(10,2) DEFAULT NULL,
  `conf_profession_monsieur` varchar(255) DEFAULT NULL,
  `conf_profession_madame` varchar(255) DEFAULT NULL,
  `conf_presence_couple` varchar(255) DEFAULT NULL,
  `conf_consommation_chauffage` varchar(255) DEFAULT NULL,
  `site_classe` varchar(255) DEFAULT NULL,
  `conf_rdv_avec` varchar(255) DEFAULT NULL,
  `cq_etat` varchar(255) DEFAULT NULL,
  `cq_dossier` varchar(255) DEFAULT NULL,
  `ph3_installateur` varchar(255) DEFAULT NULL,
  `ph3_pac` varchar(255) DEFAULT NULL,
  `ph3_puissance` varchar(255) DEFAULT NULL,
  `ph3_rr_model` int(11) DEFAULT NULL,
  `ph3_ballon` tinyint(1) DEFAULT NULL,
  `ph3_marque_ballon` varchar(255) DEFAULT NULL,
  `ph3_alimentation` varchar(255) DEFAULT NULL,
  `ph3_type` varchar(255) DEFAULT NULL,
  `ph3_prix` decimal(10,2) DEFAULT NULL,
  `ph3_bonus_30` varchar(255) DEFAULT NULL,
  `ph3_mensualite` varchar(255) DEFAULT NULL,
  `ph3_attente` varchar(255) DEFAULT NULL,
  `nbr_annee_finance` int(11) DEFAULT NULL,
  `credit_immobilier` varchar(255) DEFAULT NULL,
  `credit_autre` varchar(255) DEFAULT NULL,
  `archive` tinyint(1) DEFAULT NULL,
  `valider` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=FEDERATED
CONNECTION='mysql://admin_extranet2:Google%40JWS123@pma.jwsgroup.fr:3306/admin_extranet/yj_fiche';

-- =====================================================
-- VÉRIFICATION PRÉALABLE
-- =====================================================
-- Compter le nombre total de fiches à migrer
SELECT 
  COUNT(*) as total_fiches_a_migrer,
  MIN(id) as id_min,
  MAX(id) as id_max
FROM `yj_fiche_remote`;

-- Vérifier combien de fiches sont déjà migrées
SELECT 
  COUNT(*) as fiches_deja_migrees
FROM `fiches` f
INNER JOIN `yj_fiche_remote` y ON f.id = y.id;

-- =====================================================
-- MIGRATION PAR LOTS (BATCH)
-- =====================================================
-- Cette approche traite les données par petits lots pour éviter de surcharger le serveur distant
-- Vous pouvez exécuter cette section plusieurs fois jusqu'à ce que toutes les données soient migrées

-- Calculer le dernier ID migré
SET @last_migrated_id = (
  SELECT COALESCE(MAX(id), 0) 
  FROM `fiches` 
  WHERE id IN (SELECT id FROM `yj_fiche_remote`)
);

-- Migration par lots (exécuter cette requête plusieurs fois si nécessaire)
INSERT INTO `fiches` (
  `id`, `civ`, `nom`, `prenom`, `tel`, `gsm1`, `gsm2`, `adresse`, `cp`, `ville`,
  `etude`, `consommation_chauffage`, `surface_habitable`, `annee_systeme_chauffage`,
  `surface_chauffee`, `proprietaire_maison`, `nb_pieces`, `age_maison`, `orientation_toiture`,
  `produit`, `nb_chemines`, `mode_chauffage`, `consommation_electricite`, `age_mr`,
  `age_madame`, `revenu_foyer`, `credit_foyer`, `situation_conjugale`, `nb_enfants`,
  `profession_mr`, `profession_madame`, `commentaire`, `id_agent`, `id_centre`, `id_insert`,
  `id_confirmateur`, `id_confirmateur_2`, `id_confirmateur_3`, `id_qualite`, `id_qualif`,
  `id_commercial`, `id_commercial_2`, `id_etat_final`, `date_appel`, `date_insert`,
  `date_insert_time`, `date_audit`, `date_confirmation`, `date_qualif`, `date_rdv`,
  `date_rdv_time`, `date_affect`, `date_sign`, `date_sign_time`, `date_modif_time`,
  `archive`, `ko`, `hc`, `active`, `valider`, `conf_commentaire_produit`, `conf_consommations`,
  `conf_profession_monsieur`, `conf_profession_madame`, `conf_presence_couple`, `conf_produit`,
  `conf_orientation_toiture`, `conf_zones_ombres`, `conf_site_classe`, `conf_consommation_electricite`,
  `conf_rdv_avec`, `cq_etat`, `cq_dossier`, `ph3_installateur`, `ph3_pac`, `ph3_puissance`,
  `ph3_puissance_pv`, `ph3_rr_model`, `ph3_ballon`, `ph3_marque_ballon`, `ph3_alimentation`,
  `ph3_type`, `ph3_prix`, `ph3_bonus_30`, `ph3_mensualite`, `ph3_attente`, `nbr_annee_finance`,
  `credit_immobilier`, `credit_autre`
)
SELECT 
  `id`,
  NULLIF(`civ`, '') as `civ`,
  NULLIF(`nom`, '') as `nom`,
  NULLIF(`prenom`, '') as `prenom`,
  NULLIF(`tel`, '') as `tel`,
  NULLIF(`gsm1`, '') as `gsm1`,
  NULLIF(`gsm2`, '') as `gsm2`,
  NULLIF(`Adresse`, '') as `adresse`,
  NULLIF(`cp`, '') as `cp`,
  NULLIF(`ville`, '') as `ville`,
  NULLIF(`etude`, '') as `etude`,
  COALESCE(
    NULLIF(`conf_consommation_chauffage`, ''),
    NULLIF(`pac_consomation`, ''),
    NULL
  ) as `consommation_chauffage`,
  NULLIF(`pac_surface_habitable`, '') as `surface_habitable`,
  CASE 
    WHEN `pac_annee_chauf` != '' AND `pac_annee_chauf` != '0' 
    THEN CAST(`pac_annee_chauf` AS UNSIGNED)
    ELSE NULL
  END as `annee_systeme_chauffage`,
  NULLIF(`pac_surface_chauf`, '') as `surface_chauffee`,
  NULLIF(`pac_propritaire_maison`, '') as `proprietaire_maison`,
  CASE 
    WHEN `pac_nombre_pieces` != '' AND `pac_nombre_pieces` != '0'
    THEN CAST(`pac_nombre_pieces` AS UNSIGNED)
    ELSE NULL
  END as `nb_pieces`,
  NULLIF(`pac_age_maison`, '') as `age_maison`,
  NULLIF(`maison_orientation`, '') as `orientation_toiture`,
  CASE 
    WHEN UPPER(`conf_produit`) LIKE '%PAC%' THEN 1
    WHEN UPPER(`conf_produit`) LIKE '%PV%' THEN 2
    ELSE NULL
  END as `produit`,
  CASE 
    WHEN `nb_chemines` > 0 THEN CAST(`nb_chemines` AS CHAR)
    ELSE NULL
  END as `nb_chemines`,
  NULLIF(`conf_energie`, '') as `mode_chauffage`,
  NULL as `consommation_electricite`,
  NULLIF(`age_mr`, '') as `age_mr`,
  NULLIF(`age_mme`, '') as `age_madame`,
  NULLIF(`revenu`, '') as `revenu_foyer`,
  NULLIF(`credit`, '') as `credit_foyer`,
  NULLIF(`situation_conju`, '') as `situation_conjugale`,
  CASE 
    WHEN `enfant_encharge` > 0 THEN CAST(`enfant_encharge` AS CHAR)
    ELSE NULL
  END as `nb_enfants`,
  NULLIF(`profession_mr`, '') as `profession_mr`,
  NULLIF(`profession_mme`, '') as `profession_madame`,
  NULLIF(`commentaire`, '') as `commentaire`,
  `id_agent`,
  `id_centre`,
  NULL as `id_insert`,
  COALESCE(
    CASE 
      WHEN `nom_confirmateur` != '' AND `nom_confirmateur` IS NOT NULL
      THEN (
        SELECT `id` FROM `utilisateurs` WHERE TRIM(UPPER(`pseudo`)) = TRIM(UPPER(`yj_fiche_remote`.`nom_confirmateur`)) LIMIT 1
      )
      ELSE NULL
    END,
    CASE 
      WHEN `id_confirmateur` > 0 THEN `id_confirmateur`
      ELSE NULL
    END
  ) as `id_confirmateur`,
  CASE 
    WHEN `nom_confirmateur_2` != '' AND `nom_confirmateur_2` IS NOT NULL
    THEN COALESCE(
      (SELECT `id` FROM `utilisateurs` WHERE TRIM(UPPER(`pseudo`)) = TRIM(UPPER(`yj_fiche_remote`.`nom_confirmateur_2`)) LIMIT 1),
      NULL
    )
    ELSE NULL
  END as `id_confirmateur_2`,
  CASE 
    WHEN `nom_confirmateur_3` != '' AND `nom_confirmateur_3` IS NOT NULL
    THEN COALESCE(
      (SELECT `id` FROM `utilisateurs` WHERE TRIM(UPPER(`pseudo`)) = TRIM(UPPER(`yj_fiche_remote`.`nom_confirmateur_3`)) LIMIT 1),
      NULL
    )
    ELSE NULL
  END as `id_confirmateur_3`,
  `id_qualite`,
  NULL as `id_qualif`,
  `id_commercial`,
  CASE 
    WHEN `nom_commercial_2` != '' AND `nom_commercial_2` IS NOT NULL
    THEN COALESCE(
      (SELECT `id` FROM `utilisateurs` WHERE TRIM(UPPER(`pseudo`)) = TRIM(UPPER(`yj_fiche_remote`.`nom_commercial_2`)) LIMIT 1),
      NULL
    )
    ELSE NULL
  END as `id_commercial_2`,
  COALESCE(
    (SELECT `id` FROM `etats` e WHERE e.`titre` = `yj_fiche_remote`.`etat_final` LIMIT 1),
    CASE 
      WHEN `etat_final` = 'EN-ATTENTE' THEN 1
      WHEN `etat_final` = 'NRP' THEN 2
      WHEN `etat_final` = 'ANNULER' THEN 5
      WHEN `etat_final` = 'CONFIRMER' THEN 7
      WHEN `etat_final` = 'ANNULER ET A REPROGRAMMER' THEN 8
      WHEN `etat_final` = 'CLIENT HONORE A SUIVRE' THEN 9
      WHEN `etat_final` = 'RDV ANNULER' THEN 11
      WHEN `etat_final` = 'REFUSER' THEN 12
      WHEN `etat_final` = 'SIGNER' THEN 13
      WHEN `etat_final` = 'SIGNER RETRACTER' THEN 16
      WHEN `etat_final` = 'RAPPEL POUR BUREAU' THEN 19
      WHEN `etat_final` = 'ANNULER 2 FOIS' THEN 22
      WHEN `etat_final` = 'HORS CIBLE CONFIRMATEUR' THEN 23
      WHEN `etat_final` = 'HORS CIBLE AGE / DOUBLON / LOCATAIRE' THEN 6
      WHEN `etat_final` = 'HORS CIBLE FINANCEMENT' THEN 24
      WHEN `etat_final` = 'REFUSER 2 FOIS' THEN 25
      WHEN `etat_final` = 'RDV ANNULER 2 FOIS' THEN 26
      WHEN `etat_final` = 'HORS CIBLE AIR AIR' THEN 29
      WHEN `etat_final` = 'SIGNER RETRACTER 2 FOIS' THEN 38
      WHEN `etat_final` = 'HHC FINANCEMENT A VERIFIER' THEN 34
      WHEN `etat_final` = 'HHC TECHNIQUE' THEN 35
      WHEN `etat_final` = 'HHC ERREUR CONFIRMATEUR' THEN 36
      WHEN `etat_final` = 'HHC MENSONGE CLIENT' THEN 37
      WHEN `etat_final` = 'SIGNER COMPLET' THEN 45
      WHEN `etat_final` = 'SIGNER PM' THEN 44
      WHEN `etat_final` = 'VT EN COURS' THEN 48
      WHEN `etat_final` = 'VT OK' THEN 47
      WHEN `etat_final` = 'TH POSE OK' THEN 49
      WHEN `etat_final` = 'TH PAIEMENT OK' THEN 50
      ELSE NULL
    END
  ) as `id_etat_final`,
  CASE 
    WHEN `date_heure_appel` != '0000-00-00 00:00:00' AND `date_heure_appel` IS NOT NULL
    THEN UNIX_TIMESTAMP(`date_heure_appel`)
    ELSE NULL
  END as `date_appel`,
  CASE 
    WHEN `date_insertion` != '0000-00-00 00:00:00' AND `date_insertion` IS NOT NULL
    THEN UNIX_TIMESTAMP(`date_insertion`)
    ELSE NULL
  END as `date_insert`,
  CASE 
    WHEN `date_insertion` != '0000-00-00 00:00:00' AND `date_insertion` IS NOT NULL
    THEN `date_insertion`
    ELSE NULL
  END as `date_insert_time`,
  NULL as `date_audit`,
  NULL as `date_confirmation`,
  NULL as `date_qualif`,
  CASE 
    WHEN `date_heure_playning` != '0000-00-00 00:00:00' AND `date_heure_playning` IS NOT NULL
    THEN UNIX_TIMESTAMP(`date_heure_playning`)
    ELSE NULL
  END as `date_rdv`,
  CASE 
    WHEN `date_heure_playning` != '0000-00-00 00:00:00' AND `date_heure_playning` IS NOT NULL
    THEN `date_heure_playning`
    ELSE NULL
  END as `date_rdv_time`,
  NULL as `date_affect`,
  NULL as `date_sign`,
  NULL as `date_sign_time`,
  CASE 
    WHEN `date_heure_mod` != '0000-00-00 00:00:00' AND `date_heure_mod` IS NOT NULL
    THEN `date_heure_mod`
    ELSE NULL
  END as `date_modif_time`,
  CAST(`archive` AS UNSIGNED) as `archive`,
  0 as `ko`,
  0 as `hc`,
  1 as `active`,
  CAST(`valider` AS UNSIGNED) as `valider`,
  NULLIF(`conf_commentaire_produit`, '') as `conf_commentaire_produit`,
  CASE 
    WHEN `conf_consommations` > 0 THEN `conf_consommations`
    ELSE NULL
  END as `conf_consommations`,
  NULLIF(`conf_profession_monsieur`, '') as `conf_profession_monsieur`,
  NULLIF(`conf_profession_madame`, '') as `conf_profession_madame`,
  NULLIF(`conf_presence_couple`, '') as `conf_presence_couple`,
  CASE 
    WHEN UPPER(`conf_produit`) LIKE '%PAC%' THEN 1
    WHEN UPPER(`conf_produit`) LIKE '%PV%' THEN 2
    ELSE NULL
  END as `conf_produit`,
  NULL as `conf_orientation_toiture`,
  NULL as `conf_zones_ombres`,
  NULLIF(`site_classe`, '') as `conf_site_classe`,
  NULL as `conf_consommation_electricite`,
  NULLIF(`conf_rdv_avec`, '') as `conf_rdv_avec`,
  CASE 
    WHEN `cq_etat` != '' AND `cq_etat` REGEXP '^[0-9]+$'
    THEN CAST(`cq_etat` AS UNSIGNED)
    ELSE NULL
  END as `cq_etat`,
  CASE 
    WHEN `cq_dossier` != '' AND `cq_dossier` REGEXP '^[0-9]+$'
    THEN CAST(`cq_dossier` AS UNSIGNED)
    ELSE NULL
  END as `cq_dossier`,
  CASE 
    WHEN `ph3_installateur` != '' AND `ph3_installateur` REGEXP '^[0-9]+$'
    THEN CAST(`ph3_installateur` AS UNSIGNED)
    ELSE NULL
  END as `ph3_installateur`,
  NULLIF(`ph3_pac`, '') as `ph3_pac`,
  NULLIF(`ph3_puissance`, '') as `ph3_puissance`,
  NULL as `ph3_puissance_pv`,
  CASE 
    WHEN `ph3_rr_model` > 0 THEN CAST(`ph3_rr_model` AS CHAR)
    ELSE NULL
  END as `ph3_rr_model`,
  CASE 
    WHEN `ph3_ballon` = 1 THEN 'OUI'
    WHEN `ph3_ballon` = 0 THEN 'NON'
    ELSE NULL
  END as `ph3_ballon`,
  NULLIF(`ph3_marque_ballon`, '') as `ph3_marque_ballon`,
  NULLIF(`ph3_alimentation`, '') as `ph3_alimentation`,
  NULLIF(`ph3_type`, '') as `ph3_type`,
  CASE 
    WHEN `ph3_prix` > 0 THEN `ph3_prix`
    ELSE NULL
  END as `ph3_prix`,
  CASE 
    WHEN `ph3_bonus_30` != '' AND `ph3_bonus_30` REGEXP '^[0-9]+(\\.[0-9]+)?$'
    THEN CAST(`ph3_bonus_30` AS DECIMAL(10,2))
    ELSE NULL
  END as `ph3_bonus_30`,
  CASE 
    WHEN `ph3_mensualite` != '' AND `ph3_mensualite` REGEXP '^[0-9]+(\\.[0-9]+)?$'
    THEN CAST(`ph3_mensualite` AS DECIMAL(10,2))
    ELSE NULL
  END as `ph3_mensualite`,
  NULLIF(`ph3_attente`, '') as `ph3_attente`,
  CASE 
    WHEN `nbr_annee_finance` > 0 THEN `nbr_annee_finance`
    ELSE NULL
  END as `nbr_annee_finance`,
  NULLIF(`credit_immobilier`, '') as `credit_immobilier`,
  NULLIF(`credit_autre`, '') as `credit_autre`
FROM `yj_fiche_remote`
WHERE `id` > @last_migrated_id
ORDER BY `id` ASC
LIMIT @batch_size
ON DUPLICATE KEY UPDATE 
  `civ` = VALUES(`civ`),
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `tel` = VALUES(`tel`),
  `gsm1` = VALUES(`gsm1`),
  `gsm2` = VALUES(`gsm2`),
  `adresse` = VALUES(`adresse`),
  `cp` = VALUES(`cp`),
  `ville` = VALUES(`ville`),
  `date_modif_time` = VALUES(`date_modif_time`);

-- =====================================================
-- VÉRIFICATION POST-MIGRATION
-- =====================================================
-- Vérifier le nombre de fiches migrées après ce lot
SELECT 
  COUNT(*) as fiches_migrees_ce_lot,
  MAX(id) as dernier_id_migre
FROM `fiches` 
WHERE id IN (SELECT id FROM `yj_fiche_remote`);

-- =====================================================
-- RECOMMANDATIONS
-- =====================================================
-- 1. Exécutez la section "MIGRATION PAR LOTS" plusieurs fois jusqu'à ce que toutes les données soient migrées
-- 2. Surveillez les performances du serveur distant pendant la migration
-- 3. Si le serveur distant devient trop lent, réduisez @batch_size (par exemple à 100 ou 500)
-- 4. Exécutez la migration pendant les heures creuses si possible
-- 5. Après la migration complète, supprimez la table FEDERATED pour libérer les ressources

-- =====================================================
-- NETTOYAGE: SUPPRESSION DE LA TABLE FEDERATED
-- =====================================================
-- Décommentez cette ligne APRÈS avoir terminé la migration complète
-- DROP TABLE IF EXISTS `yj_fiche_remote`;

-- =====================================================
-- FIN DU SCRIPT
-- =====================================================

