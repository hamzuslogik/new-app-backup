-- =====================================================
-- Diagnostic planning : fiche 1062305
-- RDV attendu : 2026-10-14 18:30 → créneau 18:00 (18h–19h29)
-- Symptôme : planning 0/2 alors que le lien dashboard trouve le RDV
-- =====================================================

USE `crm`;

SELECT '--- Fiche 1062305 ---' AS info;

SELECT
  id,
  cp,
  HEX(cp) AS cp_hex,
  LENGTH(cp) AS cp_len,
  CHAR_LENGTH(cp) AS cp_chars,
  LEFT(TRIM(REPLACE(REPLACE(cp, ' ', ''), '-', '')), 2) AS dep_normalise,
  id_etat_final,
  date_rdv_time,
  archive,
  ko,
  active,
  id_commercial,
  id_centre
FROM fiches
WHERE id = 1062305;

SELECT '--- Créneau 18:00 le 2026-10-14 (même logique dashboard vs planning LIKE) ---' AS info;

-- RDVs CONFIRMER le 14/10/2026 18:00–19:29 (comme le lien dashboard)
SELECT
  f.id,
  f.cp,
  f.date_rdv_time,
  f.id_etat_final,
  f.archive,
  f.active,
  CASE
    WHEN f.cp LIKE CONCAT(LEFT(TRIM(REPLACE(REPLACE((SELECT cp FROM fiches WHERE id = 1062305), ' ', ''), '-', '')), 2), '%')
      THEN 'MATCH planning LIKE brut'
    ELSE 'MISS planning LIKE brut'
  END AS match_like_brut,
  CASE
    WHEN LEFT(TRIM(REPLACE(REPLACE(COALESCE(f.cp, ''), ' ', ''), '-', '')), 2)
       = LEFT(TRIM(REPLACE(REPLACE((SELECT cp FROM fiches WHERE id = 1062305), ' ', ''), '-', '')), 2)
      THEN 'MATCH dep normalise'
    ELSE 'MISS dep normalise'
  END AS match_dep_normalise
FROM fiches f
WHERE CAST(f.id_etat_final AS UNSIGNED) = 7
  AND f.date_rdv_time >= '2026-10-14 18:00:00'
  AND f.date_rdv_time <= '2026-10-14 19:29:59'
ORDER BY f.date_rdv_time, f.id;

SELECT '--- Disponibilité planning_availablity 14/10/2026 18:00 ---' AS info;

SELECT *
FROM planning_availablity
WHERE date_day = '2026-10-14'
  AND hour = '18:00:00'
ORDER BY dep, week, year;
