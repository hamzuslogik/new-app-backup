-- =====================================================
-- Mettre la fonction des superviseurs a 2
-- =====================================================
-- Superviseurs cibles (pseudo):
-- - ANOUAR-LEADER 2
-- - BELHASSEN-LEADER 3
-- - CHAYMA-LEADER 1
-- - IMEN SRAIEB
-- - MADIHA BOUBAKER
-- - MARIEM THOUEBTIA
-- =====================================================

USE `crm`;

SET @fonction_superviseur = 2;
SET @centre_titre = 'CALL_JWS';

-- Creer / resoudre le centre CALL_JWS
SELECT c.id INTO @id_centre_call_jws
FROM centres c
WHERE TRIM(UPPER(IFNULL(c.titre, ''))) = TRIM(UPPER(@centre_titre))
LIMIT 1;

INSERT INTO centres (titre, etat)
SELECT src.titre, src.etat
FROM (
  SELECT @centre_titre AS titre, 1 AS etat
) src
WHERE @id_centre_call_jws IS NULL;

SET @id_centre_call_jws = COALESCE(@id_centre_call_jws, LAST_INSERT_ID());

-- Controle avant update
SELECT
  id,
  nom,
  prenom,
  pseudo,
  login,
  fonction,
  etat
FROM utilisateurs
WHERE TRIM(UPPER(IFNULL(pseudo, ''))) IN (
  'ANOUAR-LEADER 2',
  'BELHASSEN-LEADER 3',
  'CHAYMA-LEADER 1',
  'IMEN SRAIEB',
  'MADIHA BOUBAKER',
  'MARIEM THOUEBTIA'
)
ORDER BY pseudo;

-- Update fonction superviseur
UPDATE utilisateurs
SET fonction = @fonction_superviseur
WHERE TRIM(UPPER(IFNULL(pseudo, ''))) IN (
  'ANOUAR-LEADER 2',
  'BELHASSEN-LEADER 3',
  'CHAYMA-LEADER 1',
  'IMEN SRAIEB',
  'MADIHA BOUBAKER',
  'MARIEM THOUEBTIA'
);

SELECT ROW_COUNT() AS nb_superviseurs_mis_a_jour;

-- Affecter le centre CALL_JWS a tous les profils fonction 2 et 3
UPDATE utilisateurs
SET centre = @id_centre_call_jws
WHERE fonction IN (2, 3);

SELECT ROW_COUNT() AS nb_profils_fonction_2_3_centre_mis_a_jour;

-- Controle apres update
SELECT
  id,
  nom,
  prenom,
  pseudo,
  login,
  fonction,
  etat
FROM utilisateurs
WHERE TRIM(UPPER(IFNULL(pseudo, ''))) IN (
  'ANOUAR-LEADER 2',
  'BELHASSEN-LEADER 3',
  'CHAYMA-LEADER 1',
  'IMEN SRAIEB',
  'MADIHA BOUBAKER',
  'MARIEM THOUEBTIA'
)
ORDER BY pseudo;

-- Controle global centre sur fonctions 2 et 3
SELECT
  u.fonction,
  COUNT(*) AS nb_utilisateurs
FROM utilisateurs u
WHERE u.fonction IN (2, 3)
  AND u.centre = @id_centre_call_jws
GROUP BY u.fonction
ORDER BY u.fonction;

