-- =============================================================================
-- Ajouter les utilisateurs (confirmateurs) manquants dans la table utilisateurs.
-- Pseudo = nom affiché, fonction = 6 (confirmateur), etat = 0 (inactif).
-- Les numéros de la liste source (nb_fiches) ne sont pas stockés.
-- Exécuter avec: mysql -u ... -p crm < insert_confirmateurs_manquants.sql
-- =============================================================================

USE `crm`;

-- N'insérer que si le pseudo n'existe pas déjà (comparaison insensible à la casse)
INSERT INTO `utilisateurs` (`pseudo`, `fonction`, `etat`)
SELECT * FROM (
  SELECT 'ABADE'   AS pseudo, 6 AS fonction, 0 AS etat
  UNION ALL SELECT 'ADEL',    6, 0
  UNION ALL SELECT 'ALVES',   6, 0
  UNION ALL SELECT 'AMI',     6, 0
  UNION ALL SELECT 'ANCEL',   6, 0
  UNION ALL SELECT 'ANDRE',   6, 0
  UNION ALL SELECT 'ANGER',   6, 0
  UNION ALL SELECT 'ARNAUD',  6, 0
  UNION ALL SELECT 'ARTHUR',  6, 0
  UNION ALL SELECT 'AUBERT',  6, 0
  UNION ALL SELECT 'AWATEF',  6, 0
  UNION ALL SELECT 'BARON',   6, 0
  UNION ALL SELECT 'BARROT',  6, 0
  UNION ALL SELECT 'BARTIN',  6, 0
  UNION ALL SELECT 'BERGEOT', 6, 0
  UNION ALL SELECT 'BESNIER', 6, 0
  UNION ALL SELECT 'BLANCHARD', 6, 0
  UNION ALL SELECT 'BLIN',    6, 0
  UNION ALL SELECT 'BLONDEL', 6, 0
  UNION ALL SELECT 'BODIN',   6, 0
  UNION ALL SELECT 'BOURGEOIS', 6, 0
  UNION ALL SELECT 'BOUVET',  6, 0
  UNION ALL SELECT 'BRIAND',  6, 0
  UNION ALL SELECT 'BROCARD', 6, 0
  UNION ALL SELECT 'BUREAU',  6, 0
) AS tmp
WHERE NOT EXISTS (
  SELECT 1 FROM `utilisateurs` u
  WHERE TRIM(UPPER(u.pseudo)) = TRIM(UPPER(tmp.pseudo))
);

-- Afficher le nombre de lignes insérées (approximatif : rows affected)
SELECT ROW_COUNT() AS 'Lignes insérées (approx)';
