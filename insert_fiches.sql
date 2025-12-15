-- =====================================================
-- Script pour migrer les fiches vers la nouvelle table fiches
-- Base de données: crm
-- =====================================================
--
-- PRÉREQUIS:
-- Ce script suppose qu'une table source de fiches existe déjà dans la base de données.
-- Les noms possibles de la table source peuvent être:
--   - yj_fiche
--   - fiches (ancienne table)
--   - ou toute autre table contenant les données de fiches
--
-- IMPORTANT: 
-- Vous devez adapter le nom de la table source dans la requête SELECT ci-dessous
-- en remplaçant `yj_fiche` par le nom réel de votre table source.
--
-- Ce script migre toutes les fiches actives (active = 1) vers la nouvelle table fiches
-- en adaptant les noms de colonnes si nécessaire.
--
-- =====================================================

USE `crm`;

-- =====================================================
-- FICHES
-- =====================================================
-- Migration depuis la table source vers fiches
-- 
-- NOTE: Adaptez le nom de la table source dans le FROM ci-dessous
-- Si votre table source s'appelle différemment, remplacez `yj_fiche` par le nom réel
--
-- Mapping des colonnes (si les noms diffèrent, adaptez dans le SELECT):
--   Toutes les colonnes qui existent dans les deux tables sont mappées directement
--   Les colonnes qui n'existent que dans la nouvelle table seront NULL

-- VERSION 1: Si la table source s'appelle yj_fiche
-- Décommentez cette section et commentez la VERSION 2 si c'est le cas

/*
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
FROM `yj_fiche`
WHERE `active` = 1 OR `active` IS NULL
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
*/

-- VERSION 2: Si la table source s'appelle fiches (migration depuis l'ancienne vers la nouvelle)
-- Décommentez cette section et commentez la VERSION 1 si c'est le cas
-- Cette version suppose que vous avez une table fiches existante à migrer

/*
-- Si vous avez besoin de migrer depuis une table fiches existante vers la nouvelle,
-- utilisez cette requête (remplacez `fiches_old` par le nom réel de votre table source):

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
  `id`, `civ`, `nom`, `prenom`, `tel`, `gsm1`, `gsm2`, `adresse`, `cp`, `ville`,
  `etude`, `consommation_chauffage`, `surface_habitable`, `annee_systeme_chauffage`,
  `surface_chauffee`, `proprietaire_maison`, `nb_pieces`, `age_maison`, `orientation_toiture`,
  `produit`, `nb_chemines`, `mode_chauffage`, `consommation_electricite`, `age_mr`,
  `age_madame`, `revenu_foyer`, `credit_foyer`, `situation_conjugale`, `nb_enfants`,
  `profession_mr`, `profession_madame`, `commentaire`, 
  CAST(`id_agent` AS UNSIGNED) as `id_agent`, -- Conversion si id_agent est varchar dans l'ancienne table
  `id_centre`, 
  CAST(`id_insert` AS UNSIGNED) as `id_insert`, -- Conversion si id_insert est varchar dans l'ancienne table
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
FROM `fiches_old` -- REMPLACEZ fiches_old par le nom réel de votre table source
WHERE (`active` = 1 OR `active` IS NULL)
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
*/

-- =====================================================
-- NOTE IMPORTANTE
-- =====================================================
-- Ce script est un template. Vous devez:
-- 1. Identifier le nom réel de votre table source de fiches
-- 2. Décommenter la VERSION appropriée (1 ou 2)
-- 3. Adapter le nom de la table dans le FROM
-- 4. Vérifier que toutes les colonnes existent dans la table source
-- 5. Adapter les conversions de types si nécessaire (ex: id_agent, id_insert)
--
-- Pour vérifier la structure de votre table source, exécutez:
-- DESCRIBE `nom_de_votre_table_source`;
--
-- =====================================================
-- FIN DU SCRIPT
-- =====================================================

