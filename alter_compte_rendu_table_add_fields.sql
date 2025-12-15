-- =====================================================
-- Script pour ajouter les nouveaux champs à la table compte_rendu_pending
-- Si la table existe déjà, utilisez ce script pour l'enrichir
-- Note: MariaDB ne supporte pas IF NOT EXISTS pour ALTER TABLE
-- Si une colonne existe déjà, vous aurez une erreur - ignorez-la simplement
-- =====================================================

USE `crm`;

-- Ajouter les champs d'état et sous-état
-- Note: Si les colonnes existent déjà, vous obtiendrez une erreur que vous pouvez ignorer
ALTER TABLE `compte_rendu_pending`
ADD COLUMN `id_etat_final` int(11) DEFAULT NULL COMMENT 'Etat de la fiche' AFTER `statut`;

ALTER TABLE `compte_rendu_pending`
ADD COLUMN `id_sous_etat` int(11) DEFAULT NULL COMMENT 'Sous-etat de la fiche' AFTER `id_etat_final`;

-- Ajouter les champs d'informations de vente (Phase 3)
ALTER TABLE `compte_rendu_pending`
ADD COLUMN `ph3_installateur` int(11) DEFAULT NULL COMMENT 'Installateur' AFTER `commentaire_admin`;

ALTER TABLE `compte_rendu_pending`
ADD COLUMN `ph3_pac` varchar(255) DEFAULT NULL COMMENT 'Type de PAC' AFTER `ph3_installateur`;

ALTER TABLE `compte_rendu_pending`
ADD COLUMN `ph3_puissance` varchar(255) DEFAULT NULL COMMENT 'Puissance' AFTER `ph3_pac`;

ALTER TABLE `compte_rendu_pending`
ADD COLUMN `ph3_puissance_pv` varchar(255) DEFAULT NULL COMMENT 'Puissance PV' AFTER `ph3_puissance`;

ALTER TABLE `compte_rendu_pending`
ADD COLUMN `ph3_rr_model` varchar(255) DEFAULT NULL COMMENT 'Modele RR' AFTER `ph3_puissance_pv`;

ALTER TABLE `compte_rendu_pending`
ADD COLUMN `ph3_ballon` varchar(255) DEFAULT NULL COMMENT 'Ballon' AFTER `ph3_rr_model`;

ALTER TABLE `compte_rendu_pending`
ADD COLUMN `ph3_marque_ballon` varchar(255) DEFAULT NULL COMMENT 'Marque du ballon' AFTER `ph3_ballon`;

ALTER TABLE `compte_rendu_pending`
ADD COLUMN `ph3_alimentation` varchar(255) DEFAULT NULL COMMENT 'Alimentation' AFTER `ph3_marque_ballon`;

ALTER TABLE `compte_rendu_pending`
ADD COLUMN `ph3_type` varchar(255) DEFAULT NULL COMMENT 'Type' AFTER `ph3_alimentation`;

ALTER TABLE `compte_rendu_pending`
ADD COLUMN `ph3_prix` decimal(10,2) DEFAULT NULL COMMENT 'Prix' AFTER `ph3_type`;

ALTER TABLE `compte_rendu_pending`
ADD COLUMN `ph3_bonus_30` decimal(10,2) DEFAULT NULL COMMENT 'Bonus 30%' AFTER `ph3_prix`;

ALTER TABLE `compte_rendu_pending`
ADD COLUMN `ph3_mensualite` decimal(10,2) DEFAULT NULL COMMENT 'Mensualite' AFTER `ph3_bonus_30`;

ALTER TABLE `compte_rendu_pending`
ADD COLUMN `ph3_attente` varchar(255) DEFAULT NULL COMMENT 'Attente' AFTER `ph3_mensualite`;

ALTER TABLE `compte_rendu_pending`
ADD COLUMN `nbr_annee_finance` int(11) DEFAULT NULL COMMENT 'Nombre d annees de financement' AFTER `ph3_attente`;

ALTER TABLE `compte_rendu_pending`
ADD COLUMN `credit_immobilier` varchar(255) DEFAULT NULL COMMENT 'Credit immobilier' AFTER `nbr_annee_finance`;

ALTER TABLE `compte_rendu_pending`
ADD COLUMN `credit_autre` varchar(255) DEFAULT NULL COMMENT 'Autre credit' AFTER `credit_immobilier`;

-- Ajouter les index pour améliorer les performances
-- Note: Si les index existent déjà, vous obtiendrez une erreur que vous pouvez ignorer
ALTER TABLE `compte_rendu_pending`
ADD INDEX `idx_id_etat_final` (`id_etat_final`);

ALTER TABLE `compte_rendu_pending`
ADD INDEX `idx_id_sous_etat` (`id_sous_etat`);

SELECT 'Table compte_rendu_pending mise à jour avec succès' AS message;

