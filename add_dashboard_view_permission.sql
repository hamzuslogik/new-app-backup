USE `crm`;

-- Ajouter la permission pour afficher le tableau des confirmateurs et les onglets dans le dashboard
INSERT INTO permissions (code, nom, description, categorie, ordre, etat)
VALUES (
  'dashboard_view_confirmateurs_tabs',
  'Afficher tableau confirmateurs et onglets dashboard',
  'Permet d\'afficher le tableau des confirmateurs avec leurs RDV et les onglets (CONFIRMER/PRE-CONFIRMER et Fiches créées) dans le dashboard',
  'view',
  120,
  1
)
ON DUPLICATE KEY UPDATE
  nom = VALUES(nom),
  description = VALUES(description),
  categorie = VALUES(categorie),
  ordre = VALUES(ordre),
  etat = VALUES(etat);

-- Attribuer la permission aux fonctions appropriées (admins, confirmateurs, etc.)
-- Par défaut, on l'attribue aux fonctions 1, 2, 6, 7 (admins et confirmateurs)
-- Vous pouvez modifier cette liste selon vos besoins
INSERT INTO fonction_permissions (id_fonction, id_permission, autorise)
SELECT f.id, p.id, 1
FROM fonctions f
CROSS JOIN permissions p
WHERE p.code = 'dashboard_view_confirmateurs_tabs'
  AND f.id IN (1, 2, 6, 7) -- Admins et confirmateurs
ON DUPLICATE KEY UPDATE autorise = 1;

