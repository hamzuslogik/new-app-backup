-- Mettre à jour la table notifications pour ajouter les colonnes metadata et action
-- Si la table existe déjà, ajouter les colonnes
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS metadata text CHARACTER SET utf8 DEFAULT NULL COMMENT 'Métadonnées JSON (date_rdv_time, etc.)';

ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS action varchar(20) DEFAULT NULL COMMENT 'Action effectuée (accepted, refused, pending)';

-- Ajouter l'index pour action si nécessaire
CREATE INDEX IF NOT EXISTS idx_action ON notifications(action);

