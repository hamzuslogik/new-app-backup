-- Bases existantes : ajout des champs d’événements sur user_activity (une ligne par utilisateur).
-- Le serveur exécute aussi ces ALTER au premier usage (ensureUserActivityTable).
-- Si une colonne existe déjà, ignorer l’erreur « Duplicate column » pour cette ligne.

ALTER TABLE user_activity ADD COLUMN nature VARCHAR(64) NULL DEFAULT NULL AFTER last_activity;
ALTER TABLE user_activity ADD COLUMN detail TEXT NULL AFTER nature;
ALTER TABLE user_activity ADD COLUMN activity_events LONGTEXT NULL AFTER detail;
