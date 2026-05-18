-- Ajoute date_rdv_time à affectations (copiée depuis fiches.date_rdv_time à l'affectation)
USE `crm`;

ALTER TABLE `affectations`
  ADD COLUMN `date_rdv_time` datetime DEFAULT NULL AFTER `id_commercial`,
  ADD KEY `idx_date_rdv_time` (`date_rdv_time`);

-- Renseigner les lignes existantes depuis la fiche liée
UPDATE affectations aff
INNER JOIN fiches f ON f.id = aff.id_fiche
SET aff.date_rdv_time = f.date_rdv_time
WHERE aff.id_commercial > 0
  AND f.date_rdv_time IS NOT NULL
  AND f.date_rdv_time != '';

SELECT 'Colonne affectations.date_rdv_time ajoutée' AS message;
