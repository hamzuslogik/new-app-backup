-- =====================================================
-- Script pour mettre à jour la table signature
-- Calcul des scores selon les nouvelles règles:
-- - 1 confirmateur: score = 1.0
-- - 2 confirmateurs: score = 0.5 pour chacun
-- - 3 confirmateurs: score = 0.33 pour chacun (1/3)
-- =====================================================

USE `crm`;

-- =====================================================
-- ÉTAPE 1: Supprimer les anciens enregistrements de signature
-- pour les fiches signées (état 13) avec date_sign_time
-- =====================================================
-- Note: On supprime uniquement les signatures liées aux fiches signées actuelles
DELETE s FROM signature s
INNER JOIN fiches f ON s.tel = f.tel
WHERE f.id_etat_final = 13 
  AND f.date_sign_time IS NOT NULL 
  AND f.date_sign_time != '';

-- =====================================================
-- ÉTAPE 2: Insérer les nouveaux scores selon les règles
-- =====================================================
-- Gérer chaque cas séparément pour plus de clarté

-- Cas 1: Un seul confirmateur (id_confirmateur uniquement)
INSERT INTO signature (confirmateur, ajoute, date_heure, tel)
SELECT 
  fiche.id_confirmateur as confirmateur,
  1.0 as ajoute,
  fiche.date_sign_time as date_heure,
  fiche.tel
FROM fiches fiche
WHERE fiche.id_etat_final = 13
  AND fiche.date_sign_time IS NOT NULL
  AND fiche.date_sign_time != ''
  AND fiche.archive = 0
  AND fiche.ko = 0
  AND fiche.active = 1
  AND fiche.id_confirmateur > 0
  AND (fiche.id_confirmateur_2 IS NULL OR fiche.id_confirmateur_2 = 0)
  AND (fiche.id_confirmateur_3 IS NULL OR fiche.id_confirmateur_3 = 0);

-- Cas 2: Deux confirmateurs (id_confirmateur + id_confirmateur_2)
INSERT INTO signature (confirmateur, ajoute, date_heure, tel)
SELECT 
  fiche.id_confirmateur as confirmateur,
  0.5 as ajoute,
  fiche.date_sign_time as date_heure,
  fiche.tel
FROM fiches fiche
WHERE fiche.id_etat_final = 13
  AND fiche.date_sign_time IS NOT NULL
  AND fiche.date_sign_time != ''
  AND fiche.archive = 0
  AND fiche.ko = 0
  AND fiche.active = 1
  AND fiche.id_confirmateur > 0
  AND fiche.id_confirmateur_2 > 0
  AND (fiche.id_confirmateur_3 IS NULL OR fiche.id_confirmateur_3 = 0);

-- Cas 2b: Deuxième confirmateur (id_confirmateur_2)
INSERT INTO signature (confirmateur, ajoute, date_heure, tel)
SELECT 
  fiche.id_confirmateur_2 as confirmateur,
  0.5 as ajoute,
  fiche.date_sign_time as date_heure,
  fiche.tel
FROM fiches fiche
WHERE fiche.id_etat_final = 13
  AND fiche.date_sign_time IS NOT NULL
  AND fiche.date_sign_time != ''
  AND fiche.archive = 0
  AND fiche.ko = 0
  AND fiche.active = 1
  AND fiche.id_confirmateur > 0
  AND fiche.id_confirmateur_2 > 0
  AND (fiche.id_confirmateur_3 IS NULL OR fiche.id_confirmateur_3 = 0);

-- Cas 3: Trois confirmateurs (id_confirmateur + id_confirmateur_2 + id_confirmateur_3)
-- Score = 1/3 (≈0.33) pour chacun
INSERT INTO signature (confirmateur, ajoute, date_heure, tel)
SELECT 
  fiche.id_confirmateur as confirmateur,
  ROUND(1.0 / 3.0, 2) as ajoute,
  fiche.date_sign_time as date_heure,
  fiche.tel
FROM fiches fiche
WHERE fiche.id_etat_final = 13
  AND fiche.date_sign_time IS NOT NULL
  AND fiche.date_sign_time != ''
  AND fiche.archive = 0
  AND fiche.ko = 0
  AND fiche.active = 1
  AND fiche.id_confirmateur > 0
  AND fiche.id_confirmateur_2 > 0
  AND fiche.id_confirmateur_3 > 0;

-- Cas 3b: Deuxième confirmateur (id_confirmateur_2) avec 3 confirmateurs
INSERT INTO signature (confirmateur, ajoute, date_heure, tel)
SELECT 
  fiche.id_confirmateur_2 as confirmateur,
  ROUND(1.0 / 3.0, 2) as ajoute,
  fiche.date_sign_time as date_heure,
  fiche.tel
FROM fiches fiche
WHERE fiche.id_etat_final = 13
  AND fiche.date_sign_time IS NOT NULL
  AND fiche.date_sign_time != ''
  AND fiche.archive = 0
  AND fiche.ko = 0
  AND fiche.active = 1
  AND fiche.id_confirmateur > 0
  AND fiche.id_confirmateur_2 > 0
  AND fiche.id_confirmateur_3 > 0;

-- Cas 3c: Troisième confirmateur (id_confirmateur_3)
INSERT INTO signature (confirmateur, ajoute, date_heure, tel)
SELECT 
  fiche.id_confirmateur_3 as confirmateur,
  ROUND(1.0 / 3.0, 2) as ajoute,
  fiche.date_sign_time as date_heure,
  fiche.tel
FROM fiches fiche
WHERE fiche.id_etat_final = 13
  AND fiche.date_sign_time IS NOT NULL
  AND fiche.date_sign_time != ''
  AND fiche.archive = 0
  AND fiche.ko = 0
  AND fiche.active = 1
  AND fiche.id_confirmateur > 0
  AND fiche.id_confirmateur_2 > 0
  AND fiche.id_confirmateur_3 > 0;

-- Vérifier les résultats
SELECT 
  'Résumé de la mise à jour' as info,
  COUNT(*) as total_signatures,
  COUNT(DISTINCT confirmateur) as nombre_confirmateurs,
  SUM(ajoute) as total_score
FROM signature;

-- Afficher les scores par confirmateur
SELECT 
  confirmateur,
  SUM(ajoute) as score_total,
  COUNT(*) as nombre_signatures
FROM signature
GROUP BY confirmateur
ORDER BY score_total DESC;

