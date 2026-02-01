-- =====================================================
-- Diagnostic : pourquoi yj_signature (2026-01) a 157 lignes
-- et signature n'en a que 150 après migration
-- =====================================================
-- Exécuter dans la base crm après migration
-- =====================================================

USE `crm`;

-- 1) Comptages bruts
SELECT '=== COMPTAGES ===' AS etape;
SELECT COUNT(*) AS yj_signature_2026_01 FROM yj_signature WHERE date_heure LIKE '2026-01%';
SELECT COUNT(*) AS signature_2026_01 FROM signature WHERE date_heure LIKE '2026-01%';

-- 2) Déduplication : combien de (tel, confirmateur, date_heure) distincts dans yj_signature ?
-- Si ce nombre = 150, les 7 lignes manquantes sont des doublons (même tel + confirmateur + date_heure)
SELECT '=== DOUBLONS (tel, confirmateur, date_heure) ===' AS etape;
SELECT COUNT(*) AS nb_lignes,
       COUNT(DISTINCT CONCAT(COALESCE(tel,''), '|', COALESCE(confirmateur,''), '|', COALESCE(date_heure,''))) AS nb_distinct_triples
FROM yj_signature
WHERE date_heure LIKE '2026-01%';

-- 3) Lister les groupes en doublon (plus d'une ligne pour le même triple)
SELECT '=== GROUPES DOUBLONS (triple tel|confirmateur|date_heure) ===' AS etape;
SELECT tel, confirmateur, date_heure, COUNT(*) AS nb
FROM yj_signature
WHERE date_heure LIKE '2026-01%'
GROUP BY tel, confirmateur, date_heure
HAVING COUNT(*) > 1
ORDER BY nb DESC;

-- 4) Lignes potentiellement exclues : tel NULL ou vide
SELECT '=== EXCLUSIONS: tel NULL ou vide ===' AS etape;
SELECT COUNT(*) AS nb_tel_vide
FROM yj_signature
WHERE date_heure LIKE '2026-01%'
  AND (tel IS NULL OR TRIM(COALESCE(tel,'')) = '');

-- 5) Lignes potentiellement exclues : date_heure NULL
SELECT '=== EXCLUSIONS: date_heure NULL ===' AS etape;
SELECT COUNT(*) AS nb_date_null
FROM yj_signature
WHERE (date_heure IS NULL OR date_heure NOT LIKE '2026-01%');
-- Pour la période 2026-01 uniquement :
SELECT COUNT(*) AS nb_date_null_dans_2026_01
FROM yj_signature
WHERE date_heure LIKE '2026-01%' AND date_heure IS NULL;
-- (devrait être 0 si LIKE '2026-01%' est utilisé)

-- 6) Si confirmateur est un pseudo (texte) : lignes dont le confirmateur n'existe pas dans utilisateurs
-- (yj_signature n'a pas de colonne id, on affiche tel, confirmateur, date_heure)
SELECT '=== EXCLUSIONS: confirmateur (pseudo) non trouvé dans utilisateurs ===' AS etape;
SELECT yj.tel, yj.confirmateur, yj.date_heure
FROM yj_signature yj
LEFT JOIN utilisateurs u ON TRIM(UPPER(yj.confirmateur)) = TRIM(UPPER(u.pseudo))
WHERE yj.date_heure LIKE '2026-01%'
  AND u.id IS NULL
  AND yj.confirmateur IS NOT NULL
  AND TRIM(COALESCE(yj.confirmateur,'')) != ''
ORDER BY yj.confirmateur, yj.date_heure
LIMIT 20;

-- 7) Résumé : combien de lignes yj_signature 2026-01 seraient exclues par (tel vide OU confirmateur non trouvé) ?
-- (en supposant colonne confirmateur = pseudo texte et JOIN utilisateurs)
SELECT '=== RÉSUMÉ LIGNES EXCLUES (tel vide ou confirmateur inconnu) ===' AS etape;
SELECT COUNT(*) AS nb_exclues
FROM yj_signature yj
LEFT JOIN utilisateurs u ON TRIM(UPPER(yj.confirmateur)) = TRIM(UPPER(u.pseudo))
WHERE yj.date_heure LIKE '2026-01%'
  AND (
    (yj.tel IS NULL OR TRIM(COALESCE(yj.tel,'')) = '')
    OR (u.id IS NULL AND yj.confirmateur IS NOT NULL AND TRIM(COALESCE(yj.confirmateur,'')) != '')
  );

-- 8) Lister les pseudo confirmateurs non trouvés (pour correction ou ajout dans utilisateurs)
SELECT '=== PSEUDOS CONFIRMATORS NON TROUVÉS (2026-01) ===' AS etape;
SELECT yj.confirmateur AS pseudo_yj, COUNT(*) AS nb_lignes
FROM yj_signature yj
LEFT JOIN utilisateurs u ON TRIM(UPPER(yj.confirmateur)) = TRIM(UPPER(u.pseudo))
WHERE yj.date_heure LIKE '2026-01%'
  AND u.id IS NULL
  AND yj.confirmateur IS NOT NULL
  AND TRIM(COALESCE(yj.confirmateur,'')) != ''
GROUP BY yj.confirmateur
ORDER BY nb_lignes DESC;
