-- Ajouter des index pour optimiser les recherches par téléphone
-- Ces index amélioreront considérablement les performances des recherches par téléphone (tel, gsm1, gsm2)
-- 
-- IMPORTANT: MariaDB/MySQL ne supporte pas "IF NOT EXISTS" pour CREATE INDEX
-- Si un index existe déjà, vous obtiendrez une erreur que vous pouvez ignorer
-- Pour vérifier les index existants avant d'exécuter : SHOW INDEX FROM `fiches`;

-- Index sur tel (recherche principale)
CREATE INDEX `idx_fiches_tel` 
ON `fiches` (`tel`);

-- Index sur gsm1 (recherche secondaire)
CREATE INDEX `idx_fiches_gsm1` 
ON `fiches` (`gsm1`);

-- Index sur gsm2 (recherche secondaire)
CREATE INDEX `idx_fiches_gsm2` 
ON `fiches` (`gsm2`);

-- Index composite pour optimiser les recherches combinées (tel OU gsm1 OU gsm2)
-- Note: MySQL peut utiliser ces index même avec des conditions OR
-- Cet index composite peut aider si les recherches combinent souvent tel avec d'autres filtres
CREATE INDEX `idx_fiches_tel_gsm1_gsm2` 
ON `fiches` (`tel`, `gsm1`, `gsm2`);

-- Vérifier les index créés
SHOW INDEX FROM `fiches` WHERE Key_name LIKE 'idx_fiches_%tel%' OR Key_name LIKE 'idx_fiches_%gsm%';

-- Pour vérifier tous les index de la table fiches :
-- SHOW INDEX FROM `fiches`;
