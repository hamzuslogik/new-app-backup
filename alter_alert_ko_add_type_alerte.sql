-- =====================================================
-- Migration : ajouter type_alerte à la table alert_ko
-- À exécuter si la table alert_ko existe déjà sans la colonne type_alerte.
-- Types : PERSO, TECHNIQUE (remplace état/sous-état dans le modal).
-- =====================================================

-- Ajouter la colonne type_alerte (exécuter une seule fois ; si la colonne existe déjà, MySQL renverra une erreur à ignorer)
ALTER TABLE `alert_ko`
  ADD COLUMN `type_alerte` varchar(20) NOT NULL DEFAULT 'PERSO'
  COMMENT 'Type d''alerte : PERSO ou TECHNIQUE'
  AFTER `id_qualite`;

-- Index pour les filtres
CREATE INDEX idx_type_alerte ON alert_ko (type_alerte);
