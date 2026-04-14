-- =====================================================
-- Remplir / mettre a jour porte_ouverte depuis compte_rendu_pending
-- =====================================================
-- Regle demandee:
--   Si compte_rendu_pending.statut = 'approved'
--   ET id_etat_final est dans la liste porte ouverte
--   => inserer dans porte_ouverte
--
-- Aucun filtre centre dans ce script.
-- =====================================================

USE `crm`;

-- Etats porte ouverte
-- 9, 12, 13, 16, 23, 34, 35, 38, 44, 45

-- ---------------------------------------------------------------------------
-- A) PREVISUALISATION CANDIDATS
-- ---------------------------------------------------------------------------
SELECT
  src.id_compte_rendu_pending,
  src.id_fiche,
  src.id_etat_final,
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
    COALESCE(cr.date_approbation, cr.date_modif, cr.date_creation) AS date_ref
  FROM compte_rendu_pending cr
  WHERE cr.statut = 'approved'
    AND cr.id_etat_final IN (9, 12, 13, 16, 23, 34, 35, 38, 44, 45)
  GROUP BY
    cr.id_fiche,
    cr.id_etat_final,
    COALESCE(cr.date_approbation, cr.date_modif, cr.date_creation)
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
WHERE cr.statut = 'approved'
  AND cr.id_etat_final IN (9, 12, 13, 16, 23, 34, 35, 38, 44, 45);

SELECT
  COUNT(*) AS nb_deja_presentes
FROM compte_rendu_pending cr
WHERE cr.statut = 'approved'
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
  WHERE cr.statut = 'approved'
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
  WHERE cr.statut = 'approved'
    AND cr.id_etat_final IN (9, 12, 13, 16, 23, 34, 35, 38, 44, 45)
  GROUP BY
    cr.id_fiche,
    cr.id_etat_final,
    COALESCE(cr.date_approbation, cr.date_modif, cr.date_creation)
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
  );

SELECT ROW_COUNT() AS nb_lignes_inserees;

-- ---------------------------------------------------------------------------
-- D) CONTROLES APRES INSERT
-- ---------------------------------------------------------------------------
SELECT COUNT(*) AS nb_porte_ouverte FROM porte_ouverte;

SELECT
  COUNT(*) AS nb_cr_approved_porte_etat
FROM compte_rendu_pending cr
WHERE cr.statut = 'approved'
  AND cr.id_etat_final IN (9, 12, 13, 16, 23, 34, 35, 38, 44, 45);

-- Controle cible
SELECT
  cr.id,
  cr.id_fiche,
  cr.id_etat_final,
  COALESCE(cr.date_approbation, cr.date_modif, cr.date_creation) AS date_ref
FROM compte_rendu_pending cr
WHERE cr.id_fiche = 965374
  AND cr.statut = 'approved'
ORDER BY cr.id DESC;

-- Fin.
-- =====================================================
-- Remplir / mettre a jour porte_ouverte depuis compte_rendu_pending
-- =====================================================
-- Etats porte ouverte: 9, 12, 13, 16, 23, 34, 35, 38, 44, 45
-- Centre: uniquement JWS
-- Source: compte_rendu_pending statut = 'approved'
--
-- Strategie:
-- 1) Construire une source temporaire "tmp_cr_porte_ouverte"
-- 2) Resoudre id_etat_resolu:
--    - priorite a cr.id_etat_final
--    - fallback via cr.modifications (texte), sans fonctions JSON
-- 3) Inserer en evitant les doublons
-- =====================================================

USE `crm`;

-- ---------------------------------------------------------------------------
-- A) SOURCE TEMPORAIRE
-- ---------------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_cr_porte_ouverte;

CREATE TEMPORARY TABLE tmp_cr_porte_ouverte AS
SELECT
  cr.id,
  cr.id_fiche,
  cr.id_commercial,
  cr.id_approbateur,
  cr.statut,
  ce.titre AS centre_titre,
  COALESCE(cr.date_approbation, cr.date_modif, cr.date_creation) AS date_ref,
  COALESCE(
    cr.id_etat_final,
    CASE
      WHEN norm_modif LIKE '%"id_etat_final":9%'  OR norm_modif LIKE '%"id_etat_final":"9"%'  THEN 9
      WHEN norm_modif LIKE '%"id_etat_final":12%' OR norm_modif LIKE '%"id_etat_final":"12"%' THEN 12
      WHEN norm_modif LIKE '%"id_etat_final":13%' OR norm_modif LIKE '%"id_etat_final":"13"%' THEN 13
      WHEN norm_modif LIKE '%"id_etat_final":16%' OR norm_modif LIKE '%"id_etat_final":"16"%' THEN 16
      WHEN norm_modif LIKE '%"id_etat_final":23%' OR norm_modif LIKE '%"id_etat_final":"23"%' THEN 23
      WHEN norm_modif LIKE '%"id_etat_final":34%' OR norm_modif LIKE '%"id_etat_final":"34"%' THEN 34
      WHEN norm_modif LIKE '%"id_etat_final":35%' OR norm_modif LIKE '%"id_etat_final":"35"%' THEN 35
      WHEN norm_modif LIKE '%"id_etat_final":38%' OR norm_modif LIKE '%"id_etat_final":"38"%' THEN 38
      WHEN norm_modif LIKE '%"id_etat_final":44%' OR norm_modif LIKE '%"id_etat_final":"44"%' THEN 44
      WHEN norm_modif LIKE '%"id_etat_final":45%' OR norm_modif LIKE '%"id_etat_final":"45"%' THEN 45
      ELSE NULL
    END
  ) AS id_etat_resolu
FROM (
  SELECT
    cr.*,
    REPLACE(
      REPLACE(
        REPLACE(COALESCE(cr.modifications, ''), ' ', ''),
        CHAR(10),
        ''
      ),
      CHAR(13),
      ''
    ) AS norm_modif
  FROM compte_rendu_pending cr
) cr
INNER JOIN fiches f ON f.id = cr.id_fiche
INNER JOIN centres ce ON ce.id = f.id_centre
WHERE cr.statut = 'approved'
  AND UPPER(COALESCE(ce.titre, '')) LIKE '%JWS%';

-- ---------------------------------------------------------------------------
-- B) PREVISUALISATION CANDIDATS
-- ---------------------------------------------------------------------------
SELECT
  src.id_compte_rendu_pending,
  src.id_fiche,
  src.id_etat_resolu,
  src.centre_titre,
  src.id_commercial,
  src.id_approbateur,
  src.date_ref
FROM (
  SELECT
    MIN(t.id) AS id_compte_rendu_pending,
    t.id_fiche,
    t.id_etat_resolu,
    MIN(t.id_commercial) AS id_commercial,
    MIN(t.id_approbateur) AS id_approbateur,
    t.date_ref,
    t.centre_titre
  FROM tmp_cr_porte_ouverte t
  WHERE t.id_etat_resolu IN (9, 12, 13, 16, 23, 34, 35, 38, 44, 45)
  GROUP BY t.id_fiche, t.id_etat_resolu, t.date_ref, t.centre_titre
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
      AND po2.id_etat_final = src.id_etat_resolu
      AND COALESCE(po2.date_approbation, po2.date_creation) = src.date_ref
  )
ORDER BY src.id_compte_rendu_pending;

-- ---------------------------------------------------------------------------
-- C) DIAGNOSTIC AVANT INSERT
-- ---------------------------------------------------------------------------
SELECT COUNT(*) AS nb_candidates_total
FROM tmp_cr_porte_ouverte t
WHERE t.id_etat_resolu IN (9, 12, 13, 16, 23, 34, 35, 38, 44, 45);

SELECT COUNT(*) AS nb_deja_presentes
FROM tmp_cr_porte_ouverte t
WHERE t.id_etat_resolu IN (9, 12, 13, 16, 23, 34, 35, 38, 44, 45)
  AND EXISTS (
    SELECT 1
    FROM porte_ouverte po
    WHERE po.id_compte_rendu_pending = t.id
  );

SELECT
  COUNT(*) AS nb_source_doublons_meme_fiche_etat_date
FROM (
  SELECT
    t.id_fiche,
    t.id_etat_resolu,
    t.date_ref,
    COUNT(*) AS nb
  FROM tmp_cr_porte_ouverte t
  WHERE t.id_etat_resolu IN (9, 12, 13, 16, 23, 34, 35, 38, 44, 45)
  GROUP BY t.id_fiche, t.id_etat_resolu, t.date_ref
  HAVING COUNT(*) > 1
) d;

-- ---------------------------------------------------------------------------
-- D) INSERT EFFECTIF
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
  src.id_etat_resolu,
  src.id_commercial,
  src.id_approbateur,
  src.date_ref,
  src.date_ref
FROM (
  SELECT
    MIN(t.id) AS id_compte_rendu_pending,
    t.id_fiche,
    t.id_etat_resolu,
    MIN(t.id_commercial) AS id_commercial,
    MIN(t.id_approbateur) AS id_approbateur,
    t.date_ref
  FROM tmp_cr_porte_ouverte t
  WHERE t.id_etat_resolu IN (9, 12, 13, 16, 23, 34, 35, 38, 44, 45)
  GROUP BY t.id_fiche, t.id_etat_resolu, t.date_ref
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
      AND po2.id_etat_final = src.id_etat_resolu
      AND COALESCE(po2.date_approbation, po2.date_creation) = src.date_ref
  );

SELECT ROW_COUNT() AS nb_lignes_inserees;

-- ---------------------------------------------------------------------------
-- E) CONTROLES APRES INSERT
-- ---------------------------------------------------------------------------
SELECT COUNT(*) AS nb_porte_ouverte FROM porte_ouverte;

SELECT COUNT(*) AS nb_cr_approved_porte_etat
FROM tmp_cr_porte_ouverte t
WHERE t.id_etat_resolu IN (9, 12, 13, 16, 23, 34, 35, 38, 44, 45);

-- Controle cible (exemple fiche)
SELECT
  t.id,
  t.id_fiche,
  t.id_etat_resolu,
  t.date_ref,
  t.centre_titre
FROM tmp_cr_porte_ouverte t
WHERE t.id_fiche = 965374
ORDER BY t.id DESC;

-- Fin.
-- =====================================================
-- Remplir / mettre à jour porte_ouverte depuis compte_rendu_pending
-- =====================================================
-- Aligné sur backend/routes/compte-rendu.routes.js (approbation CR) :
--   États « porte ouverte » : 9, 12, 13, 16, 23, 34, 35, 38, 44, 45
--   (Honoré à suivre, Refuser, Signer, Signer rétracter, Hors cible confirmateur,
--    HHC financement à vérifier, HHC technique, Signer rétracter 2×, Signer PM, Signer complet)
--
-- Résolution de l’état cible :
--   1) compte_rendu_pending.id_etat_final
--   2) fallback depuis compte_rendu_pending.modifications (texte)
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
  src.id_etat_resolu,
  src.centre_titre,
  src.id_commercial,
  src.id_approbateur,
  src.date_ref
FROM (
  SELECT
    MIN(cr.id) AS id_compte_rendu_pending,
    cr.id_fiche,
    COALESCE(
      cr.id_etat_final,
      CASE
        WHEN cr.modifications IS NOT NULL
             AND LOCATE('"id_etat_final"', cr.modifications) > 0
        THEN CAST(
          TRIM(
            REPLACE(
              REPLACE(
                SUBSTRING_INDEX(
                  SUBSTRING(
                    cr.modifications,
                    LOCATE('"id_etat_final"', cr.modifications) + LENGTH('"id_etat_final"')
                  ),
                  ',',
                  1
                ),
                ':',
                ''
              ),
              '"',
              ''
            )
          ) AS UNSIGNED
        )
        ELSE NULL
      END
    ) AS id_etat_resolu,
    MIN(cr.id_commercial) AS id_commercial,
    MIN(cr.id_approbateur) AS id_approbateur,
    COALESCE(cr.date_approbation, cr.date_modif, cr.date_creation) AS date_ref,
    ce.titre AS centre_titre
  FROM compte_rendu_pending cr
  INNER JOIN fiches f ON f.id = cr.id_fiche
  INNER JOIN centres ce ON ce.id = f.id_centre
  WHERE cr.statut = 'approved'
    AND UPPER(COALESCE(ce.titre, '')) LIKE '%JWS%'
    AND COALESCE(
      cr.id_etat_final,
      CASE
        WHEN cr.modifications IS NOT NULL
             AND LOCATE('"id_etat_final"', cr.modifications) > 0
        THEN CAST(
          TRIM(
            REPLACE(
              REPLACE(
                SUBSTRING_INDEX(
                  SUBSTRING(
                    cr.modifications,
                    LOCATE('"id_etat_final"', cr.modifications) + LENGTH('"id_etat_final"')
                  ),
                  ',',
                  1
                ),
                ':',
                ''
              ),
              '"',
              ''
            )
          ) AS UNSIGNED
        )
        ELSE NULL
      END
    ) IN (9, 12, 13, 16, 23, 34, 35, 38, 44, 45)
  GROUP BY
    cr.id_fiche,
    COALESCE(
      cr.id_etat_final,
      CASE
        WHEN cr.modifications IS NOT NULL
             AND LOCATE('"id_etat_final"', cr.modifications) > 0
        THEN CAST(
          TRIM(
            REPLACE(
              REPLACE(
                SUBSTRING_INDEX(
                  SUBSTRING(
                    cr.modifications,
                    LOCATE('"id_etat_final"', cr.modifications) + LENGTH('"id_etat_final"')
                  ),
                  ',',
                  1
                ),
                ':',
                ''
              ),
              '"',
              ''
            )
          ) AS UNSIGNED
        )
        ELSE NULL
      END
    ),
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
      AND po2.id_etat_final = src.id_etat_resolu
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
  AND COALESCE(
    cr.id_etat_final,
    CASE
      WHEN cr.modifications IS NOT NULL
           AND LOCATE('"id_etat_final"', cr.modifications) > 0
      THEN CAST(
        TRIM(
          REPLACE(
            REPLACE(
              SUBSTRING_INDEX(
                SUBSTRING(
                  cr.modifications,
                  LOCATE('"id_etat_final"', cr.modifications) + LENGTH('"id_etat_final"')
                ),
                ',',
                1
              ),
              ':',
              ''
            ),
            '"',
            ''
          )
        ) AS UNSIGNED
      )
      ELSE NULL
    END
  ) IN (9, 12, 13, 16, 23, 34, 35, 38, 44, 45);

SELECT
  COUNT(*) AS nb_deja_presentes
FROM compte_rendu_pending cr
INNER JOIN fiches f ON f.id = cr.id_fiche
INNER JOIN centres ce ON ce.id = f.id_centre
WHERE cr.statut = 'approved'
  AND UPPER(COALESCE(ce.titre, '')) LIKE '%JWS%'
  AND COALESCE(
    cr.id_etat_final,
    CASE
      WHEN cr.modifications IS NOT NULL
           AND LOCATE('"id_etat_final"', cr.modifications) > 0
      THEN CAST(
        TRIM(
          REPLACE(
            REPLACE(
              SUBSTRING_INDEX(
                SUBSTRING(
                  cr.modifications,
                  LOCATE('"id_etat_final"', cr.modifications) + LENGTH('"id_etat_final"')
                ),
                ',',
                1
              ),
              ':',
              ''
            ),
            '"',
            ''
          )
        ) AS UNSIGNED
      )
      ELSE NULL
    END
  ) IN (9, 12, 13, 16, 23, 34, 35, 38, 44, 45)
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
    COALESCE(
      cr.id_etat_final,
      CASE
        WHEN cr.modifications IS NOT NULL
             AND LOCATE('"id_etat_final"', cr.modifications) > 0
        THEN CAST(
          TRIM(
            REPLACE(
              REPLACE(
                SUBSTRING_INDEX(
                  SUBSTRING(
                    cr.modifications,
                    LOCATE('"id_etat_final"', cr.modifications) + LENGTH('"id_etat_final"')
                  ),
                  ',',
                  1
                ),
                ':',
                ''
              ),
              '"',
              ''
            )
          ) AS UNSIGNED
        )
        ELSE NULL
      END
    ) AS id_etat_resolu,
    COALESCE(cr.date_approbation, cr.date_modif, cr.date_creation) AS date_ref,
    COUNT(*) AS nb
  FROM compte_rendu_pending cr
  INNER JOIN fiches f ON f.id = cr.id_fiche
  INNER JOIN centres ce ON ce.id = f.id_centre
  WHERE cr.statut = 'approved'
    AND UPPER(COALESCE(ce.titre, '')) LIKE '%JWS%'
    AND COALESCE(
      cr.id_etat_final,
      CASE
        WHEN cr.modifications IS NOT NULL
             AND LOCATE('"id_etat_final"', cr.modifications) > 0
        THEN CAST(
          TRIM(
            REPLACE(
              REPLACE(
                SUBSTRING_INDEX(
                  SUBSTRING(
                    cr.modifications,
                    LOCATE('"id_etat_final"', cr.modifications) + LENGTH('"id_etat_final"')
                  ),
                  ',',
                  1
                ),
                ':',
                ''
              ),
              '"',
              ''
            )
          ) AS UNSIGNED
        )
        ELSE NULL
      END
    ) IN (9, 12, 13, 16, 23, 34, 35, 38, 44, 45)
  GROUP BY cr.id_fiche, id_etat_resolu, COALESCE(cr.date_approbation, cr.date_modif, cr.date_creation)
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
  src.id_etat_resolu,
  src.id_commercial,
  src.id_approbateur,
  src.date_ref,
  src.date_ref
FROM (
  SELECT
    MIN(cr.id) AS id_compte_rendu_pending,
    cr.id_fiche,
    COALESCE(
      cr.id_etat_final,
      CASE
        WHEN cr.modifications IS NOT NULL
             AND LOCATE('"id_etat_final"', cr.modifications) > 0
        THEN CAST(
          TRIM(
            REPLACE(
              REPLACE(
                SUBSTRING_INDEX(
                  SUBSTRING(
                    cr.modifications,
                    LOCATE('"id_etat_final"', cr.modifications) + LENGTH('"id_etat_final"')
                  ),
                  ',',
                  1
                ),
                ':',
                ''
              ),
              '"',
              ''
            )
          ) AS UNSIGNED
        )
        ELSE NULL
      END
    ) AS id_etat_resolu,
    MIN(cr.id_commercial) AS id_commercial,
    MIN(cr.id_approbateur) AS id_approbateur,
    COALESCE(cr.date_approbation, cr.date_modif, cr.date_creation) AS date_ref
  FROM compte_rendu_pending cr
  INNER JOIN fiches f ON f.id = cr.id_fiche
  INNER JOIN centres ce ON ce.id = f.id_centre
  WHERE cr.statut = 'approved'
    AND UPPER(COALESCE(ce.titre, '')) LIKE '%JWS%'
    AND COALESCE(
      cr.id_etat_final,
      CASE
        WHEN cr.modifications IS NOT NULL
             AND LOCATE('"id_etat_final"', cr.modifications) > 0
        THEN CAST(
          TRIM(
            REPLACE(
              REPLACE(
                SUBSTRING_INDEX(
                  SUBSTRING(
                    cr.modifications,
                    LOCATE('"id_etat_final"', cr.modifications) + LENGTH('"id_etat_final"')
                  ),
                  ',',
                  1
                ),
                ':',
                ''
              ),
              '"',
              ''
            )
          ) AS UNSIGNED
        )
        ELSE NULL
      END
    ) IN (9, 12, 13, 16, 23, 34, 35, 38, 44, 45)
  GROUP BY
    cr.id_fiche,
    COALESCE(
      cr.id_etat_final,
      CASE
        WHEN cr.modifications IS NOT NULL
             AND LOCATE('"id_etat_final"', cr.modifications) > 0
        THEN CAST(
          TRIM(
            REPLACE(
              REPLACE(
                SUBSTRING_INDEX(
                  SUBSTRING(
                    cr.modifications,
                    LOCATE('"id_etat_final"', cr.modifications) + LENGTH('"id_etat_final"')
                  ),
                  ',',
                  1
                ),
                ':',
                ''
              ),
              '"',
              ''
            )
          ) AS UNSIGNED
        )
        ELSE NULL
      END
    ),
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
      AND po2.id_etat_final = src.id_etat_resolu
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
  AND COALESCE(
    cr.id_etat_final,
    CASE
      WHEN cr.modifications IS NOT NULL
           AND LOCATE('"id_etat_final"', cr.modifications) > 0
      THEN CAST(
        TRIM(
          REPLACE(
            REPLACE(
              SUBSTRING_INDEX(
                SUBSTRING(
                  cr.modifications,
                  LOCATE('"id_etat_final"', cr.modifications) + LENGTH('"id_etat_final"')
                ),
                ',',
                1
              ),
              ':',
              ''
            ),
            '"',
            ''
          )
        ) AS UNSIGNED
      )
      ELSE NULL
    END
  ) IN (9, 12, 13, 16, 23, 34, 35, 38, 44, 45);

-- Fin.
