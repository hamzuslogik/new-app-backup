# Plan d'implémentation - Page Contrôle Qualité pour Qualité Qualification

## Objectif
Implémenter toutes les fonctionnalités demandées pour la fonction "Qualité Qualification" sur la page "Contrôle Qualité".

## Fonctionnalités demandées

### ✅ Déjà implémentées
1. **Affichage de la production** : La page affiche déjà les fiches avec les états du groupe 0
2. **Filtres** : Les filtres date, agent, état sont déjà disponibles (il y a aussi centre et produit)
3. **Bouton de validation** : Il existe un bouton "Valider" qui appelle `/fiches/${hash}/valider-qualite`

### ❌ À implémenter
1. **Vérifier/implémenter la route backend** `/fiches/:hash/valider-qualite` pour passer une fiche en état "En-Attente"
2. **Ajouter un champ commentaire qualité** à la table `fiches` dans la base de données
3. **Ajouter une interface pour ajouter/modifier le commentaire qualité** dans la page Contrôle Qualité
4. **S'assurer que les filtres correspondent exactement** aux exigences (date, agent, état uniquement)

---

## ÉTAPE 1 : Vérifier et implémenter la route backend `/fiches/:hash/valider-qualite`

### Fichier : `backend/routes/fiche.routes.js`

**Actions :**
1. Chercher si la route existe déjà dans le fichier
2. Si elle n'existe pas, créer la route :
   ```javascript
   router.put('/:hash/valider-qualite', authenticate, hashToIdMiddleware, async (req, res) => {
     // Vérifier les permissions (fonction 4 = Qualité Qualification)
     // Récupérer l'état "En-Attente" (ID 1)
     // Mettre à jour la fiche avec id_etat_final = 1
     // Enregistrer la modification dans modifica
     // Retourner succès
   });
   ```
3. Vérifier que l'état "En-Attente" a l'ID 1 dans la table `etats`
4. Ajouter les vérifications de permissions appropriées

**Vérifications nécessaires :**
- La fonction ID pour "Qualité Qualification" (probablement 4)
- L'ID de l'état "En-Attente" dans la table `etats`
- La route doit être placée AVANT la route `/:id` pour éviter les conflits de routing

---

## ÉTAPE 2 : Ajouter le champ `commentaire_qualite` à la table `fiches`

### Fichier : `add_commentaire_qualite_column.sql` (à créer)

**Actions :**
1. Créer un script SQL pour ajouter la colonne `commentaire_qualite` à la table `fiches`
2. Type de colonne : `TEXT CHARACTER SET utf8 DEFAULT NULL`
3. Position : après le champ `commentaire`
4. Exécuter le script sur la base de données

**Script SQL :**
```sql
USE `crm`;

-- Vérifier et ajouter la colonne commentaire_qualite si elle n'existe pas
SET @dbname = SCHEMA();
SET @tablename = 'fiches';
SET @columnname = 'commentaire_qualite';

SELECT COUNT(*) INTO @col_exists
FROM INFORMATION_SCHEMA.COLUMNS
WHERE table_schema = @dbname
  AND table_name = @tablename
  AND column_name = @columnname;

SET @sql = IF(@col_exists = 0,
  CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN `', @columnname, '` TEXT CHARACTER SET utf8 DEFAULT NULL AFTER `commentaire`'),
  'SELECT "Column already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'Colonne commentaire_qualite ajoutée avec succès' AS message;
```

---

## ÉTAPE 3 : Mettre à jour les routes backend pour gérer `commentaire_qualite`

### Fichier : `backend/routes/fiche.routes.js`

**Actions :**

1. **Route GET `/fiches/controle-qualite`** (ligne ~953)
   - Ajouter `fiche.commentaire_qualite` dans le SELECT
   - Exemple :
     ```javascript
     SELECT 
       fiche.id,
       fiche.nom,
       ...
       fiche.commentaire_qualite,
       ...
     FROM fiches fiche
     ```

2. **Route PUT `/fiches/:id`** (ligne ~2029)
   - Ajouter `commentaire_qualite` dans la liste des `allowedFields`
   - Exemple :
     ```javascript
     const allowedFields = [
       ...
       'commentaire_qualite'
     ];
     ```

3. **Route PUT `/fiches/:id/:field`** (ligne ~1571)
   - Ajouter `commentaire_qualite` dans la liste des `allowedFields`
   - Exemple :
     ```javascript
     const allowedFields = [
       ...
       'commentaire_qualite'
     ];
     ```

4. **Route POST `/fiches`** (ligne ~1626) - Si nécessaire
   - Ajouter `commentaire_qualite` dans les champs autorisés lors de la création

---

## ÉTAPE 4 : Modifier le frontend pour ajouter l'interface de commentaire qualité

### Fichier : `frontend/src/pages/ControleQualite.jsx`

**Actions :**

1. **Ajouter un état pour gérer l'édition du commentaire**
   ```javascript
   const [editingComment, setEditingComment] = useState({ hash: null, value: '' });
   ```

2. **Créer une mutation pour mettre à jour le commentaire qualité**
   ```javascript
   const updateCommentaireQualiteMutation = useMutation(
     async ({ hash, commentaire_qualite }) => {
       const res = await api.put(`/fiches/${hash}/commentaire_qualite`, {
         value: commentaire_qualite
       });
       return res.data;
     },
     {
       onSuccess: () => {
         queryClient.invalidateQueries(['controle-qualite']);
         toast.success('Commentaire qualité ajouté avec succès');
         setEditingComment({ hash: null, value: '' });
       },
       onError: (error) => {
         toast.error(error.response?.data?.message || 'Erreur lors de la mise à jour du commentaire');
       }
     }
   );
   ```

3. **Ajouter une colonne "Commentaire Qualité" dans le tableau**
   - Dans le `<thead>`, ajouter : `<th>Commentaire Qualité</th>`
   - Dans le `<tbody>`, ajouter une cellule avec :
     - Un bouton/icône pour ouvrir l'édition
     - Un modal ou un champ inline pour éditer le commentaire
     - Afficher le commentaire existant s'il y en a un

4. **Créer un modal ou une interface inline pour éditer le commentaire**
   - Utiliser un `textarea` pour saisir le commentaire
   - Boutons "Enregistrer" et "Annuler"

---

## ÉTAPE 5 : Simplifier les filtres selon les exigences

### Fichier : `frontend/src/pages/ControleQualite.jsx`

**Actions :**

1. **Masquer ou supprimer les filtres non demandés**
   - Supprimer le filtre "Centre" (non demandé)
   - Supprimer le filtre "Produit" (non demandé)
   - Garder uniquement : Date début, Date fin, Agent, État

2. **Mettre à jour l'état `filters`**
   ```javascript
   const [filters, setFilters] = useState({
     page: 1,
     limit: 50,
     id_agent: '',
     id_etat_final: '',
     date_debut: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
     date_fin: new Date().toISOString().split('T')[0]
   });
   ```

3. **Supprimer les requêtes inutiles**
   - Supprimer la requête pour `centresData`
   - Supprimer la requête pour `produitsData`

4. **Nettoyer le JSX**
   - Supprimer les éléments de formulaire pour "Centre" et "Produit"

---

## ÉTAPE 6 : Améliorer le bouton de validation

### Fichier : `frontend/src/pages/ControleQualite.jsx`

**Actions :**

1. **Vérifier que le bouton fonctionne correctement**
   - Tester que la route backend répond correctement
   - Vérifier les messages d'erreur et de succès

2. **Améliorer l'UI du bouton si nécessaire**
   - S'assurer qu'il est bien visible à la fin de chaque ligne
   - Utiliser une icône appropriée (FaCheck ou FaCheckCircle)
   - Ajouter un tooltip explicatif

---

## ÉTAPE 7 : Ajouter le commentaire qualité dans la page de détail de la fiche

### Fichier : `frontend/src/pages/FicheDetail.jsx`

**Actions :**

1. **Afficher le commentaire qualité dans la page de détail**
   - Ajouter une section pour afficher `commentaire_qualite`
   - Permettre la modification si l'utilisateur est Qualité Qualification (fonction 4)

2. **Mettre à jour la requête pour inclure `commentaire_qualite`**
   - Vérifier que la route GET `/fiches/:id` retourne `commentaire_qualite`

---

## ÉTAPE 8 : Tests et vérifications

### Checklist de vérification

- [ ] La route `/fiches/:hash/valider-qualite` existe et fonctionne
- [ ] Le bouton "Valider" passe bien la fiche en état "En-Attente" (ID 1)
- [ ] La colonne `commentaire_qualite` existe dans la table `fiches`
- [ ] Les routes backend retournent `commentaire_qualite` dans les réponses
- [ ] L'interface permet d'ajouter/modifier le commentaire qualité
- [ ] Le commentaire qualité s'affiche dans le tableau
- [ ] Le commentaire qualité s'affiche dans la page de détail de la fiche
- [ ] Les filtres sont limités à : date, agent, état uniquement
- [ ] Les fiches affichées sont uniquement celles avec les états du groupe 0
- [ ] La permission `controle_qualite_view` est correctement vérifiée

---

## Ordre d'exécution recommandé

1. **ÉTAPE 2** : Créer et exécuter le script SQL pour ajouter `commentaire_qualite`
2. **ÉTAPE 1** : Vérifier et créer la route `/fiches/:hash/valider-qualite`
3. **ÉTAPE 3** : Mettre à jour les routes backend pour gérer `commentaire_qualite`
4. **ÉTAPE 5** : Simplifier les filtres dans le frontend
5. **ÉTAPE 4** : Ajouter l'interface de commentaire qualité dans le frontend
6. **ÉTAPE 6** : Vérifier et améliorer le bouton de validation
7. **ÉTAPE 7** : Ajouter le commentaire qualité dans la page de détail
8. **ÉTAPE 8** : Tests et vérifications finales

---

## Notes importantes

- La fonction "Qualité Qualification" a probablement l'ID 4 (à vérifier dans la table `fonctions`)
- L'état "En-Attente" a probablement l'ID 1 (à vérifier dans la table `etats`)
- La permission `controle_qualite_view` doit être vérifiée pour accéder à cette page
- Le bouton de validation doit être placé à la fin de chaque ligne du tableau
- Le commentaire qualité doit être éditable uniquement par les utilisateurs Qualité Qualification

