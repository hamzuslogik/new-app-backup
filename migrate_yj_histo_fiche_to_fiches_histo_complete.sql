-- =====================================================
-- Script complet de migration de yj_histo_fiche vers fiches_histo
-- =====================================================
--
-- Structure typique de yj_histo_fiche (à adapter si noms différents) :
-- - Pas de colonne "id_etat" : l'état est dans la colonne "etat" (libellé ex. "CONFIRMER" ou numérique)
-- - Date planning : uniquement "date_heure_playning" (pas de date_rdv_time dans la source)
--
-- Le script convertit "etat" -> id_etat (numérique) via la table etats (ex. CONFIRMER -> 7).
-- date_heure_playning (yj) -> date_rdv_time (fiches_histo).
-- date_creation et date_appel_time (fiches_histo) : priorité à date_heure_mod (yj) si présente.
--
-- Migre TOUS les champs possibles :
-- - id_fiche, id_etat (depuis etat), date_creation (depuis date_heure_mod ou date_creation), date_rdv_time (depuis date_heure_playning)
-- - id_confirmateur, ..., date_appel_time (depuis date_heure_mod ou date_appel_time), date_sign_time
-- - id_sous_etat, id_commercial, ph3_*, credit_*, valeur_mensualite
-- - conf_mode_chauffage (fiches_histo) <- conf_energie (table YJ : yj_histo_fiche ou yj_fiche_histo), texte tel quel (VARCHAR)
-- Détection insensible à la casse. Colonne fiche : id_fiche, fiche_id ou id.
--
-- =====================================================

USE `crm`;

-- Désactiver temporairement les vérifications pour améliorer les performances
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_SAFE_UPDATES = 0;

-- =====================================================
-- ÉTAPE 1 : Vérifier l'existence des tables
-- =====================================================

-- Table historique YJ : accepte yj_histo_fiche OU yj_fiche_histo (noms rencontrés en production).
-- Si les deux existent, priorité à yj_fiche_histo (souvent celle qui contient conf_energie).
SET @yj_source_table = (
  SELECT t.TABLE_NAME
  FROM INFORMATION_SCHEMA.TABLES t
  WHERE t.TABLE_SCHEMA = DATABASE()
    AND LOWER(t.TABLE_NAME) IN ('yj_histo_fiche', 'yj_fiche_histo')
  ORDER BY CASE LOWER(t.TABLE_NAME) WHEN 'yj_fiche_histo' THEN 0 WHEN 'yj_histo_fiche' THEN 1 ELSE 2 END,
           t.TABLE_NAME
  LIMIT 1
);

SELECT 
    CASE 
        WHEN @yj_source_table IS NULL THEN '✗ Aucune table yj_histo_fiche ni yj_fiche_histo'
        ELSE CONCAT('✓ Table source YJ pour la migration : ', @yj_source_table)
    END AS verification_table_source_yj;

SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✓ Table fiches_histo existe'
        ELSE '✗ Table fiches_histo n''existe pas'
    END as verification_fiches_histo
FROM information_schema.tables 
WHERE table_schema = DATABASE() 
  AND table_name = 'fiches_histo';

-- =====================================================
-- ÉTAPE 2 : Analyser la structure de yj_histo_fiche
-- =====================================================

-- Afficher toutes les colonnes de la table YJ retenue
SELECT 
    CONCAT('=== STRUCTURE DE ', IFNULL(@yj_source_table, '(non défini)'), ' ===') AS info;

SELECT 
    COLUMN_NAME as nom_colonne,
    DATA_TYPE as type_donnee,
    CHARACTER_MAXIMUM_LENGTH as longueur_max,
    IS_NULLABLE as nullable,
    COLUMN_DEFAULT as valeur_par_defaut,
    ORDINAL_POSITION as position
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = @yj_source_table
ORDER BY ORDINAL_POSITION;

-- Afficher quelques exemples de données
SELECT 
    '=== EXEMPLES DE DONNÉES (5 premières lignes) ===' as info;

SET @yj_preview_sql = IF(
  @yj_source_table IS NOT NULL,
  CONCAT('SELECT * FROM `', REPLACE(@yj_source_table, '`', ''), '` LIMIT 5'),
  'SELECT ''(aucune table YJ)'' AS message'
);
PREPARE stmt_yj_preview FROM @yj_preview_sql;
EXECUTE stmt_yj_preview;
DEALLOCATE PREPARE stmt_yj_preview;

-- Compter le total
SET @yj_count_sql = IF(
  @yj_source_table IS NOT NULL,
  CONCAT('SELECT ''=== STATISTIQUES ==='' AS info, COUNT(*) AS total_lignes_yj FROM `', REPLACE(@yj_source_table, '`', ''), '`'),
  'SELECT ''=== STATISTIQUES ==='' AS info, NULL AS total_lignes_yj'
);
PREPARE stmt_yj_count FROM @yj_count_sql;
EXECUTE stmt_yj_count;
DEALLOCATE PREPARE stmt_yj_count;

-- =====================================================
-- ÉTAPE 3 : Identifier les colonnes clés
-- =====================================================

-- Colonne pour l'ID de la fiche (probablement 'id' ou 'id_fiche')
SELECT 
    '=== COLONNES POUR ID_FICHE ===' as info,
    COLUMN_NAME,
    DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = @yj_source_table
  AND (COLUMN_NAME LIKE '%fiche%' OR COLUMN_NAME = 'id')
ORDER BY 
    CASE 
        WHEN COLUMN_NAME = 'id' THEN 1
        WHEN COLUMN_NAME = 'id_fiche' THEN 2
        WHEN COLUMN_NAME LIKE '%fiche%' THEN 3
        ELSE 4
    END;

-- Colonnes pour l'état (probablement 'etat', 'id_etat', 'etat_final', etc.)
SELECT 
    '=== COLONNES POUR ÉTAT ===' as info,
    COLUMN_NAME,
    DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = @yj_source_table
  AND (COLUMN_NAME LIKE '%etat%' OR COLUMN_NAME LIKE '%statut%')
ORDER BY 
    CASE 
        WHEN COLUMN_NAME = 'id_etat' THEN 1
        WHEN COLUMN_NAME = 'etat' THEN 2
        WHEN COLUMN_NAME = 'etat_final' THEN 3
        WHEN COLUMN_NAME LIKE '%etat%' THEN 4
        ELSE 5
    END;

-- Colonnes pour les dates
SELECT 
    '=== COLONNES POUR DATES ===' as info,
    COLUMN_NAME,
    DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = @yj_source_table
  AND (COLUMN_NAME LIKE '%date%' OR COLUMN_NAME LIKE '%heure%' OR COLUMN_NAME LIKE '%time%')
ORDER BY 
    CASE 
        WHEN COLUMN_NAME = 'date_creation' THEN 1
        WHEN COLUMN_NAME = 'date' THEN 2
        WHEN COLUMN_NAME LIKE '%date%' THEN 3
        WHEN COLUMN_NAME LIKE '%time%' THEN 4
        ELSE 5
    END;

-- =====================================================
-- ÉTAPE 4 : Vérifier les correspondances avec fiches
-- =====================================================

-- Compter combien de fiches de yj_histo_fiche existent dans fiches
-- (en supposant que la colonne 'id' dans yj_histo_fiche correspond à fiches.id)
SET @step4_corr_sql = IF(
  @yj_source_table IS NOT NULL,
  CONCAT(
    'SELECT ''=== CORRESPONDANCES AVEC FICHES ==='' AS info, ',
    'COUNT(DISTINCT hf.`id`) AS total_fiches_avec_historique, COUNT(*) AS total_lignes_historique ',
    'FROM `', REPLACE(@yj_source_table, '`', ''), '` hf ',
    'WHERE EXISTS (SELECT 1 FROM `fiches` f WHERE f.`id` = hf.`id`)'
  ),
  'SELECT ''=== CORRESPONDANCES AVEC FICHES ==='' AS info, NULL AS total_fiches_avec_historique, NULL AS total_lignes_historique'
);
PREPARE stmt_step4_corr FROM @step4_corr_sql;
EXECUTE stmt_step4_corr;
DEALLOCATE PREPARE stmt_step4_corr;

-- Compter les fiches qui n'existent pas encore dans fiches (seront migrées quand même)
SET @step4_nonmig_sql = IF(
  @yj_source_table IS NOT NULL,
  CONCAT(
    'SELECT ''=== FICHES NON MIGRÉES (historique sera migré quand même) ==='' AS info, ',
    'COUNT(DISTINCT hf.`id`) AS total_fiches_non_migrees, COUNT(*) AS total_lignes_historique_non_migrees ',
    'FROM `', REPLACE(@yj_source_table, '`', ''), '` hf ',
    'WHERE NOT EXISTS (SELECT 1 FROM `fiches` f WHERE f.`id` = hf.`id`) AND hf.`id` IS NOT NULL'
  ),
  'SELECT ''=== FICHES NON MIGRÉES ==='' AS info, NULL AS total_fiches_non_migrees, NULL AS total_lignes_historique_non_migrees'
);
PREPARE stmt_step4_nonmig FROM @step4_nonmig_sql;
EXECUTE stmt_step4_nonmig;
DEALLOCATE PREPARE stmt_step4_nonmig;

-- =====================================================
-- ÉTAPE 4.5 : Diagnostic pour une fiche spécifique (exemple: 924782)
-- =====================================================
-- 
-- Cette section permet de diagnostiquer pourquoi certaines lignes ne sont pas migrées
-- Décommentez et adaptez l'ID de la fiche pour analyser

/*
-- Analyser les lignes dans yj_histo_fiche pour la fiche 924782
SELECT 
    '=== ANALYSE yj_histo_fiche pour fiche 924782 ===' as info,
    COUNT(*) as total_lignes_yj
FROM `yj_histo_fiche`
WHERE `id` = 924782;

-- Voir toutes les lignes de cette fiche
SELECT 
    '=== TOUTES LES LIGNES yj_histo_fiche pour fiche 924782 ===' as info,
    *
FROM `yj_histo_fiche`
WHERE `id` = 924782
ORDER BY 
    COALESCE(`date_creation`, `date`, `date_insertion`, `date_heure_mod`, `date_modif_time`, NOW());

-- Analyser les lignes déjà migrées dans fiches_histo
SELECT 
    '=== LIGNES MIGRÉES dans fiches_histo pour fiche 924782 ===' as info,
    COUNT(*) as total_lignes_histo
FROM `fiches_histo`
WHERE `id_fiche` = 924782;

-- Voir les lignes migrées
SELECT 
    '=== LIGNES MIGRÉES pour fiche 924782 ===' as info,
    *
FROM `fiches_histo`
WHERE `id_fiche` = 924782
ORDER BY `date_creation`;
*/

-- =====================================================
-- ÉTAPE 5 : Migration vers fiches_histo
-- =====================================================
-- 
-- IMPORTANT : Cette requête doit être adaptée selon les colonnes réelles détectées à l'étape 2
-- 
-- Structure de fiches_histo :
--   - id_fiche (int) : ID de la fiche
--   - id_etat (int) : ID de l'état
--   - date_rdv_time (datetime, nullable) : Date du rendez-vous
--   - date_creation (datetime) : Date de création de l'entrée historique
--
-- =====================================================

-- VERSION ADAPTATIVE : Essaie plusieurs combinaisons de colonnes
-- Cette version détecte automatiquement les colonnes disponibles

-- D'abord, créer une table temporaire pour stocker les résultats de détection
DROP TEMPORARY TABLE IF EXISTS temp_yj_columns;
CREATE TEMPORARY TABLE temp_yj_columns (
    col_name VARCHAR(100),
    col_type VARCHAR(50)
);

-- Insérer les colonnes disponibles (conserver le nom exact pour les requêtes dynamiques)
INSERT INTO temp_yj_columns
SELECT COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = @yj_source_table;

-- Vérifier quelles colonnes existent dans yj_histo_fiche (insensible à la casse pour détection)
SET @has_id_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'id');
SET @has_id_fiche_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'id_fiche');
SET @has_fiche_id_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'fiche_id');
-- Nom exact de la colonne à utiliser pour id_fiche (priorité : id_fiche > fiche_id > id)
SET @id_fiche_col_name = (
  SELECT col_name FROM temp_yj_columns
  WHERE LOWER(TRIM(col_name)) IN ('id_fiche', 'fiche_id', 'id')
  ORDER BY FIELD(LOWER(TRIM(col_name)), 'id_fiche', 'fiche_id', 'id')
  LIMIT 1
);
SET @has_etat_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'etat');
SET @etat_col_name = (SELECT col_name FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'etat' LIMIT 1);
SET @has_id_etat_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'id_etat');
SET @has_etat_final_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'etat_final');
SET @has_date_creation_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'date_creation');
SET @has_date_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'date');
SET @has_date_heure_mod_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) IN ('date_heure_mod', 'date_modif_time', 'date_heure_modif'));
SET @date_heure_mod_col_name = (SELECT col_name FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) IN ('date_heure_mod', 'date_modif_time', 'date_heure_modif') ORDER BY FIELD(LOWER(TRIM(col_name)), 'date_heure_mod', 'date_modif_time', 'date_heure_modif') LIMIT 1);
SET @has_date_rdv_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'date_rdv');
SET @has_date_rdv_time_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'date_rdv_time');
-- Date planning (yj) -> date_rdv_time (fiches_histo). Noms possibles : date_heure_playning, date_heure_planning, date_planning, etc.
SET @has_date_planning_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) IN ('date_heure_playning', 'date_heure_planning', 'date_planning', 'date_planification', 'planning'));
SET @date_planning_col_name = (SELECT col_name FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) IN ('date_heure_playning', 'date_heure_planning', 'date_planning', 'date_planification', 'planning') ORDER BY FIELD(LOWER(TRIM(col_name)), 'date_heure_playning', 'date_heure_planning', 'date_planning', 'date_planification', 'planning') LIMIT 1);

-- Vérifier les colonnes pour les nouvelles colonnes enrichies (insensible à la casse)
-- Confirmateurs
SET @has_id_confirmateur_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'id_confirmateur');
SET @has_id_confirmateur_2_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'id_confirmateur_2');
SET @has_id_confirmateur_3_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'id_confirmateur_3');
SET @has_nom_confirmateur_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'nom_confirmateur');
SET @has_conf_commentaire_produit_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'conf_commentaire_produit');
SET @has_commentaire_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'commentaire');
SET @has_conf_rdv_avec_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'conf_rdv_avec');
SET @has_conf_energie_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'conf_energie');

-- Dates
SET @has_date_appel_time_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) IN ('date_appel_time', 'date_appel'));
SET @has_date_heure_appel_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'date_heure_appel');
SET @has_date_sign_time_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) IN ('date_sign_time', 'date_sign'));
SET @has_date_sign_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'date_sign');

-- Autres
SET @has_id_sous_etat_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'id_sous_etat');
SET @has_id_commercial_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'id_commercial');
SET @has_ph3_installateur_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'ph3_installateur');

-- Phase 3
SET @has_ph3_pac_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'ph3_pac');
SET @has_ph3_type_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'ph3_type');
SET @has_ph3_prix_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'ph3_prix');
SET @has_ph3_puissance_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'ph3_puissance');
SET @has_ph3_consommation_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'ph3_consommation');
SET @has_ph3_bonus_30_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'ph3_bonus_30');
SET @has_ph3_mensualite_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'ph3_mensualite');
SET @has_ph3_nbr_annee_finance_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'ph3_nbr_annee_finance');
SET @has_nbr_annee_finance_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) IN ('nbr_annee_finance', 'nbr_annee_fin'));
SET @has_ph3_ballon_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'ph3_ballon');
SET @has_ph3_alimentation_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'ph3_alimentation');
SET @has_credit_immobilier_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'credit_immobilier');
SET @has_credit_autre_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'credit_autre');
SET @has_valeur_mensualite_col = (SELECT COUNT(*) FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'valeur_mensualite');

-- Vérifier quelles colonnes existent dans fiches_histo (pour adapter l'INSERT)
DROP TEMPORARY TABLE IF EXISTS temp_fiches_histo_columns;
CREATE TEMPORARY TABLE temp_fiches_histo_columns (
    col_name VARCHAR(100)
);
INSERT INTO temp_fiches_histo_columns
SELECT COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'fiches_histo';

SET @fh_has_id_confirmateur = (SELECT COUNT(*) FROM temp_fiches_histo_columns WHERE col_name = 'id_confirmateur');
SET @fh_has_id_confirmateur_2 = (SELECT COUNT(*) FROM temp_fiches_histo_columns WHERE col_name = 'id_confirmateur_2');
SET @fh_has_id_confirmateur_3 = (SELECT COUNT(*) FROM temp_fiches_histo_columns WHERE col_name = 'id_confirmateur_3');
SET @fh_has_conf_commentaire_produit = (SELECT COUNT(*) FROM temp_fiches_histo_columns WHERE col_name = 'conf_commentaire_produit');
SET @fh_has_date_appel_time = (SELECT COUNT(*) FROM temp_fiches_histo_columns WHERE col_name = 'date_appel_time');
SET @fh_has_date_sign_time = (SELECT COUNT(*) FROM temp_fiches_histo_columns WHERE col_name = 'date_sign_time');
SET @fh_has_id_sous_etat = (SELECT COUNT(*) FROM temp_fiches_histo_columns WHERE col_name = 'id_sous_etat');
SET @fh_has_id_commercial = (SELECT COUNT(*) FROM temp_fiches_histo_columns WHERE col_name = 'id_commercial');
SET @fh_has_ph3_installateur = (SELECT COUNT(*) FROM temp_fiches_histo_columns WHERE col_name = 'ph3_installateur');
SET @fh_has_ph3_pac = (SELECT COUNT(*) FROM temp_fiches_histo_columns WHERE col_name = 'ph3_pac');
SET @fh_has_ph3_type = (SELECT COUNT(*) FROM temp_fiches_histo_columns WHERE col_name = 'ph3_type');
SET @fh_has_ph3_prix = (SELECT COUNT(*) FROM temp_fiches_histo_columns WHERE col_name = 'ph3_prix');
SET @fh_has_ph3_puissance = (SELECT COUNT(*) FROM temp_fiches_histo_columns WHERE col_name = 'ph3_puissance');
SET @fh_has_ph3_consommation = (SELECT COUNT(*) FROM temp_fiches_histo_columns WHERE col_name = 'ph3_consommation');
SET @fh_has_ph3_bonus_30 = (SELECT COUNT(*) FROM temp_fiches_histo_columns WHERE col_name = 'ph3_bonus_30');
SET @fh_has_ph3_mensualite = (SELECT COUNT(*) FROM temp_fiches_histo_columns WHERE col_name = 'ph3_mensualite');
SET @fh_has_ph3_nbr_annee_finance = (SELECT COUNT(*) FROM temp_fiches_histo_columns WHERE col_name = 'ph3_nbr_annee_finance');
SET @fh_has_ph3_ballon = (SELECT COUNT(*) FROM temp_fiches_histo_columns WHERE col_name = 'ph3_ballon');
SET @fh_has_ph3_alimentation = (SELECT COUNT(*) FROM temp_fiches_histo_columns WHERE col_name = 'ph3_alimentation');
SET @fh_has_credit_immobilier = (SELECT COUNT(*) FROM temp_fiches_histo_columns WHERE col_name = 'credit_immobilier');
SET @fh_has_credit_autre = (SELECT COUNT(*) FROM temp_fiches_histo_columns WHERE col_name = 'credit_autre');
SET @fh_has_valeur_mensualite = (SELECT COUNT(*) FROM temp_fiches_histo_columns WHERE col_name = 'valeur_mensualite');
SET @fh_has_conf_rdv_avec = (SELECT COUNT(*) FROM temp_fiches_histo_columns WHERE col_name = 'conf_rdv_avec');

-- Afficher la colonne utilisée pour id_fiche (à vérifier avant migration)
SELECT 
    '=== COLONNE UTILISÉE POUR id_fiche ===' as info,
    COALESCE(@id_fiche_col_name, '(aucune - risque id_fiche=0)') as colonne_source_id_fiche,
    @has_id_fiche_col as has_id_fiche,
    @has_fiche_id_col as has_fiche_id,
    @has_id_col as has_id;

-- Afficher les colonnes détectées dans yj_histo_fiche
SELECT 
    '=== COLONNES DÉTECTÉES DANS yj_histo_fiche ===' as info,
    @has_id_col as has_id,
    @has_id_fiche_col as has_id_fiche,
    @has_fiche_id_col as has_fiche_id,
    @has_etat_col as has_etat,
    @has_id_etat_col as has_id_etat,
    @has_etat_final_col as has_etat_final,
    @has_date_creation_col as has_date_creation,
    @has_date_col as has_date,
    @has_date_rdv_col as has_date_rdv,
    @has_date_rdv_time_col as has_date_rdv_time,
    @has_date_planning_col as has_date_planning,
    COALESCE(@date_planning_col_name, '-') as colonne_date_planning,
    @has_id_confirmateur_col as has_id_confirmateur,
    @has_conf_commentaire_produit_col as has_conf_commentaire_produit,
    @has_commentaire_col as has_commentaire,
    @has_conf_energie_col as has_conf_energie,
    @has_date_appel_time_col as has_date_appel_time,
    @has_ph3_pac_col as has_ph3_pac;

-- Afficher les colonnes détectées dans fiches_histo
SELECT 
    '=== COLONNES DÉTECTÉES DANS fiches_histo ===' as info,
    @fh_has_id_confirmateur as has_id_confirmateur,
    @fh_has_id_confirmateur_2 as has_id_confirmateur_2,
    @fh_has_id_confirmateur_3 as has_id_confirmateur_3,
    @fh_has_conf_commentaire_produit as has_conf_commentaire_produit,
    @fh_has_conf_mode_chauffage as has_conf_mode_chauffage,
    @fh_has_date_appel_time as has_date_appel_time,
    @fh_has_date_sign_time as has_date_sign_time,
    @fh_has_id_sous_etat as has_id_sous_etat,
    @fh_has_id_commercial as has_id_commercial,
    @fh_has_ph3_installateur as has_ph3_installateur,
    @fh_has_ph3_pac as has_ph3_pac,
    @fh_has_ph3_type as has_ph3_type,
    @fh_has_ph3_prix as has_ph3_prix;

-- =====================================================
-- MIGRATION PRINCIPALE
-- =====================================================
-- 
-- Cette requête utilise les colonnes détectées automatiquement
-- Si une colonne n'existe pas, elle utilise une valeur par défaut
-- 
-- IMPORTANT : Cette version utilise une approche plus sûre qui évite
-- les erreurs si les colonnes n'existent pas
--

-- Construire la requête dynamiquement selon les colonnes disponibles
SET @sql_query = '';

-- IMPORTANT : utiliser le nom exact de la colonne détectée (id_fiche, fiche_id ou id)
-- pour éviter id_fiche = 0 partout quand la colonne a un autre nom ou une autre casse.
SET @id_fiche_select = CASE
    WHEN @id_fiche_col_name IS NOT NULL AND @id_fiche_col_name != '' THEN CONCAT('hf.`', REPLACE(@id_fiche_col_name, '`', ''), '`')
    WHEN @has_id_fiche_col > 0 THEN 'hf.`id_fiche`'
    WHEN @has_fiche_id_col > 0 THEN 'hf.`fiche_id`'
    WHEN @has_id_col > 0 THEN 'hf.`id`'
    ELSE 'NULL'
END;

-- Nom de colonne brut (sans alias) pour les requêtes qui n'utilisent pas l'alias hf
SET @id_fiche_col = CASE
    WHEN @id_fiche_col_name IS NOT NULL AND @id_fiche_col_name != '' THEN CONCAT('`', REPLACE(@id_fiche_col_name, '`', ''), '`')
    WHEN @has_id_fiche_col > 0 THEN '`id_fiche`'
    WHEN @has_fiche_id_col > 0 THEN '`fiche_id`'
    WHEN @has_id_col > 0 THEN '`id`'
    ELSE '`id`'
END;

-- Construire la partie SELECT pour id_etat (fiches_histo attend un id numérique)
-- Dans yj_histo_fiche : souvent pas de "id_etat", la colonne "etat" contient le libellé (ex. CONFIRMER) ou un nombre
SET @id_etat_parts = '';

-- Ajouter id_etat si la colonne existe dans yj
SET @id_etat_parts = CONCAT(@id_etat_parts,
    CASE WHEN @has_id_etat_col > 0 THEN 'CAST(hf.`id_etat` AS UNSIGNED), ' ELSE '' END
);

-- Ajouter etat : si numérique on le garde, sinon on résout via la table etats (ex. CONFIRMER -> 7). Nom exact de la colonne (casse).
SET @etat_col_ref = CASE WHEN @etat_col_name IS NOT NULL AND @etat_col_name != '' THEN CONCAT('hf.`', REPLACE(@etat_col_name, '`', ''), '`') ELSE 'hf.`etat`' END;
SET @etat_part1 = CASE WHEN @has_etat_col > 0 THEN 
    CONCAT('CASE WHEN CAST(', @etat_col_ref, ' AS CHAR) REGEXP ''^[0-9]+$'' THEN CAST(', @etat_col_ref, ' AS UNSIGNED) ELSE NULL END, ')
ELSE '' END;

SET @etat_part2 = CASE WHEN @has_etat_col > 0 THEN 
    CONCAT('(SELECT e.`id` FROM `etats` e WHERE e.`titre` = CAST(', @etat_col_ref, ' AS CHAR) OR e.`titre` LIKE CONCAT(''%'', CAST(', @etat_col_ref, ' AS CHAR), ''%'') LIMIT 1), ')
ELSE '' END;

SET @id_etat_parts = CONCAT(@id_etat_parts, @etat_part1, @etat_part2);

-- Ajouter etat_final si la colonne existe
SET @id_etat_parts = CONCAT(@id_etat_parts,
    CASE WHEN @has_etat_final_col > 0 THEN 
        'CASE WHEN CAST(hf.`etat_final` AS CHAR) REGEXP ''^[0-9]+$'' THEN CAST(hf.`etat_final` AS UNSIGNED) ELSE NULL END, '
    ELSE '' END
);

-- Ajouter la valeur par défaut
SET @id_etat_parts = CONCAT(@id_etat_parts, '1');

-- Construire le COALESCE final (seulement si on a plus que juste "1")
SET @id_etat_select = CASE 
    WHEN LENGTH(@id_etat_parts) > 1 AND @id_etat_parts != '1' THEN 
        CONCAT('COALESCE(', @id_etat_parts, ')')
    ELSE 
        '1'
END;

-- Construire la partie SELECT pour date_rdv_time (fiches_histo)
-- Souvent en yj : uniquement date_heure_playning (pas de date_rdv_time) -> copie directe vers date_rdv_time
SET @date_rdv_time_yj = (SELECT col_name FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'date_rdv_time' LIMIT 1);
SET @date_rdv_yj = (SELECT col_name FROM temp_yj_columns WHERE LOWER(TRIM(col_name)) = 'date_rdv' LIMIT 1);
SET @date_planning_expr = CASE
    WHEN @date_planning_col_name IS NOT NULL AND @date_planning_col_name != '' THEN CONCAT('hf.`', REPLACE(@date_planning_col_name, '`', ''), '`')
    ELSE 'NULL'
END;
SET @date_rdv_select = CASE
    WHEN @has_date_rdv_time_col > 0 AND @has_date_planning_col > 0 AND @date_planning_col_name IS NOT NULL AND @date_rdv_time_yj IS NOT NULL THEN CONCAT('COALESCE(hf.`', REPLACE(@date_rdv_time_yj, '`', ''), '`, ', @date_planning_expr, ')')
    WHEN @has_date_rdv_time_col > 0 AND @date_rdv_time_yj IS NOT NULL THEN CONCAT('hf.`', REPLACE(@date_rdv_time_yj, '`', ''), '`')
    WHEN @has_date_planning_col > 0 AND @date_planning_col_name IS NOT NULL THEN @date_planning_expr
    WHEN @has_date_rdv_col > 0 AND @date_rdv_yj IS NOT NULL THEN CONCAT('hf.`', REPLACE(@date_rdv_yj, '`', ''), '`')
    ELSE 'NULL'
END;

-- Construire la partie SELECT pour date_creation : priorité date_heure_mod (yj) si présent, sinon date_creation, date
SET @date_heure_mod_ref = CASE WHEN @date_heure_mod_col_name IS NOT NULL AND @date_heure_mod_col_name != '' THEN CONCAT('hf.`', REPLACE(@date_heure_mod_col_name, '`', ''), '`') ELSE NULL END;
SET @date_creation_select = CASE
    WHEN @has_date_heure_mod_col > 0 AND @date_heure_mod_ref IS NOT NULL AND @has_date_creation_col > 0 THEN CONCAT('COALESCE(', @date_heure_mod_ref, ', hf.`date_creation`)')
    WHEN @has_date_heure_mod_col > 0 AND @date_heure_mod_ref IS NOT NULL AND @has_date_col > 0 THEN CONCAT('COALESCE(', @date_heure_mod_ref, ', hf.`date`)')
    WHEN @has_date_heure_mod_col > 0 AND @date_heure_mod_ref IS NOT NULL THEN @date_heure_mod_ref
    WHEN @has_date_creation_col > 0 THEN 'hf.`date_creation`'
    WHEN @has_date_col > 0 THEN 'hf.`date`'
    ELSE 'NOW()'
END;

-- Construire les parties SELECT pour les nouvelles colonnes enrichies
-- IMPORTANT : Ne pas inclure de virgule dans ces variables, elle sera ajoutée dans le CONCAT
-- Fallback : si yj_histo_fiche n'a pas les confirmateurs, prendre ceux de la fiche actuelle (fiches)
SET @fiche_fallback_confirmateur = CONCAT('(SELECT f.`id_confirmateur` FROM `fiches` f WHERE f.`id` = ', @id_fiche_select, ' LIMIT 1)');
SET @fiche_fallback_confirmateur_2 = CONCAT('(SELECT f.`id_confirmateur_2` FROM `fiches` f WHERE f.`id` = ', @id_fiche_select, ' LIMIT 1)');
SET @fiche_fallback_confirmateur_3 = CONCAT('(SELECT f.`id_confirmateur_3` FROM `fiches` f WHERE f.`id` = ', @id_fiche_select, ' LIMIT 1)');

-- Confirmateurs : source yj_histo_fiche, sinon fallback fiches
SET @id_confirmateur_select = CASE
    WHEN @fh_has_id_confirmateur > 0 AND @has_id_confirmateur_col > 0 THEN CONCAT('COALESCE(NULLIF(CAST(hf.`id_confirmateur` AS UNSIGNED), 0), ', @fiche_fallback_confirmateur, ')')
    WHEN @fh_has_id_confirmateur > 0 AND @has_nom_confirmateur_col > 0 THEN CONCAT('COALESCE((SELECT u.`id` FROM `utilisateurs` u WHERE TRIM(UPPER(u.`pseudo`)) = TRIM(UPPER(hf.`nom_confirmateur`)) LIMIT 1), ', @fiche_fallback_confirmateur, ')')
    WHEN @fh_has_id_confirmateur > 0 THEN @fiche_fallback_confirmateur
    ELSE ''
END;

SET @id_confirmateur_2_select = CASE
    WHEN @fh_has_id_confirmateur_2 > 0 AND @has_id_confirmateur_2_col > 0 THEN CONCAT('COALESCE(NULLIF(CAST(hf.`id_confirmateur_2` AS UNSIGNED), 0), ', @fiche_fallback_confirmateur_2, ')')
    WHEN @fh_has_id_confirmateur_2 > 0 THEN @fiche_fallback_confirmateur_2
    ELSE ''
END;

SET @id_confirmateur_3_select = CASE
    WHEN @fh_has_id_confirmateur_3 > 0 AND @has_id_confirmateur_3_col > 0 THEN CONCAT('COALESCE(NULLIF(CAST(hf.`id_confirmateur_3` AS UNSIGNED), 0), ', @fiche_fallback_confirmateur_3, ')')
    WHEN @fh_has_id_confirmateur_3 > 0 THEN @fiche_fallback_confirmateur_3
    ELSE ''
END;

-- conf_commentaire_produit (fiches_histo) <- commentaire (yj_histo_fiche) ; fallback conf_commentaire_produit si commentaire absent
SET @conf_commentaire_produit_select = CASE
    WHEN @fh_has_conf_commentaire_produit > 0 AND @has_commentaire_col > 0 THEN 'hf.`commentaire`'
    WHEN @fh_has_conf_commentaire_produit > 0 AND @has_conf_commentaire_produit_col > 0 THEN 'hf.`conf_commentaire_produit`'
    ELSE ''
END;

SET @conf_rdv_avec_select = CASE
    WHEN @fh_has_conf_rdv_avec > 0 AND @has_conf_rdv_avec_col > 0 THEN 'hf.`conf_rdv_avec`'
    ELSE ''
END;

-- conf_mode_chauffage (fiches_histo) <- conf_energie (table YJ), chaîne telle quelle (nom de colonne exact)
SET @conf_mode_chauffage_select = CASE
    WHEN @fh_has_conf_mode_chauffage > 0 AND @has_conf_energie_col > 0 AND @conf_energie_col_name IS NOT NULL AND @conf_energie_col_name != '' THEN
        CONCAT('NULLIF(TRIM(CAST(hf.`', REPLACE(@conf_energie_col_name, '`', ''), '` AS CHAR)), '''')')
    ELSE ''
END;

-- Dates : date_appel_time (fiches_histo) prend date_heure_mod (yj) si présent, sinon date_appel_time, date_heure_appel
SET @date_appel_time_select = CASE
    WHEN @fh_has_date_appel_time > 0 AND @date_heure_mod_ref IS NOT NULL AND @has_date_appel_time_col > 0 THEN CONCAT('COALESCE(', @date_heure_mod_ref, ', hf.`date_appel_time`)')
    WHEN @fh_has_date_appel_time > 0 AND @date_heure_mod_ref IS NOT NULL AND @has_date_heure_appel_col > 0 THEN CONCAT('COALESCE(', @date_heure_mod_ref, ', hf.`date_heure_appel`)')
    WHEN @fh_has_date_appel_time > 0 AND @date_heure_mod_ref IS NOT NULL THEN @date_heure_mod_ref
    WHEN @fh_has_date_appel_time > 0 AND @has_date_appel_time_col > 0 THEN 'hf.`date_appel_time`'
    WHEN @fh_has_date_appel_time > 0 AND @has_date_heure_appel_col > 0 THEN 'hf.`date_heure_appel`'
    ELSE ''
END;

SET @date_sign_time_select = CASE
    WHEN @fh_has_date_sign_time > 0 AND @has_date_sign_time_col > 0 THEN 'hf.`date_sign_time`'
    WHEN @fh_has_date_sign_time > 0 AND @has_date_sign_col > 0 THEN 'hf.`date_sign`'
    ELSE ''
END;

-- Autres
SET @id_sous_etat_select = CASE
    WHEN @fh_has_id_sous_etat > 0 AND @has_id_sous_etat_col > 0 THEN 'CAST(hf.`id_sous_etat` AS UNSIGNED)'
    ELSE ''
END;

SET @id_commercial_select = CASE
    WHEN @fh_has_id_commercial > 0 AND @has_id_commercial_col > 0 THEN 'CAST(hf.`id_commercial` AS UNSIGNED)'
    ELSE ''
END;

SET @ph3_installateur_select = CASE
    WHEN @fh_has_ph3_installateur > 0 AND @has_ph3_installateur_col > 0 THEN 'CAST(hf.`ph3_installateur` AS UNSIGNED)'
    ELSE ''
END;

-- Phase 3
SET @ph3_pac_select = CASE
    WHEN @fh_has_ph3_pac > 0 AND @has_ph3_pac_col > 0 THEN 'hf.`ph3_pac`'
    ELSE ''
END;

SET @ph3_type_select = CASE
    WHEN @fh_has_ph3_type > 0 AND @has_ph3_type_col > 0 THEN 'hf.`ph3_type`'
    ELSE ''
END;

SET @ph3_prix_select = CASE
    WHEN @fh_has_ph3_prix > 0 AND @has_ph3_prix_col > 0 THEN 'hf.`ph3_prix`'
    ELSE ''
END;

SET @ph3_puissance_select = CASE
    WHEN @fh_has_ph3_puissance > 0 AND @has_ph3_puissance_col > 0 THEN 'hf.`ph3_puissance`'
    ELSE ''
END;

SET @ph3_consommation_select = CASE
    WHEN @fh_has_ph3_consommation > 0 AND @has_ph3_consommation_col > 0 THEN 'hf.`ph3_consommation`'
    ELSE ''
END;

SET @ph3_bonus_30_select = CASE
    WHEN @fh_has_ph3_bonus_30 > 0 AND @has_ph3_bonus_30_col > 0 THEN 'hf.`ph3_bonus_30`'
    ELSE ''
END;

SET @ph3_mensualite_select = CASE
    WHEN @fh_has_ph3_mensualite > 0 AND @has_ph3_mensualite_col > 0 THEN 'hf.`ph3_mensualite`'
    ELSE ''
END;

SET @ph3_nbr_annee_finance_select = CASE
    WHEN @fh_has_ph3_nbr_annee_finance > 0 AND @has_ph3_nbr_annee_finance_col > 0 THEN 'CAST(hf.`ph3_nbr_annee_finance` AS UNSIGNED)'
    WHEN @fh_has_ph3_nbr_annee_finance > 0 AND @has_nbr_annee_finance_col > 0 THEN 'CAST(hf.`nbr_annee_finance` AS UNSIGNED)'
    ELSE ''
END;

SET @ph3_ballon_select = CASE
    WHEN @fh_has_ph3_ballon > 0 AND @has_ph3_ballon_col > 0 THEN 'hf.`ph3_ballon`'
    ELSE ''
END;

SET @ph3_alimentation_select = CASE
    WHEN @fh_has_ph3_alimentation > 0 AND @has_ph3_alimentation_col > 0 THEN 'hf.`ph3_alimentation`'
    ELSE ''
END;

SET @credit_immobilier_select = CASE
    WHEN @fh_has_credit_immobilier > 0 AND @has_credit_immobilier_col > 0 THEN 'hf.`credit_immobilier`'
    ELSE ''
END;

SET @credit_autre_select = CASE
    WHEN @fh_has_credit_autre > 0 AND @has_credit_autre_col > 0 THEN 'hf.`credit_autre`'
    ELSE ''
END;

SET @valeur_mensualite_select = CASE
    WHEN @fh_has_valeur_mensualite > 0 AND @has_valeur_mensualite_col > 0 THEN 'hf.`valeur_mensualite`'
    ELSE ''
END;

-- Construire la liste des colonnes pour l'INSERT dynamiquement
SET @insert_columns = '`id_fiche`, `id_etat`';
SET @select_values = CONCAT(@id_fiche_select, ' AS `id_fiche`, ', @id_etat_select, ' AS `id_etat`');

-- Ajouter date_rdv_time si la colonne existe dans fiches_histo
SET @has_date_rdv_time_fh = (SELECT COUNT(*) FROM temp_fiches_histo_columns WHERE col_name = 'date_rdv_time');
SET @insert_columns = CONCAT(@insert_columns, 
    CASE WHEN @has_date_rdv_time_fh > 0 THEN ', `date_rdv_time`' ELSE '' END
);
SET @select_values = CONCAT(@select_values,
    CASE WHEN @has_date_rdv_time_fh > 0 THEN CONCAT(', ', @date_rdv_select, ' AS `date_rdv_time`') ELSE '' END
);

-- Ajouter les nouvelles colonnes si elles existent dans fiches_histo ET qu'on a une valeur à insérer
-- IMPORTANT : Synchroniser avec @select_values pour éviter l'erreur "Column count doesn't match value count"
SET @insert_columns = CONCAT(@insert_columns,
    CASE WHEN @fh_has_id_confirmateur > 0 AND @id_confirmateur_select != '' THEN ', `id_confirmateur`' ELSE '' END,
    CASE WHEN @fh_has_id_confirmateur_2 > 0 AND @id_confirmateur_2_select != '' THEN ', `id_confirmateur_2`' ELSE '' END,
    CASE WHEN @fh_has_id_confirmateur_3 > 0 AND @id_confirmateur_3_select != '' THEN ', `id_confirmateur_3`' ELSE '' END,
    CASE WHEN @fh_has_conf_commentaire_produit > 0 AND @conf_commentaire_produit_select != '' THEN ', `conf_commentaire_produit`' ELSE '' END,
    CASE WHEN @fh_has_conf_rdv_avec > 0 AND @conf_rdv_avec_select != '' THEN ', `conf_rdv_avec`' ELSE '' END,
    CASE WHEN @fh_has_conf_mode_chauffage > 0 AND @conf_mode_chauffage_select != '' THEN ', `conf_mode_chauffage`' ELSE '' END,
    CASE WHEN @fh_has_date_appel_time > 0 AND @date_appel_time_select != '' THEN ', `date_appel_time`' ELSE '' END,
    CASE WHEN @fh_has_date_sign_time > 0 AND @date_sign_time_select != '' THEN ', `date_sign_time`' ELSE '' END,
    CASE WHEN @fh_has_id_sous_etat > 0 AND @id_sous_etat_select != '' THEN ', `id_sous_etat`' ELSE '' END,
    CASE WHEN @fh_has_id_commercial > 0 AND @id_commercial_select != '' THEN ', `id_commercial`' ELSE '' END,
    CASE WHEN @fh_has_ph3_installateur > 0 AND @ph3_installateur_select != '' THEN ', `ph3_installateur`' ELSE '' END,
    CASE WHEN @fh_has_ph3_pac > 0 AND @ph3_pac_select != '' THEN ', `ph3_pac`' ELSE '' END,
    CASE WHEN @fh_has_ph3_type > 0 AND @ph3_type_select != '' THEN ', `ph3_type`' ELSE '' END,
    CASE WHEN @fh_has_ph3_prix > 0 AND @ph3_prix_select != '' THEN ', `ph3_prix`' ELSE '' END,
    CASE WHEN @fh_has_ph3_puissance > 0 AND @ph3_puissance_select != '' THEN ', `ph3_puissance`' ELSE '' END,
    CASE WHEN @fh_has_ph3_consommation > 0 AND @ph3_consommation_select != '' THEN ', `ph3_consommation`' ELSE '' END,
    CASE WHEN @fh_has_ph3_bonus_30 > 0 AND @ph3_bonus_30_select != '' THEN ', `ph3_bonus_30`' ELSE '' END,
    CASE WHEN @fh_has_ph3_mensualite > 0 AND @ph3_mensualite_select != '' THEN ', `ph3_mensualite`' ELSE '' END,
    CASE WHEN @fh_has_ph3_nbr_annee_finance > 0 AND @ph3_nbr_annee_finance_select != '' THEN ', `ph3_nbr_annee_finance`' ELSE '' END,
    CASE WHEN @fh_has_ph3_ballon > 0 AND @ph3_ballon_select != '' THEN ', `ph3_ballon`' ELSE '' END,
    CASE WHEN @fh_has_ph3_alimentation > 0 AND @ph3_alimentation_select != '' THEN ', `ph3_alimentation`' ELSE '' END,
    CASE WHEN @fh_has_credit_immobilier > 0 AND @credit_immobilier_select != '' THEN ', `credit_immobilier`' ELSE '' END,
    CASE WHEN @fh_has_credit_autre > 0 AND @credit_autre_select != '' THEN ', `credit_autre`' ELSE '' END,
    CASE WHEN @fh_has_valeur_mensualite > 0 AND @valeur_mensualite_select != '' THEN ', `valeur_mensualite`' ELSE '' END,
    ', `date_creation`'
);

-- Construire @select_values en ajoutant seulement les valeurs non vides avec une virgule
SET @select_values = CONCAT(@select_values,
    CASE WHEN @fh_has_id_confirmateur > 0 AND @id_confirmateur_select != '' THEN CONCAT(', ', @id_confirmateur_select) ELSE '' END,
    CASE WHEN @fh_has_id_confirmateur_2 > 0 AND @id_confirmateur_2_select != '' THEN CONCAT(', ', @id_confirmateur_2_select) ELSE '' END,
    CASE WHEN @fh_has_id_confirmateur_3 > 0 AND @id_confirmateur_3_select != '' THEN CONCAT(', ', @id_confirmateur_3_select) ELSE '' END,
    CASE WHEN @fh_has_conf_commentaire_produit > 0 AND @conf_commentaire_produit_select != '' THEN CONCAT(', ', @conf_commentaire_produit_select) ELSE '' END,
    CASE WHEN @fh_has_conf_rdv_avec > 0 AND @conf_rdv_avec_select != '' THEN CONCAT(', ', @conf_rdv_avec_select) ELSE '' END,
    CASE WHEN @fh_has_conf_mode_chauffage > 0 AND @conf_mode_chauffage_select != '' THEN CONCAT(', ', @conf_mode_chauffage_select) ELSE '' END,
    CASE WHEN @fh_has_date_appel_time > 0 AND @date_appel_time_select != '' THEN CONCAT(', ', @date_appel_time_select) ELSE '' END,
    CASE WHEN @fh_has_date_sign_time > 0 AND @date_sign_time_select != '' THEN CONCAT(', ', @date_sign_time_select) ELSE '' END,
    CASE WHEN @fh_has_id_sous_etat > 0 AND @id_sous_etat_select != '' THEN CONCAT(', ', @id_sous_etat_select) ELSE '' END,
    CASE WHEN @fh_has_id_commercial > 0 AND @id_commercial_select != '' THEN CONCAT(', ', @id_commercial_select) ELSE '' END,
    CASE WHEN @fh_has_ph3_installateur > 0 AND @ph3_installateur_select != '' THEN CONCAT(', ', @ph3_installateur_select) ELSE '' END,
    CASE WHEN @fh_has_ph3_pac > 0 AND @ph3_pac_select != '' THEN CONCAT(', ', @ph3_pac_select) ELSE '' END,
    CASE WHEN @fh_has_ph3_type > 0 AND @ph3_type_select != '' THEN CONCAT(', ', @ph3_type_select) ELSE '' END,
    CASE WHEN @fh_has_ph3_prix > 0 AND @ph3_prix_select != '' THEN CONCAT(', ', @ph3_prix_select) ELSE '' END,
    CASE WHEN @fh_has_ph3_puissance > 0 AND @ph3_puissance_select != '' THEN CONCAT(', ', @ph3_puissance_select) ELSE '' END,
    CASE WHEN @fh_has_ph3_consommation > 0 AND @ph3_consommation_select != '' THEN CONCAT(', ', @ph3_consommation_select) ELSE '' END,
    CASE WHEN @fh_has_ph3_bonus_30 > 0 AND @ph3_bonus_30_select != '' THEN CONCAT(', ', @ph3_bonus_30_select) ELSE '' END,
    CASE WHEN @fh_has_ph3_mensualite > 0 AND @ph3_mensualite_select != '' THEN CONCAT(', ', @ph3_mensualite_select) ELSE '' END,
    CASE WHEN @fh_has_ph3_nbr_annee_finance > 0 AND @ph3_nbr_annee_finance_select != '' THEN CONCAT(', ', @ph3_nbr_annee_finance_select) ELSE '' END,
    CASE WHEN @fh_has_ph3_ballon > 0 AND @ph3_ballon_select != '' THEN CONCAT(', ', @ph3_ballon_select) ELSE '' END,
    CASE WHEN @fh_has_ph3_alimentation > 0 AND @ph3_alimentation_select != '' THEN CONCAT(', ', @ph3_alimentation_select) ELSE '' END,
    CASE WHEN @fh_has_credit_immobilier > 0 AND @credit_immobilier_select != '' THEN CONCAT(', ', @credit_immobilier_select) ELSE '' END,
    CASE WHEN @fh_has_credit_autre > 0 AND @credit_autre_select != '' THEN CONCAT(', ', @credit_autre_select) ELSE '' END,
    CASE WHEN @fh_has_valeur_mensualite > 0 AND @valeur_mensualite_select != '' THEN CONCAT(', ', @valeur_mensualite_select) ELSE '' END,
    CONCAT(', ', @date_creation_select, ' AS `date_creation`')
);

-- Construire la requête complète
-- IMPORTANT : On migre les entrées avec id_fiche valide (NOT NULL et > 0).
-- Anti-doublons : ne pas insérer si une ligne existe déjà dans fiches_histo avec le même
-- id_fiche, id_etat et date_creation à ±5 secondes (tolérance arrondis / re-migration).
SET @sql_query = CONCAT(
    'INSERT INTO `fiches_histo` (', @insert_columns, ') ',
    'SELECT ',
    @select_values, ' ',
    'FROM `', REPLACE(@yj_source_table, '`', ''), '` hf ',
    'WHERE ',
    @id_fiche_select, ' IS NOT NULL AND ', @id_fiche_select, ' > 0 ',
    'AND NOT EXISTS (',
        'SELECT 1 FROM `fiches_histo` fh_dup ',
        'WHERE fh_dup.`id_fiche` = ', @id_fiche_select, ' ',
        'AND fh_dup.`id_etat` = ', @id_etat_select, ' ',
        'AND ABS(TIMESTAMPDIFF(SECOND, fh_dup.`date_creation`, ', @date_creation_select, ')) <= 5',
    ') ',
    'ORDER BY ', @id_fiche_select, ', ', @date_creation_select
);

-- Afficher la requête générée (pour debug)
SELECT 
    '=== REQUÊTE GÉNÉRÉE ===' as info,
    @sql_query as requete_sql;

-- Afficher les valeurs des variables pour debug
SELECT 
    '=== VARIABLES DE DÉTECTION ===' as info,
    @yj_source_table AS yj_source_table,
    @has_id_col as has_id,
    @has_id_fiche_col as has_id_fiche,
    @has_etat_col as has_etat,
    @has_id_etat_col as has_id_etat,
    @has_etat_final_col as has_etat_final,
    @has_date_creation_col as has_date_creation,
    @has_date_col as has_date,
    @has_date_rdv_col as has_date_rdv,
    @has_date_rdv_time_col as has_date_rdv_time,
    @has_conf_energie_col AS has_conf_energie,
    @fh_has_conf_mode_chauffage AS fh_has_conf_mode_chauffage;

-- Vérifier que la requête est valide avant de l'exécuter
-- Si aucune colonne pour id_fiche n'est trouvée, ne pas exécuter (sinon id_fiche = 0 partout)
SELECT 
    CASE 
        WHEN @id_fiche_col_name IS NULL OR @id_fiche_col_name = '' THEN 
            'ERREUR : Aucune colonne id_fiche/fiche_id/id trouvée dans yj_histo_fiche - vérifier les noms de colonnes (casse possible)'
        WHEN @id_fiche_select = 'NULL' THEN 
            'ERREUR : Colonne id_fiche non détectée - tous les id_fiche seraient 0'
        ELSE 
            CONCAT('OK : Colonne utilisée pour id_fiche = ', @id_fiche_col_name, ', migration possible')
    END as verification_migration;

-- Exécuter la requête dynamique seulement si les colonnes nécessaires existent
-- Note : Cette vérification doit être faite manuellement avant d'exécuter
-- Si vous voyez l'erreur ci-dessus, adaptez le script selon la structure réelle

-- Exécuter la requête dynamique
PREPARE stmt FROM @sql_query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Remplir conf_mode_chauffage sur les lignes déjà présentes (ré-exécution : NOT EXISTS empêchait un nouvel INSERT).
SET @conf_mode_src_yj = REPLACE(@conf_mode_chauffage_select, 'hf.', 'yj.');
SET @date_creation_yj = REPLACE(@date_creation_select, 'hf.', 'yj.');
SET @sql_update_conf_mc = IF(
    @fh_has_conf_mode_chauffage > 0
    AND @conf_mode_chauffage_select != ''
    AND @yj_source_table IS NOT NULL
    AND @id_fiche_col_name IS NOT NULL AND @id_fiche_col_name != '',
    CONCAT(
        'UPDATE `fiches_histo` fh ',
        'INNER JOIN `', REPLACE(@yj_source_table, '`', ''), '` yj ON yj.`', REPLACE(@id_fiche_col_name, '`', ''), '` = fh.`id_fiche` ',
        'AND ABS(TIMESTAMPDIFF(SECOND, fh.`date_creation`, ', @date_creation_yj, ')) <= 5 ',
        'SET fh.`conf_mode_chauffage` = ', @conf_mode_src_yj, ' ',
        'WHERE (fh.`conf_mode_chauffage` IS NULL OR TRIM(fh.`conf_mode_chauffage`) = '''') ',
        'AND ', @conf_mode_src_yj, ' IS NOT NULL'
    ),
    'SELECT 1 AS skip_conf_mode_chauffage_backfill'
);
PREPARE stmt_conf_mc FROM @sql_update_conf_mc;
EXECUTE stmt_conf_mc;
DEALLOCATE PREPARE stmt_conf_mc;

-- Nettoyer les tables temporaires
DROP TEMPORARY TABLE IF EXISTS temp_yj_columns;
DROP TEMPORARY TABLE IF EXISTS temp_fiches_histo_columns;

-- =====================================================
-- ÉTAPE 6 : Statistiques après migration
-- =====================================================

SELECT 
    '=== RÉSULTATS DE LA MIGRATION ===' as info;

-- Nombre total d'enregistrements dans fiches_histo
SELECT 
    'Total enregistrements dans fiches_histo' as info,
    COUNT(*) as total
FROM `fiches_histo`;

-- =====================================================
-- Vérification id_fiche invalide (NULL ou 0)
-- =====================================================
SELECT 
    '=== VÉRIFICATION id_fiche INVALIDE (NULL ou 0) ===' as info;

SELECT 
    COUNT(*) as nb_lignes_id_fiche_null
FROM `fiches_histo`
WHERE `id_fiche` IS NULL;

SELECT 
    COUNT(*) as nb_lignes_id_fiche_zero
FROM `fiches_histo`
WHERE `id_fiche` = 0;

SELECT 
    COALESCE(
        (SELECT COUNT(*) FROM `fiches_histo` WHERE `id_fiche` IS NULL OR `id_fiche` = 0),
        0
    ) as total_lignes_invalides,
    CASE 
        WHEN (SELECT COUNT(*) FROM `fiches_histo` WHERE `id_fiche` IS NULL OR `id_fiche` = 0) = 0 
        THEN '✓ Aucune ligne avec id_fiche NULL ou 0'
        ELSE CONCAT('⚠ ', (SELECT COUNT(*) FROM `fiches_histo` WHERE `id_fiche` IS NULL OR `id_fiche` = 0), ' ligne(s) à corriger ou supprimer')
    END as statut;

-- Exemples de lignes invalides (pour correction manuelle si besoin)
SELECT 
    '=== EXEMPLES DE LIGNES AVEC id_fiche NULL ou 0 (max 20) ===' as info;

SELECT 
    fh.`id`,
    fh.`id_fiche`,
    fh.`id_etat`,
    fh.`date_creation`,
    fh.`date_rdv_time`
FROM `fiches_histo` fh
WHERE fh.`id_fiche` IS NULL OR fh.`id_fiche` = 0
ORDER BY fh.`id` DESC
LIMIT 20;

-- Vérifier que toutes les lignes ont été migrées
-- Utiliser la détection dynamique pour compter les lignes de yj_histo_fiche
SET @count_yj_query = CONCAT(
    'SELECT COUNT(*) INTO @total_yj FROM `', REPLACE(@yj_source_table, '`', ''), '` WHERE ', @id_fiche_col, ' IS NOT NULL AND ', @id_fiche_col, ' > 0'
);
PREPARE stmt_count FROM @count_yj_query;
EXECUTE stmt_count;
DEALLOCATE PREPARE stmt_count;

SELECT 
    '=== VÉRIFICATION COMPLÉTUDE DE LA MIGRATION ===' as info,
    @total_yj as total_lignes_yj_histo_fiche,
    (SELECT COUNT(*) FROM `fiches_histo`) as total_lignes_fiches_histo,
    CASE 
        WHEN @total_yj <= (SELECT COUNT(*) FROM `fiches_histo`)
        THEN '✓ Migration complète ou supérieure (doublons possibles dans yj_histo_fiche)'
        ELSE CONCAT('⚠ Attention : ', 
            @total_yj - (SELECT COUNT(*) FROM `fiches_histo`),
            ' lignes non migrées')
    END as statut_migration;

-- Réactiver les vérifications
SET FOREIGN_KEY_CHECKS = 1;
SET SQL_SAFE_UPDATES = 1;

-- =====================================================
-- NOTES IMPORTANTES
-- =====================================================
--
-- 1. Ce script détecte automatiquement la colonne id_fiche dans yj_histo_fiche (id_fiche, fiche_id ou id, insensible à la casse).
--    Si aucune n'est trouvée, tous les id_fiche insérés seraient 0 : le WHERE exclut alors id_fiche = 0 et aucune ligne n'est insérée.
--    Vérifier le résultat "COLONNE UTILISÉE POUR id_fiche" avant d'exécuter.
-- 2. Il évite les doublons en vérifiant l'ID de la fiche, l'ID de l'état et la date (tolérance de 1 seconde)
-- 3. Si une colonne n'existe pas, le script utilise une valeur par défaut
-- 4. Le script migre TOUTES les entrées historiques, même si la fiche n'existe pas encore dans 'fiches'
--    (l'historique sera disponible dès que la fiche sera créée)
-- 5. Si l'état n'est pas trouvé, l'état par défaut (1 = EN-ATTENTE) est utilisé
-- 6. DISTINCT a été retiré pour garantir que toutes les entrées historiques sont migrées
-- 7. Tolérance ±5 secondes sur date_creation (alignée sur la requête de diagnostic « non migrées »)
-- 8. NOT EXISTS sur (id_fiche, id_etat, date_creation) : relancer le script ne recrée pas les mêmes lignes ;
--    deux transitions distinctes même jour restent migrées si leurs date_creation diffèrent de plus de 5 s
--    Un UPDATE complète conf_mode_chauffage depuis conf_energie sur les lignes déjà présentes (valeur encore vide).
--
-- 9. Le script ramène tous les champs possibles de la table YJ (yj_histo_fiche ou yj_fiche_histo) vers fiches_histo.
--    Détection insensible à la casse. Mapping explicite :
--    - date_heure_playning, date_planning dans yj -> date_rdv_time (copie directe)
--    - date_creation et date_appel_time (fiches_histo) : priorité à date_heure_mod (yj) si présente
--    - date_rdv_time, date_rdv dans yj -> date_rdv_time (COALESCE si plusieurs présents)
--    - id_confirmateur, id_confirmateur_2, id_confirmateur_3 (ou nom_confirmateur) ; fallback fiches si NULL
--    - conf_commentaire_produit, conf_rdv_avec, conf_mode_chauffage (source yj : conf_energie)
--    - date_appel_time, date_sign_time
--    - id_sous_etat, id_commercial, ph3_installateur, ph3_pac, ph3_type, ph3_prix, ph3_puissance
--    - ph3_consommation, ph3_bonus_30, ph3_mensualite, ph3_nbr_annee_finance, ph3_ballon, ph3_alimentation
--    - credit_immobilier, credit_autre, valeur_mensualite
--
-- =====================================================
-- FIN DU SCRIPT
-- =====================================================

