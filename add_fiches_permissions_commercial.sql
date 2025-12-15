-- =====================================================
-- Activer les permissions pour les commerciaux (fonction 5)
-- pour consulter et modifier les fiches (RDV)
-- =====================================================

USE `crm`;

-- 1. S'assurer que les permissions existent
-- Permission pour voir la liste des fiches
INSERT INTO permissions (code, nom, description, categorie, ordre, etat)
VALUES (
  'fiches_view',
  'Voir la liste des fiches',
  'Permet d\'accéder à la page de liste des fiches et de les consulter',
  'page',
  2,
  1
)
ON DUPLICATE KEY UPDATE
  nom = VALUES(nom),
  description = VALUES(description),
  categorie = VALUES(categorie),
  ordre = VALUES(ordre),
  etat = VALUES(etat);

-- Permission pour voir le détail d'une fiche
INSERT INTO permissions (code, nom, description, categorie, ordre, etat)
VALUES (
  'fiches_detail',
  'Voir le détail d\'une fiche',
  'Permet d\'accéder à la page de détail d\'une fiche et de consulter toutes ses informations',
  'page',
  3,
  1
)
ON DUPLICATE KEY UPDATE
  nom = VALUES(nom),
  description = VALUES(description),
  categorie = VALUES(categorie),
  ordre = VALUES(ordre),
  etat = VALUES(etat);

-- Permission pour modifier une fiche
INSERT INTO permissions (code, nom, description, categorie, ordre, etat)
VALUES (
  'fiches_edit',
  'Modifier une fiche',
  'Permet de modifier les informations d\'une fiche (uniquement ses propres fiches pour les commerciaux)',
  'action',
  10,
  1
)
ON DUPLICATE KEY UPDATE
  nom = VALUES(nom),
  description = VALUES(description),
  categorie = VALUES(categorie),
  ordre = VALUES(ordre),
  etat = VALUES(etat);

-- 2. Activer ces permissions pour les commerciaux (fonction 5)
INSERT INTO fonction_permissions (id_fonction, id_permission, autorise)
SELECT f.id, p.id, 1
FROM fonctions f
CROSS JOIN permissions p
WHERE p.code IN ('fiches_view', 'fiches_detail', 'fiches_edit')
  AND f.id = 5  -- Fonction 5 = Commercial
ON DUPLICATE KEY UPDATE autorise = 1;

-- 3. Vérification : Afficher les permissions activées pour les commerciaux
SELECT 
  p.code,
  p.nom,
  p.description,
  p.categorie,
  f.titre as fonction,
  fp.autorise
FROM permissions p
INNER JOIN fonction_permissions fp ON p.id = fp.id_permission
INNER JOIN fonctions f ON fp.id_fonction = f.id
WHERE p.code IN ('fiches_view', 'fiches_detail', 'fiches_edit')
  AND f.id = 5
ORDER BY p.ordre;

-- Message de confirmation
SELECT 
  'Permissions activées pour les commerciaux (fonction 5)' AS message,
  COUNT(*) AS nombre_permissions_actives
FROM fonction_permissions fp
INNER JOIN permissions p ON fp.id_permission = p.id
INNER JOIN fonctions f ON fp.id_fonction = f.id
WHERE p.code IN ('fiches_view', 'fiches_detail', 'fiches_edit')
  AND f.id = 5
  AND fp.autorise = 1;

