-- =====================================================
-- Équivalent MySQL de la requête GET /fiches du Dashboard
-- (RDV créés aujourd'hui = fiches_histo_confirmation, date 2026-03-17)
-- =====================================================
-- Paramètres utilisés dans les logs :
--   date_champ=fiches_histo_confirmation, date_debut=2026-03-17, date_fin=2026-03-17
--   id_etat_final=7, time_debut=00:00:00, time_fin=23:59:59
-- =====================================================

USE `crm`;

-- 1) Nombre de fiches (COUNT)
SELECT COUNT(DISTINCT fiche.id) AS total
FROM fiches fiche
INNER JOIN (
  SELECT DISTINCT id_fiche
  FROM fiches_histo
  WHERE id_etat = 7
    AND DATE(date_creation) >= '2026-03-17'
    AND DATE(date_creation) <= '2026-03-17'
) histo_conf ON fiche.id = histo_conf.id_fiche
WHERE fiche.active = 1
  AND (fiche.archive = 0 OR fiche.archive IS NULL)
  AND fiche.id_etat_final = 7;

-- 2) Liste des fiches (SELECT)
SELECT
  fiche.id,
  fiche.hash,
  fiche.nom,
  fiche.prenom,
  fiche.tel,
  fiche.cp,
  fiche.date_rdv_time,
  fiche.id_etat_final,
  fiche.id_commercial,
  fiche.id_confirmateur,
  etat.titre AS etat_titre
FROM fiches fiche
LEFT JOIN etats etat ON fiche.id_etat_final = etat.id
INNER JOIN (
  SELECT DISTINCT id_fiche
  FROM fiches_histo
  WHERE id_etat = 7
    AND DATE(date_creation) >= '2026-03-17'
    AND DATE(date_creation) <= '2026-03-17'
) histo_conf ON fiche.id = histo_conf.id_fiche
WHERE fiche.active = 1
  AND (fiche.archive = 0 OR fiche.archive IS NULL)
  AND fiche.id_etat_final = 7
ORDER BY fiche.date_rdv_time ASC;

-- 3) Diagnostic : y a-t-il des lignes fiches_histo id_etat=7 le 2026-03-17 ?
SELECT 'Lignes fiches_histo id_etat=7 avec DATE(date_creation)=2026-03-17' AS info;
SELECT id, id_fiche, id_etat, date_creation
FROM fiches_histo
WHERE id_etat = 7
  AND DATE(date_creation) = '2026-03-17'
LIMIT 20;

-- 4) Diagnostic : fiches avec id_etat_final=7 (sans filtre date)
SELECT 'Fiches id_etat_final=7 actives non archivées (échantillon)' AS info;
SELECT id, nom, prenom, id_etat_final, date_rdv_time, archive, active
FROM fiches
WHERE id_etat_final = 7
  AND active = 1
  AND (archive = 0 OR archive IS NULL)
LIMIT 10;
