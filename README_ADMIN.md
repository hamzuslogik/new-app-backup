# Création d'un utilisateur administrateur

Ce guide explique comment créer un utilisateur administrateur avec tous les privilèges dans le système CRM.

## Méthode 1 : Utilisateur par défaut (rapide)

Exécutez le script SQL suivant :

```bash
mysql -h 151.80.58.72 -u hamzus -p crm < insert_admin_user.sql
```

**Identifiants par défaut :**
- **Login**: `admin`
- **Mot de passe**: `admin123`

⚠️ **Important** : Changez le mot de passe immédiatement après la première connexion !

## Méthode 2 : Utilisateur personnalisé

1. Ouvrez le fichier `insert_admin_user_custom.sql`
2. Modifiez les variables en haut du fichier :
   ```sql
   SET @admin_nom = 'Votre Nom';
   SET @admin_prenom = 'Votre Prénom';
   SET @admin_pseudo = 'Admin Principal';
   SET @admin_login = 'admin';
   SET @admin_password = 'VotreMotDePasseSecurise123!';
   SET @admin_email = 'admin@jwsgroup.fr';
   ```
3. Exécutez le script :
   ```bash
   mysql -h 151.80.58.72 -u hamzus -p crm < insert_admin_user_custom.sql
   ```

## Méthode 3 : Via l'interface MySQL

Connectez-vous à MySQL et exécutez :

```sql
USE crm;

-- Créer le centre si nécessaire
INSERT INTO `centres` (`id`, `titre`, `etat`) 
VALUES (1, 'Centre Principal', 1)
ON DUPLICATE KEY UPDATE `titre`=VALUES(`titre`), `etat`=1;

-- Créer la fonction Administrateur si nécessaire
INSERT INTO `fonctions` (`id`, `titre`, `etat`) 
VALUES (1, 'Administrateur', 1)
ON DUPLICATE KEY UPDATE `titre`=VALUES(`titre`), `etat`=1;

-- Créer l'utilisateur administrateur
INSERT INTO `utilisateurs` (
  `nom`,
  `prenom`,
  `pseudo`,
  `login`,
  `mdp`,
  `etat`,
  `fonction`,
  `centre`,
  `genre`,
  `color`,
  `date`
) VALUES (
  'Admin',
  'Système',
  'Administrateur',
  'admin',
  'admin123',
  1,
  1,  -- Fonction 1 = Administrateur
  1,  -- Centre Principal
  2,  -- Genre: 2 = Homme
  '#629aa9',
  UNIX_TIMESTAMP(NOW())
);
```

## Privilèges de l'administrateur (Fonction 1)

L'utilisateur avec la fonction **1 (Administrateur)** a accès à :

### ✅ Gestion complète
- Toutes les fiches (création, modification, suppression)
- Tous les utilisateurs
- Tous les centres
- Tous les départements
- Toutes les fonctions
- Tous les états
- Tous les installateurs

### ✅ Fonctionnalités avancées
- Statistiques complètes
- Planning et affectation
- Export de données (CSV, PDF)
- Gestion des décalages
- Gestion des messages
- Accès à tous les modules

### ✅ Configuration système
- Modification des paramètres
- Gestion des rôles et permissions
- Configuration des états personnalisés

## Vérification

Pour vérifier que l'utilisateur a été créé correctement :

```sql
SELECT 
  u.id,
  u.login,
  u.pseudo,
  u.etat,
  f.titre as fonction,
  c.titre as centre
FROM utilisateurs u
LEFT JOIN fonctions f ON u.fonction = f.id
LEFT JOIN centres c ON u.centre = c.id
WHERE u.login = 'admin';
```

## Sécurité

1. **Changez le mot de passe par défaut** immédiatement
2. **Utilisez un mot de passe fort** (minimum 12 caractères, majuscules, minuscules, chiffres, caractères spéciaux)
3. **Ne partagez pas les identifiants** de l'administrateur
4. **Créez des utilisateurs avec des privilèges limités** pour les opérations quotidiennes

## Connexion

Une fois l'utilisateur créé, vous pouvez vous connecter à l'application :

1. Ouvrez l'application : `http://localhost:3000`
2. Utilisez les identifiants créés
3. Vous aurez accès à toutes les fonctionnalités

## Dépannage

### L'utilisateur ne peut pas se connecter

1. Vérifiez que `etat = 1` dans la table `utilisateurs`
2. Vérifiez que la fonction a `etat = 1` dans la table `fonctions`
3. Vérifiez que le centre a `etat = 1` dans la table `centres`
4. Vérifiez que le login et le mot de passe sont corrects

### Erreur "Compte désactivé"

Assurez-vous que :
- `utilisateurs.etat = 1`
- `fonctions.etat = 1` (pour la fonction de l'utilisateur)
- `centres.etat = 1` (pour le centre de l'utilisateur)

