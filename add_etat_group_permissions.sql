-- Ajouter les permissions pour voir les groupes d'états
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

-- Phase 1 : États initiaux (Nouveau, Confirmé, etc.)
INSERT INTO permissions (code, nom, description, categorie, ordre, etat)
VALUES (
  'VIEW_ETAT_GROUP_1',
  'Voir les états Phase 1',
  'Permet de voir les fiches avec des états du groupe Phase 1 (États initiaux)',
  'etats',
  10,
  1
)
ON DUPLICATE KEY UPDATE
  nom = VALUES(nom),
  description = VALUES(description),
  categorie = VALUES(categorie),
  ordre = VALUES(ordre),
  etat = VALUES(etat);

-- Phase 2 : États de rendez-vous (RDV Planifié, Validé, etc.)
INSERT INTO permissions (code, nom, description, categorie, ordre, etat)
VALUES (
  'VIEW_ETAT_GROUP_2',
  'Voir les états Phase 2',
  'Permet de voir les fiches avec des états du groupe Phase 2 (États de rendez-vous)',
  'etats',
  20,
  1
)
ON DUPLICATE KEY UPDATE
  nom = VALUES(nom),
  description = VALUES(description),
  categorie = VALUES(categorie),
  ordre = VALUES(ordre),
  etat = VALUES(etat);

-- Phase 3 : États finaux (Signé, Refusé, Annulé, etc.)
INSERT INTO permissions (code, nom, description, categorie, ordre, etat)
VALUES (
  'VIEW_ETAT_GROUP_3',
  'Voir les états Phase 3',
  'Permet de voir les fiches avec des états du groupe Phase 3 (États finaux)',
  'etats',
  30,
  1
)
ON DUPLICATE KEY UPDATE
  nom = VALUES(nom),
  description = VALUES(description),
  categorie = VALUES(categorie),
  ordre = VALUES(ordre),
  etat = VALUES(etat);

