-- =====================================================
-- Mise a jour des chef_equipe depuis liste fournie
-- =====================================================
-- Regles:
-- 1) Affecter chaque agent de la liste a son superviseur (id)
-- 2) Pour les superviseurs cibles, mettre chef_equipe = NULL
--    si l'utilisateur n'existe pas dans la liste fournie
-- =====================================================

USE `crm`;

-- Superviseurs cibles
-- 2742, 3644, 2744, 2697, 2698, 2699

DROP TEMPORARY TABLE IF EXISTS tmp_mapping_chef_equipe_20260416;
CREATE TEMPORARY TABLE tmp_mapping_chef_equipe_20260416 (
  login_normalise VARCHAR(20) NOT NULL,
  id_superviseur INT NOT NULL
);

INSERT INTO tmp_mapping_chef_equipe_20260416 (login_normalise, id_superviseur) VALUES
  ('AG2267', 2742),
  ('AG2191', 2742),
  ('AG2259', 2742),
  ('AG2235', 2742),
  ('AG874', 2742),
  ('AG2261', 2742),
  ('AG2215', 2742),
  ('AG2294', 2742),
  ('AG2290', 2742),
  ('AG2272', 2742),
  ('AG2273', 2742),
  ('AG2300', 2742),
  ('AG2095', 3644),
  ('AG258', 3644),
  ('AG2234', 3644),
  ('AG2253', 3644),
  ('AG710', 3644),
  ('AG1090', 3644),
  ('AG2289', 3644),
  ('AG719', 3644),
  ('AG2194', 3644),
  ('AG2270', 3644),
  ('AG2283', 3644),
  ('AG2297', 3644),
  ('AG2226', 2744),
  ('AG2043', 2744),
  ('AG2204', 2744),
  ('AG717', 2744),
  ('AG1069', 2744),
  ('AG2224', 2744),
  ('AG2072', 2744),
  ('AG2278', 2744),
  ('AG183', 2744),
  ('AG2254', 2744),
  ('AG2256', 2744),
  ('AG560', 2744),
  ('AG1016', 2697),
  ('AG2206', 2697),
  ('AG879', 2697),
  ('AG2230', 2697),
  ('AG2137', 2697),
  ('AG2282', 2697),
  ('AG2175', 2697),
  ('AG2291', 2697),
  ('AG2279', 2697),
  ('AG1028', 2697),
  ('AG391', 2697),
  ('AG2298', 2697),
  ('AG2262', 2698),
  ('AG1088', 2698),
  ('AG2164', 2698),
  ('AG2271', 2698),
  ('AG2011', 2698),
  ('AG2251', 2698),
  ('AG2098', 2698),
  ('AG2281', 2698),
  ('AG2268', 2698),
  ('AG2242', 2698),
  ('AG2299', 2698),
  ('AG2295', 2698),
  ('AG2199', 2699),
  ('AG741', 2699),
  ('AG2096', 2699),
  ('AG2228', 2699),
  ('AG2252', 2699),
  ('AG2192', 2699),
  ('AG2159', 2699),
  ('AG2296', 2699),
  ('AG2287', 2699),
  ('AG2207', 2699),
  ('AG2219', 2699),
  ('AG2089', 2699),
  ('AG2258', 2699);

-- 1) Affectation chef_equipe selon liste
UPDATE utilisateurs u
JOIN tmp_mapping_chef_equipe_20260416 m
  ON (
    TRIM(UPPER(IFNULL(u.login, ''))) = m.login_normalise
    OR TRIM(UPPER(IFNULL(u.pseudo, ''))) = m.login_normalise
  )
SET u.chef_equipe = m.id_superviseur;

SELECT ROW_COUNT() AS nb_agents_affectes_depuis_liste;

-- 2) Nettoyage: pour ces superviseurs, les utilisateurs hors liste passent a NULL
UPDATE utilisateurs u
SET u.chef_equipe = NULL
WHERE u.chef_equipe IN (2742, 3644, 2744, 2697, 2698, 2699)
  AND NOT EXISTS (
    SELECT 1
    FROM tmp_mapping_chef_equipe_20260416 m
    WHERE
      m.login_normalise = TRIM(UPPER(IFNULL(u.login, '')))
      OR m.login_normalise = TRIM(UPPER(IFNULL(u.pseudo, '')))
  );

SELECT ROW_COUNT() AS nb_agents_hors_liste_passes_a_null;

-- Controle final
SELECT
  u.chef_equipe,
  COUNT(*) AS nb_agents
FROM utilisateurs u
WHERE u.chef_equipe IN (2742, 3644, 2744, 2697, 2698, 2699)
GROUP BY u.chef_equipe
ORDER BY u.chef_equipe;

