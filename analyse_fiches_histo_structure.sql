-- =====================================================
-- Analyse de la structure de la table fiches_histo
-- et vérification des informations nécessaires pour l'affichage
-- =====================================================

USE `crm`;

-- =====================================================
-- ÉTAPE 1 : Structure actuelle de fiches_histo
-- =====================================================

SELECT 
    '=== STRUCTURE ACTUELLE DE fiches_histo ===' as info;

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
-- ÉTAPE 2 : Informations nécessaires pour l'affichage
-- =====================================================
-- 
-- D'après l'analyse du code frontend (FicheDetail.jsx) et backend (fiche.routes.js),
-- l'historique doit contenir les informations suivantes :
--
-- INFORMATIONS DE BASE (déjà dans fiches_histo) :
-- ✓ id_fiche
-- ✓ id_etat
-- ✓ date_creation
-- ✓ date_rdv_time (optionnel)
--
-- INFORMATIONS ENRICHIES (actuellement ajoutées depuis la fiche actuelle - PROBLÈME) :
-- ✗ confirmateur_pseudo, confirmateur_2_pseudo, confirmateur_3_pseudo
-- ✗ conf_commentaire_produit
-- ✗ date_appel_time
-- ✗ date_sign_time
-- ✗ sous_etat_titre (via id_sous_etat)
-- ✗ commercial_pseudo
-- ✗ installeur_nom
-- ✗ ph3_pac, ph3_financement, ph3_prix, ph3_puissance, etc.
-- ✗ conf_rdv_avec
-- ✗ profession_mr, profession_madame
-- ✗ type_contrat_mr, type_contrat_madame
-- ✗ revenu_foyer, credit_foyer
-- ✗ mode_chauffage, produit
-- ✗ surface_chauffee, consommation_chauffage
-- ✗ annee_systeme_chauffage
-- ✗ conf_orientation_toiture, conf_zones_ombres, conf_site_classe
-- ✗ conf_consommation_electricite
-- ✗ nb_pans
-- ✗ cq_etat, cq_dossier
-- ✗ commentaire_qualite, commentaire_commercial
--
-- PROBLÈME IDENTIFIÉ :
-- Le backend enrichit actuellement chaque entrée de l'historique avec les données
-- de la fiche ACTUELLE, ce qui signifie que toutes les entrées historiques affichent
-- les mêmes valeurs (celles d'aujourd'hui), pas les valeurs au moment du changement d'état.
--
-- =====================================================
-- ÉTAPE 3 : Exemple de données dans fiches_histo
-- =====================================================

SELECT 
    '=== EXEMPLES DE DONNÉES DANS fiches_histo ===' as info;

SELECT 
    fh.`id`,
    fh.`id_fiche`,
    fh.`id_etat`,
    e.`titre` as etat_titre,
    fh.`date_rdv_time`,
    fh.`date_creation`,
    f.`nom`,
    f.`prenom`
FROM `fiches_histo` fh
LEFT JOIN `etats` e ON fh.`id_etat` = e.`id`
LEFT JOIN `fiches` f ON fh.`id_fiche` = f.`id`
ORDER BY fh.`id_fiche`, fh.`date_creation`
LIMIT 10;

-- =====================================================
-- ÉTAPE 4 : Comparaison avec les données de la fiche actuelle
-- =====================================================
-- 
-- Cette requête montre ce qui est stocké dans fiches_histo vs ce qui est dans la fiche actuelle
-- pour une fiche spécifique (exemple: fiche 924782)

SELECT 
    '=== COMPARAISON : fiches_histo vs fiches (exemple fiche 924782) ===' as info;

-- Données dans fiches_histo
SELECT 
    'DONNÉES DANS fiches_histo' as source,
    fh.`id`,
    fh.`id_fiche`,
    fh.`id_etat`,
    fh.`date_rdv_time`,
    fh.`date_creation`
FROM `fiches_histo` fh
WHERE fh.`id_fiche` = 924782
ORDER BY fh.`date_creation`;

-- Données actuelles dans fiches (qui sont utilisées pour enrichir l'historique)
SELECT 
    'DONNÉES ACTUELLES DANS fiches' as source,
    f.`id`,
    f.`id_etat_final` as id_etat,
    f.`id_confirmateur`,
    f.`id_confirmateur_2`,
    f.`id_confirmateur_3`,
    f.`conf_commentaire_produit`,
    f.`date_rdv_time`,
    f.`date_appel_time`,
    f.`date_sign_time`,
    f.`id_sous_etat`,
    f.`id_commercial`,
    f.`ph3_installateur`,
    f.`ph3_pac`,
    f.`ph3_type`,
    f.`ph3_prix`
FROM `fiches` f
WHERE f.`id` = 924782;

-- =====================================================
-- ÉTAPE 5 : Recommandations
-- =====================================================
--
-- PROBLÈME PRINCIPAL :
-- La table fiches_histo ne stocke que l'état et la date, mais pas les autres informations
-- contextuelles (confirmateur, commentaire, dates spécifiques, etc.) au moment du changement.
-- Le backend compense en ajoutant les données actuelles de la fiche, ce qui ne reflète pas
-- l'historique réel.
--
-- SOLUTIONS POSSIBLES :
--
-- OPTION 1 : Enrichir la table fiches_histo avec les colonnes nécessaires
--   - Ajouter les colonnes pour stocker les valeurs au moment du changement d'état
--   - Modifier le backend pour stocker ces valeurs lors de la création de l'entrée historique
--   - Avantage : Historique réel et précis
--   - Inconvénient : Modification de la structure de la table et du code
--
-- OPTION 2 : Utiliser la table modifica pour l'historique détaillé
--   - La table modifica contient déjà l'historique des modifications
--   - Filtrer par type = 'etat' ou similaire
--   - Avantage : Pas de modification de structure
--   - Inconvénient : Nécessite de vérifier si modifica stocke toutes les infos nécessaires
--
-- OPTION 3 : Créer une table d'historique enrichie (snapshot)
--   - Créer une nouvelle table qui stocke un snapshot complet de la fiche à chaque changement d'état
--   - Avantage : Historique complet et précis
--   - Inconvénient : Beaucoup de données dupliquées
--
-- =====================================================
-- FIN DE L'ANALYSE
-- =====================================================

