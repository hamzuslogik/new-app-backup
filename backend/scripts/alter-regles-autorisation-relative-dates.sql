-- Migration : ajouter colonnes critères relatifs (< 3 mois, etc.)
-- À exécuter si erreur : Unknown column 'date_insert_operateur'
USE `crm`;

ALTER TABLE `regles_autorisation`
  ADD COLUMN `date_insert_operateur` varchar(4) DEFAULT NULL COMMENT '< > <= >=' AFTER `id_etat_final`;

ALTER TABLE `regles_autorisation`
  ADD COLUMN `date_insert_valeur` int(11) DEFAULT NULL AFTER `date_insert_operateur`;

ALTER TABLE `regles_autorisation`
  ADD COLUMN `date_insert_unite` varchar(10) DEFAULT NULL COMMENT 'jour, mois, annee' AFTER `date_insert_valeur`;

ALTER TABLE `regles_autorisation`
  ADD COLUMN `date_appel_operateur` varchar(4) DEFAULT NULL AFTER `date_insert_unite`;

ALTER TABLE `regles_autorisation`
  ADD COLUMN `date_appel_valeur` int(11) DEFAULT NULL AFTER `date_appel_operateur`;

ALTER TABLE `regles_autorisation`
  ADD COLUMN `date_appel_unite` varchar(10) DEFAULT NULL AFTER `date_appel_valeur`;

-- Si une colonne existe déjà, ignorer l'erreur Duplicate column pour cette ligne et continuer.
-- Optionnel (anciennes colonnes inutilisées) :
-- ALTER TABLE regles_autorisation DROP COLUMN date_insert_debut;
-- ALTER TABLE regles_autorisation DROP COLUMN date_insert_fin;
-- ALTER TABLE regles_autorisation DROP COLUMN date_appel_debut;
-- ALTER TABLE regles_autorisation DROP COLUMN date_appel_fin;

SELECT 'Colonnes regles_autorisation (critères relatifs) ajoutées' AS message;
