-- =====================================================
-- Script pour migrer les fiches depuis yj_fiche vers fiches
-- Base de données: crm
-- =====================================================
--
-- PRÉREQUIS:
-- Ce script suppose que la table yj_fiche existe déjà dans la base de données.
-- Si elle n'existe pas, vous devez d'abord exécuter yj_fiche.sql
--
-- Ce script migre toutes les fiches de yj_fiche vers la nouvelle table fiches
-- en adaptant les noms de colonnes et en convertissant les types de données.
--
-- =====================================================

USE `crm`;

-- =====================================================
-- FICHES
-- =====================================================
-- Migration depuis yj_fiche vers fiches
-- 
-- Mapping des colonnes:
--   yj_fiche.Adresse -> fiches.adresse
--   yj_fiche.maison_orientation -> fiches.orientation_toiture
--   yj_fiche.profession_mme -> fiches.profession_madame
--   yj_fiche.age_mme -> fiches.age_madame
--   yj_fiche.enfant_encharge -> fiches.nb_enfants (conversion int vers varchar)
--   yj_fiche.situation_conju -> fiches.situation_conjugale
--   yj_fiche.revenu -> fiches.revenu_foyer
--   yj_fiche.credit -> fiches.credit_foyer
--   yj_fiche.date_heure_appel -> fiches.date_appel (datetime vers bigint) et date_insert_time
--   yj_fiche.date_heure_playning -> fiches.date_rdv_time
--   yj_fiche.date_heure_mod -> fiches.date_modif_time
--   yj_fiche.date_insertion -> fiches.date_insert_time
--   yj_fiche.etat_final (varchar) -> fiches.id_etat_final (int) - conversion via table etats
--   yj_fiche.conf_produit (varchar) -> fiches.produit (int) et conf_produit (int)
--   yj_fiche.conf_energie -> fiches.mode_chauffage
--   yj_fiche.pac_* -> fiches.* (mapping des champs PAC)
--   yj_fiche.ph3_installateur (varchar) -> fiches.ph3_installateur (int)
--   yj_fiche.cq_etat (varchar) -> fiches.cq_etat (int)
--   yj_fiche.cq_dossier (varchar) -> fiches.cq_dossier (int)
--   yj_fiche.archive (tinyint) -> fiches.archive (int)
--   yj_fiche.valider (tinyint) -> fiches.valider (int)

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
  NULLIF(`Adresse`, '') as `adresse`, -- Adresse avec majuscule
  NULLIF(`cp`, '') as `cp`,
  NULLIF(`ville`, '') as `ville`,
  NULLIF(`etude`, '') as `etude`,
  -- Consommation chauffage: utiliser conf_consommation_chauffage si disponible, sinon pac_consomation
  COALESCE(
    NULLIF(`conf_consommation_chauffage`, ''),
    NULLIF(`pac_consomation`, ''),
    NULL
  ) as `consommation_chauffage`,
  -- Surface habitable: utiliser pac_surface_habitable
  NULLIF(`pac_surface_habitable`, '') as `surface_habitable`,
  -- Année système chauffage: convertir pac_annee_chauf de varchar vers int
  CASE 
    WHEN `pac_annee_chauf` != '' AND `pac_annee_chauf` != '0' 
    THEN CAST(`pac_annee_chauf` AS UNSIGNED)
    ELSE NULL
  END as `annee_systeme_chauffage`,
  -- Surface chauffée: utiliser pac_surface_chauf
  NULLIF(`pac_surface_chauf`, '') as `surface_chauffee`,
  -- Propriétaire maison: utiliser pac_propritaire_maison
  NULLIF(`pac_propritaire_maison`, '') as `proprietaire_maison`,
  -- Nombre de pièces: convertir pac_nombre_pieces de varchar vers int
  CASE 
    WHEN `pac_nombre_pieces` != '' AND `pac_nombre_pieces` != '0'
    THEN CAST(`pac_nombre_pieces` AS UNSIGNED)
    ELSE NULL
  END as `nb_pieces`,
  -- Age maison: utiliser pac_age_maison
  NULLIF(`pac_age_maison`, '') as `age_maison`,
  -- Orientation toiture: utiliser maison_orientation
  NULLIF(`maison_orientation`, '') as `orientation_toiture`,
  -- Produit: convertir conf_produit de varchar vers int (PAC=1, PV=2)
  CASE 
    WHEN UPPER(`conf_produit`) LIKE '%PAC%' THEN 1
    WHEN UPPER(`conf_produit`) LIKE '%PV%' THEN 2
    ELSE NULL
  END as `produit`,
  -- Nombre de cheminées: convertir nb_chemines de int vers varchar
  CASE 
    WHEN `nb_chemines` > 0 THEN CAST(`nb_chemines` AS CHAR)
    ELSE NULL
  END as `nb_chemines`,
  -- Mode chauffage: utiliser conf_energie
  NULLIF(`conf_energie`, '') as `mode_chauffage`,
  -- Consommation électricité: à partir de conf_consommation_electricite ou autres champs
  NULL as `consommation_electricite`, -- Pas de champ direct dans yj_fiche
  NULLIF(`age_mr`, '') as `age_mr`,
  NULLIF(`age_mme`, '') as `age_madame`, -- age_mme -> age_madame
  NULLIF(`revenu`, '') as `revenu_foyer`, -- revenu -> revenu_foyer
  NULLIF(`credit`, '') as `credit_foyer`, -- credit -> credit_foyer
  NULLIF(`situation_conju`, '') as `situation_conjugale`, -- situation_conju -> situation_conjugale
  -- Nombre d'enfants: convertir enfant_encharge de int vers varchar
  CASE 
    WHEN `enfant_encharge` > 0 THEN CAST(`enfant_encharge` AS CHAR)
    ELSE NULL
  END as `nb_enfants`,
  NULLIF(`profession_mr`, '') as `profession_mr`,
  NULLIF(`profession_mme`, '') as `profession_madame`, -- profession_mme -> profession_madame
  NULLIF(`commentaire`, '') as `commentaire`,
  `id_agent`,
  `id_centre`,
  NULL as `id_insert`, -- Pas de champ direct dans yj_fiche
  -- id_confirmateur: retrouver l'ID via le nom dans la table utilisateurs (avec fallback sur id_confirmateur si le nom n'existe pas)
  COALESCE(
    CASE 
      WHEN `nom_confirmateur` != '' AND `nom_confirmateur` IS NOT NULL
      THEN (
        SELECT `id` FROM `utilisateurs` WHERE TRIM(UPPER(`pseudo`)) = TRIM(UPPER(`yj_fiche`.`nom_confirmateur`)) LIMIT 1
      )
      ELSE NULL
    END,
    CASE 
      WHEN `id_confirmateur` > 0 THEN `id_confirmateur`
      ELSE NULL
    END
  ) as `id_confirmateur`,
  -- id_confirmateur_2: retrouver l'ID via le nom dans la table utilisateurs
  CASE 
    WHEN `nom_confirmateur_2` != '' AND `nom_confirmateur_2` IS NOT NULL
    THEN COALESCE(
      (SELECT `id` FROM `utilisateurs` WHERE TRIM(UPPER(`pseudo`)) = TRIM(UPPER(`yj_fiche`.`nom_confirmateur_2`)) LIMIT 1),
      NULL
    )
    ELSE NULL
  END as `id_confirmateur_2`,
  -- id_confirmateur_3: retrouver l'ID via le nom dans la table utilisateurs
  CASE 
    WHEN `nom_confirmateur_3` != '' AND `nom_confirmateur_3` IS NOT NULL
    THEN COALESCE(
      (SELECT `id` FROM `utilisateurs` WHERE TRIM(UPPER(`pseudo`)) = TRIM(UPPER(`yj_fiche`.`nom_confirmateur_3`)) LIMIT 1),
      NULL
    )
    ELSE NULL
  END as `id_confirmateur_3`,
  `id_qualite`,
  NULL as `id_qualif`, -- Pas de champ direct dans yj_fiche
  `id_commercial`,
  -- id_commercial_2: retrouver l'ID via le nom dans la table utilisateurs
  CASE 
    WHEN `nom_commercial_2` != '' AND `nom_commercial_2` IS NOT NULL
    THEN COALESCE(
      (SELECT `id` FROM `utilisateurs` WHERE TRIM(UPPER(`pseudo`)) = TRIM(UPPER(`yj_fiche`.`nom_commercial_2`)) LIMIT 1),
      NULL
    )
    ELSE NULL
  END as `id_commercial_2`,
  -- État final: convertir etat_final (varchar) vers id_etat_final (int)
  -- On essaie d'abord de trouver l'ID correspondant dans la table etats
  -- Si la jointure échoue, on utilise un mapping manuel
  COALESCE(
    (SELECT `id` FROM `etats` e WHERE e.`titre` = `yj_fiche`.`etat_final` LIMIT 1),
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
  -- Date appel: convertir datetime vers bigint (timestamp Unix)
  CASE 
    WHEN `date_heure_appel` != '0000-00-00 00:00:00' AND `date_heure_appel` IS NOT NULL
    THEN UNIX_TIMESTAMP(`date_heure_appel`)
    ELSE NULL
  END as `date_appel`,
  -- Date insert: convertir date_insertion vers bigint
  CASE 
    WHEN `date_insertion` != '0000-00-00 00:00:00' AND `date_insertion` IS NOT NULL
    THEN UNIX_TIMESTAMP(`date_insertion`)
    ELSE NULL
  END as `date_insert`,
  -- Date insert time: utiliser date_insertion directement
  CASE 
    WHEN `date_insertion` != '0000-00-00 00:00:00' AND `date_insertion` IS NOT NULL
    THEN `date_insertion`
    ELSE NULL
  END as `date_insert_time`,
  NULL as `date_audit`, -- Pas de champ direct dans yj_fiche
  NULL as `date_confirmation`, -- Pas de champ direct dans yj_fiche
  NULL as `date_qualif`, -- Pas de champ direct dans yj_fiche
  -- Date RDV: convertir date_heure_playning vers bigint
  CASE 
    WHEN `date_heure_playning` != '0000-00-00 00:00:00' AND `date_heure_playning` IS NOT NULL
    THEN UNIX_TIMESTAMP(`date_heure_playning`)
    ELSE NULL
  END as `date_rdv`,
  -- Date RDV time: utiliser date_heure_playning directement
  CASE 
    WHEN `date_heure_playning` != '0000-00-00 00:00:00' AND `date_heure_playning` IS NOT NULL
    THEN `date_heure_playning`
    ELSE NULL
  END as `date_rdv_time`,
  NULL as `date_affect`, -- Pas de champ direct dans yj_fiche
  NULL as `date_sign`, -- Pas de champ direct dans yj_fiche
  NULL as `date_sign_time`, -- Pas de champ direct dans yj_fiche
  -- Date modif time: utiliser date_heure_mod directement
  CASE 
    WHEN `date_heure_mod` != '0000-00-00 00:00:00' AND `date_heure_mod` IS NOT NULL
    THEN `date_heure_mod`
    ELSE NULL
  END as `date_modif_time`,
  -- Archive: convertir tinyint vers int
  CAST(`archive` AS UNSIGNED) as `archive`,
  0 as `ko`, -- Pas de champ direct dans yj_fiche
  0 as `hc`, -- Pas de champ direct dans yj_fiche
  1 as `active`, -- Par défaut actif
  CAST(`valider` AS UNSIGNED) as `valider`,
  NULLIF(`conf_commentaire_produit`, '') as `conf_commentaire_produit`,
  CASE 
    WHEN `conf_consommations` > 0 THEN `conf_consommations`
    ELSE NULL
  END as `conf_consommations`,
  NULLIF(`conf_profession_monsieur`, '') as `conf_profession_monsieur`,
  NULLIF(`conf_profession_madame`, '') as `conf_profession_madame`,
  NULLIF(`conf_presence_couple`, '') as `conf_presence_couple`,
  -- Conf produit: convertir conf_produit de varchar vers int
  CASE 
    WHEN UPPER(`conf_produit`) LIKE '%PAC%' THEN 1
    WHEN UPPER(`conf_produit`) LIKE '%PV%' THEN 2
    ELSE NULL
  END as `conf_produit`,
  NULL as `conf_orientation_toiture`, -- Pas de champ direct dans yj_fiche
  NULL as `conf_zones_ombres`, -- Pas de champ direct dans yj_fiche
  NULLIF(`site_classe`, '') as `conf_site_classe`, -- site_classe -> conf_site_classe
  NULL as `conf_consommation_electricite`, -- Pas de champ direct dans yj_fiche
  NULLIF(`conf_rdv_avec`, '') as `conf_rdv_avec`,
  -- CQ état: convertir cq_etat de varchar vers int (si c'est un nombre)
  CASE 
    WHEN `cq_etat` != '' AND `cq_etat` REGEXP '^[0-9]+$'
    THEN CAST(`cq_etat` AS UNSIGNED)
    ELSE NULL
  END as `cq_etat`,
  -- CQ dossier: convertir cq_dossier de varchar vers int (si c'est un nombre)
  CASE 
    WHEN `cq_dossier` != '' AND `cq_dossier` REGEXP '^[0-9]+$'
    THEN CAST(`cq_dossier` AS UNSIGNED)
    ELSE NULL
  END as `cq_dossier`,
  -- PH3 installateur: convertir ph3_installateur de varchar vers int (si c'est un nombre)
  CASE 
    WHEN `ph3_installateur` != '' AND `ph3_installateur` REGEXP '^[0-9]+$'
    THEN CAST(`ph3_installateur` AS UNSIGNED)
    ELSE NULL
  END as `ph3_installateur`,
  NULLIF(`ph3_pac`, '') as `ph3_pac`,
  NULLIF(`ph3_puissance`, '') as `ph3_puissance`,
  NULL as `ph3_puissance_pv`, -- Pas de champ direct dans yj_fiche
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
  -- PH3 bonus 30: convertir ph3_bonus_30 de varchar vers decimal
  CASE 
    WHEN `ph3_bonus_30` != '' AND `ph3_bonus_30` REGEXP '^[0-9]+(\\.[0-9]+)?$'
    THEN CAST(`ph3_bonus_30` AS DECIMAL(10,2))
    ELSE NULL
  END as `ph3_bonus_30`,
  -- PH3 mensualité: convertir ph3_mensualite de varchar vers decimal
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
FROM `yj_fiche`
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
-- FIN DU SCRIPT
-- =====================================================

