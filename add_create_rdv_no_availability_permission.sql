-- Ajouter la permission pour créer un RDV dans un horaire sans disponibilité
INSERT INTO permissions (code, nom, description, categorie, ordre, etat)
VALUES (
  'CREATE_RDV_NO_AVAILABILITY',
  'Créer RDV sans disponibilité',
  'Permet de créer un rendez-vous directement dans un créneau qui n\'a pas de disponibilité ou qui a atteint sa limite, sans passer par le système de pré-confirmation',
  'planning',
  10,
  1
)
ON DUPLICATE KEY UPDATE
  nom = VALUES(nom),
  description = VALUES(description),
  categorie = VALUES(categorie),
  ordre = VALUES(ordre),
  etat = VALUES(etat);

