-- =====================================================
-- Agents qualité qualification (fonction 8)
-- =====================================================
-- Crée les comptes manquants et force fonction = 8 pour la liste ci-dessous.
-- À exécuter sur la base `crm` avant utilisation des stats / alertes / remarques.
-- =====================================================

USE `crm`;

SET @fonction_qualite = 8;
SET @etat_actif = 1;

SET SQL_SAFE_UPDATES = 0;

DROP TEMPORARY TABLE IF EXISTS tmp_qualite_qualification_pseudo;
CREATE TEMPORARY TABLE tmp_qualite_qualification_pseudo (
  pseudo VARCHAR(80) NOT NULL PRIMARY KEY
) ENGINE=MEMORY;

INSERT INTO tmp_qualite_qualification_pseudo (pseudo) VALUES
  ('QUALITE9'),
  ('HAITHEM'),
  ('AZIZA'),
  ('QUALITE3'),
  ('QUALITE6'),
  ('QUALITE4'),
  ('Q_AMINE'),
  ('QUALITE7'),
  ('QUALITE8'),
  ('TECHNIQUE'),
  ('RE_MALEK'),
  ('Q_LEAD_PAC'),
  ('AD_MAHMOUD');

-- Comptes manquants (pseudo = login)
INSERT INTO utilisateurs (nom, prenom, pseudo, login, etat, fonction)
SELECT
  t.pseudo AS nom,
  '' AS prenom,
  t.pseudo AS pseudo,
  t.pseudo AS login,
  @etat_actif AS etat,
  @fonction_qualite AS fonction
FROM tmp_qualite_qualification_pseudo t
WHERE NOT EXISTS (
  SELECT 1
  FROM utilisateurs u
  WHERE TRIM(UPPER(u.pseudo)) = TRIM(UPPER(t.pseudo))
     OR TRIM(UPPER(u.login)) = TRIM(UPPER(t.pseudo))
);

-- Homologuer la fonction qualité qualification sur les comptes existants
UPDATE utilisateurs u
INNER JOIN tmp_qualite_qualification_pseudo t
  ON TRIM(UPPER(u.pseudo)) = TRIM(UPPER(t.pseudo))
  OR TRIM(UPPER(u.login)) = TRIM(UPPER(t.pseudo))
SET
  u.fonction = @fonction_qualite,
  u.etat = @etat_actif,
  u.pseudo = TRIM(t.pseudo),
  u.login = TRIM(t.pseudo);

SELECT
  u.id,
  u.pseudo,
  u.login,
  u.fonction,
  u.etat
FROM utilisateurs u
INNER JOIN tmp_qualite_qualification_pseudo t
  ON TRIM(UPPER(u.pseudo)) = TRIM(UPPER(t.pseudo))
ORDER BY u.pseudo ASC;
