USE `crm`;

-- Ajouter la permission pour la page Planning Dép (planning par département)
INSERT INTO permissions (code, nom, description, categorie, ordre, etat)
VALUES (
  'planning_dep_view',
  'Voir le planning par département',
  'Permet d\'accéder à la page Planning Dép (planning par département / code postal)',
  'page',
  9,
  1
)
ON DUPLICATE KEY UPDATE
  nom = VALUES(nom),
  description = VALUES(description),
  categorie = VALUES(categorie),
  ordre = VALUES(ordre),
  etat = VALUES(etat);

-- Attribuer la permission aux fonctions qui ont déjà planning_view (admins, confirmateurs, RE/RP confirmation, etc.)
INSERT INTO fonction_permissions (id_fonction, id_permission, autorise)
SELECT f.id, p.id, 1
FROM fonctions f
CROSS JOIN permissions p
WHERE p.code = 'planning_dep_view'
  AND f.id IN (
    SELECT id_fonction FROM fonction_permissions fp
    JOIN permissions perm ON perm.id = fp.id_permission
    WHERE perm.code = 'planning_view' AND fp.autorise = 1
  )
ON DUPLICATE KEY UPDATE autorise = 1;
