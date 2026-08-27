-- Diagnostic écart Statistiques vs Fiches (Production Qualif)
-- Période exemple : 26/08/2026 00:00:00 → 23:59:59
-- Remplacer @date_debut / @date_fin si besoin.

SET @date_debut = '2026-08-26 00:00:00';
SET @date_fin   = '2026-08-26 23:59:59';

-- Agents sous superviseurs (périmètre stats production-qualif)
CREATE TEMPORARY TABLE IF NOT EXISTS tmp_agents_prod_qualif AS
SELECT DISTINCT agents.id AS id_agent
FROM utilisateurs agents
INNER JOIN utilisateurs sup ON agents.chef_equipe = sup.id AND sup.etat > 0
WHERE agents.fonction = 3
  AND agents.etat > 0
  AND EXISTS (
    SELECT 1 FROM utilisateurs a2
    WHERE a2.chef_equipe = sup.id AND a2.fonction = 3 AND a2.etat > 0
  );

-- Filtres ONGLET STATISTIQUES (ancienne logique — avant alignement)
SELECT 'stats_ancien_total' AS mesure, COUNT(*) AS nb
FROM fiches f
INNER JOIN tmp_agents_prod_qualif aq ON aq.id_agent = f.id_agent
WHERE f.date_insert_time >= @date_debut AND f.date_insert_time <= @date_fin
  AND (f.archive = 0 OR f.archive IS NULL)
  AND f.date_insert_time IS NOT NULL;

-- Filtres ONGLET FICHES (logique cible / après alignement)
SELECT 'fiches_total' AS mesure, COUNT(*) AS nb
FROM fiches f
INNER JOIN tmp_agents_prod_qualif aq ON aq.id_agent = f.id_agent
WHERE f.date_insert_time >= @date_debut AND f.date_insert_time <= @date_fin
  AND f.active = 1
  AND f.archive = 0
  AND f.date_insert_time IS NOT NULL
  AND f.date_insert_time != '';

-- KO : ancien stats vs fiches
SELECT 'stats_ancien_ko' AS mesure, COUNT(*) AS nb
FROM fiches f
INNER JOIN tmp_agents_prod_qualif aq ON aq.id_agent = f.id_agent
WHERE f.ko = 1
  AND f.date_insert_time >= @date_debut AND f.date_insert_time <= @date_fin
  AND (f.archive = 0 OR f.archive IS NULL)
  AND f.date_insert_time IS NOT NULL;

SELECT 'fiches_ko' AS mesure, COUNT(*) AS nb
FROM fiches f
INNER JOIN tmp_agents_prod_qualif aq ON aq.id_agent = f.id_agent
WHERE f.ko = 1
  AND f.date_insert_time >= @date_debut AND f.date_insert_time <= @date_fin
  AND f.active = 1
  AND f.archive = 0
  AND f.date_insert_time IS NOT NULL
  AND f.date_insert_time != '';

-- Fiches présentes en stats (ancien) mais absentes de l'onglet Fiches
SELECT f.id, f.nom, f.prenom, f.id_agent, f.id_etat_final, f.ko, f.active, f.archive, f.date_insert_time,
       CASE
         WHEN f.active != 1 THEN 'active != 1'
         WHEN f.archive IS NULL THEN 'archive IS NULL'
         WHEN f.archive != 0 THEN 'archive != 0'
         WHEN f.date_insert_time = '' THEN 'date_insert_time vide'
         WHEN aq.id_agent IS NULL THEN 'agent hors périmètre superviseur'
         ELSE 'autre'
       END AS raison_ecart
FROM fiches f
LEFT JOIN tmp_agents_prod_qualif aq ON aq.id_agent = f.id_agent
WHERE f.date_insert_time >= @date_debut AND f.date_insert_time <= @date_fin
  AND (f.archive = 0 OR f.archive IS NULL)
  AND f.date_insert_time IS NOT NULL
  AND (
    f.active != 1
    OR f.archive IS NULL
    OR f.archive != 0
    OR f.date_insert_time = ''
    OR aq.id_agent IS NULL
  );

-- Agents qualification sans superviseur (exclus stats, inclus ancien onglet Fiches admin)
SELECT agents.id, agents.pseudo, agents.chef_equipe
FROM utilisateurs agents
WHERE agents.fonction = 3 AND agents.etat > 0
  AND agents.id NOT IN (SELECT id_agent FROM tmp_agents_prod_qualif);

DROP TEMPORARY TABLE IF EXISTS tmp_agents_prod_qualif;
