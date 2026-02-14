-- Ajouter la colonne archive à la table notifications (notifications lues et de plus de 3 jours)
-- Les notifications archivées ne s'affichent plus dans la liste ni dans le compteur.

ALTER TABLE notifications ADD COLUMN archive TINYINT(1) NOT NULL DEFAULT 0 AFTER action;
CREATE INDEX idx_archive ON notifications (archive);
