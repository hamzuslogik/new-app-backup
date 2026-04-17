-- =====================================================
-- Mise a jour utilisateurs qualification (16/04/2026)
-- =====================================================
-- Objectif:
-- 1) Garantir l'existence des superviseurs qualification
-- 2) Creer les agents qualification manquants
-- 3) Uniformiser pseudo/login des agents au format AGxxxx
-- 4) Rattacher chaque agent a son superviseur via chef_equipe
-- =====================================================

USE `crm`;

SET @fonction_agent_qualite = 3;
SET @etat_actif = 1;

-- -----------------------------------------------------------------
-- A) Source superviseurs
-- -----------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_superviseurs_qualif_20260416;
CREATE TEMPORARY TABLE tmp_superviseurs_qualif_20260416 (
  supervisor_key VARCHAR(40) NOT NULL,
  supervisor_full_name VARCHAR(255) NOT NULL
);

INSERT INTO tmp_superviseurs_qualif_20260416 (supervisor_key, supervisor_full_name) VALUES
  ('MADIHA', 'MADIHA BOUBAKER'),
  ('MARIEM', 'MARIEM THOUEBTIA'),
  ('IMEN', 'IMEN SRAIEB'),
  ('CHAIMA', 'CHAYMA-LEADER 1'),
  ('ANOUAR', 'ANOUAR-LEADER 2'),
  ('BELHASSEN', 'BELHASSEN-LEADER 3');

DROP TEMPORARY TABLE IF EXISTS tmp_superviseurs_resolus_20260416;
CREATE TEMPORARY TABLE tmp_superviseurs_resolus_20260416 (
  supervisor_key VARCHAR(40) NOT NULL,
  supervisor_full_name VARCHAR(255) NOT NULL,
  id_superviseur INT NULL
);

INSERT INTO tmp_superviseurs_resolus_20260416 (supervisor_key, supervisor_full_name, id_superviseur)
SELECT
  s.supervisor_key,
  s.supervisor_full_name,
  (
    SELECT u.id
    FROM utilisateurs u
    WHERE
      TRIM(UPPER(IFNULL(u.pseudo, ''))) = TRIM(UPPER(s.supervisor_full_name))
      OR TRIM(UPPER(IFNULL(u.login, ''))) = TRIM(UPPER(REPLACE(s.supervisor_full_name, ' ', '.')))
      OR (
        TRIM(UPPER(IFNULL(u.prenom, ''))) = TRIM(UPPER(
          CASE
            WHEN INSTR(TRIM(s.supervisor_full_name), ' ') > 0
              THEN SUBSTRING(TRIM(s.supervisor_full_name), 1, LENGTH(TRIM(s.supervisor_full_name)) - LENGTH(SUBSTRING_INDEX(TRIM(s.supervisor_full_name), ' ', -1)) - 1)
            ELSE TRIM(s.supervisor_full_name)
          END
        ))
        AND TRIM(UPPER(IFNULL(u.nom, ''))) = TRIM(UPPER(
          CASE
            WHEN INSTR(TRIM(s.supervisor_full_name), ' ') > 0
              THEN SUBSTRING_INDEX(TRIM(s.supervisor_full_name), ' ', -1)
            ELSE ''
          END
        ))
      )
    LIMIT 1
  ) AS id_superviseur
FROM tmp_superviseurs_qualif_20260416 s;

INSERT INTO utilisateurs (nom, prenom, pseudo, login, etat)
SELECT
  CASE
    WHEN INSTR(TRIM(sr.supervisor_full_name), ' ') > 0
      THEN SUBSTRING_INDEX(TRIM(sr.supervisor_full_name), ' ', -1)
    ELSE ''
  END AS nom,
  CASE
    WHEN INSTR(TRIM(sr.supervisor_full_name), ' ') > 0
      THEN SUBSTRING(TRIM(sr.supervisor_full_name), 1, LENGTH(TRIM(sr.supervisor_full_name)) - LENGTH(SUBSTRING_INDEX(TRIM(sr.supervisor_full_name), ' ', -1)) - 1)
    ELSE TRIM(sr.supervisor_full_name)
  END AS prenom,
  LOWER(TRIM(sr.supervisor_full_name)) AS pseudo,
  LOWER(REPLACE(TRIM(sr.supervisor_full_name), ' ', '.')) AS login,
  @etat_actif AS etat
FROM tmp_superviseurs_resolus_20260416 sr
WHERE sr.id_superviseur IS NULL;

UPDATE tmp_superviseurs_resolus_20260416 sr
JOIN utilisateurs u
  ON (
    TRIM(UPPER(IFNULL(u.pseudo, ''))) = TRIM(UPPER(sr.supervisor_full_name))
    OR TRIM(UPPER(IFNULL(u.login, ''))) = TRIM(UPPER(REPLACE(sr.supervisor_full_name, ' ', '.')))
  )
SET sr.id_superviseur = u.id
WHERE sr.id_superviseur IS NULL;

UPDATE utilisateurs u
JOIN tmp_superviseurs_resolus_20260416 sr ON sr.id_superviseur = u.id
SET
  u.etat = @etat_actif;

-- -----------------------------------------------------------------
-- B) Source agents (superviseur + login + nom complet)
-- -----------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_agents_qualif_20260416;
CREATE TEMPORARY TABLE tmp_agents_qualif_20260416 (
  supervisor_key VARCHAR(40) NOT NULL,
  login_source VARCHAR(20) NOT NULL,
  agent_full_name VARCHAR(255) NOT NULL
);

INSERT INTO tmp_agents_qualif_20260416 (supervisor_key, login_source, agent_full_name) VALUES
  ('MADIHA', '2267', 'DALILA KHLIFA'),
  ('MADIHA', '2191', 'IMEN SEHLI'),
  ('MADIHA', '2259', 'EMNA FEYDI'),
  ('MADIHA', '2235', 'BASMA JLASSI'),
  ('MADIHA', '874', 'RAHALI SALWA'),
  ('MADIHA', '2261', 'EMNA GARCI'),
  ('MADIHA', '2215', 'INES ZORGATI'),
  ('MADIHA', '2294', 'INTISSAR MTAR'),
  ('MADIHA', '2290', 'EMNA MGHIRI'),
  ('MADIHA', '2272', 'HEDIA OUERTANI'),
  ('MADIHA', '2273', 'FATMA MANAI'),
  ('MADIHA', '2300', 'Nouha Oueslati'),
  ('MARIEM', '2095', 'RACHIDA CHATTI'),
  ('MARIEM', '258', 'SAFA FKIH'),
  ('MARIEM', '2234', 'CHAIMA TOUATI'),
  ('MARIEM', '2253', 'FATEN BEN MOUSSA'),
  ('MARIEM', '710', 'JANDOUBI MARIEM'),
  ('MARIEM', '1090', 'HAMZA SGHAIRI'),
  ('MARIEM', '2289', 'WASSIM EZZIDNI'),
  ('MARIEM', '719', 'ZAINEB MOHSNI'),
  ('MARIEM', '2194', 'HANA MASSOUD'),
  ('MARIEM', '2270', 'LINDA LASTA'),
  ('MARIEM', '2283', 'BEN AMEUR SAFA'),
  ('MARIEM', '2297', 'HAKIM AISSAOUI'),
  ('IMEN', '2226', 'SAMIA TORKHANI'),
  ('IMEN', '2043', 'JIHEN OUESLATI'),
  ('IMEN', '2204', 'AWATEF ATHIMI'),
  ('IMEN', '717', 'DALY SALIM'),
  ('IMEN', '1069', 'SABRINE ZRIBI'),
  ('IMEN', '2224', 'MARIEM ZAGHDOUDI'),
  ('IMEN', '2072', 'BOUKARI KAWTHER'),
  ('IMEN', '2278', 'AMENI MNAREK'),
  ('IMEN', '183', 'WAAD GHRIBI'),
  ('IMEN', '2254', 'HIBA JBELI'),
  ('IMEN', '2256', 'ARIJ CHERIF'),
  ('IMEN', '560', 'NAIMA KHAMESSI'),
  ('CHAIMA', 'AG1016', 'MANEL BEN AYECH'),
  ('CHAIMA', 'AG2206', 'SAFA BEN FRADJ'),
  ('CHAIMA', 'AG879', 'Tlibia Sameh'),
  ('CHAIMA', 'AG2230', 'AISSIA WERGHI'),
  ('CHAIMA', 'AG2137', 'NAHLA FERCHICI'),
  ('CHAIMA', 'AG2282', 'ILHEM AYARI'),
  ('CHAIMA', 'AG2175', 'IMEN KSOURI MEDDEB'),
  ('CHAIMA', 'AG2291', 'NEDIA CHAHEB'),
  ('CHAIMA', 'AG2279', 'OUMAIMA MARZOUKI'),
  ('CHAIMA', 'AG1028', 'Oumayma Soumri'),
  ('CHAIMA', 'AG391', 'MAYEDA BOUNEB'),
  ('CHAIMA', 'AG2298', 'NOUR SGHAIER'),
  ('ANOUAR', 'AG2262', 'NOUR BEN KHLIL'),
  ('ANOUAR', 'AG1088', 'SONIA SLITI'),
  ('ANOUAR', 'AG2164', 'NEILA OUICHKA'),
  ('ANOUAR', 'AG2271', 'Maram trabelssi'),
  ('ANOUAR', 'AG2011', 'BEN DHIF SALMA'),
  ('ANOUAR', 'AG2251', 'CHAIMA KLAI'),
  ('ANOUAR', 'AG2098', 'Oumayma Dhiab'),
  ('ANOUAR', 'AG2281', 'Taoufik Baroudi'),
  ('ANOUAR', 'AG2268', 'Sabrine MANNAI'),
  ('ANOUAR', 'AG2242', 'Akrem Bougerra'),
  ('ANOUAR', 'AG2299', 'Faiza Laabidi'),
  ('ANOUAR', 'AG2295', 'Ouni Nessrine'),
  ('BELHASSEN', 'AG2199', 'LINA KHAMMAR'),
  ('BELHASSEN', 'AG741', 'Dorra selmi'),
  ('BELHASSEN', 'AG2096', 'JIHEN SALLEMI'),
  ('BELHASSEN', 'AG2228', 'AYCHA HADDAD'),
  ('BELHASSEN', 'AG2252', 'SALHI NOURA'),
  ('BELHASSEN', 'AG2192', 'MARIEM BAHRI'),
  ('BELHASSEN', 'AG2159', 'Imen Belhaj Saad'),
  ('BELHASSEN', 'AG2296', 'Amenallah Saddi'),
  ('BELHASSEN', 'AG2287', 'YOSSRA DELY'),
  ('BELHASSEN', 'AG2207', 'INES HAMEMI'),
  ('BELHASSEN', 'AG2219', 'NOURHENE CHERNI'),
  ('BELHASSEN', 'AG2089', 'Asma Boughanmi'),
  ('BELHASSEN', 'AG2258', 'CHIRINE HAMZEOUI');

-- Harmoniser explicitement l'ancien pseudo superviseur
UPDATE utilisateurs
SET
  pseudo = 'MARIEM THOUEBTIA',
  login = 'mariem.thouebtia',
  etat = @etat_actif
WHERE TRIM(UPPER(IFNULL(pseudo, ''))) = 'MARIEM HAMDAN';

-- -----------------------------------------------------------------
-- B-2) Reparer la fonction des superviseurs (si elle a ete remplacee)
-- Source prioritaire: yj_utilisateur.fonction
-- -----------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_superviseurs_fonction_source_20260416;
CREATE TEMPORARY TABLE tmp_superviseurs_fonction_source_20260416 (
  supervisor_key VARCHAR(40) NOT NULL,
  fonction_source INT NULL
);

INSERT INTO tmp_superviseurs_fonction_source_20260416 (supervisor_key, fonction_source)
SELECT
  sr.supervisor_key,
  (
    SELECT yj.fonction
    FROM yj_utilisateur yj
    WHERE
      TRIM(UPPER(IFNULL(yj.login, ''))) = TRIM(UPPER(sr.supervisor_full_name))
      OR TRIM(UPPER(IFNULL(yj.vrai_nom, ''))) = TRIM(UPPER(sr.supervisor_full_name))
      OR TRIM(UPPER(CONCAT(IFNULL(yj.prenom, ''), ' ', IFNULL(yj.nom, '')))) = TRIM(UPPER(sr.supervisor_full_name))
      OR (
        sr.supervisor_key = 'MARIEM'
        AND (
          TRIM(UPPER(IFNULL(yj.login, ''))) = 'MARIEM HAMDAN'
          OR TRIM(UPPER(IFNULL(yj.vrai_nom, ''))) = 'MARIEM HAMDAN'
          OR TRIM(UPPER(CONCAT(IFNULL(yj.prenom, ''), ' ', IFNULL(yj.nom, '')))) = 'MARIEM HAMDAN'
        )
      )
    ORDER BY yj.etat DESC, yj.id DESC
    LIMIT 1
  ) AS fonction_source
FROM tmp_superviseurs_resolus_20260416 sr;

UPDATE utilisateurs u
JOIN tmp_superviseurs_resolus_20260416 sr ON sr.id_superviseur = u.id
JOIN tmp_superviseurs_fonction_source_20260416 fs ON fs.supervisor_key = sr.supervisor_key
SET u.fonction = fs.fonction_source
WHERE fs.fonction_source IS NOT NULL;

-- -----------------------------------------------------------------
-- C) Creer les agents manquants
-- -----------------------------------------------------------------
INSERT INTO utilisateurs (nom, prenom, pseudo, login, etat, fonction, chef_equipe)
SELECT
  TRIM(SUBSTRING_INDEX(t.agent_full_name, ' ', -1)) AS nom,
  TRIM(
    CASE
      WHEN INSTR(TRIM(t.agent_full_name), ' ') > 0
        THEN SUBSTRING(TRIM(t.agent_full_name), 1, LENGTH(TRIM(t.agent_full_name)) - LENGTH(SUBSTRING_INDEX(TRIM(t.agent_full_name), ' ', -1)) - 1)
      ELSE TRIM(t.agent_full_name)
    END
  ) AS prenom,
  CONCAT('AG', REPLACE(UPPER(t.login_source), 'AG', '')) AS pseudo,
  CONCAT('AG', REPLACE(UPPER(t.login_source), 'AG', '')) AS login,
  @etat_actif AS etat,
  @fonction_agent_qualite AS fonction,
  sr.id_superviseur AS chef_equipe
FROM tmp_agents_qualif_20260416 t
JOIN tmp_superviseurs_resolus_20260416 sr ON sr.supervisor_key = t.supervisor_key
WHERE NOT EXISTS (
  SELECT 1
  FROM utilisateurs u
  WHERE
    TRIM(UPPER(IFNULL(u.login, ''))) = TRIM(UPPER(CONCAT('AG', REPLACE(UPPER(t.login_source), 'AG', ''))))
    OR TRIM(UPPER(IFNULL(u.pseudo, ''))) = TRIM(UPPER(CONCAT('AG', REPLACE(UPPER(t.login_source), 'AG', ''))))
    OR (
      TRIM(UPPER(IFNULL(u.prenom, ''))) = TRIM(UPPER(
        CASE
          WHEN INSTR(TRIM(t.agent_full_name), ' ') > 0
            THEN SUBSTRING(TRIM(t.agent_full_name), 1, LENGTH(TRIM(t.agent_full_name)) - LENGTH(SUBSTRING_INDEX(TRIM(t.agent_full_name), ' ', -1)) - 1)
          ELSE TRIM(t.agent_full_name)
        END
      ))
      AND TRIM(UPPER(IFNULL(u.nom, ''))) = TRIM(UPPER(SUBSTRING_INDEX(TRIM(t.agent_full_name), ' ', -1)))
    )
);

-- -----------------------------------------------------------------
-- D) Mettre a jour les agents existants (login/pseudo + rattachement)
-- -----------------------------------------------------------------
UPDATE utilisateurs u
JOIN tmp_agents_qualif_20260416 t
  ON (
    TRIM(UPPER(IFNULL(u.login, ''))) = TRIM(UPPER(CONCAT('AG', REPLACE(UPPER(t.login_source), 'AG', ''))))
    OR TRIM(UPPER(IFNULL(u.pseudo, ''))) = TRIM(UPPER(CONCAT('AG', REPLACE(UPPER(t.login_source), 'AG', ''))))
    OR (
      TRIM(UPPER(IFNULL(u.prenom, ''))) = TRIM(UPPER(
        CASE
          WHEN INSTR(TRIM(t.agent_full_name), ' ') > 0
            THEN SUBSTRING(TRIM(t.agent_full_name), 1, LENGTH(TRIM(t.agent_full_name)) - LENGTH(SUBSTRING_INDEX(TRIM(t.agent_full_name), ' ', -1)) - 1)
          ELSE TRIM(t.agent_full_name)
        END
      ))
      AND TRIM(UPPER(IFNULL(u.nom, ''))) = TRIM(UPPER(SUBSTRING_INDEX(TRIM(t.agent_full_name), ' ', -1)))
    )
  )
JOIN tmp_superviseurs_resolus_20260416 sr ON sr.supervisor_key = t.supervisor_key
SET
  u.nom = TRIM(SUBSTRING_INDEX(t.agent_full_name, ' ', -1)),
  u.prenom = TRIM(
    CASE
      WHEN INSTR(TRIM(t.agent_full_name), ' ') > 0
        THEN SUBSTRING(TRIM(t.agent_full_name), 1, LENGTH(TRIM(t.agent_full_name)) - LENGTH(SUBSTRING_INDEX(TRIM(t.agent_full_name), ' ', -1)) - 1)
      ELSE TRIM(t.agent_full_name)
    END
  ),
  u.pseudo = CONCAT('AG', REPLACE(UPPER(t.login_source), 'AG', '')),
  u.login = CONCAT('AG', REPLACE(UPPER(t.login_source), 'AG', '')),
  u.etat = @etat_actif,
  u.fonction = @fonction_agent_qualite,
  u.chef_equipe = sr.id_superviseur;

-- -----------------------------------------------------------------
-- E) Controles
-- -----------------------------------------------------------------
SELECT
  sr.supervisor_key,
  sr.supervisor_full_name,
  sr.id_superviseur,
  u.fonction AS fonction_superviseur
FROM tmp_superviseurs_resolus_20260416 sr
LEFT JOIN utilisateurs u ON u.id = sr.id_superviseur
ORDER BY sr.supervisor_key;

SELECT
  t.supervisor_key,
  u.id,
  u.nom,
  u.prenom,
  u.pseudo,
  u.login,
  u.fonction,
  u.chef_equipe,
  CASE WHEN u.chef_equipe = sr.id_superviseur THEN 'OK' ELSE 'KO' END AS rattachement_superviseur
FROM tmp_agents_qualif_20260416 t
JOIN tmp_superviseurs_resolus_20260416 sr ON sr.supervisor_key = t.supervisor_key
JOIN utilisateurs u
  ON TRIM(UPPER(IFNULL(u.login, ''))) = TRIM(UPPER(CONCAT('AG', REPLACE(UPPER(t.login_source), 'AG', ''))))
ORDER BY t.supervisor_key, u.login;

