-- Ajouter la permission pour voir toutes les fiches (pour les confirmateurs)
INSERT INTO permissions (code, nom, description, categorie, ordre, etat)
VALUES (
  'VIEW_ALL_FICHES',
  'Voir toutes les fiches',
  'Permet de voir toutes les fiches du système, pas seulement celles assignées au confirmateur',
  'fiches',
  100,
  1
)
ON DUPLICATE KEY UPDATE
  nom = VALUES(nom),
  description = VALUES(description),
  categorie = VALUES(categorie),
  ordre = VALUES(ordre),
  etat = VALUES(etat);

