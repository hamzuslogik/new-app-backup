-- =====================================================
-- Ajouter l'utilisateur CLARA (vrai nom CLARA, équipe garnier)
-- Base de données: crm
-- =====================================================
-- Exécuter avec: mysql -u ... -p crm < add_utilisateur_clara.sql
-- =====================================================

USE `crm`;

-- Insérer CLARA si le pseudo n'existe pas (comparaison insensible à la casse)
INSERT INTO `utilisateurs` (`pseudo`, `nom`, `prenom`, `login`, `mdp`, `fonction`, `etat`, `centre`)
SELECT 'CLARA', 'CLARA', '', 'CLARA', SHA2('CLARA', 256), 6, 1, 'garnier'
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM `utilisateurs` u
  WHERE TRIM(UPPER(u.pseudo)) = 'CLARA'
);

-- Si CLARA existe déjà, mettre à jour nom et centre (équipe garnier)
UPDATE `utilisateurs`
SET `nom` = 'CLARA', `centre` = 'garnier'
WHERE TRIM(UPPER(pseudo)) = 'CLARA';

-- Vérification
SELECT id, pseudo, nom, prenom, centre, fonction, etat
FROM `utilisateurs`
WHERE TRIM(UPPER(pseudo)) = 'CLARA';
