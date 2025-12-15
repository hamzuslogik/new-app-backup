-- Script pour vérifier et corriger les titres d'états
-- Vérifier les titres des états 7 (CONFIRMER) et 8 (ANNULER)

USE `crm`;

-- Vérifier les titres actuels
SELECT 
    id,
    titre,
    color,
    groupe,
    CASE 
        WHEN id = 7 AND titre NOT LIKE '%CONFIRMER%' AND titre NOT LIKE '%CONFIRME%' THEN 'ATTENTION: État 7 devrait être CONFIRMER'
        WHEN id = 8 AND titre NOT LIKE '%ANNULER%' THEN 'ATTENTION: État 8 devrait être ANNULER'
        ELSE 'OK'
    END as verification
FROM etats
WHERE id IN (7, 8)
ORDER BY id;

-- Afficher tous les états pour référence
SELECT id, titre, color, groupe FROM etats ORDER BY id;

