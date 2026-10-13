-- =====================================================
-- yj_fiche(s).valeur_mensualite → fiches.valeur_mensualite
-- Filtre source : etat_final = 'SIGNER'
-- Périmètre date : fiches strictement avant le 01/10/2026
--   (COALESCE date_sign_time, date_rdv_time, date_insert_time)
-- Liaison : yj.id = fiches.id
-- =====================================================
-- Sécurité :
--   SET @execution = 0  → diagnostic seulement (SELECT)
--   SET @execution = 1  → UPDATE réel
--
-- Options :
--   SET @force_overwrite = 0  → ne met à jour que fiches.valeur_mensualite NULL ou 0
--   SET @force_overwrite = 1  → écrase aussi les valeurs déjà renseignées
--
-- Table source :
--   priorite a yj_fiches si elle existe, sinon yj_fiche
-- =====================================================

USE `crm`;

SET SQL_SAFE_UPDATES = 0;

-- >>> PASSER À 1 APRÈS AVOIR LU LE DIAGNOSTIC <<<
SET @execution = 0;
SET @force_overwrite = 0;
-- Borne exclusive : uniquement les fiches avant le 01/10/2026
SET @date_avant = '2026-10-01';

-- Résoudre le nom de table source (yj_fiches ou yj_fiche)
SET @src_table := (
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'yj_fiches'
    ) THEN 'yj_fiches'
    WHEN EXISTS (
      SELECT 1 FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'yj_fiche'
    ) THEN 'yj_fiche'
    ELSE NULL
  END
);

SELECT
  @execution AS execution,
  CASE WHEN @execution = 1 THEN 'ÉCRITURE ACTIVÉE' ELSE 'DIAGNOSTIC SEULEMENT' END AS mode_libelle,
  @force_overwrite AS force_overwrite,
  @date_avant AS date_avant_exclusive,
  @src_table AS table_source;

-- Arrêt propre si aucune table source
SET @stop_sql := IF(
  @src_table IS NULL,
  'SELECT ''ERREUR : ni yj_fiches ni yj_fiche introuvable dans cette base'' AS erreur',
  'SELECT CONCAT(''Source OK : '', @src_table) AS info'
);
PREPARE stmt_stop FROM @stop_sql;
EXECUTE stmt_stop;
DEALLOCATE PREPARE stmt_stop;

-- =====================================================
-- Table temporaire des lignes éligibles
-- =====================================================
DROP TEMPORARY TABLE IF EXISTS tmp_vm_signer;

CREATE TEMPORARY TABLE tmp_vm_signer (
  id_fiche INT NOT NULL,
  nom VARCHAR(255) DEFAULT NULL,
  prenom VARCHAR(255) DEFAULT NULL,
  id_etat_final INT DEFAULT NULL,
  date_ref DATETIME DEFAULT NULL,
  yj_etat_final VARCHAR(255) DEFAULT NULL,
  yj_valeur_mensualite VARCHAR(255) DEFAULT NULL,
  fiche_valeur_mensualite_actuelle DECIMAL(10,2) DEFAULT NULL,
  valeur_mensualite_cible DECIMAL(10,2) DEFAULT NULL,
  PRIMARY KEY (id_fiche)
);

SET @sql_tmp := IF(
  @src_table IS NULL,
  'SELECT ''Pas de remplissage tmp (source absente)'' AS info',
  CONCAT(
    'INSERT INTO tmp_vm_signer (',
    '  id_fiche, nom, prenom, id_etat_final, date_ref, yj_etat_final, ',
    '  yj_valeur_mensualite, fiche_valeur_mensualite_actuelle, valeur_mensualite_cible',
    ') ',
    'SELECT ',
    '  f.id AS id_fiche, ',
    '  f.nom, ',
    '  f.prenom, ',
    '  f.id_etat_final, ',
    '  COALESCE(f.date_sign_time, f.date_rdv_time, f.date_insert_time) AS date_ref, ',
    '  y.etat_final AS yj_etat_final, ',
    '  y.valeur_mensualite AS yj_valeur_mensualite, ',
    '  f.valeur_mensualite AS fiche_valeur_mensualite_actuelle, ',
    '  CASE ',
    '    WHEN NULLIF(TRIM(y.valeur_mensualite), '''') REGEXP ''^[0-9]+(\\.[0-9]+)?$'' ',
    '      THEN CAST(TRIM(y.valeur_mensualite) AS DECIMAL(10,2)) ',
    '    ELSE NULL ',
    '  END AS valeur_mensualite_cible ',
    'FROM fiches f ',
    'INNER JOIN `', @src_table, '` y ON y.id = f.id ',
    'WHERE UPPER(TRIM(y.etat_final)) = ''SIGNER'' ',
    '  AND COALESCE(f.date_sign_time, f.date_rdv_time, f.date_insert_time) IS NOT NULL ',
    '  AND COALESCE(f.date_sign_time, f.date_rdv_time, f.date_insert_time) < ''', @date_avant, ''' ',
    '  AND NULLIF(TRIM(y.valeur_mensualite), '''') IS NOT NULL ',
    '  AND NULLIF(TRIM(y.valeur_mensualite), '''') REGEXP ''^[0-9]+(\\.[0-9]+)?$'' ',
    '  AND ( ',
    '    ', @force_overwrite, ' = 1 ',
    '    OR f.valeur_mensualite IS NULL ',
    '    OR f.valeur_mensualite = 0 ',
    '  )'
  )
);

PREPARE stmt_tmp FROM @sql_tmp;
EXECUTE stmt_tmp;
DEALLOCATE PREPARE stmt_tmp;

-- =====================================================
-- DIAGNOSTIC (toujours)
-- =====================================================
SELECT '--- Compteurs ---' AS info;

-- Une seule lecture de tmp_vm_signer (MySQL refuse de rouvrir une TEMP TABLE plusieurs fois)
SELECT
  COUNT(*) AS nb_eligibles_a_mettre_a_jour,
  SUM(CASE WHEN valeur_mensualite_cible IS NOT NULL THEN 1 ELSE 0 END) AS nb_valeur_numerique_ok,
  SUM(CASE WHEN fiche_valeur_mensualite_actuelle IS NULL OR fiche_valeur_mensualite_actuelle = 0 THEN 1 ELSE 0 END) AS nb_fiches_vide_ou_zero,
  SUM(CASE WHEN fiche_valeur_mensualite_actuelle IS NOT NULL AND fiche_valeur_mensualite_actuelle <> 0 THEN 1 ELSE 0 END) AS nb_fiches_deja_renseignees
FROM tmp_vm_signer;

SELECT '--- Aperçu (max 200) ---' AS info;

SELECT
  id_fiche,
  nom,
  prenom,
  id_etat_final,
  date_ref,
  yj_etat_final,
  yj_valeur_mensualite,
  fiche_valeur_mensualite_actuelle,
  valeur_mensualite_cible
FROM tmp_vm_signer
ORDER BY date_ref DESC, id_fiche
LIMIT 200;

-- =====================================================
-- UPDATE (uniquement si @execution = 1)
-- =====================================================
SET @sql_upd := IF(
  @execution = 1 AND @src_table IS NOT NULL,
  CONCAT(
    'UPDATE fiches f ',
    'INNER JOIN tmp_vm_signer t ON t.id_fiche = f.id ',
    'SET f.valeur_mensualite = t.valeur_mensualite_cible ',
    'WHERE t.valeur_mensualite_cible IS NOT NULL'
  ),
  'SELECT ''UPDATE ignoré (execution=0 ou source absente)'' AS info'
);

PREPARE stmt_upd FROM @sql_upd;
EXECUTE stmt_upd;
DEALLOCATE PREPARE stmt_upd;

SET @rows_updated := IF(@execution = 1, ROW_COUNT(), 0);

SELECT
  @execution AS execution,
  @rows_updated AS nb_lignes_mises_a_jour,
  CASE
    WHEN @execution = 0 THEN 'Diagnostic terminé — aucune écriture'
    WHEN @execution = 1 THEN 'Mise à jour terminée'
    ELSE 'Mode inconnu'
  END AS resultat;

-- Contrôle après UPDATE
SELECT '--- Échantillon après traitement (max 50) ---' AS info;

SELECT
  f.id,
  f.id_etat_final,
  t.yj_etat_final,
  t.yj_valeur_mensualite,
  f.valeur_mensualite AS fiche_valeur_mensualite
FROM fiches f
INNER JOIN tmp_vm_signer t ON t.id_fiche = f.id
ORDER BY f.id DESC
LIMIT 50;

DROP TEMPORARY TABLE IF EXISTS tmp_vm_signer;

SELECT 'Terminé : valeur_mensualite SIGNER (yj → fiches).' AS message;
