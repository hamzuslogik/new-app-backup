-- Vérifier si l'état REFUS-ADMIN existe, sinon le créer
-- Note: Ajustez le groupe, l'ordre, la couleur selon vos besoins

INSERT INTO etats (titre, groupe, ordre, color, etat)
SELECT 
  'REFUS-ADMIN',
  3, -- Phase 3 (états finaux)
  (SELECT COALESCE(MAX(ordre), 0) + 1 FROM etats WHERE groupe = 3), -- Ordre suivant dans Phase 3
  '#FF0000', -- Rouge par défaut
  1 -- Actif
WHERE NOT EXISTS (
  SELECT 1 FROM etats 
  WHERE (titre LIKE '%REFUS-ADMIN%' OR titre LIKE '%REFUS ADMIN%' OR titre LIKE '%REFUSADMIN%')
  AND etat = 1
);

