# Page de Configuration - Guide d'utilisation

## Vue d'ensemble

La page de configuration permet de gérer toutes les entités de référence du système CRM :
- **Centres** : Gestion des centres d'activité
- **Utilisateurs** : Gestion complète des utilisateurs du système
- **Départements** : Gestion des départements français
- **Produits** : Gestion des types de produits (PAC, PV, etc.)
- **Fonctions** : Gestion des rôles/fonctions des utilisateurs

## Accès

La page de configuration est accessible uniquement aux utilisateurs ayant les fonctions :
- **Fonction 1** : Administrateur
- **Fonction 2** : Superviseur
- **Fonction 7** : Manager

URL : `/management`

## Fonctionnalités

### 1. Gestion des Centres

**Actions disponibles :**
- ✅ Créer un nouveau centre
- ✅ Modifier un centre existant
- ✅ Activer/Désactiver un centre
- ✅ Supprimer un centre

**Champs :**
- Titre (obligatoire)
- État (Actif/Inactif)

### 2. Gestion des Utilisateurs

**Actions disponibles :**
- ✅ Créer un nouvel utilisateur
- ✅ Modifier un utilisateur existant
- ✅ Activer/Désactiver un utilisateur
- ✅ Supprimer un utilisateur (sauf son propre compte)

**Champs :**
- Nom, Prénom, Pseudo (obligatoires)
- Login, Mot de passe (obligatoires pour création)
- Email, Téléphone
- Fonction (obligatoire)
- Centre (obligatoire)
- Genre (Homme/Femme)
- État (Actif/Inactif)
- Couleur (pour le planning)
- Chef d'équipe

### 3. Gestion des Départements

**Actions disponibles :**
- ✅ Créer un nouveau département
- ✅ Modifier un département existant
- ✅ Activer/Désactiver un département
- ✅ Supprimer un département

**Champs :**
- Code (obligatoire, ex: 01, 75, 13)
- Nom (obligatoire)
- Nom en majuscules (généré automatiquement si vide)
- État (Actif/Inactif)

### 4. Gestion des Produits

**Actions disponibles :**
- ✅ Créer un nouveau produit
- ✅ Modifier un produit existant
- ✅ Supprimer un produit

**Champs :**
- Nom (obligatoire, ex: PAC, PV)

### 5. Gestion des Fonctions

**Actions disponibles :**
- ✅ Créer une nouvelle fonction
- ✅ Modifier une fonction existante
- ✅ Activer/Désactiver une fonction
- ✅ Supprimer une fonction

**Champs :**
- Titre (obligatoire, ex: Administrateur, Commercial)
- État (Actif/Inactif)

## Utilisation

### Créer une nouvelle entité

1. Cliquez sur le bouton **"Ajouter"** dans l'onglet correspondant
2. Remplissez le formulaire
3. Cliquez sur **"Créer"**
4. Une notification de succès s'affichera

### Modifier une entité

1. Cliquez sur l'icône **✏️ Modifier** dans la ligne de l'entité
2. Modifiez les champs souhaités
3. Cliquez sur **"Modifier"**
4. Une notification de succès s'affichera

### Supprimer une entité

1. Cliquez sur l'icône **🗑️ Supprimer** dans la ligne de l'entité
2. Confirmez la suppression
3. Une notification de succès s'affichera

## API Endpoints

### Centres
- `GET /api/management/centres` - Liste des centres
- `POST /api/management/centres` - Créer un centre
- `PUT /api/management/centres/:id` - Modifier un centre
- `DELETE /api/management/centres/:id` - Supprimer un centre

### Utilisateurs
- `GET /api/management/utilisateurs` - Liste des utilisateurs
- `POST /api/management/utilisateurs` - Créer un utilisateur
- `PUT /api/management/utilisateurs/:id` - Modifier un utilisateur
- `DELETE /api/management/utilisateurs/:id` - Supprimer un utilisateur

### Départements
- `GET /api/management/departements` - Liste des départements
- `POST /api/management/departements` - Créer un département
- `PUT /api/management/departements/:id` - Modifier un département
- `DELETE /api/management/departements/:id` - Supprimer un département

### Produits
- `GET /api/management/produits` - Liste des produits
- `POST /api/management/produits` - Créer un produit
- `PUT /api/management/produits/:id` - Modifier un produit
- `DELETE /api/management/produits/:id` - Supprimer un produit

### Fonctions
- `GET /api/management/fonctions` - Liste des fonctions
- `POST /api/management/fonctions` - Créer une fonction
- `PUT /api/management/fonctions/:id` - Modifier une fonction
- `DELETE /api/management/fonctions/:id` - Supprimer une fonction

## Sécurité

- ✅ Toutes les routes sont protégées par authentification JWT
- ✅ Seuls les administrateurs (fonctions 1, 2, 7) peuvent accéder
- ✅ Validation des données côté serveur
- ✅ Protection contre la suppression de son propre compte utilisateur
- ✅ Vérification de l'unicité des logins

## Notes importantes

1. **Désactiver vs Supprimer** : Il est recommandé de désactiver une entité plutôt que de la supprimer si elle est utilisée dans d'autres tables
2. **Fonctions** : Ne supprimez pas une fonction si des utilisateurs l'utilisent
3. **Centres** : Ne supprimez pas un centre si des utilisateurs y sont assignés
4. **Utilisateurs** : Le mot de passe n'est pas requis lors de la modification (laisser vide pour ne pas le modifier)

## Interface

L'interface est responsive et s'adapte aux écrans mobiles et tablettes. Les formulaires s'affichent dans une modale pour une meilleure expérience utilisateur.

