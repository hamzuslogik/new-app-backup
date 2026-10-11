-- HC = état (id 55) : motifs via sous_etat.
-- KO = champ fiches.ko (0/1) : motifs via liste statique (constants/koMotifs.js), PAS sous_etat.

INSERT INTO sous_etat (id_etat, titre)
SELECT 55, 'AUTRE'
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM sous_etat WHERE id_etat = 55 AND UPPER(titre) = 'AUTRE'
);

SELECT id, id_etat, titre
FROM sous_etat
WHERE id_etat = 55 AND UPPER(titre) = 'AUTRE';
