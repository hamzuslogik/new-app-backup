-- Ajouter l'option pour afficher ou masquer l'expéditeur des messages système
-- afficher_expediteur : 1 = afficher le createur, 0 = ne pas l'afficher

ALTER TABLE system_messages ADD COLUMN afficher_expediteur TINYINT(1) DEFAULT 1 COMMENT '1=afficher expéditeur, 0=masquer';
