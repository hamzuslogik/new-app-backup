-- Script SQL pour insérer la structure RP Qualification avec superviseurs et agents
-- RP Qualification: Rplmen
-- Superviseurs: MADIHA BOUBAKER, MARIEM HAMDAN, IMEN SRAIEB
-- Agents: Voir la liste complète ci-dessous
-- 
-- Note: Les noms complets sont séparés automatiquement selon l'espace:
--   - Premier mot = nom
--   - Reste = prénom

USE `crm`;

-- 1. Insérer ou mettre à jour le RP Qualification
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`)
VALUES ('Rplmen', 'RP', 'Lmen', 'Rplmen', SHA2('Rplmen@2024', 256), 12, 1, '#629aa9')
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `fonction` = VALUES(`fonction`),
  `etat` = VALUES(`etat`);

-- Récupérer l'ID du RP Qualification
SET @rp_qualif_id = (SELECT id FROM utilisateurs WHERE pseudo = 'Rplmen' AND fonction = 12 LIMIT 1);

-- 2. Insérer ou mettre à jour les Superviseurs Qualification
-- Superviseur 1: MADIHA BOUBAKER
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `id_rp_qualif`)
VALUES ('MADIHA BOUBAKER', 'MADIHA', 'BOUBAKER', 'MADIHABOUBAKER', SHA2('MADIHABOUBAKER@2024', 256), 2, 1, '#629aa9', @rp_qualif_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `id_rp_qualif` = VALUES(`id_rp_qualif`),
  `etat` = VALUES(`etat`);

SET @superviseur1_id = (SELECT id FROM utilisateurs WHERE pseudo = 'MADIHA BOUBAKER' AND fonction = 2 LIMIT 1);

-- Superviseur 2: MARIEM HAMDAN
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `id_rp_qualif`)
VALUES ('MARIEM HAMDAN', 'MARIEM', 'HAMDAN', 'MARIEMHAMDAN', SHA2('MARIEMHAMDAN@2024', 256), 2, 1, '#629aa9', @rp_qualif_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `id_rp_qualif` = VALUES(`id_rp_qualif`),
  `etat` = VALUES(`etat`);

SET @superviseur2_id = (SELECT id FROM utilisateurs WHERE pseudo = 'MARIEM HAMDAN' AND fonction = 2 LIMIT 1);

-- Superviseur 3: IMEN SRAIEB
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `id_rp_qualif`)
VALUES ('IMEN SRAIEB', 'IMEN', 'SRAIEB', 'IMENSRAIEB', SHA2('IMENSRAIEB@2024', 256), 2, 1, '#629aa9', @rp_qualif_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `id_rp_qualif` = VALUES(`id_rp_qualif`),
  `etat` = VALUES(`etat`);

SET @superviseur3_id = (SELECT id FROM utilisateurs WHERE pseudo = 'IMEN SRAIEB' AND fonction = 2 LIMIT 1);

-- 3. Insérer ou mettre à jour les Agents sous MADIHA BOUBAKER
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `chef_equipe`)
VALUES
  ('AG2095', 'RACHIDA', 'CHATTI', 'AG2095', SHA2('AG2095@2024', 256), 3, 1, '#629aa9', @superviseur1_id),
  ('AG2098', 'OUMAIMA', 'DHIEB', 'AG2098', SHA2('AG2098@2024', 256), 3, 1, '#629aa9', @superviseur1_id),
  ('AG874', 'RAHALI', 'SALWA', 'AG874', SHA2('AG874@2024', 256), 3, 1, '#629aa9', @superviseur1_id),
  ('AG560', 'NAIMA', 'KHAMASSI', 'AG560', SHA2('AG560@2024', 256), 3, 1, '#629aa9', @superviseur1_id),
  ('AG2215', 'INES', 'ZORGATI', 'AG2215', SHA2('AG2215@2024', 256), 3, 1, '#629aa9', @superviseur1_id),
  ('AG2230', 'AISSIA', 'WERGHI', 'AG2230', SHA2('AG2230@2024', 256), 3, 1, '#629aa9', @superviseur1_id),
  ('AG2232', 'HADIL', 'GUESMI', 'AG2232', SHA2('AG2232@2024', 256), 3, 1, '#629aa9', @superviseur1_id),
  ('AG2226', 'SAMIA', 'TORKHANI', 'AG2226', SHA2('AG2226@2024', 256), 3, 1, '#629aa9', @superviseur1_id),
  ('AG2191', 'IMEN', 'SEHLI', 'AG2191', SHA2('AG2191@2024', 256), 3, 1, '#629aa9', @superviseur1_id),
  ('AG2259', 'EMNA', 'FEYDI', 'AG2259', SHA2('AG2259@2024', 256), 3, 1, '#629aa9', @superviseur1_id),
  ('AG614', 'RAHMA', 'FATHALLAH', 'AG614', SHA2('AG614@2024', 256), 3, 1, '#629aa9', @superviseur1_id),
  ('AG2284', 'LANDARI', 'SOUMAYA', 'AG2284', SHA2('AG2284@2024', 256), 3, 1, '#629aa9', @superviseur1_id),
  ('AG2287', 'YOSSRA', 'DELY', 'AG2287', SHA2('AG2287@2024', 256), 3, 1, '#629aa9', @superviseur1_id),
  ('AG2290', 'EMNA', 'MIGHRI', 'AG2290', SHA2('AG2290@2024', 256), 3, 1, '#629aa9', @superviseur1_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `chef_equipe` = VALUES(`chef_equipe`),
  `etat` = VALUES(`etat`);

-- 4. Insérer ou mettre à jour les Agents sous MARIEM HAMDAN
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `chef_equipe`)
VALUES
  ('AG2243', 'MARIEM', 'THOUABTIA', 'AG2243', SHA2('AG2243@2024', 256), 3, 1, '#629aa9', @superviseur2_id),
  ('AG2043', 'JIHEN', 'OUESLATI', 'AG2043', SHA2('AG2043@2024', 256), 3, 1, '#629aa9', @superviseur2_id),
  ('AG2192', 'MARIEM', 'BAHRI', 'AG2192', SHA2('AG2192@2024', 256), 3, 1, '#629aa9', @superviseur2_id),
  ('AG2270', 'LINDA', 'LASTA', 'AG2270', SHA2('AG2270@2024', 256), 3, 1, '#629aa9', @superviseur2_id),
  ('AG2271', 'MARAM', 'TRABELSI', 'AG2271', SHA2('AG2271@2024', 256), 3, 1, '#629aa9', @superviseur2_id),
  ('AG477', 'NADIM', 'ABDA', 'AG477', SHA2('AG477@2024', 256), 3, 1, '#629aa9', @superviseur2_id),
  ('AG2245', 'MAROUA', 'KHLIFI', 'AG2245', SHA2('AG2245@2024', 256), 3, 1, '#629aa9', @superviseur2_id),
  ('AG2253', 'FATEN', 'BEN MOUSSA', 'AG2253', SHA2('AG2253@2024', 256), 3, 1, '#629aa9', @superviseur2_id),
  ('AG717', 'DALY', 'SALIM', 'AG717', SHA2('AG717@2024', 256), 3, 1, '#629aa9', @superviseur2_id),
  ('AG2277', 'GHOFRANE', 'JABALLAH', 'AG2277', SHA2('AG2277@2024', 256), 3, 1, '#629aa9', @superviseur2_id),
  ('AG2278', 'AMENI', 'MBAREK', 'AG2278', SHA2('AG2278@2024', 256), 3, 1, '#629aa9', @superviseur2_id),
  ('AG2291', 'NEDIA', 'CHAHEB', 'AG2291', SHA2('AG2291@2024', 256), 3, 1, '#629aa9', @superviseur2_id),
  ('AG2293', 'RANIA', 'CHALBI', 'AG2293', SHA2('AG2293@2024', 256), 3, 1, '#629aa9', @superviseur2_id),
  ('AG2294', 'INTISSAR', 'MTAR', 'AG2294', SHA2('AG2294@2024', 256), 3, 1, '#629aa9', @superviseur2_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `chef_equipe` = VALUES(`chef_equipe`),
  `etat` = VALUES(`etat`);

-- 5. Insérer ou mettre à jour les Agents sous IMEN SRAIEB
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `chef_equipe`)
VALUES
  ('AG2207', 'INES', 'HAMEMI', 'AG2207', SHA2('AG2207@2024', 256), 3, 1, '#629aa9', @superviseur3_id),
  ('AG2175', 'IMEN', 'KSOURI MEDDEB', 'AG2175', SHA2('AG2175@2024', 256), 3, 1, '#629aa9', @superviseur3_id),
  ('AG2164', 'NEILA', 'OUICHKA', 'AG2164', SHA2('AG2164@2024', 256), 3, 1, '#629aa9', @superviseur3_id),
  ('AG183', 'WAAD', 'Ghribi', 'AG183', SHA2('AG183@2024', 256), 3, 1, '#629aa9', @superviseur3_id),
  ('AG2155', 'MED AMINE', 'RASSA', 'AG2155', SHA2('AG2155@2024', 256), 3, 1, '#629aa9', @superviseur3_id),
  ('AG2224', 'MARIEM', 'ZAGHDOUDI', 'AG2224', SHA2('AG2224@2024', 256), 3, 1, '#629aa9', @superviseur3_id),
  ('AG2251', 'CHAIMA', 'KLAI', 'AG2251', SHA2('AG2251@2024', 256), 3, 1, '#629aa9', @superviseur3_id),
  ('AG2256', 'ARIJ', 'CHERIF', 'AG2256', SHA2('AG2256@2024', 256), 3, 1, '#629aa9', @superviseur3_id),
  ('AG2261', 'EMNA', 'GARCI', 'AG2261', SHA2('AG2261@2024', 256), 3, 1, '#629aa9', @superviseur3_id),
  ('AG2072', 'BOUKERI', 'KAOUTHER', 'AG2072', SHA2('AG2072@2024', 256), 3, 1, '#629aa9', @superviseur3_id),
  ('AG2279', 'OUMAIMA', 'MARZOUKI', 'AG2279', SHA2('AG2279@2024', 256), 3, 1, '#629aa9', @superviseur3_id),
  ('AG2283', 'BEN AMEUR', 'SAFA', 'AG2283', SHA2('AG2283@2024', 256), 3, 1, '#629aa9', @superviseur3_id),
  ('AG2286', 'WISSAL', 'BECHIKH', 'AG2286', SHA2('AG2286@2024', 256), 3, 1, '#629aa9', @superviseur3_id),
  ('AG2292', 'RIM', 'BEN AMOR', 'AG2292', SHA2('AG2292@2024', 256), 3, 1, '#629aa9', @superviseur3_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `chef_equipe` = VALUES(`chef_equipe`),
  `etat` = VALUES(`etat`);

-- Vérification
SELECT 
  'RP Qualification créé' AS message,
  (SELECT COUNT(*) FROM utilisateurs WHERE pseudo = 'Rplmen' AND fonction = 12) AS rp_count,
  (SELECT COUNT(*) FROM utilisateurs WHERE id_rp_qualif = @rp_qualif_id AND fonction = 2) AS superviseurs_count,
  (SELECT COUNT(*) FROM utilisateurs WHERE chef_equipe IN (@superviseur1_id, @superviseur2_id, @superviseur3_id) AND fonction = 3) AS agents_count;

-- Afficher la structure complète
SELECT 
  'RP Qualification' AS niveau,
  u.id,
  u.pseudo,
  u.nom,
  u.prenom,
  f.titre AS fonction,
  s.pseudo AS superviseur_pseudo,
  rp.pseudo AS rp_qualif_pseudo
FROM utilisateurs u
LEFT JOIN fonctions f ON u.fonction = f.id
LEFT JOIN utilisateurs s ON u.chef_equipe = s.id
LEFT JOIN utilisateurs rp ON u.id_rp_qualif = rp.id
WHERE u.pseudo = 'Rplmen' AND u.fonction = 12

UNION ALL

SELECT 
  'Superviseur' AS niveau,
  u.id,
  u.pseudo,
  u.nom,
  u.prenom,
  f.titre AS fonction,
  s.pseudo AS superviseur_pseudo,
  rp.pseudo AS rp_qualif_pseudo
FROM utilisateurs u
LEFT JOIN fonctions f ON u.fonction = f.id
LEFT JOIN utilisateurs s ON u.chef_equipe = s.id
LEFT JOIN utilisateurs rp ON u.id_rp_qualif = rp.id
WHERE u.id_rp_qualif = @rp_qualif_id AND u.fonction = 2

UNION ALL

SELECT 
  'Agent' AS niveau,
  u.id,
  u.pseudo,
  u.nom,
  u.prenom,
  f.titre AS fonction,
  s.pseudo AS superviseur_pseudo,
  rp.pseudo AS rp_qualif_pseudo
FROM utilisateurs u
LEFT JOIN fonctions f ON u.fonction = f.id
LEFT JOIN utilisateurs s ON u.chef_equipe = s.id
LEFT JOIN utilisateurs rp ON s.id_rp_qualif = rp.id
WHERE u.chef_equipe IN (@superviseur1_id, @superviseur2_id, @superviseur3_id) AND u.fonction = 3
ORDER BY niveau, pseudo;

