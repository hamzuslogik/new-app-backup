-- Script SQL pour insérer la structure RP CONFIRMATION avec RE CONFIRMATION et confirmateurs
-- RP CONFIRMATION: OLFA
-- RE CONFIRMATION: Alec(Sami), perez(Amal), garnier(jihen)
-- Confirmateurs: Voir la liste complète ci-dessous
-- 
-- Note: Les noms complets sont séparés automatiquement selon l'espace:
--   - Premier mot = nom
--   - Reste = prénom

USE `crm`;

-- 1. Insérer ou mettre à jour le RP CONFIRMATION
-- Note: Utilisation de la fonction 15 pour RP CONFIRMATION (à ajuster selon votre structure)
-- Si vous utilisez une autre fonction, modifiez la valeur ci-dessous
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`)
VALUES ('OLFA', 'OLFA', '', 'OLFA', SHA2('OLFA@2024', 256), 15, 1, '#629aa9')
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `fonction` = VALUES(`fonction`),
  `etat` = VALUES(`etat`);

-- Récupérer l'ID du RP CONFIRMATION
SET @rp_confirmation_id = (SELECT id FROM utilisateurs WHERE pseudo = 'OLFA' AND fonction = 15 LIMIT 1);

-- 2. Insérer ou mettre à jour les RE CONFIRMATION
-- RE CONFIRMATION 1: Alec(Sami)
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `chef_equipe`)
VALUES ('Alec', 'Alec', 'Sami', 'Alec', SHA2('Alec@2024', 256), 14, 1, '#629aa9', @rp_confirmation_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `chef_equipe` = VALUES(`chef_equipe`),
  `etat` = VALUES(`etat`);

SET @re_confirmation1_id = (SELECT id FROM utilisateurs WHERE pseudo = 'Alec' AND fonction = 14 LIMIT 1);

-- RE CONFIRMATION 2: perez(Amal)
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `chef_equipe`)
VALUES ('perez', 'perez', 'Amal', 'perez', SHA2('perez@2024', 256), 14, 1, '#629aa9', @rp_confirmation_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `chef_equipe` = VALUES(`chef_equipe`),
  `etat` = VALUES(`etat`);

SET @re_confirmation2_id = (SELECT id FROM utilisateurs WHERE pseudo = 'perez' AND fonction = 14 LIMIT 1);

-- RE CONFIRMATION 3: garnier(jihen)
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `chef_equipe`)
VALUES ('garnier', 'garnier', 'jihen', 'garnier', SHA2('garnier@2024', 256), 14, 1, '#629aa9', @rp_confirmation_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `chef_equipe` = VALUES(`chef_equipe`),
  `etat` = VALUES(`etat`);

SET @re_confirmation3_id = (SELECT id FROM utilisateurs WHERE pseudo = 'garnier' AND fonction = 14 LIMIT 1);

-- 3. Insérer les Confirmateurs sous RE CONFIRMATION 1: Alec(Sami)
-- Confirmateur 1: DANIEL (dhouha aouadi)
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `chef_equipe`)
VALUES ('DANIEL', 'dhouha', 'aouadi', 'DANIEL', SHA2('DANIEL@2024', 256), 6, 1, '#629aa9', @re_confirmation1_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `chef_equipe` = VALUES(`chef_equipe`),
  `etat` = VALUES(`etat`);

-- Confirmateur 2: ALVARO (hamza jamazi)
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `chef_equipe`)
VALUES ('ALVARO', 'hamza', 'jamazi', 'ALVARO', SHA2('ALVARO@2024', 256), 6, 1, '#629aa9', @re_confirmation1_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `chef_equipe` = VALUES(`chef_equipe`),
  `etat` = VALUES(`etat`);

-- Confirmateur 3: MULLER (monoem majri)
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `chef_equipe`)
VALUES ('MULLER', 'monoem', 'majri', 'MULLER', SHA2('MULLER@2024', 256), 6, 1, '#629aa9', @re_confirmation1_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `chef_equipe` = VALUES(`chef_equipe`),
  `etat` = VALUES(`etat`);

-- Confirmateur 4: CINDY (nefaa eya)
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `chef_equipe`)
VALUES ('CINDY', 'nefaa', 'eya', 'CINDY', SHA2('CINDY@2024', 256), 6, 1, '#629aa9', @re_confirmation1_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `chef_equipe` = VALUES(`chef_equipe`),
  `etat` = VALUES(`etat`);

-- Confirmateur 5: rania (pas de pseudo visible dans l'image, utilisation du nom)
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `chef_equipe`)
VALUES ('rania', 'rania', '', 'rania', SHA2('rania@2024', 256), 6, 1, '#629aa9', @re_confirmation1_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `chef_equipe` = VALUES(`chef_equipe`),
  `etat` = VALUES(`etat`);

-- Confirmateur 6: GARENNE (choraz bou azizi)
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `chef_equipe`)
VALUES ('GARENNE', 'choraz', 'bou azizi', 'GARENNE', SHA2('GARENNE@2024', 256), 6, 1, '#629aa9', @re_confirmation1_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `chef_equipe` = VALUES(`chef_equipe`),
  `etat` = VALUES(`etat`);

-- Confirmateur 7: ROSSI (rebai mohamed)
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `chef_equipe`)
VALUES ('ROSSI', 'rebai', 'mohamed', 'ROSSI', SHA2('ROSSI@2024', 256), 6, 1, '#629aa9', @re_confirmation1_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `chef_equipe` = VALUES(`chef_equipe`),
  `etat` = VALUES(`etat`);

-- Confirmateur 8: LAURENT (chiraz guesmi)
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `chef_equipe`)
VALUES ('LAURENT', 'chiraz', 'guesmi', 'LAURENT', SHA2('LAURENT@2024', 256), 6, 1, '#629aa9', @re_confirmation1_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `chef_equipe` = VALUES(`chef_equipe`),
  `etat` = VALUES(`etat`);

-- 4. Insérer les Confirmateurs sous RE CONFIRMATION 2: perez(Amal)
-- Confirmateur 1: Duval (sassi imen)
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `chef_equipe`)
VALUES ('Duval', 'sassi', 'imen', 'Duval', SHA2('Duval@2024', 256), 6, 1, '#629aa9', @re_confirmation2_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `chef_equipe` = VALUES(`chef_equipe`),
  `etat` = VALUES(`etat`);

-- Confirmateur 2: Cadeau (slaouti sabrine)
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `chef_equipe`)
VALUES ('Cadeau', 'slaouti', 'sabrine', 'Cadeau', SHA2('Cadeau@2024', 256), 6, 1, '#629aa9', @re_confirmation2_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `chef_equipe` = VALUES(`chef_equipe`),
  `etat` = VALUES(`etat`);

-- Confirmateur 3: Leroi (yahyaoui alia)
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `chef_equipe`)
VALUES ('Leroi', 'yahyaoui', 'alia', 'Leroi', SHA2('Leroi@2024', 256), 6, 1, '#629aa9', @re_confirmation2_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `chef_equipe` = VALUES(`chef_equipe`),
  `etat` = VALUES(`etat`);

-- Confirmateur 4: Vidal (souilmi houaida)
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `chef_equipe`)
VALUES ('Vidal', 'souilmi', 'houaida', 'Vidal', SHA2('Vidal@2024', 256), 6, 1, '#629aa9', @re_confirmation2_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `chef_equipe` = VALUES(`chef_equipe`),
  `etat` = VALUES(`etat`);

-- Confirmateur 5: Ari (ben hassine jabbalah)
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `chef_equipe`)
VALUES ('Ari', 'ben hassine', 'jabbalah', 'Ari', SHA2('Ari@2024', 256), 6, 1, '#629aa9', @re_confirmation2_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `chef_equipe` = VALUES(`chef_equipe`),
  `etat` = VALUES(`etat`);

-- Confirmateur 6: Champion (zouinekh amira)
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `chef_equipe`)
VALUES ('Champion', 'zouinekh', 'amira', 'Champion', SHA2('Champion@2024', 256), 6, 1, '#629aa9', @re_confirmation2_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `chef_equipe` = VALUES(`chef_equipe`),
  `etat` = VALUES(`etat`);

-- Confirmateur 7: Blanc (ellafi islam)
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `chef_equipe`)
VALUES ('Blanc', 'ellafi', 'islam', 'Blanc', SHA2('Blanc@2024', 256), 6, 1, '#629aa9', @re_confirmation2_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `chef_equipe` = VALUES(`chef_equipe`),
  `etat` = VALUES(`etat`);

-- 5. Insérer les Confirmateurs sous RE CONFIRMATION 3: garnier(jihen)
-- Confirmateur 1: CARRAT (amira oueslati)
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `chef_equipe`)
VALUES ('CARRAT', 'amira', 'oueslati', 'CARRAT', SHA2('CARRAT@2024', 256), 6, 1, '#629aa9', @re_confirmation3_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `chef_equipe` = VALUES(`chef_equipe`),
  `etat` = VALUES(`etat`);

-- Confirmateur 2: NOEL (baldi azza)
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `chef_equipe`)
VALUES ('NOEL', 'baldi', 'azza', 'NOEL', SHA2('NOEL@2024', 256), 6, 1, '#629aa9', @re_confirmation3_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `chef_equipe` = VALUES(`chef_equipe`),
  `etat` = VALUES(`etat`);

-- Confirmateur 3: HAZARD (harard mechirgui)
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `chef_equipe`)
VALUES ('HAZARD', 'harard', 'mechirgui', 'HAZARD', SHA2('HAZARD@2024', 256), 6, 1, '#629aa9', @re_confirmation3_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `chef_equipe` = VALUES(`chef_equipe`),
  `etat` = VALUES(`etat`);

-- Confirmateur 4: MARIE (harbaoui souha)
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `chef_equipe`)
VALUES ('MARIE', 'harbaoui', 'souha', 'MARIE', SHA2('MARIE@2024', 256), 6, 1, '#629aa9', @re_confirmation3_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `chef_equipe` = VALUES(`chef_equipe`),
  `etat` = VALUES(`etat`);

-- Confirmateur 5: MUNIER (mezghini slim)
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `chef_equipe`)
VALUES ('MUNIER', 'mezghini', 'slim', 'MUNIER', SHA2('MUNIER@2024', 256), 6, 1, '#629aa9', @re_confirmation3_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `chef_equipe` = VALUES(`chef_equipe`),
  `etat` = VALUES(`etat`);

-- Confirmateur 6: CHLOE (raja amri)
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `chef_equipe`)
VALUES ('CHLOE', 'raja', 'amri', 'CHLOE', SHA2('CHLOE@2024', 256), 6, 1, '#629aa9', @re_confirmation3_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `chef_equipe` = VALUES(`chef_equipe`),
  `etat` = VALUES(`etat`);

-- Confirmateur 7: CORSO (mourad karoui)
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `chef_equipe`)
VALUES ('CORSO', 'mourad', 'karoui', 'CORSO', SHA2('CORSO@2024', 256), 6, 1, '#629aa9', @re_confirmation3_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `chef_equipe` = VALUES(`chef_equipe`),
  `etat` = VALUES(`etat`);

-- Confirmateur 8: PARIS (yahbaoui sarra)
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `chef_equipe`)
VALUES ('PARIS', 'yahbaoui', 'sarra', 'PARIS', SHA2('PARIS@2024', 256), 6, 1, '#629aa9', @re_confirmation3_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `chef_equipe` = VALUES(`chef_equipe`),
  `etat` = VALUES(`etat`);

-- Vérification
SELECT 
  'RP CONFIRMATION' as niveau,
  pseudo,
  nom,
  prenom,
  fonction
FROM utilisateurs 
WHERE pseudo = 'OLFA' AND fonction = 15;

SELECT 
  'RE CONFIRMATION' as niveau,
  pseudo,
  nom,
  prenom,
  fonction,
  chef_equipe
FROM utilisateurs 
WHERE fonction = 14 AND chef_equipe = @rp_confirmation_id;

SELECT 
  'CONFIRMATEURS' as niveau,
  pseudo,
  nom,
  prenom,
  fonction,
  chef_equipe
FROM utilisateurs 
WHERE fonction = 6 AND chef_equipe IN (@re_confirmation1_id, @re_confirmation2_id, @re_confirmation3_id)
ORDER BY chef_equipe, pseudo;

