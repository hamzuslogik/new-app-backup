-- Script SQL pour insérer la structure RP Qualification avec superviseurs et agents
-- RP Qualification: Rpyoussef
-- Superviseurs: CHAYMA-LEADER 1, JEZIA-LEADER 2, BELHASSEN-LEADER 3
-- Agents: Voir la liste complète ci-dessous
-- 
-- Note: Les noms complets sont séparés automatiquement selon l'espace:
--   - Premier mot = nom
--   - Reste = prénom

USE `crm`;

-- Fonction helper pour séparer nom et prénom depuis une chaîne "NOM PRENOM"
-- Utilise SUBSTRING_INDEX pour extraire le premier mot (nom) et le reste (prénom)

-- 1. Insérer ou mettre à jour le RP Qualification
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`)
VALUES ('Rpyoussef', 'RP', 'Youssef', 'Rpyoussef', SHA2('Rpyoussef@2024', 256), 12, 1, '#629aa9')
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `fonction` = VALUES(`fonction`),
  `etat` = VALUES(`etat`);

-- Récupérer l'ID du RP Qualification
SET @rp_qualif_id = (SELECT id FROM utilisateurs WHERE pseudo = 'Rpyoussef' AND fonction = 12 LIMIT 1);

-- 2. Insérer ou mettre à jour les Superviseurs Qualification
-- Superviseur 1: CHAYMA-LEADER 1
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `id_rp_qualif`)
VALUES ('CHAYMA-LEADER 1', 'CHAYMA', 'LEADER 1', 'CHAYMA-LEADER1', SHA2('CHAYMA-LEADER1@2024', 256), 2, 1, '#629aa9', @rp_qualif_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `id_rp_qualif` = VALUES(`id_rp_qualif`),
  `etat` = VALUES(`etat`);

SET @superviseur1_id = (SELECT id FROM utilisateurs WHERE pseudo = 'CHAYMA-LEADER 1' AND fonction = 2 LIMIT 1);

-- Superviseur 2: JEZIA-LEADER 2
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `id_rp_qualif`)
VALUES ('JEZIA-LEADER 2', 'JEZIA', 'LEADER 2', 'JEZIA-LEADER2', SHA2('JEZIA-LEADER2@2024', 256), 2, 1, '#629aa9', @rp_qualif_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `id_rp_qualif` = VALUES(`id_rp_qualif`),
  `etat` = VALUES(`etat`);

SET @superviseur2_id = (SELECT id FROM utilisateurs WHERE pseudo = 'JEZIA-LEADER 2' AND fonction = 2 LIMIT 1);

-- Superviseur 3: BELHASSEN-LEADER 3
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `id_rp_qualif`)
VALUES ('BELHASSEN-LEADER 3', 'BELHASSEN', 'LEADER 3', 'BELHASSEN-LEADER3', SHA2('BELHASSEN-LEADER3@2024', 256), 2, 1, '#629aa9', @rp_qualif_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `id_rp_qualif` = VALUES(`id_rp_qualif`),
  `etat` = VALUES(`etat`);

SET @superviseur3_id = (SELECT id FROM utilisateurs WHERE pseudo = 'BELHASSEN-LEADER 3' AND fonction = 2 LIMIT 1);

-- 3. Insérer ou mettre à jour les Agents sous CHAYMA-LEADER 1
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `chef_equipe`)
VALUES
  ('AG719', 'ZAYNEB', 'MOHSNI', 'AG719', SHA2('AG719@2024', 256), 3, 1, '#629aa9', @superviseur1_id),
  ('AG2252', 'SALHI', 'NOURA', 'AG2252', SHA2('AG2252@2024', 256), 3, 1, '#629aa9', @superviseur1_id),
  ('AG2206', 'SAFA', 'BEN FRADJ', 'AG2206', SHA2('AG2206@2024', 256), 3, 1, '#629aa9', @superviseur1_id),
  ('AG2204', 'AWATEF', 'ATHIMNI', 'AG2204', SHA2('AG2204@2024', 256), 3, 1, '#629aa9', @superviseur1_id),
  ('AG2194', 'HANA', 'MASSAOUD', 'AG2194', SHA2('AG2194@2024', 256), 3, 1, '#629aa9', @superviseur1_id),
  ('AG2096', 'JIHEN', 'SALLEMI', 'AG2096', SHA2('AG2096@2024', 256), 3, 1, '#629aa9', @superviseur1_id),
  ('AG2228', 'AYCHA', 'HADDAD', 'AG2228', SHA2('AG2228@2024', 256), 3, 1, '#629aa9', @superviseur1_id),
  ('AG2089', 'Boughanmi', 'Asma', 'AG2089', SHA2('AG2089@2024', 256), 3, 1, '#629aa9', @superviseur1_id),
  ('AG2238', 'Slama', 'Fahd', 'AG2238', SHA2('AG2238@2024', 256), 3, 1, '#629aa9', @superviseur1_id),
  ('AG2262', 'NOUR', 'BEN KHLIL', 'AG2262', SHA2('AG2262@2024', 256), 3, 1, '#629aa9', @superviseur1_id),
  ('AG2219', 'NOURHENE', 'CHERNI', 'AG2219', SHA2('AG2219@2024', 256), 3, 1, '#629aa9', @superviseur1_id),
  ('AG2282', 'Elhem', 'Ayari', 'AG2282', SHA2('AG2282@2024', 256), 3, 1, '#629aa9', @superviseur1_id),
  ('AG2288', 'Najoua', 'Oueslati', 'AG2288', SHA2('AG2288@2024', 256), 3, 1, '#629aa9', @superviseur1_id),
  ('AG2272', 'HEDIA', 'WERTANI', 'AG2272', SHA2('AG2272@2024', 256), 3, 1, '#629aa9', @superviseur1_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `chef_equipe` = VALUES(`chef_equipe`),
  `etat` = VALUES(`etat`);

-- 4. Insérer ou mettre à jour les Agents sous JEZIA-LEADER 2
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `chef_equipe`)
VALUES
  ('AG1016', 'MANEL', 'BEN AYECH', 'AG1016', SHA2('AG1016@2024', 256), 3, 1, '#629aa9', @superviseur2_id),
  ('AG2023', 'Laabidi', 'Saliha', 'AG2023', SHA2('AG2023@2024', 256), 3, 1, '#629aa9', @superviseur2_id),
  ('AG2159', 'Imen', 'Belhaj Saad', 'AG2159', SHA2('AG2159@2024', 256), 3, 1, '#629aa9', @superviseur2_id),
  ('AG2137', 'NAHLA', 'FERCHICI', 'AG2137', SHA2('AG2137@2024', 256), 3, 1, '#629aa9', @superviseur2_id),
  ('AG2258', 'CHIRINE', 'HAMZEOUI', 'AG2258', SHA2('AG2258@2024', 256), 3, 1, '#629aa9', @superviseur2_id),
  ('AG1069', 'Zribi', 'Sabrine', 'AG1069', SHA2('AG1069@2024', 256), 3, 1, '#629aa9', @superviseur2_id),
  ('AG879', 'Tlibia', 'Sameh', 'AG879', SHA2('AG879@2024', 256), 3, 1, '#629aa9', @superviseur2_id),
  ('AG710', 'Jandoubi', 'Mariem', 'AG710', SHA2('AG710@2024', 256), 3, 1, '#629aa9', @superviseur2_id),
  ('AG2268', 'Sabrine', 'MANNAI', 'AG2268', SHA2('AG2268@2024', 256), 3, 1, '#629aa9', @superviseur2_id),
  ('AG2273', 'Fatma', 'Manai', 'AG2273', SHA2('AG2273@2024', 256), 3, 1, '#629aa9', @superviseur2_id),
  ('AG2285', 'Nadia', 'Moumni', 'AG2285', SHA2('AG2285@2024', 256), 3, 1, '#629aa9', @superviseur2_id),
  ('AG1088', 'SONIA', 'SLITI', 'AG1088', SHA2('AG1088@2024', 256), 3, 1, '#629aa9', @superviseur2_id),
  ('AG2295', 'Ouni', 'Nessrine', 'AG2295', SHA2('AG2295@2024', 256), 3, 1, '#629aa9', @superviseur2_id),
  ('AG2254', 'HIBA', 'JLELI', 'AG2254', SHA2('AG2254@2024', 256), 3, 1, '#629aa9', @superviseur2_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `chef_equipe` = VALUES(`chef_equipe`),
  `etat` = VALUES(`etat`);

-- 5. Insérer ou mettre à jour les Agents sous BELHASSEN-LEADER 3
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `color`, `chef_equipe`)
VALUES
  ('AG741', 'Dorra', 'selmi', 'AG741', SHA2('AG741@2024', 256), 3, 1, '#629aa9', @superviseur3_id),
  ('AG2235', 'BASSMA', 'JLASSI', 'AG2235', SHA2('AG2235@2024', 256), 3, 1, '#629aa9', @superviseur3_id),
  ('AG2011', 'BEN DHIF', 'SALMA', 'AG2011', SHA2('AG2011@2024', 256), 3, 1, '#629aa9', @superviseur3_id),
  ('AG258', 'SAFA', 'FEKIH', 'AG258', SHA2('AG258@2024', 256), 3, 1, '#629aa9', @superviseur3_id),
  ('AG702', 'KHADHI', 'KHOULOUD', 'AG702', SHA2('AG702@2024', 256), 3, 1, '#629aa9', @superviseur3_id),
  ('AG2199', 'LINA', 'KHAMMAR', 'AG2199', SHA2('AG2199@2024', 256), 3, 1, '#629aa9', @superviseur3_id),
  ('AG2266', 'NOUR HOUDA', 'ABBESSI', 'AG2266', SHA2('AG2266@2024', 256), 3, 1, '#629aa9', @superviseur3_id),
  ('AG2234', 'CHAIMA', 'TOUATI', 'AG2234', SHA2('AG2234@2024', 256), 3, 1, '#629aa9', @superviseur3_id),
  ('AG2263', 'ANOUER', 'NOOMANI', 'AG2263', SHA2('AG2263@2024', 256), 3, 1, '#629aa9', @superviseur3_id),
  ('AG2267', 'Dalila', 'KHLIFA', 'AG2267', SHA2('AG2267@2024', 256), 3, 1, '#629aa9', @superviseur3_id),
  ('AG2289', 'Wassim', 'Ezzidini', 'AG2289', SHA2('AG2289@2024', 256), 3, 1, '#629aa9', @superviseur3_id),
  ('AG2281', 'Taoufik', 'Baroudi', 'AG2281', SHA2('AG2281@2024', 256), 3, 1, '#629aa9', @superviseur3_id),
  ('AG2248', 'WIDED', 'TOUATI', 'AG2248', SHA2('AG2248@2024', 256), 3, 1, '#629aa9', @superviseur3_id)
ON DUPLICATE KEY UPDATE
  `nom` = VALUES(`nom`),
  `prenom` = VALUES(`prenom`),
  `chef_equipe` = VALUES(`chef_equipe`),
  `etat` = VALUES(`etat`);

-- Vérification
SELECT 
  'RP Qualification créé' AS message,
  (SELECT COUNT(*) FROM utilisateurs WHERE pseudo = 'Rpyoussef' AND fonction = 12) AS rp_count,
  (SELECT COUNT(*) FROM utilisateurs WHERE id_rp_qualif = @rp_qualif_id AND fonction = 2) AS superviseurs_count,
  (SELECT COUNT(*) FROM utilisateurs WHERE chef_equipe IN (@superviseur1_id, @superviseur2_id, @superviseur3_id) AND fonction = 3) AS agents_count;

-- Afficher la structure complète
SELECT 
  'RP Qualification' AS niveau,
  u.id,
  u.pseudo,
  u.nom,
  u.prenom,
  u.fonction
FROM utilisateurs u
WHERE u.pseudo = 'Rpyoussef' AND u.fonction = 12

UNION ALL

SELECT 
  'Superviseur' AS niveau,
  u.id,
  u.pseudo,
  u.nom,
  u.prenom,
  u.fonction
FROM utilisateurs u
WHERE u.id_rp_qualif = @rp_qualif_id AND u.fonction = 2

UNION ALL

SELECT 
  'Agent' AS niveau,
  u.id,
  u.pseudo,
  u.nom,
  u.prenom,
  u.fonction
FROM utilisateurs u
WHERE u.chef_equipe IN (@superviseur1_id, @superviseur2_id, @superviseur3_id) AND u.fonction = 3
ORDER BY niveau, pseudo;

