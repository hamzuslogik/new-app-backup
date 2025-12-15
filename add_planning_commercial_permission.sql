USE `crm`;

-- Ajouter la permission pour accéder au planning commercial
INSERT INTO permissions (code, nom, description, categorie, ordre, etat)
VALUES (
  'planning_commercial_view',
  'Voir le planning commercial',
  'Permet d\'accéder à la page Planning Commercial pour voir les RDV confirmés affectés aux commerciaux',
  'view',
  130,
  1
)
ON DUPLICATE KEY UPDATE
  nom = VALUES(nom),
  description = VALUES(description),
  categorie = VALUES(categorie),
  ordre = VALUES(ordre),
  etat = VALUES(etat);

-- Attribuer la permission aux fonctions appropriées
-- Par défaut, on l'attribue aux fonctions 1, 2, 5, 7 (admins et commerciaux)
-- Vous pouvez modifier cette liste selon vos besoins
INSERT INTO fonction_permissions (id_fonction, id_permission, autorise)
SELECT f.id, p.id, 1
FROM fonctions f
CROSS JOIN permissions p
WHERE p.code = 'planning_commercial_view'
  AND f.id IN (1, 2, 5, 7) -- Admins et commerciaux
ON DUPLICATE KEY UPDATE autorise = 1;

