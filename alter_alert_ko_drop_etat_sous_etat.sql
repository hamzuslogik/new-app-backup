-- =====================================================
-- Migration : supprimer id_etat et id_sous_etat de alert_ko
-- À exécuter si la table alert_ko contient encore ces colonnes.
-- =====================================================

ALTER TABLE `alert_ko`
  DROP COLUMN `id_etat`,
  DROP COLUMN `id_sous_etat`;

-- Si une des colonnes n'existe pas, MySQL renverra une erreur pour cette colonne.
-- Dans ce cas exécuter séparément :
-- ALTER TABLE `alert_ko` DROP COLUMN `id_etat`;
-- ALTER TABLE `alert_ko` DROP COLUMN `id_sous_etat`;
