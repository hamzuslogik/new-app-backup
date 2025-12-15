# Instructions pour mettre à jour tous les hash avec le HASH_SECRET actuel

## Problème

Les hash dans la base de données ont été créés avec un ancien HASH_SECRET, ce qui cause des avertissements comme :
```
Hash invalide mais ID décodable: hash=24a7f1ed7ef066e8OTgz..., id=983041, expected=31db9745..., got=24a7f1ed...
```

## Solution : Utiliser les scripts SQL

### Étape 1 : Vider tous les hash

Exécutez d'abord le script pour vider tous les hash existants :

```sql
-- Exécuter clear_all_fiches_hash.sql
source clear_all_fiches_hash.sql;
```

Ou copiez-collez le contenu du fichier `clear_all_fiches_hash.sql` dans votre client MySQL.

### Étape 2 : Modifier le HASH_SECRET dans le script SQL

**IMPORTANT** : Avant d'exécuter le script de régénération, vous devez modifier la ligne 26 du fichier `update_existing_fiches_hash.sql` pour mettre le bon HASH_SECRET :

```sql
-- Ligne 26 : Remplacez par votre HASH_SECRET actuel
SET @hash_secret = 'VOTRE_HASH_SECRET_ICI';
```

Pour trouver votre HASH_SECRET actuel, vérifiez :
1. Le fichier `.env` à la racine du projet
2. La variable d'environnement `FICHE_HASH_SECRET`

**Exemple** :
```sql
SET @hash_secret = 'crm-jws-group-secret-key-2024-change-in-production';
```

### Étape 3 : Régénérer tous les hash

Exécutez le script pour régénérer tous les hash :

```sql
-- Exécuter update_existing_fiches_hash.sql
source update_existing_fiches_hash.sql;
```

Ou copiez-collez le contenu du fichier `update_existing_fiches_hash.sql` dans votre client MySQL.

### Étape 4 : Vérification

Le script affichera :
- Le nombre total de fiches
- Le nombre de fiches avec hash
- Des exemples de hash générés

## Alternative : Script Node.js (recommandé pour un hash exact)

Le script SQL utilise une **approximation** (SHA2 au lieu de HMAC). Pour un hash **exact identique** à celui généré par l'application, utilisez plutôt le script Node.js :

```bash
node update_all_fiches_hash_with_current_secret.js
```

Ce script :
- Lit automatiquement le HASH_SECRET depuis le fichier `.env`
- Génère des hash identiques à ceux de l'application
- Met à jour uniquement les hash qui sont différents

## Notes importantes

⚠️ **ATTENTION** :
- Le script SQL met à jour **TOUS** les hash, même ceux qui existent déjà
- Faites une **sauvegarde** de votre base de données avant d'exécuter ces scripts
- Le script SQL utilise une approximation, les hash peuvent être légèrement différents de ceux générés par l'application

✅ **Recommandation** :
- Pour un hash **exact**, utilisez le script Node.js : `update_all_fiches_hash_with_current_secret.js`
- Pour une mise à jour rapide avec SQL, utilisez les scripts SQL (mais les hash seront approximatifs)

## Résumé des fichiers

1. **`clear_all_fiches_hash.sql`** : Vide tous les hash existants
2. **`update_existing_fiches_hash.sql`** : Régénère tous les hash (nécessite modification du HASH_SECRET)
3. **`update_all_fiches_hash_with_current_secret.js`** : Script Node.js qui génère des hash exacts (recommandé)

