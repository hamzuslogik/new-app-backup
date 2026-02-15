-- =====================================================
-- Rendre id_compte_rendu_pending nullable dans porte_ouverte
-- =====================================================
-- À exécuter UNE FOIS avant fill_porte_ouverte_from_fiches_histo.sql
-- pour permettre l'insertion de lignes depuis fiches_histo (sans compte rendu).
-- Sans cela : erreur #1452 (foreign key fk_porte_ouverte_cr).
-- =====================================================

USE `crm`;

-- Supprimer la FK puis modifier la colonne
ALTER TABLE `porte_ouverte` DROP FOREIGN KEY `fk_porte_ouverte_cr`;
ALTER TABLE `porte_ouverte` MODIFY `id_compte_rendu_pending` INT(11) NULL COMMENT 'Compte rendu à l''origine (NULL si source fiches_histo)';

SELECT 'Colonne id_compte_rendu_pending est maintenant nullable.' AS message;
