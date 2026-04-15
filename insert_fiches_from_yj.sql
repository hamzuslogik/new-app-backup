-- =====================================================
-- Script pour migrer les fiches depuis yj_fiche vers fiches
-- Base de données: crm
-- =====================================================
--
-- PRÉREQUIS:
-- Ce script suppose que la table yj_fiche existe déjà dans la base de données.
-- Si elle n'existe pas, vous devez d'abord exécuter yj_fiche.sql
--
-- yj_fiche.id_qualite n'est pas utilise (toujours NULL en pratique). fiches.id_qualite
-- est rempli uniquement via nom_qualite -> utilisateurs.pseudo.
-- Executer AVANT ce script : ensure_utilisateurs_nom_qualite_from_yj_fiche.sql
-- (cree les utilisateurs manquants, inactifs, pour que la resolution fonctionne)
--
-- Ce script migre toutes les fiches de yj_fiche vers la nouvelle table fiches
-- en adaptant les noms de colonnes et en convertissant les types de données.
--
-- AMÉLIORATIONS APPORTÉES:
-- - Ajout du champ nb_pans (nombre de pans de toiture) si disponible dans yj_fiche
-- - conf_consommations (yj_fiche) -> fiches.consommation_electricite (varchar)
-- - Amélioration de la clause ON DUPLICATE KEY UPDATE pour inclure plus de champs importants
-- - Meilleure gestion des valeurs NULL et des conversions de types
-- - id_agent représente l'agent créateur/assigné de la fiche (id_insert reste NULL)
--
-- =====================================================

USE `crm`;

-- =====================================================
-- CONFIGURATION DU HASH
-- =====================================================
-- ⚠️ ATTENTION: MODIFIEZ CETTE LIGNE avec votre HASH_SECRET actuel
-- Pour trouver votre HASH_SECRET, vérifiez le fichier .env à la racine du projet
-- ou la variable d'environnement FICHE_HASH_SECRET
SET @hash_secret = 'crm-jws-group-secret-key-2024-change-in-production';

-- =====================================================
-- CRÉATION DES FONCTIONS POUR LE HASH (si elles n'existent pas)
-- =====================================================

DELIMITER $$

-- Fonction helper pour encoder en base64 (compatible MySQL < 8.0)
DROP FUNCTION IF EXISTS `base64_encode`$$

CREATE FUNCTION `base64_encode`(input_str VARCHAR(255))
RETURNS VARCHAR(255)
DETERMINISTIC
READS SQL DATA
BEGIN
  DECLARE base64_chars VARCHAR(64) DEFAULT 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  DECLARE result VARCHAR(255) DEFAULT '';
  DECLARE i INT DEFAULT 1;
  DECLARE len INT;
  DECLARE char1, char2, char3 INT;
  DECLARE enc1, enc2, enc3, enc4 INT;
  
  SET len = LENGTH(input_str);
  
  WHILE i <= len DO
    SET char1 = ASCII(SUBSTRING(input_str, i, 1));
    SET char2 = IF(i + 1 <= len, ASCII(SUBSTRING(input_str, i + 1, 1)), 0);
    SET char3 = IF(i + 2 <= len, ASCII(SUBSTRING(input_str, i + 2, 1)), 0);
    
    SET enc1 = char1 >> 2;
    SET enc2 = ((char1 & 3) << 4) | (char2 >> 4);
    SET enc3 = IF(i + 1 <= len, ((char2 & 15) << 2) | (char3 >> 6), 64);
    SET enc4 = IF(i + 2 <= len, char3 & 63, 64);
    
    SET result = CONCAT(result,
      SUBSTRING(base64_chars, enc1 + 1, 1),
      SUBSTRING(base64_chars, enc2 + 1, 1),
      IF(enc3 = 64, '=', SUBSTRING(base64_chars, enc3 + 1, 1)),
      IF(enc4 = 64, '=', SUBSTRING(base64_chars, enc4 + 1, 1))
    );
    
    SET i = i + 3;
  END WHILE;
  
  RETURN result;
END$$

DROP FUNCTION IF EXISTS `calculate_fiche_hash`$$

CREATE FUNCTION `calculate_fiche_hash`(fiche_id INT, secret_key VARCHAR(255))
RETURNS VARCHAR(255)
READS SQL DATA
DETERMINISTIC
BEGIN
  DECLARE hash_part VARCHAR(16);
  DECLARE encoded_id VARCHAR(255);
  DECLARE id_str VARCHAR(20);
  DECLARE base64_encoded VARCHAR(255);
  
  -- Convertir l'ID en string
  SET id_str = CAST(fiche_id AS CHAR);
  
  -- Calculer le hash SHA-256 (approximation de HMAC)
  -- Note: Ce n'est pas exactement HMAC, mais proche
  SET hash_part = SUBSTRING(SHA2(CONCAT(secret_key, id_str, secret_key), 256), 1, 16);
  
  -- Encoder l'ID en base64 et convertir en URL-safe
  SET base64_encoded = `base64_encode`(id_str);
  SET encoded_id = REPLACE(REPLACE(REPLACE(base64_encoded, '+', '-'), '/', '_'), '=', '');
  
  -- Retourner la combinaison
  RETURN CONCAT(hash_part, encoded_id);
END$$

DELIMITER ;

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
--   yj_fiche.date_heure_appel -> fiches.date_appel (datetime vers bigint) et fiches.date_appel_time (datetime)
--   yj_fiche.date_heure_playning -> fiches.date_rdv_time
--   yj_fiche.date_heure_mod -> fiches.date_modif_time
--   yj_fiche.date_insertion -> fiches.date_insert (bigint) et fiches.date_insert_time (datetime)
--   yj_fiche.etat_final (varchar) -> fiches.id_etat_final (int) - conversion via table etats
--   yj_fiche.conf_produit (varchar) -> fiches.produit (int) et conf_produit (int)
--   yj_fiche.conf_energie -> fiches.mode_chauffage et conf_mode_chauffage (copie texte telle quelle)
--   yj_fiche.pac_* -> fiches.* (mapping des champs PAC)
--   yj_fiche.surface_disponible -> fiches.surface_habitable (fallback si pac_surface_habitable vide)
--   yj_fiche.chemines (varchar) -> fiches.nb_chemines (fallback si nb_chemines vide)
--   yj_fiche.zones_ombres -> fiches.conf_zones_ombres
--   yj_fiche.site_classe -> fiches.conf_site_classe
--   yj_fiche.ph3_installateur (varchar) -> fiches.ph3_installateur (int)
--   yj_fiche.ph3_prix (int) -> fiches.ph3_prix (decimal)
--   yj_fiche.ph3_bonus_30 (varchar) -> fiches.ph3_bonus_30 (decimal)
--   yj_fiche.ph3_mensualite (varchar) -> fiches.ph3_mensualite (decimal)
--   yj_fiche.cq_etat (texte) -> fiches.cq_etat (int) : si chiffres uniquement = id cq_etat,
--     sinon résolution par cq_etat.titre (trim, insensible à la casse)
--   yj_fiche.cq_dossier (texte) -> fiches.cq_dossier (int) : idem via table cq_dossier
--   yj_fiche.cq_etat, cq_dossier, cq_observations -> fiches.observations_cq (texte agrégé, valeurs brutes YJ)
--   yj_fiche.archive (tinyint) -> fiches.archive (int)
--   yj_fiche.valider (tinyint) -> fiches.valider (int)
--   yj_fiche.nom_centre (varchar) -> fiches.id_centre (int) - conversion via table centres (titre = nom_centre)
--   yj_fiche.nom_agent (varchar) -> fiches.id_agent (int) - conversion via table utilisateurs
--     (nom_agent correspond à l'agent qui a créé/assigne la fiche)
--   yj_fiche.nom_commercial (varchar) -> fiches.id_commercial (int) - conversion via table utilisateurs (si id_commercial vide)
--   yj_fiche.nom_commercial_2 (varchar) -> fiches.id_commercial_2 (int) - conversion via table utilisateurs
--   yj_fiche.nom_confirmateur (varchar) -> fiches.id_confirmateur (int) - conversion via table utilisateurs
--     Si nom_confirmateur = nom_confirmateur_2 = nom_confirmateur_3 → uniquement id_confirmateur
--     Si 2 valeurs distinctes → id_confirmateur + id_confirmateur_2
--     Si 3 valeurs distinctes → id_confirmateur + id_confirmateur_2 + id_confirmateur_3
--   yj_fiche.nom_confirmateur_2 (varchar) -> fiches.id_confirmateur_2 (int) - conversion via table utilisateurs
--   yj_fiche.nom_confirmateur_3 (varchar) -> fiches.id_confirmateur_3 (int) - conversion via table utilisateurs
--   yj_fiche.commentaire -> fiches.conf_commentaire_produit (commentaire confirmateur / compte rendu)
--   yj_fiche.nom_qualite uniquement -> fiches.id_qualite via utilisateurs.pseudo (yj_fiche.id_qualite ignore)
--   yj_fiche.conf_consommations -> fiches.consommation_electricite (numérique -> texte)

INSERT INTO `fiches` (
  `id`, `civ`, `nom`, `prenom`, `tel`, `gsm1`, `gsm2`, `adresse`, `cp`, `ville`,
  `etude`, `consommation_chauffage`, `surface_habitable`, `annee_systeme_chauffage`,
  `surface_chauffee`, `proprietaire_maison`, `nb_pieces`, `nb_pans`, `age_maison`, `orientation_toiture`,
  `produit`, `nb_chemines`, `mode_chauffage`, `consommation_electricite`, `age_mr`,
  `age_madame`, `revenu_foyer`, `credit_foyer`, `situation_conjugale`, `nb_enfants`,
  `profession_mr`, `profession_madame`, `commentaire`, `id_agent`, `id_centre`, `id_insert`,
  `id_confirmateur`, `id_confirmateur_2`, `id_confirmateur_3`, `id_qualite`, `id_qualif`,
  `id_commercial`, `id_commercial_2`, `id_etat_final`, `id_sous_etat`, `date_appel`, `date_appel_time`, `date_insert`,
  `date_insert_time`, `date_audit`, `date_confirmation`, `date_qualif`, `date_rdv`,
  `date_rdv_time`, `date_affect`, `date_sign`, `date_sign_time`, `date_modif_time`,
  `archive`, `ko`, `hc`, `active`, `valider`, `conf_commentaire_produit`, `conf_consommations`,
  `conf_profession_monsieur`, `conf_profession_madame`, `conf_presence_couple`, `conf_produit`,
  `conf_orientation_toiture`, `conf_zones_ombres`, `conf_site_classe`, `conf_consommation_electricite`,
  `conf_rdv_avec`,
  `conf_appel_tunisie_avec`, `conf_deja_etude`, `conf_revenu`, `conf_credit`, `conf_mode_chauffage`,
  `conf_consommation_chauffage`, `conf_rdv_annule_precedent`, `conf_type_contrat_mr`, `conf_type_contrat_madame`,
  `cq_etat`, `cq_dossier`, `observations_cq`, `ph3_installateur`, `ph3_pac`, `ph3_puissance`,
  `ph3_puissance_pv`, `ph3_rr_model`, `ph3_ballon`, `ph3_marque_ballon`, `ph3_alimentation`,
  `ph3_type`, `ph3_prix`, `ph3_bonus_30`, `ph3_mensualite`, `ph3_attente`, `nbr_annee_finance`,
  `credit_immobilier`, `credit_autre`, `hash`
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
  -- Surface habitable: utiliser pac_surface_habitable, sinon surface_disponible
  COALESCE(
    NULLIF(`pac_surface_habitable`, ''),
    NULLIF(`surface_disponible`, ''),
    NULL
  ) as `surface_habitable`,
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
  -- Nombre de pans: NULL par défaut (colonne peut ne pas exister dans yj_fiche)
  NULL as `nb_pans`,
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
  -- Nombre de cheminées: convertir nb_chemines de int vers varchar, sinon utiliser chemines (varchar)
  COALESCE(
    CASE 
      WHEN `nb_chemines` > 0 THEN CAST(`nb_chemines` AS CHAR)
      ELSE NULL
    END,
    NULLIF(`chemines`, '')
  ) as `nb_chemines`,
  -- Mode chauffage : copie directe de conf_energie (colonne fiches.mode_chauffage = VARCHAR)
  NULLIF(TRIM(`conf_energie`), '') as `mode_chauffage`,
  -- Consommation électricité: yj_fiche.conf_consommations (converti en texte pour varchar)
  CASE 
    WHEN `conf_consommations` IS NOT NULL AND `conf_consommations` > 0 
    THEN CAST(CAST(`conf_consommations` AS UNSIGNED) AS CHAR)
    ELSE NULL
  END as `consommation_electricite`,
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
  -- id_agent: retrouver l'ID via le nom dans la table utilisateurs
  CASE 
    WHEN `nom_agent` != '' AND `nom_agent` IS NOT NULL
    THEN (
      SELECT `id` FROM `utilisateurs` WHERE TRIM(UPPER(`pseudo`)) = TRIM(UPPER(`yj_fiche`.`nom_agent`)) LIMIT 1
    )
    ELSE NULL
  END as `id_agent`,
  -- id_centre: retrouver l'ID via nom_centre dans la table centres (non pas id_centre de yj_fiche)
  COALESCE(
    CASE 
      WHEN NULLIF(TRIM(`nom_centre`), '') IS NOT NULL
      THEN (SELECT `id` FROM `centres` WHERE TRIM(UPPER(`titre`)) = TRIM(UPPER(`yj_fiche`.`nom_centre`)) LIMIT 1)
      ELSE NULL
    END,
    CASE WHEN `id_centre` > 0 THEN `id_centre` ELSE NULL END
  ) as `id_centre`,
  NULL as `id_insert`, -- Pas de champ direct dans yj_fiche (id_agent représente l'agent créateur)
  -- Confirmateurs : 1 même valeur sur les 3 noms → uniquement id_confirmateur ; 2 valeurs distinctes → id_confirmateur + id_confirmateur_2 ; 3 distinctes → id_confirmateur + id_confirmateur_2 + id_confirmateur_3
  COALESCE(
    CASE WHEN NULLIF(TRIM(`nom_confirmateur`), '') IS NOT NULL
    THEN (SELECT `id` FROM `utilisateurs` WHERE TRIM(UPPER(`pseudo`)) = UPPER(TRIM(`yj_fiche`.`nom_confirmateur`)) LIMIT 1)
    ELSE NULL END,
    CASE WHEN `id_confirmateur` > 0 THEN `id_confirmateur` ELSE NULL END
  ) as `id_confirmateur`,
  CASE
    -- Tous les 3 noms identiques → pas de 2ème
    WHEN NULLIF(TRIM(`nom_confirmateur`), '') IS NOT NULL AND NULLIF(TRIM(`nom_confirmateur_2`), '') IS NOT NULL AND NULLIF(TRIM(`nom_confirmateur_3`), '') IS NOT NULL
     AND UPPER(TRIM(`nom_confirmateur`)) = UPPER(TRIM(`nom_confirmateur_2`))
     AND UPPER(TRIM(`nom_confirmateur_2`)) = UPPER(TRIM(`nom_confirmateur_3`))
    THEN NULL
    -- 2ème position différente du 1er → id_confirmateur_2 depuis nom_confirmateur_2
    WHEN NULLIF(TRIM(`nom_confirmateur_2`), '') IS NOT NULL AND UPPER(TRIM(`nom_confirmateur_2`)) != UPPER(TRIM(IFNULL(`nom_confirmateur`, '')))
    THEN (SELECT `id` FROM `utilisateurs` WHERE TRIM(UPPER(`pseudo`)) = UPPER(TRIM(`yj_fiche`.`nom_confirmateur_2`)) LIMIT 1)
    -- 3ème position différente du 1er (et 2ème vide ou égal au 1er) → id_confirmateur_2 depuis nom_confirmateur_3
    WHEN NULLIF(TRIM(`nom_confirmateur_3`), '') IS NOT NULL AND UPPER(TRIM(`nom_confirmateur_3`)) != UPPER(TRIM(IFNULL(`nom_confirmateur`, '')))
     AND (NULLIF(TRIM(`nom_confirmateur_2`), '') IS NULL OR UPPER(TRIM(`nom_confirmateur_2`)) = UPPER(TRIM(IFNULL(`nom_confirmateur`, ''))))
    THEN (SELECT `id` FROM `utilisateurs` WHERE TRIM(UPPER(`pseudo`)) = UPPER(TRIM(`yj_fiche`.`nom_confirmateur_3`)) LIMIT 1)
    ELSE NULL
  END as `id_confirmateur_2`,
  CASE
    -- Tous les 3 noms identiques → pas de 3ème
    WHEN NULLIF(TRIM(`nom_confirmateur`), '') IS NOT NULL AND NULLIF(TRIM(`nom_confirmateur_2`), '') IS NOT NULL AND NULLIF(TRIM(`nom_confirmateur_3`), '') IS NOT NULL
     AND UPPER(TRIM(`nom_confirmateur`)) = UPPER(TRIM(`nom_confirmateur_2`))
     AND UPPER(TRIM(`nom_confirmateur_2`)) = UPPER(TRIM(`nom_confirmateur_3`))
    THEN NULL
    -- 3 valeurs distinctes : 1er != 2ème et 2ème != 3ème et 1er != 3ème → id_confirmateur_3 depuis nom_confirmateur_3
    WHEN NULLIF(TRIM(`nom_confirmateur`), '') IS NOT NULL AND NULLIF(TRIM(`nom_confirmateur_2`), '') IS NOT NULL AND NULLIF(TRIM(`nom_confirmateur_3`), '') IS NOT NULL
     AND UPPER(TRIM(`nom_confirmateur`)) != UPPER(TRIM(`nom_confirmateur_2`))
     AND UPPER(TRIM(`nom_confirmateur_2`)) != UPPER(TRIM(`nom_confirmateur_3`))
     AND UPPER(TRIM(`nom_confirmateur`)) != UPPER(TRIM(`nom_confirmateur_3`))
    THEN (SELECT `id` FROM `utilisateurs` WHERE TRIM(UPPER(`pseudo`)) = UPPER(TRIM(`yj_fiche`.`nom_confirmateur_3`)) LIMIT 1)
    ELSE NULL
  END as `id_confirmateur_3`,
  CASE
    WHEN NULLIF(TRIM(`nom_qualite`), '') IS NOT NULL
    THEN (
      SELECT `id` FROM `utilisateurs`
      WHERE TRIM(UPPER(`pseudo`)) = TRIM(UPPER(`yj_fiche`.`nom_qualite`))
      LIMIT 1
    )
    ELSE NULL
  END as `id_qualite`,
  NULL as `id_qualif`, -- Pas de champ direct dans yj_fiche
  -- id_commercial: utiliser id_commercial si présent, sinon chercher via nom_commercial
  COALESCE(
    CASE 
      WHEN `id_commercial` > 0 THEN `id_commercial`
      ELSE NULL
    END,
    CASE 
      WHEN `nom_commercial` != '' AND `nom_commercial` IS NOT NULL
      THEN (
        SELECT `id` FROM `utilisateurs` WHERE TRIM(UPPER(`pseudo`)) = TRIM(UPPER(`yj_fiche`.`nom_commercial`)) LIMIT 1
      )
      ELSE NULL
    END
  ) as `id_commercial`,
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
  -- Sous-etat: conversion yj_fiche.sous_etat -> fiches.id_sous_etat via (id_etat + titre)
  (
    SELECT se.`id`
    FROM `sous_etat` se
    WHERE se.`id_etat` = COALESCE(
      (SELECT `id` FROM `etats` e WHERE TRIM(UPPER(e.`titre`)) = TRIM(UPPER(`yj_fiche`.`etat_final`)) LIMIT 1),
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
    )
    AND TRIM(UPPER(se.`titre`)) = TRIM(UPPER(`yj_fiche`.`sous_etat`))
    LIMIT 1
  ) as `id_sous_etat`,
  -- Date appel: convertir datetime vers bigint (timestamp Unix)
  CASE 
    WHEN `date_heure_appel` != '0000-00-00 00:00:00' AND `date_heure_appel` IS NOT NULL
    THEN UNIX_TIMESTAMP(`date_heure_appel`)
    ELSE NULL
  END as `date_appel`,
  -- Date appel time: utiliser date_heure_appel directement
  CASE 
    WHEN `date_heure_appel` != '0000-00-00 00:00:00' AND `date_heure_appel` IS NOT NULL
    THEN `date_heure_appel`
    ELSE NULL
  END as `date_appel_time`,
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
  -- conf_commentaire_produit: rempli par le champ commentaire de yj_fiche
  NULLIF(TRIM(`commentaire`), '') as `conf_commentaire_produit`,
  -- conf_consommations source -> consommation_electricite (colonne conf_consommations non remplie par cette migration)
  NULL as `conf_consommations`,
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
  NULLIF(`zones_ombres`, '') as `conf_zones_ombres`, -- zones_ombres -> conf_zones_ombres
  NULLIF(`site_classe`, '') as `conf_site_classe`, -- site_classe -> conf_site_classe
  NULL as `conf_consommation_electricite`, -- Pas de champ direct dans yj_fiche
  NULLIF(`conf_rdv_avec`, '') as `conf_rdv_avec`,
  -- Nouveaux champs conf_ (yj_fiche a conf_deja_fait_etude, conf_revenu, conf_credit, conf_annulee_precedemment, conf_consommation_chauffage)
  'entretient' as `conf_appel_tunisie_avec`,
  COALESCE(NULLIF(TRIM(`conf_deja_fait_etude`), ''), NULLIF(TRIM(`etude`), '')) as `conf_deja_etude`,
  COALESCE(NULLIF(TRIM(`conf_revenu`), ''), NULLIF(TRIM(`revenu`), '')) as `conf_revenu`,
  COALESCE(NULLIF(TRIM(`conf_credit`), ''), NULLIF(TRIM(`credit`), '')) as `conf_credit`,
  -- conf_mode_chauffage : identique à mode_chauffage (copie conf_energie)
  NULLIF(TRIM(`conf_energie`), '') as `conf_mode_chauffage`,
  NULLIF(TRIM(`conf_consommation_chauffage`), '') as `conf_consommation_chauffage`,
  NULLIF(TRIM(`conf_annulee_precedemment`), '') as `conf_rdv_annule_precedent`,
  NULL as `conf_type_contrat_mr`, -- Pas dans yj_fiche
  NULL as `conf_type_contrat_madame`, -- Pas dans yj_fiche
  -- CQ état : id (nombre pur) ou libellé -> cq_etat.id
  COALESCE(
    CASE
      WHEN NULLIF(TRIM(`cq_etat`), '') IS NULL THEN NULL
      WHEN TRIM(`cq_etat`) REGEXP '^[0-9]+$' THEN CAST(TRIM(`cq_etat`) AS UNSIGNED)
      ELSE NULL
    END,
    (
      SELECT e.id
      FROM cq_etat e
      WHERE e.titre IS NOT NULL
        AND NULLIF(TRIM(`cq_etat`), '') IS NOT NULL
        AND TRIM(LOWER(e.titre)) = TRIM(LOWER(`cq_etat`))
      LIMIT 1
    )
  ) as `cq_etat`,
  -- CQ dossier : id (nombre pur) ou libellé -> cq_dossier.id
  COALESCE(
    CASE
      WHEN NULLIF(TRIM(`cq_dossier`), '') IS NULL THEN NULL
      WHEN TRIM(`cq_dossier`) REGEXP '^[0-9]+$' THEN CAST(TRIM(`cq_dossier`) AS UNSIGNED)
      ELSE NULL
    END,
    (
      SELECT d.id
      FROM cq_dossier d
      WHERE d.titre IS NOT NULL
        AND NULLIF(TRIM(`cq_dossier`), '') IS NOT NULL
        AND TRIM(LOWER(d.titre)) = TRIM(LOWER(`cq_dossier`))
      LIMIT 1
    )
  ) as `cq_dossier`,
  -- observations_cq : copie des infos CQ depuis YJ (texte brut, y compris si non numérique)
  NULLIF(
    TRIM(CONCAT_WS(CHAR(10),
      IF(NULLIF(TRIM(`cq_etat`), '') IS NULL, NULL, CONCAT('CQ état: ', TRIM(`cq_etat`))),
      IF(NULLIF(TRIM(`cq_dossier`), '') IS NULL, NULL, CONCAT('CQ dossier: ', TRIM(`cq_dossier`))),
      NULLIF(TRIM(`cq_observations`), '')
    )),
    ''
  ) as `observations_cq`,
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
  -- PH3 prix: convertir ph3_prix de int vers decimal
  CASE 
    WHEN `ph3_prix` > 0 THEN CAST(`ph3_prix` AS DECIMAL(10,2))
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
  NULLIF(`credit_autre`, '') as `credit_autre`,
  -- Hash: laisser NULL (sera calculé plus tard par les scripts de mise à jour)
  NULL as `hash`
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
  `etude` = VALUES(`etude`),
  `mode_chauffage` = VALUES(`mode_chauffage`),
  `id_etat_final` = VALUES(`id_etat_final`),
  `id_sous_etat` = VALUES(`id_sous_etat`),
  `id_agent` = VALUES(`id_agent`),
  `id_centre` = VALUES(`id_centre`),
  `id_commercial` = VALUES(`id_commercial`),
  `id_confirmateur` = VALUES(`id_confirmateur`),
  `id_confirmateur_2` = VALUES(`id_confirmateur_2`),
  `id_confirmateur_3` = VALUES(`id_confirmateur_3`),
  `id_qualite` = VALUES(`id_qualite`),
  `date_rdv_time` = VALUES(`date_rdv_time`),
  `date_modif_time` = VALUES(`date_modif_time`),
  `consommation_electricite` = VALUES(`consommation_electricite`),
  `conf_commentaire_produit` = VALUES(`conf_commentaire_produit`),
  `conf_consommations` = VALUES(`conf_consommations`),
  `conf_profession_monsieur` = VALUES(`conf_profession_monsieur`),
  `conf_profession_madame` = VALUES(`conf_profession_madame`),
  `conf_presence_couple` = VALUES(`conf_presence_couple`),
  `conf_produit` = VALUES(`conf_produit`),
  `conf_orientation_toiture` = VALUES(`conf_orientation_toiture`),
  `conf_zones_ombres` = VALUES(`conf_zones_ombres`),
  `conf_site_classe` = VALUES(`conf_site_classe`),
  `conf_consommation_electricite` = VALUES(`conf_consommation_electricite`),
  `conf_rdv_avec` = VALUES(`conf_rdv_avec`),
  `conf_appel_tunisie_avec` = VALUES(`conf_appel_tunisie_avec`),
  `conf_deja_etude` = VALUES(`conf_deja_etude`),
  `conf_revenu` = VALUES(`conf_revenu`),
  `conf_credit` = VALUES(`conf_credit`),
  `conf_mode_chauffage` = VALUES(`conf_mode_chauffage`),
  `conf_consommation_chauffage` = VALUES(`conf_consommation_chauffage`),
  `conf_rdv_annule_precedent` = VALUES(`conf_rdv_annule_precedent`),
  `conf_type_contrat_mr` = VALUES(`conf_type_contrat_mr`),
  `conf_type_contrat_madame` = VALUES(`conf_type_contrat_madame`),
  `cq_etat` = VALUES(`cq_etat`),
  `cq_dossier` = VALUES(`cq_dossier`),
  `observations_cq` = VALUES(`observations_cq`);

-- =====================================================
-- FIN DU SCRIPT
-- =====================================================

