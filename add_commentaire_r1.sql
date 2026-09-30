-- Champs R2 / R1 déjà ajoutés côté BDD pour is_r2, date_r1, id_commercial_r1.
-- Commentaire R1 (requis si is_r2 = OUI) :
ALTER TABLE `fiches`
  ADD COLUMN IF NOT EXISTS `commentaire_r1` TEXT NULL AFTER `id_commercial_r1`;

ALTER TABLE `fiches_histo`
  ADD COLUMN IF NOT EXISTS `commentaire_r1` TEXT NULL AFTER `id_commercial_r1`;

-- MySQL < 8.0.12 : utiliser sans IF NOT EXISTS si erreur de syntaxe :
-- ALTER TABLE `fiches` ADD COLUMN `commentaire_r1` TEXT NULL AFTER `id_commercial_r1`;
-- ALTER TABLE `fiches_histo` ADD COLUMN `commentaire_r1` TEXT NULL AFTER `id_commercial_r1`;
