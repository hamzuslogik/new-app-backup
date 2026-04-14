-- =====================================================
-- Remplir / mettre à jour porte_ouverte depuis compte_rendu_pending
-- =====================================================
-- Aligné sur backend/routes/compte-rendu.routes.js (approbation CR) :
--   États « porte ouverte » : 9, 12, 13, 16, 23, 35, 38, 44, 45
--   (Honoré à suivre, Refuser, Signer, Signer rétracter, Hors cible confirmateur,
--    HHC technique, Signer rétracter 2×, Signer PM, Signer complet)
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
  cr.id AS id_compte_rendu_pending,
  cr.id_fiche,
  cr.id_etat_final AS id_etat_resolu,
  cr.id_commercial,
  cr.id_approbateur,
  COALESCE(cr.date_approbation, cr.date_modif, cr.date_creation) AS date_ref
FROM compte_rendu_pending cr
WHERE cr.statut = 'approved'
  AND cr.id_etat_final IN (9, 12, 13, 16, 23, 35, 38, 44, 45)
  AND NOT EXISTS (
    SELECT 1
    FROM porte_ouverte po
    WHERE po.id_compte_rendu_pending = cr.id
  )
ORDER BY cr.id;

-- ---------------------------------------------------------------------------
-- B) DIAGNOSTIC AVANT INSERT
-- ---------------------------------------------------------------------------
SELECT
  COUNT(*) AS nb_candidates_total
FROM compte_rendu_pending cr
WHERE cr.statut = 'approved'
  AND cr.id_etat_final IN (9, 12, 13, 16, 23, 35, 38, 44, 45);

SELECT
  COUNT(*) AS nb_deja_presentes
FROM compte_rendu_pending cr
WHERE cr.statut = 'approved'
  AND cr.id_etat_final IN (9, 12, 13, 16, 23, 35, 38, 44, 45)
  AND EXISTS (
    SELECT 1
    FROM porte_ouverte po
    WHERE po.id_compte_rendu_pending = cr.id
  );

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
  cr.id_fiche,
  cr.id,
  cr.id_etat_final,
  cr.id_commercial,
  cr.id_approbateur,
  COALESCE(cr.date_approbation, cr.date_modif, cr.date_creation),
  COALESCE(cr.date_approbation, cr.date_modif, cr.date_creation)
FROM compte_rendu_pending cr
WHERE cr.statut = 'approved'
  AND cr.id_etat_final IN (9, 12, 13, 16, 23, 35, 38, 44, 45)
  AND NOT EXISTS (
    SELECT 1
    FROM porte_ouverte po
    WHERE po.id_compte_rendu_pending = cr.id
  );
SELECT ROW_COUNT() AS nb_lignes_inserees;

-- ---------------------------------------------------------------------------
-- D) CONTRÔLES après INSERT
-- ---------------------------------------------------------------------------
SELECT COUNT(*) AS nb_porte_ouverte FROM porte_ouverte;

SELECT
  COUNT(*) AS nb_cr_approved_porte_etat
FROM compte_rendu_pending cr
WHERE cr.statut = 'approved'
  AND cr.id_etat_final IN (9, 12, 13, 16, 23, 35, 38, 44, 45);

-- Fin.
