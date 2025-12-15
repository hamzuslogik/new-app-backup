-- Script pour ajouter la permission de visualisation des décalages
-- Cette permission permet d'accéder à la page de liste des décalages

-- Ajouter la permission si elle n'existe pas
INSERT IGNORE INTO permissions (code, nom, description, categorie, ordre, etat)
VALUES (
  'decalage_view',
  'Voir les décalages',
  'Permet d\'accéder à la page de liste des demandes de décalage',
  'page',
  30,
  1
);

-- Assigner la permission aux fonctions appropriées :
-- - Admins (1, 2, 7) : peuvent voir tous les décalages
-- - Confirmateurs (6) : peuvent voir les décalages où ils sont destinataires
-- - Commerciaux (5) : peuvent voir leurs propres décalages créés

-- Fonction 1 (Admin)
INSERT INTO fonction_permissions (id_fonction, id_permission)
SELECT 1, p.id
FROM permissions p
WHERE p.code = 'decalage_view'
AND NOT EXISTS (
  SELECT 1 FROM fonction_permissions fp 
  WHERE fp.id_fonction = 1 AND fp.id_permission = p.id
);

-- Fonction 2 (Admin)
INSERT INTO fonction_permissions (id_fonction, id_permission)
SELECT 2, p.id
FROM permissions p
WHERE p.code = 'decalage_view'
AND NOT EXISTS (
  SELECT 1 FROM fonction_permissions fp 
  WHERE fp.id_fonction = 2 AND fp.id_permission = p.id
);

-- Fonction 5 (Commercial)
INSERT INTO fonction_permissions (id_fonction, id_permission)
SELECT 5, p.id
FROM permissions p
WHERE p.code = 'decalage_view'
AND NOT EXISTS (
  SELECT 1 FROM fonction_permissions fp 
  WHERE fp.id_fonction = 5 AND fp.id_permission = p.id
);

-- Fonction 6 (Confirmateur)
INSERT INTO fonction_permissions (id_fonction, id_permission)
SELECT 6, p.id
FROM permissions p
WHERE p.code = 'decalage_view'
AND NOT EXISTS (
  SELECT 1 FROM fonction_permissions fp 
  WHERE fp.id_fonction = 6 AND fp.id_permission = p.id
);

-- Fonction 7 (Dev/Admin)
INSERT INTO fonction_permissions (id_fonction, id_permission)
SELECT 7, p.id
FROM permissions p
WHERE p.code = 'decalage_view'
AND NOT EXISTS (
  SELECT 1 FROM fonction_permissions fp 
  WHERE fp.id_fonction = 7 AND fp.id_permission = p.id
);

-- Vérification
SELECT 
  'Permission decalage_view créée et assignée' AS message,
  COUNT(*) AS fonctions_avec_permission
FROM fonction_permissions fp
JOIN permissions p ON fp.id_permission = p.id
WHERE p.code = 'decalage_view';

