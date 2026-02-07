# Pourquoi fiches_histo contient des lignes avec id_confirmateur NULL

## Cause

**Aucun code de l’application ne renseigne `id_confirmateur` (ni `id_confirmateur_2`, `id_confirmateur_3`) lors des INSERT dans `fiches_histo`.**

Tous les INSERT utilisent uniquement un sous-ensemble de colonnes :
- `id_fiche`, `id_etat`, `date_creation` (partout)
- parfois `date_rdv_time`

Les colonnes confirmateurs existent dans la table (schéma `create_fiches_histo_table.sql` / `enrichir_fiches_histo_table.sql`) mais ne sont jamais alimentées par le backend.

## Emplacements concernés

| Fichier | Ligne | Colonnes insérées |
|---------|-------|-------------------|
| `backend/routes/compte-rendu.routes.js` | 825 | id_fiche, id_etat, date_creation |
| `backend/routes/fiche.routes.js` | 2370 | id_fiche, id_etat, date_creation |
| `backend/routes/fiche.routes.js` | 2986 | id_fiche, id_etat, date_creation |
| `backend/routes/fiche.routes.js` | 3491 | id_fiche, id_etat, date_creation |
| `backend/routes/fiche.routes.js` | 3576 | id_fiche, id_etat, date_rdv_time, date_creation |
| `backend/routes/fiche.routes.js` | 3687 | id_fiche, id_etat, date_creation |
| `backend/routes/fiche.routes.js` | 3769 | id_fiche, id_etat, date_creation |
| `backend/routes/fiche.routes.js` | 4113 | id_fiche, id_etat, date_rdv_time, date_creation |
| `backend/routes/notification.routes.js` | 557 | id_fiche, id_etat, date_creation |
| `backend/routes/notification.routes.js` | 660 | id_fiche, id_etat, date_creation |
| `backend/routes/decalage.routes.js` | 520 | id_fiche, id_etat, date_rdv_time, date_creation |
| `backend/services/workflow/workflow-executor.js` | 772 | id_fiche, id_etat, date_creation |

## Pistes de correction

1. **À chaque INSERT dans `fiches_histo`** : récupérer la fiche courante (ou utiliser l’objet fiche déjà chargé) et ajouter dans l’INSERT :
   - `id_confirmateur`, `id_confirmateur_2`, `id_confirmateur_3` (depuis `fiches`)
   - éventuellement `id_commercial` pour cohérence avec la table `confirmations`.

2. **Script SQL de rattrapage** : mettre à jour les lignes existantes de `fiches_histo` où `id_confirmateur` est NULL en recopiant les valeurs actuelles de la fiche (par `id_fiche`). Attention : l’historique reflète l’état au moment du changement ; les confirmateurs ont pu changer depuis.

3. **Ne rien changer** : si l’usage métier n’a pas besoin des confirmateurs dans l’historique, les NULL restent acceptables.
