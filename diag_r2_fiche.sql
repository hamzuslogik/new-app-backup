-- Diagnostic R2 pour une fiche (ex. 996748)
-- Règle : HAS (9) puis CONFIRMER (7) sans REFUSER (12/25) entre les deux

SET @id_fiche = 996748;

SELECT id, is_r2, id_commercial, id_commercial_2, id_etat_final
FROM fiches
WHERE id = @id_fiche;

SELECT
  h.id,
  h.id_etat,
  e.titre,
  h.date_creation,
  h.from_compte_rendu,
  h.id_commercial,
  h.id_commercial_cr
FROM fiches_histo h
LEFT JOIN etats e ON e.id = h.id_etat
WHERE h.id_fiche = @id_fiche
ORDER BY h.id ASC;

-- Chaîne d'états
SELECT GROUP_CONCAT(CONCAT(h.id, ':', h.id_etat, ':', IFNULL(e.titre,'?')) ORDER BY h.id ASC SEPARATOR ' → ') AS chaine
FROM fiches_histo h
LEFT JOIN etats e ON e.id = h.id_etat
WHERE h.id_fiche = @id_fiche;

-- Y a-t-il un HAS suivi d'un CONFIRMER sans REFUSER entre ?
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM fiches_histo h1
      INNER JOIN fiches_histo h2
        ON h2.id_fiche = h1.id_fiche
       AND h2.id > h1.id
       AND h2.id_etat = 7
      WHERE h1.id_fiche = @id_fiche
        AND h1.id_etat = 9
        AND NOT EXISTS (
          SELECT 1 FROM fiches_histo hr
          WHERE hr.id_fiche = h1.id_fiche
            AND hr.id > h1.id
            AND hr.id < h2.id
            AND hr.id_etat IN (12, 25)
        )
    ) THEN 'OUI — devrait être R2'
    ELSE 'NON — pas de motif HAS→CONFIRMER sans REFUSER'
  END AS diagnostic_r2_histo;
