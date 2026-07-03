-- =====================================================
-- Stats journalières YJ (1 requête)
-- Remplacer '2026-06-26' par la date souhaitée
-- =====================================================
-- nb_fiches_distinctes : fiches traitées ce jour, dernier état = CONFIRMER
-- nb_confirmer         : idem avec au moins un passage CONFIRMER dans la journée
-- Filtre : nom_commercial vide | 1 id_fiche = 1 comptage
-- =====================================================

SELECT
  d.`jour`,
  COUNT(*) AS nb_fiches_distinctes,
  SUM(d.`a_confirmer_dans_journee`) AS nb_confirmer
FROM (
  SELECT
    last_h.`jour`,
    last_h.`id_fiche`,
    MAX(CASE WHEN TRIM(hf.`etat`) = 'CONFIRMER' THEN 1 ELSE 0 END) AS a_confirmer_dans_journee
  FROM (
    SELECT
      hf.`id_fiche`,
      DATE(hf.`date_heure_mod`) AS jour,
      MAX(hf.`date_heure_mod`) AS derniere_date
    FROM `yj_histo_fiche` hf
    INNER JOIN `yj_fiche` y ON y.`id` = hf.`id_fiche`
    WHERE hf.`id_fiche` IS NOT NULL
      AND hf.`date_heure_mod` IS NOT NULL
      AND hf.`date_heure_mod` != '0000-00-00 00:00:00'
      AND TRIM(COALESCE(hf.`etat`, '')) != ''
      AND TRIM(COALESCE(y.`nom_commercial`, '')) = ''
      AND (y.`archive` IS NULL OR y.`archive` = 0)
      AND DATE(hf.`date_heure_mod`) = '2026-06-26'
    GROUP BY hf.`id_fiche`, DATE(hf.`date_heure_mod`)
  ) last_h
  INNER JOIN `yj_histo_fiche` hf_last
    ON hf_last.`id_fiche` = last_h.`id_fiche`
   AND hf_last.`date_heure_mod` = last_h.`derniere_date`
   AND TRIM(hf_last.`etat`) = 'CONFIRMER'
  INNER JOIN `yj_histo_fiche` hf
    ON hf.`id_fiche` = last_h.`id_fiche`
   AND DATE(hf.`date_heure_mod`) = last_h.`jour`
   AND hf.`date_heure_mod` IS NOT NULL
   AND hf.`date_heure_mod` != '0000-00-00 00:00:00'
  GROUP BY last_h.`jour`, last_h.`id_fiche`
) d
GROUP BY d.`jour`;
