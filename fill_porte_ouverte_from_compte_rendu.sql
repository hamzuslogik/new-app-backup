-- =====================================================
-- Remplir / mettre à jour porte_ouverte depuis compte_rendu_pending
-- =====================================================
-- Aligné sur backend/routes/compte-rendu.routes.js (approbation CR) :
--   États « porte ouverte » : 9, 12, 13, 16, 23, 34, 35, 38, 44, 45
--   (Honoré à suivre, Refuser, Signer, Signer rétracter, Hors cible confirmateur,
--    HHC financement à vérifier, HHC technique, Signer rétracter 2×, Signer PM, Signer complet)
--
-- Résolution de l’état cible :
--   compte_rendu_pending.id_etat_final (source unique)
--
-- Prérequis :
--   - Table porte_ouverte (create_porte_ouverte_table.sql)
--   - Lignes insérées uniquement pour CR statut = 'approved'
--   - Pas de doublon pour un même id_compte_rendu_pending (NOT EXISTS)
--
-- Usage :
--   Exécuter le script tel quel (INSERT actif + diagnostics)
-- =====================================================

USE `crm`;

-- ---------------------------------------------------------------------------
-- A) PRÉVISUALISATION — lignes candidates
-- ---------------------------------------------------------------------------
SELECT
  src.id_compte_rendu_pending,
  src.id_fiche,
  src.id_etat_final AS id_etat_resolu,
  src.centre_titre,
  src.id_commercial,
  src.id_approbateur,
  src.date_ref
FROM (
  SELECT
    MIN(cr.id) AS id_compte_rendu_pending,
    cr.id_fiche,
    cr.id_etat_final,
    MIN(cr.id_commercial) AS id_commercial,
    MIN(cr.id_approbateur) AS id_approbateur,
    COALESCE(cr.date_approbation, cr.date_modif, cr.date_creation) AS date_ref,
    ce.titre AS centre_titre
  FROM compte_rendu_pending cr
  INNER JOIN fiches f ON f.id = cr.id_fiche
  INNER JOIN centres ce ON ce.id = f.id_centre
  WHERE cr.statut = 'approved'
    AND UPPER(COALESCE(ce.titre, '')) LIKE '%JWS%'
    AND cr.id_etat_final IN (9, 12, 13, 16, 23, 34, 35, 38, 44, 45)
  GROUP BY
    cr.id_fiche,
    cr.id_etat_final,
    COALESCE(cr.date_approbation, cr.date_modif, cr.date_creation),
    ce.titre
) src
WHERE NOT EXISTS (
    SELECT 1
    FROM porte_ouverte po
    WHERE po.id_compte_rendu_pending = src.id_compte_rendu_pending
  )
  AND NOT EXISTS (
    SELECT 1
    FROM porte_ouverte po2
    WHERE po2.id_fiche = src.id_fiche
      AND po2.id_etat_final = src.id_etat_final
      AND COALESCE(po2.date_approbation, po2.date_creation) = src.date_ref
  )
ORDER BY src.id_compte_rendu_pending;

-- ---------------------------------------------------------------------------
-- B) DIAGNOSTIC AVANT INSERT
-- ---------------------------------------------------------------------------
SELECT
  COUNT(*) AS nb_candidates_total
FROM compte_rendu_pending cr
INNER JOIN fiches f ON f.id = cr.id_fiche
INNER JOIN centres ce ON ce.id = f.id_centre
WHERE cr.statut = 'approved'
  AND UPPER(COALESCE(ce.titre, '')) LIKE '%JWS%'
  AND cr.id_etat_final IN (9, 12, 13, 16, 23, 34, 35, 38, 44, 45);

SELECT
  COUNT(*) AS nb_deja_presentes
FROM compte_rendu_pending cr
INNER JOIN fiches f ON f.id = cr.id_fiche
INNER JOIN centres ce ON ce.id = f.id_centre
WHERE cr.statut = 'approved'
  AND UPPER(COALESCE(ce.titre, '')) LIKE '%JWS%'
  AND cr.id_etat_final IN (9, 12, 13, 16, 23, 34, 35, 38, 44, 45)
  AND EXISTS (
    SELECT 1
    FROM porte_ouverte po
    WHERE po.id_compte_rendu_pending = cr.id
  );

SELECT
  COUNT(*) AS nb_source_doublons_meme_fiche_etat_date
FROM (
  SELECT
    cr.id_fiche,
    cr.id_etat_final,
    COALESCE(cr.date_approbation, cr.date_modif, cr.date_creation) AS date_ref,
    COUNT(*) AS nb
  FROM compte_rendu_pending cr
  INNER JOIN fiches f ON f.id = cr.id_fiche
  INNER JOIN centres ce ON ce.id = f.id_centre
  WHERE cr.statut = 'approved'
    AND UPPER(COALESCE(ce.titre, '')) LIKE '%JWS%'
    AND cr.id_etat_final IN (9, 12, 13, 16, 23, 34, 35, 38, 44, 45)
  GROUP BY cr.id_fiche, cr.id_etat_final, COALESCE(cr.date_approbation, cr.date_modif, cr.date_creation)
  HAVING COUNT(*) > 1
) d;

-- ---------------------------------------------------------------------------
-- C) INSERT EFFECTIF
-- ---------------------------------------------------------------------------
INSERT INTO porte_ouverte (
  id_fiche,
  id_compte_rendu_pending,
  id_etat_final,
  id_commercial,
  id_approbateur,
  date_approbation,
  date_creation
)
SELECT
  src.id_fiche,
  src.id_compte_rendu_pending,
  src.id_etat_final,
  src.id_commercial,
  src.id_approbateur,
  src.date_ref,
  src.date_ref
FROM (
  SELECT
    MIN(cr.id) AS id_compte_rendu_pending,
    cr.id_fiche,
    cr.id_etat_final,
    MIN(cr.id_commercial) AS id_commercial,
    MIN(cr.id_approbateur) AS id_approbateur,
    COALESCE(cr.date_approbation, cr.date_modif, cr.date_creation) AS date_ref
  FROM compte_rendu_pending cr
  INNER JOIN fiches f ON f.id = cr.id_fiche
  INNER JOIN centres ce ON ce.id = f.id_centre
  WHERE cr.statut = 'approved'
    AND UPPER(COALESCE(ce.titre, '')) LIKE '%JWS%'
    AND cr.id_etat_final IN (9, 12, 13, 16, 23, 34, 35, 38, 44, 45)
  GROUP BY
    cr.id_fiche,
    cr.id_etat_final,
    COALESCE(cr.date_approbation, cr.date_modif, cr.date_creation)
) src
WHERE 1=1
  AND NOT EXISTS (
    SELECT 1
    FROM porte_ouverte po
    WHERE po.id_compte_rendu_pending = src.id_compte_rendu_pending
  )
  AND NOT EXISTS (
    SELECT 1
    FROM porte_ouverte po2
    WHERE po2.id_fiche = src.id_fiche
      AND po2.id_etat_final = src.id_etat_final
      AND COALESCE(po2.date_approbation, po2.date_creation) = src.date_ref
  );
SELECT ROW_COUNT() AS nb_lignes_inserees;

-- ---------------------------------------------------------------------------
-- D) CONTRÔLES après INSERT
-- ---------------------------------------------------------------------------
SELECT COUNT(*) AS nb_porte_ouverte FROM porte_ouverte;

SELECT
  COUNT(*) AS nb_cr_approved_porte_etat
FROM compte_rendu_pending cr
INNER JOIN fiches f ON f.id = cr.id_fiche
INNER JOIN centres ce ON ce.id = f.id_centre
WHERE cr.statut = 'approved'
  AND UPPER(COALESCE(ce.titre, '')) LIKE '%JWS%'
  AND cr.id_etat_final IN (9, 12, 13, 16, 23, 34, 35, 38, 44, 45);

-- Fin.
