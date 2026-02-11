-- =====================================================
-- Script d'insertion des sous-états pour l'état HC (id 55)
-- Date: 2026-02-11
-- =====================================================

-- Vérifier que l'état HC existe
SELECT id, titre FROM etats WHERE id = 55;

-- Supprimer les sous-états existants pour l'état HC (optionnel - décommenter si nécessaire)
-- DELETE FROM sous_etat WHERE id_etat = 55;

-- Insérer les sous-états pour l'état HC (id 55)
INSERT INTO sous_etat (id_etat, titre) VALUES
(55, 'HC DÉPARTEMENT'),
(55, 'HC REVENU'),
(55, 'HC TYPE D''HABITATION'),
(55, 'HC PROJET DE VENTE'),
(55, 'HC ÂGE DU CLIENT'),
(55, 'HC SURFACE CHAUFFÉE'),
(55, 'HC TYPE DE CONTRAT'),
(55, 'HC CONSOMMATION'),
(55, 'HC INTÉRÊT'),
(55, 'HC PUISSANCE PV EXISTANTE : +6 KW'),
(55, 'HC TAUX D''ENDETTEMENT +50%'),
(55, 'HC MODE DE CHAUFFAGE'),
(55, 'HC CLIENT NON SÉRIEUX'),
(55, 'HC SURFACE JARDIN -100M²'),
(55, 'HC TITRE DE PROPRIÉTÉ'),
(55, 'HC DOMAINE D''ACTIVITÉ');

-- Vérifier les sous-états insérés
SELECT id, id_etat, titre 
FROM sous_etat 
WHERE id_etat = 55 
ORDER BY titre ASC;

-- Afficher le nombre total de sous-états pour l'état HC
SELECT COUNT(*) as total_sous_etats_hc 
FROM sous_etat 
WHERE id_etat = 55;
