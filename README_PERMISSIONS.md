# Système de Gestion des Permissions

## Vue d'ensemble

Le système de gestion des permissions permet aux administrateurs de configurer finement les autorisations pour chaque fonction (rôle) dans l'application. Chaque fonction peut avoir des permissions spécifiques pour accéder aux pages, effectuer des actions, et utiliser des fonctionnalités.

## Structure de la Base de Données

### Table `permissions`
Stocke toutes les permissions disponibles dans l'application.

**Colonnes :**
- `id` : Identifiant unique
- `code` : Code unique de la permission (ex: `dashboard_view`, `fiche_create`)
- `nom` : Nom affiché de la permission
- `description` : Description détaillée
- `categorie` : Catégorie (page, action, fonctionnalite, admin)
- `ordre` : Ordre d'affichage
- `etat` : 1 = actif, 0 = inactif

### Table `fonction_permissions`
Associe les permissions aux fonctions.

**Colonnes :**
- `id` : Identifiant unique
- `id_fonction` : ID de la fonction
- `id_permission` : ID de la permission
- `autorise` : 1 = autorisé, 0 = refusé
- `date_creation` : Date de création
- `date_modif` : Date de modification

## Installation

1. **Exécuter le script SQL** pour créer les tables :
```bash
mysql -h 151.80.58.72 -u hamzus -p crm < nouvelle_application/create_permissions_tables.sql
```

2. **Redémarrer le serveur backend** pour charger les nouvelles routes.

## Utilisation

### Interface Admin

1. **Accéder à la page Permissions** :
   - Menu : "Permissions" (visible pour Admin et Dev)
   - URL : `/permissions`

2. **Sélectionner une fonction** :
   - Choisir une fonction dans le menu déroulant
   - Les permissions de cette fonction s'affichent

3. **Modifier les permissions** :
   - Cliquer sur les boutons "Autoriser" / "Refuser" pour chaque permission
   - Utiliser "Tout autoriser" / "Tout refuser" par catégorie
   - Cliquer sur "Sauvegarder les permissions"

### Permissions Disponibles

#### Pages (categorie: `page`)
- `dashboard_view` : Voir le tableau de bord
- `fiches_view` : Voir les fiches
- `planning_view` : Voir le planning
- `statistiques_view` : Voir les statistiques
- `affectation_view` : Voir l'affectation
- `suivi_telepro_view` : Voir le suivi télépro
- `compte_rendu_view` : Voir les comptes rendus
- `phase3_view` : Voir Phase 3
- `messages_view` : Voir les messages
- `users_view` : Voir les utilisateurs
- `management_view` : Voir la gestion

#### Actions (categorie: `action`)
- `fiches_create` : Créer une fiche
- `fiches_edit` : Modifier une fiche
- `fiches_delete` : Supprimer une fiche
- `fiches_archive` : Archiver une fiche
- `fiches_detail` : Voir le détail d'une fiche
- `planning_create` : Créer un planning
- `planning_edit` : Modifier un planning
- `planning_delete` : Supprimer un planning
- `affectation_edit` : Modifier l'affectation
- `compte_rendu_create` : Créer un compte rendu
- `compte_rendu_edit` : Modifier un compte rendu
- `compte_rendu_delete` : Supprimer un compte rendu
- `messages_send` : Envoyer un message
- `users_create` : Créer un utilisateur
- `users_edit` : Modifier un utilisateur
- `users_delete` : Supprimer un utilisateur
- `management_edit` : Modifier la configuration

#### Fonctionnalités (categorie: `fonctionnalite`)
- `fiche_validate` : Valider une fiche
- `fiche_quick_edit` : Modification rapide
- `fiche_sms_send` : Envoyer un SMS
- `planning_duplicate` : Dupliquer un planning
- `planning_availability` : Gérer les disponibilités
- `statistiques_export` : Exporter les statistiques
- `fiche_export` : Exporter les fiches
- `search_advanced` : Recherche avancée
- `filter_by_centre` : Filtrer par centre
- `filter_by_confirmateur` : Filtrer par confirmateur
- `filter_by_commercial` : Filtrer par commercial
- `filter_by_etat` : Filtrer par état

#### Administration (categorie: `admin`)
- `config_centres` : Gérer les centres
- `config_departements` : Gérer les départements
- `config_produits` : Gérer les produits
- `config_etats` : Gérer les états
- `config_fonctions` : Gérer les fonctions
- `config_permissions` : Gérer les permissions

## API Backend

### Routes Disponibles

#### GET `/api/permissions`
Récupère toutes les permissions disponibles.
- **Accès** : Admin (1, 7)

#### GET `/api/permissions/fonction/:id_fonction`
Récupère les permissions d'une fonction spécifique.
- **Accès** : Admin (1, 7)
- **Retourne** : Liste des permissions avec leur statut (autorise)

#### POST `/api/permissions/fonction/:id_fonction`
Met à jour les permissions d'une fonction.
- **Accès** : Admin (1, 7)
- **Body** : `{ permissions: [{ id_permission, autorise }] }`

#### GET `/api/permissions/check/:code`
Vérifie si l'utilisateur actuel a une permission spécifique.
- **Accès** : Tous les utilisateurs authentifiés
- **Retourne** : `{ hasPermission: boolean }`

#### GET `/api/permissions/user`
Récupère toutes les permissions de l'utilisateur actuel.
- **Accès** : Tous les utilisateurs authentifiés
- **Retourne** : Objet avec les codes de permissions comme clés

## Utilisation dans le Code

### Backend

#### Middleware de Permission
```javascript
const { checkPermissionCode } = require('../middleware/permissions.middleware');

// Utiliser dans une route
router.get('/fiches', authenticate, checkPermissionCode('fiches_view'), async (req, res) => {
  // ...
});
```

#### Vérification Programmatique
```javascript
const { hasPermission } = require('../middleware/permissions.middleware');

// Dans une fonction
const canEdit = await hasPermission(req.user.fonction, 'fiches_edit');
if (!canEdit) {
  return res.status(403).json({ message: 'Permission refusée' });
}
```

### Frontend

#### Récupérer les Permissions Utilisateur
```javascript
import { useQuery } from 'react-query';
import api from '../config/api';

const { data: permissionsData } = useQuery('user-permissions', async () => {
  const res = await api.get('/permissions/user');
  return res.data.data; // Objet avec les codes comme clés
});

// Utilisation
if (permissionsData?.fiches_create) {
  // Afficher le bouton "Créer une fiche"
}
```

#### Vérifier une Permission
```javascript
const hasPermission = (permissions, code) => {
  return permissions && permissions[code] === true;
};

// Utilisation
{hasPermission(permissionsData, 'fiches_create') && (
  <button>Créer une fiche</button>
)}
```

## Comportement par Défaut

- **Si une permission n'existe pas dans `fonction_permissions`** : Elle est **autorisée par défaut** (pour rétrocompatibilité)
- **Si une permission n'existe pas dans `permissions`** : Elle est **autorisée par défaut**
- **En cas d'erreur lors de la vérification** : La permission est **autorisée par défaut** (pour ne pas bloquer l'application)

## Migration depuis l'Ancien Système

L'ancien système utilisait des vérifications hardcodées par fonction. Le nouveau système permet une gestion dynamique :

1. **Créer les permissions** : Le script SQL crée automatiquement toutes les permissions de base
2. **Configurer les fonctions** : Utiliser l'interface admin pour configurer les permissions de chaque fonction
3. **Migrer progressivement** : Les routes existantes continuent de fonctionner avec les permissions par défaut

## Exemples de Configuration

### Confirmateur (Fonction 6)
- ✅ `dashboard_view`
- ✅ `fiches_view`
- ✅ `fiches_detail`
- ✅ `affectation_view`
- ✅ `suivi_telepro_view`
- ✅ `phase3_view`
- ❌ `fiches_create`
- ❌ `fiches_delete`
- ❌ `planning_view`

### Commercial (Fonction 5)
- ✅ `dashboard_view`
- ✅ `fiches_view`
- ✅ `fiches_detail`
- ✅ `compte_rendu_create`
- ✅ `compte_rendu_edit`
- ❌ `statistiques_view`
- ❌ `affectation_view`

## Notes Importantes

1. **Les administrateurs (fonction 1, 7)** ont toujours accès à la page de gestion des permissions
2. **Les permissions sont vérifiées côté backend** pour la sécurité
3. **Les permissions peuvent être vérifiées côté frontend** pour l'UX (masquer/afficher des éléments)
4. **Les permissions par défaut** permettent une migration en douceur sans casser l'application existante

