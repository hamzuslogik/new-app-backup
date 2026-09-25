-- Cron journalier : présence 8h (coefficient 1) pour chaque agent qualification.
-- N'écrase jamais une ligne déjà présente (absence / départ).
--
-- Crontab exemple (lun–ven à 06:00) :
-- 0 6 * * 1-5 mysql -h HOST -u USER -p'PASS' NOM_BDD < /chemin/cron_presence_agents_qualif_quotidien.sql

INSERT INTO presence_agents_qualif (
  id_agent,
  id_superviseur,
  date_jour,
  type,
  heure_depart,
  coefficient_presence,
  heures_travaillees,
  heures_prevues,
  created_at,
  updated_at
)
SELECT
  u.id,
  COALESCE(u.chef_equipe, 0),
  CURDATE(),
  'present',
  NULL,
  1.0000,
  8.00,
  8.00,
  NOW(),
  NOW()
FROM utilisateurs u
WHERE u.fonction = 3
  AND (u.etat > 0 OR u.etat IS NULL)
  AND NOT EXISTS (
    SELECT 1
    FROM presence_agents_qualif p
    WHERE p.id_agent = u.id
      AND p.date_jour = CURDATE()
  );
