-- Ajoute les colonnes manquantes dans compte_rendu_pending (MySQL)
-- Colonnes cible: pseudo, valeur_mensualite, conf_consommations, produit, date_visite
-- Version sans PREPARE/EXECUTE (evite l'erreur #1243 dans certains clients)

ALTER TABLE `compte_rendu_pending`
  ADD COLUMN IF NOT EXISTS `pseudo` VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS `valeur_mensualite` DECIMAL(10,2) NULL,
  ADD COLUMN IF NOT EXISTS `conf_consommations` DECIMAL(10,2) NULL,
  ADD COLUMN IF NOT EXISTS `produit` INT NULL,
  ADD COLUMN IF NOT EXISTS `date_visite` DATETIME NULL;

SELECT 'Migration compte_rendu_pending terminee' AS message;
