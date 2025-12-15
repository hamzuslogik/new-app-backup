-- Ajouter la permission pour voir le groupe d'états 0
-- Groupe 0 : États spéciaux
INSERT INTO permissions (code, nom, description, categorie, ordre, etat)
VALUES (
  'VIEW_ETAT_GROUP_0',
  'Voir les états Groupe 0',
  'Permet de voir les fiches avec des états du groupe 0 (États spéciaux)',
  'etats',
  5,
  1
)
ON DUPLICATE KEY UPDATE
  nom = VALUES(nom),
  description = VALUES(description),
  categorie = VALUES(categorie),
  ordre = VALUES(ordre),
  etat = VALUES(etat);

