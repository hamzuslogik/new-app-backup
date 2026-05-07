-- Semaines d’affichage : * = toujours visible ; sinon liste « YYYY-WW,YYYY-WW » (même logique que le planning).
-- Exécuter une seule fois si la table existe déjà sans cette colonne (sinon le serveur applique ensurePlanningAlertsTable).

-- ALTER TABLE planning_alerts
--   ADD COLUMN week_visibility VARCHAR(2048) NOT NULL DEFAULT '*' AFTER visible_functions;
