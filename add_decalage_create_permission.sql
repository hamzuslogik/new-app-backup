-- =====================================================
-- Ajouter la permission pour créer un décalage de RDV
-- =====================================================

USE `crm`;

-- Ajouter la permission pour créer un décalage
INSERT INTO permissions (code, nom, description, categorie, ordre, etat)
VALUES (
  'decalage_create',
  'Créer un décalage de RDV',
  'Permet de créer une demande de décalage de rendez-vous',
  'action',
  101,
  1
)
ON DUPLICATE KEY UPDATE
  nom = VALUES(nom),
  description = VALUES(description),
  categorie = VALUES(categorie),
  ordre = VALUES(ordre),
  etat = VALUES(etat);

-- Par défaut, autoriser cette permission pour :
-- - Les commerciaux (fonction 5)
-- - Les confirmateurs (fonction 6)
-- - Les administrateurs (fonctions 1, 2, 7)
INSERT INTO fonction_permissions (id_fonction, id_permission, autorise)
SELECT f.id, p.id, 1
FROM fonctions f
CROSS JOIN permissions p
WHERE p.code = 'decalage_create'
  AND f.id IN (1, 2, 5, 6, 7)
ON DUPLICATE KEY UPDATE autorise = 1;

-- Vérification
SELECT 
  p.code,
  p.nom,
  p.description,
  GROUP_CONCAT(f.id ORDER BY f.id) as fonctions_autorisees
FROM permissions p
LEFT JOIN fonction_permissions fp ON p.id = fp.id_permission AND fp.autorise = 1
LEFT JOIN fonctions f ON fp.id_fonction = f.id
WHERE p.code = 'decalage_create'
GROUP BY p.id;

