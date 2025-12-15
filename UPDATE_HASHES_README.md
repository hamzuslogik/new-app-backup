# Mise à jour des hashes de fiches

## Problème

Si vous voyez des messages d'avertissement comme :
```
Hash invalide mais ID décodable: hash=24a7f1ed7ef066e8OTgz..., id=983041, expected=31db9745..., got=24a7f1ed...
```

Cela signifie que les hashes dans la base de données ont été créés avec un **ancien HASH_SECRET**, différent du HASH_SECRET actuellement utilisé dans le fichier `.env`.

## Solution

Utilisez le script `update_all_fiches_hash_with_current_secret.js` pour régénérer tous les hashes avec le HASH_SECRET actuel.

## Prérequis

1. Assurez-vous que le fichier `.env` contient le bon `FICHE_HASH_SECRET` :
   ```env
   FICHE_HASH_SECRET=votre-secret-actuel
   ```

2. Installez les dépendances Node.js si ce n'est pas déjà fait :
   ```bash
   npm install
   ```

## Utilisation

### 1. Exécuter le script

```bash
node update_all_fiches_hash_with_current_secret.js
```

### 2. Vérifier les informations affichées

Le script va :
- Afficher le HASH_SECRET utilisé (masqué pour la sécurité)
- Analyser toutes les fiches
- Afficher combien de fiches ont des hash différents ou manquants
- Demander confirmation avant de procéder

### 3. Confirmer la mise à jour

Le script demande confirmation avant de modifier les hashes :
```
⚠️  ATTENTION: Ce script va modifier les hashes de toutes les fiches.
   150 fiche(s) seront mises à jour.

Voulez-vous continuer? (oui/non):
```

Tapez `oui` ou `o` pour continuer.

## Ce que fait le script

1. **Se connecte à la base de données** en utilisant les paramètres du fichier `.env`
2. **Récupère toutes les fiches** de la table `fiches`
3. **Analyse chaque hash** :
   - Compare le hash existant avec le hash attendu (basé sur le HASH_SECRET actuel)
   - Identifie les fiches à mettre à jour
4. **Met à jour les hashes** :
   - Fiches sans hash : génère un nouveau hash
   - Fiches avec hash différent : remplace par le hash correct
   - Fiches avec hash identique : laisse inchangé
5. **Vérifie la cohérence** de tous les hash après la mise à jour

## Statistiques affichées

Le script affiche :
- Nombre de fiches sans hash
- Nombre de fiches avec hash différent
- Nombre de fiches avec hash identique
- Progression de la mise à jour
- Statistiques finales

## Exemple de sortie

```
🔌 Connexion à la base de données...
✅ Connexion réussie

🔑 HASH_SECRET utilisé: crm-jw...
   (Longueur: 32 caractères)

📋 Récupération de toutes les fiches...
📊 Total de fiches trouvées: 500

🔍 Analyse des hashes existants...
   - Fiches sans hash: 0
   - Fiches avec hash différent: 150
   - Fiches avec hash identique: 350
   - Total à mettre à jour: 150

⚠️  ATTENTION: Ce script va modifier les hashes de toutes les fiches.
   150 fiche(s) seront mises à jour.

Voulez-vous continuer? (oui/non): oui

🔄 Mise à jour des hashes...

⏳ Progression: 100 fiches mises à jour...
✅ Mise à jour terminée!
   - Fiches mises à jour: 150
   - Fiches inchangées: 350
   - Erreurs: 0

📊 Statistiques finales:
   - Total fiches: 500
   - Fiches avec hash: 500
   - Fiches sans hash: 0

🔍 Vérification de la cohérence des hash...
✅ Tous les hash sont cohérents avec le HASH_SECRET actuel!

🔌 Connexion fermée

✨ Script terminé avec succès
```

## Notes importantes

- ⚠️ **Ce script modifie TOUS les hashes** dans la base de données. Assurez-vous que le HASH_SECRET dans `.env` est le bon.
- 📋 **Faites une sauvegarde** de votre base de données avant d'exécuter le script (recommandé).
- 🔒 Le script demande confirmation avant de modifier quoi que ce soit.
- 🔄 Les hashes déjà corrects ne seront pas modifiés pour optimiser les performances.

## Script alternatif

Si vous voulez seulement mettre à jour les fiches **sans hash** (pas toutes les fiches), utilisez :
```bash
node update_existing_fiches_hash.js
```

## Dépannage

### Erreur de connexion à la base de données

Vérifiez que les paramètres dans `.env` sont corrects :
- `DB_HOST`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

### HASH_SECRET non défini

Assurez-vous que `FICHE_HASH_SECRET` est défini dans le fichier `.env`.

### Permission refusée

Vérifiez que l'utilisateur de la base de données a les permissions nécessaires pour modifier la table `fiches`.

