-- =====================================================
-- Ajouter la permission pour rédiger un compte rendu
-- =====================================================

USE `crm`;

-- Ajouter la permission pour rédiger un compte rendu
INSERT INTO permissions (code, nom, description, categorie, ordre, etat)
VALUES (
  'compte_rendu_write',
  'Rédiger un compte rendu',
  'Permet de rédiger un compte rendu lors de la modification d\'une fiche vers un état de Phase 3',
  'action',
  100,
  1
)
ON DUPLICATE KEY UPDATE
  nom = VALUES(nom),
  description = VALUES(description),
  categorie = VALUES(categorie),
  ordre = VALUES(ordre),
  etat = VALUES(etat);

-- Par défaut, autoriser cette permission pour les commerciaux (fonction 5)
-- et les administrateurs (fonctions 1, 2, 7)
INSERT INTO fonction_permissions (id_fonction, id_permission, autorise)
SELECT f.id, p.id, 1
FROM fonctions f
CROSS JOIN permissions p
WHERE p.code = 'compte_rendu_write'
  AND f.id IN (1, 2, 5, 7)
ON DUPLICATE KEY UPDATE autorise = 1;

-- Vérification
SELECT 
  p.code,
  p.nom,
  p.description,
  COUNT(fp.id_fonction) as fonctions_autorisees
FROM permissions p
LEFT JOIN fonction_permissions fp ON p.id = fp.id_permission AND fp.autorise = 1
WHERE p.code = 'compte_rendu_write'
GROUP BY p.id;

