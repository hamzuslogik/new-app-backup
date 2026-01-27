-- =====================================================
-- Données Contrôle Qualité : CQ ETAT et CQ DOSSIER
-- =====================================================
-- À exécuter une fois. Les tables cq_etat et cq_dossier
-- doivent exister (voir database_schema.sql).

-- CQ ETAT : NRP / INJOIGNABLE, RAS, NEGATIF
INSERT IGNORE INTO `cq_etat` (`id`, `titre`) VALUES
(1, 'NRP / INJOIGNABLE'),
(2, 'RAS'),
(3, 'NEGATIF');

-- CQ DOSSIER : COMPLET, INCOMPLET
INSERT IGNORE INTO `cq_dossier` (`id`, `titre`) VALUES
(1, 'COMPLET'),
(2, 'INCOMPLET');
