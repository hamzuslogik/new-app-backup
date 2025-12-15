-- =====================================================
-- Script d'insertion d'une fiche exemple
-- pour tester les fonctionnalités de l'application
-- =====================================================

USE `crm`;

-- =====================================================
-- 1. Vérifier/Créer les entités nécessaires
-- =====================================================

-- S'assurer qu'un centre existe (ID 1)
INSERT INTO `centres` (`id`, `titre`, `etat`) 
VALUES (1, 'Centre Principal', 1)
ON DUPLICATE KEY UPDATE `titre`=VALUES(`titre`), `etat`=1;

-- S'assurer qu'un utilisateur admin existe (ID 1) pour être l'agent
INSERT INTO `utilisateurs` (`id`, `nom`, `prenom`, `pseudo`, `login`, `mdp`, `etat`, `fonction`, `centre`, `genre`, `color`, `date`)
VALUES (1, 'Admin', 'Système', 'Administrateur', 'admin', 'admin123', 1, 1, 1, 2, '#629aa9', UNIX_TIMESTAMP(NOW()))
ON DUPLICATE KEY UPDATE `etat`=1;

-- S'assurer qu'un état "Nouveau" existe (ID 1)
INSERT INTO `etats` (`id`, `titre`, `groupe`, `ordre`, `color`)
VALUES (1, 'Nouveau', 1, 1, '#3498db')
ON DUPLICATE KEY UPDATE `titre`=VALUES(`titre`), `groupe`=VALUES(`groupe`), `ordre`=VALUES(`ordre`), `color`=VALUES(`color`);

-- S'assurer qu'un état "Confirmé" existe (ID 7) pour les RDV
INSERT INTO `etats` (`id`, `titre`, `groupe`, `ordre`, `color`)
VALUES (7, 'Confirmé', 2, 7, '#2ecc71')
ON DUPLICATE KEY UPDATE `titre`=VALUES(`titre`), `groupe`=VALUES(`groupe`), `ordre`=VALUES(`ordre`), `color`=VALUES(`color`);

-- S'assurer qu'un produit PAC existe (ID 1)
INSERT INTO `produits` (`id`, `nom`)
VALUES (1, 'PAC')
ON DUPLICATE KEY UPDATE `nom`=VALUES(`nom`);

-- S'assurer qu'un produit PV existe (ID 2)
INSERT INTO `produits` (`id`, `nom`)
VALUES (2, 'PV')
ON DUPLICATE KEY UPDATE `nom`=VALUES(`nom`);

-- =====================================================
-- 2. Insérer la fiche exemple
-- =====================================================

-- Calculer les dates
SET @now = NOW();
SET @date_insert = UNIX_TIMESTAMP(@now);
SET @date_rdv = DATE_ADD(@now, INTERVAL 7 DAY); -- RDV dans 7 jours
SET @date_rdv_timestamp = UNIX_TIMESTAMP(@date_rdv);

-- Insérer la fiche exemple (PAC avec RDV confirmé)
INSERT INTO `fiches` (
  `civ`,
  `nom`,
  `prenom`,
  `tel`,
  `gsm1`,
  `gsm2`,
  `adresse`,
  `cp`,
  `ville`,
  `situation_conjugale`,
  `produit`,
  `id_centre`,
  `id_agent`,
  `id_insert`,
  `id_etat_final`,
  `date_insert`,
  `date_insert_time`,
  `date_rdv`,
  `date_rdv_time`,
  `date_modif_time`,
  `archive`,
  `ko`,
  `hc`,
  `active`,
  `valider`,
  -- Informations professionnelles
  `profession_mr`,
  `profession_madame`,
  `age_mr`,
  `age_madame`,
  `revenu_foyer`,
  `credit_foyer`,
  `nb_enfants`,
  -- Informations logement
  `proprietaire_maison`,
  `surface_habitable`,
  `surface_chauffee`,
  `annee_systeme_chauffage`,
  `mode_chauffage`,
  `consommation_chauffage`,
  `consommation_electricite`,
  `nb_pieces`,
  -- Informations produit
  `etude`,
  -- Commentaire
  `commentaire`
) VALUES (
  'MR',                                    -- Civilité
  'Dupont',                                -- Nom
  'Jean',                                  -- Prénom
  '0612345678',                            -- Téléphone
  '0612345678',                            -- GSM1
  '0612345678',                            -- GSM2
  '123 Rue de la République',             -- Adresse
  '75001',                                 -- Code postal (Paris)
  'Paris',                                 -- Ville
  'MARIE',                                 -- Situation conjugale
  1,                                       -- Produit (1 = PAC)
  1,                                       -- Centre (ID 1)
  1,                                       -- Agent (ID 1 = Admin)
  1,                                       -- Insert par (ID 1)
  7,                                       -- État final (7 = Confirmé)
  @date_insert,                            -- Date insertion (timestamp)
  @now,                                    -- Date insertion (datetime)
  @date_rdv_timestamp,                     -- Date RDV (timestamp)
  @date_rdv,                               -- Date RDV (datetime)
  @now,                                    -- Date modification
  0,                                       -- Archive (non)
  0,                                       -- KO (non)
  0,                                       -- HC (non)
  1,                                       -- Active (oui)
  1,                                       -- Validé (oui)
  -- Informations professionnelles
  '1',                                     -- Profession Monsieur (ID)
  '2',                                     -- Profession Madame (ID)
  '45',                                    -- Âge Monsieur
  '42',                                    -- Âge Madame
  '3500',                                  -- Revenu foyer
  '800',                                   -- Crédit foyer
  '2',                                     -- Nombre d'enfants
  -- Informations logement
  'OUI',                                   -- Propriétaire
  '120',                                   -- Surface habitable (m²)
  '100',                                   -- Surface chauffée (m²)
  2010,                                    -- Année système chauffage
  '1',                                     -- Mode chauffage (ID)
  '15000',                                 -- Consommation chauffage (kWh)
  '3500',                                  -- Consommation électricité (kWh)
  5,                                       -- Nombre de pièces
  -- Informations produit
  'OUI',                                   -- Étude
  -- Commentaire
  'Fiche exemple créée pour tester les fonctionnalités de l\'application. Client intéressé par une PAC pour réduire sa consommation énergétique.'
);

-- Récupérer l'ID de la fiche insérée
SET @fiche_id = LAST_INSERT_ID();

-- =====================================================
-- 3. Créer l'historique de la fiche
-- =====================================================

-- Historique : État initial "Nouveau"
INSERT INTO `fiches_histo` (`id_fiche`, `id_etat`, `date_creation`)
VALUES (@fiche_id, 1, DATE_SUB(@now, INTERVAL 2 DAY));

-- Historique : Passage à "Confirmé"
INSERT INTO `fiches_histo` (`id_fiche`, `id_etat`, `date_rdv_time`, `date_creation`)
VALUES (@fiche_id, 7, @date_rdv, DATE_SUB(@now, INTERVAL 1 DAY));

-- =====================================================
-- 4. Insérer une deuxième fiche exemple (PV)
-- =====================================================

SET @date_rdv2 = DATE_ADD(@now, INTERVAL 10 DAY); -- RDV dans 10 jours
SET @date_rdv_timestamp2 = UNIX_TIMESTAMP(@date_rdv2);

INSERT INTO `fiches` (
  `civ`,
  `nom`,
  `prenom`,
  `tel`,
  `gsm1`,
  `gsm2`,
  `adresse`,
  `cp`,
  `ville`,
  `situation_conjugale`,
  `produit`,
  `id_centre`,
  `id_agent`,
  `id_insert`,
  `id_etat_final`,
  `date_insert`,
  `date_insert_time`,
  `date_rdv`,
  `date_rdv_time`,
  `date_modif_time`,
  `archive`,
  `ko`,
  `hc`,
  `active`,
  `valider`,
  `profession_mr`,
  `age_mr`,
  `proprietaire_maison`,
  `surface_habitable`,
  `etude`,
  `orientation_toiture`,
  `commentaire`
) VALUES (
  'MME',
  'Martin',
  'Sophie',
  '0623456789',
  '0623456789',
  '0623456789',
  '456 Avenue des Champs',
  '69001',
  'Lyon',
  'CELIBATAIRE',
  2,                                       -- Produit (2 = PV)
  1,
  1,
  1,
  7,                                       -- État final (7 = Confirmé)
  @date_insert,
  @now,
  @date_rdv_timestamp2,
  @date_rdv2,
  @now,
  0,
  0,
  0,
  1,
  1,
  '3',                                     -- Profession
  '38',                                    -- Âge
  'OUI',
  '90',
  'OUI',
  'SUD',                                   -- Orientation toiture
  'Fiche exemple pour produit PV. Client célibataire propriétaire intéressé par l\'autoconsommation.'
);

SET @fiche_id2 = LAST_INSERT_ID();

-- Historique pour la fiche PV
INSERT INTO `fiches_histo` (`id_fiche`, `id_etat`, `date_creation`)
VALUES (@fiche_id2, 1, DATE_SUB(@now, INTERVAL 3 DAY));

INSERT INTO `fiches_histo` (`id_fiche`, `id_etat`, `date_rdv_time`, `date_creation`)
VALUES (@fiche_id2, 7, @date_rdv2, DATE_SUB(@now, INTERVAL 1 DAY));

-- =====================================================
-- 5. Insérer une troisième fiche (Nouveau, sans RDV)
-- =====================================================

INSERT INTO `fiches` (
  `civ`,
  `nom`,
  `prenom`,
  `tel`,
  `gsm1`,
  `adresse`,
  `cp`,
  `ville`,
  `situation_conjugale`,
  `produit`,
  `id_centre`,
  `id_agent`,
  `id_insert`,
  `id_etat_final`,
  `date_insert`,
  `date_insert_time`,
  `date_modif_time`,
  `archive`,
  `ko`,
  `hc`,
  `active`,
  `valider`,
  `commentaire`
) VALUES (
  'MR',
  'Bernard',
  'Pierre',
  '0634567890',
  '0634567890',
  '789 Boulevard Saint-Michel',
  '33000',
  'Bordeaux',
  'CONCUBINAGE',
  1,                                       -- Produit (1 = PAC)
  1,
  1,
  1,
  1,                                       -- État final (1 = Nouveau)
  @date_insert,
  @now,
  @now,
  0,
  0,
  0,
  1,
  0,                                       -- Non validé
  'Fiche exemple en état "Nouveau" pour tester les fonctionnalités de suivi et de modification.'
);

SET @fiche_id3 = LAST_INSERT_ID();

-- Historique pour la fiche "Nouveau"
INSERT INTO `fiches_histo` (`id_fiche`, `id_etat`, `date_creation`)
VALUES (@fiche_id3, 1, @now);

-- =====================================================
-- 6. Afficher les informations des fiches créées
-- =====================================================

SELECT 
  'Fiches exemple créées avec succès !' as message,
  @fiche_id as 'Fiche PAC (Confirmée)',
  @fiche_id2 as 'Fiche PV (Confirmée)',
  @fiche_id3 as 'Fiche PAC (Nouveau)';

SELECT 
  f.id,
  f.nom,
  f.prenom,
  f.tel,
  f.cp,
  f.ville,
  p.nom as produit,
  e.titre as etat,
  f.date_rdv_time as 'Date RDV',
  f.valider as 'Validé'
FROM fiches f
LEFT JOIN produits p ON f.produit = p.id
LEFT JOIN etats e ON f.id_etat_final = e.id
WHERE f.id IN (@fiche_id, @fiche_id2, @fiche_id3)
ORDER BY f.id;

-- =====================================================
-- FIN DU SCRIPT
-- =====================================================
-- 
-- Les fiches créées peuvent être utilisées pour tester :
-- - Affichage dans le dashboard
-- - Filtres et recherche
-- - Modification de fiches
-- - Historique des états
-- - Planning (fiches avec état 7 et date_rdv_time)
-- - Archivage
-- - Export de données
-- =====================================================

