-- Migration : plages de dates fixes → critères relatifs (< 3 mois, etc.)
USE `crm`;

ALTER TABLE `regles_autorisation`
  ADD COLUMN `date_insert_operateur` varchar(4) DEFAULT NULL COMMENT '< > <= >=' AFTER `id_etat_final`,
  ADD COLUMN `date_insert_valeur` int(11) DEFAULT NULL AFTER `date_insert_operateur`,
  ADD COLUMN `date_insert_unite` varchar(10) DEFAULT NULL COMMENT 'jour, mois, annee' AFTER `date_insert_valeur`,
  ADD COLUMN `date_appel_operateur` varchar(4) DEFAULT NULL AFTER `date_insert_unite`,
  ADD COLUMN `date_appel_valeur` int(11) DEFAULT NULL AFTER `date_appel_operateur`,
  ADD COLUMN `date_appel_unite` varchar(10) DEFAULT NULL AFTER `date_appel_valeur`;

-- Optionnel si anciennes colonnes présentes :
-- ALTER TABLE regles_autorisation
--   DROP COLUMN date_insert_debut, DROP COLUMN date_insert_fin,
--   DROP COLUMN date_appel_debut, DROP COLUMN date_appel_fin;

SELECT 'Migration regles_autorisation (colonnes relatives) — vérifiez les colonnes obsolètes date_*_debut/fin' AS message;
