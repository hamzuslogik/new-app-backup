-- Accorder aux partenaires (fonction 9) les permissions de créer / voir / détail fiches
-- Exécuter sur la base CRM si la permission n'est pas déjà autorisée pour la fonction 9.

INSERT INTO fonction_permissions (id_fonction, id_permission, autorise)
SELECT 9, p.id, 1
FROM permissions p
WHERE p.code IN ('fiches_create', 'fiches_view', 'fiches_detail')
  AND p.etat = 1
  AND NOT EXISTS (
    SELECT 1
    FROM fonction_permissions fp
    WHERE fp.id_fonction = 9
      AND fp.id_permission = p.id
  );

-- Si une ligne existe déjà avec autorise = 0, la réactiver
UPDATE fonction_permissions fp
INNER JOIN permissions p ON p.id = fp.id_permission
SET fp.autorise = 1
WHERE fp.id_fonction = 9
  AND p.code IN ('fiches_create', 'fiches_view', 'fiches_detail');
