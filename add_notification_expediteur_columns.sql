-- Ajouter les colonnes pour l'expéditeur des notifications (workflow)
-- id_expediteur : utilisateur à l'origine de la notification (workflow)
-- afficher_expediteur : 1 = afficher l'expéditeur, 0 = ne pas l'afficher

-- Exécuter chaque ligne. Si la colonne existe déjà, ignorer l'erreur "Duplicate column name".
ALTER TABLE notifications ADD COLUMN id_expediteur INT(11) DEFAULT NULL COMMENT 'ID utilisateur expéditeur (workflow)';
ALTER TABLE notifications ADD COLUMN afficher_expediteur TINYINT(1) DEFAULT 1 COMMENT '1=afficher expéditeur, 0=masquer';
