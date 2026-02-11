-- =====================================================
-- Script d'insertion des sous-états pour l'état KO (id 54)
-- Date: 2026-02-11
-- =====================================================

-- Vérifier que l'état KO existe
SELECT id, titre FROM etats WHERE id = 54;

-- Supprimer les sous-états existants pour l'état KO (optionnel - décommenter si nécessaire)
-- DELETE FROM sous_etat WHERE id_etat = 54;

-- Insérer les sous-états pour l'état KO (id 54)
INSERT INTO sous_etat (id_etat, titre) VALUES
(54, 'CONSOMMATION MAUVAISE VÉRIFICATION'),
(54, 'TITRE DE PROPRIÉTÉ MAUVAISE VÉRIFICATION'),
(54, 'ÂGE MODE DE CHAUFFAGE'),
(54, 'SURFACE CHAUFFÉE'),
(54, 'TYPE DE CONTRAT'),
(54, 'REVENU MAUVAISE VÉRIFICATION'),
(54, 'MAUVAISE VÉRIFICATION 20M²'),
(54, 'SURFACE JARDIN'),
(54, 'ÂGE CLIENT VÉRIFICATION NON EFFECTUÉE'),
(54, 'INTÉRÊT'),
(54, 'TRAITEMENT'),
(54, 'ZONE MAUVAISE VÉRIFICATION'),
(54, 'ÂGE DES PANNEAUX EXISTANTS'),
(54, 'TAUX D''ENDETTEMENT NON VÉRIFIÉ'),
(54, 'CLIENT NON SÉRIEUX'),
(54, 'DÉMÉNAGEMENT'),
(54, 'VERROUILLAGE'),
(54, 'KO ACCORD'),
(54, 'COORDONNÉES NON VÉRIFIÉES'),
(54, 'VÉRIFICATION REVENU'),
(54, 'DOMAINE D''ACTIVITÉ');

-- Vérifier les sous-états insérés
SELECT id, id_etat, titre 
FROM sous_etat 
WHERE id_etat = 54 
ORDER BY titre ASC;

-- Afficher le nombre total de sous-états pour l'état KO
SELECT COUNT(*) as total_sous_etats_ko 
FROM sous_etat 
WHERE id_etat = 54;
