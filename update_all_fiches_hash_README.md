# Mise à jour des hash de fiches

## ⚠️ Problème avec le script SQL

Le script SQL `update_all_fiches_hash_with_secret.sql` tente d'implémenter HMAC-SHA256 manuellement, mais **MySQL/MariaDB ne supporte pas nativement HMAC**. L'implémentation manuelle peut produire des résultats incorrects qui ne correspondent pas au backend Node.js.

## ✅ Solution recommandée : Script Node.js

**Utilisez le script Node.js** qui utilise exactement la même fonction que le backend :

```bash
node update_all_fiches_hash_with_current_secret.js
```

### Avantages du script Node.js :

1. ✅ **Hash exacts** : Utilise exactement la même fonction `encodeFicheId` que le backend
2. ✅ **Garanti de fonctionner** : Pas de problèmes d'implémentation
3. ✅ **Même secret** : Lit automatiquement `FICHE_HASH_SECRET` depuis le fichier `.env`
4. ✅ **Vérification** : Compare les hash existants et ne met à jour que ceux qui sont différents

### Prérequis :

1. Assurez-vous que le fichier `.env` contient le bon `FICHE_HASH_SECRET` :
   ```env
   FICHE_HASH_SECRET=crm-jws-group-secret-key-2024-change-in-production
   ```

2. Installez les dépendances Node.js :
   ```bash
   npm install
   ```

### Utilisation :

```bash
# Exécuter le script
node update_all_fiches_hash_with_current_secret.js

# Le script va :
# - Afficher le HASH_SECRET utilisé (masqué)
# - Analyser toutes les fiches
# - Afficher combien de fiches ont des hash différents
# - Demander confirmation avant de procéder
```

## ⚠️ Si vous devez absolument utiliser le script SQL

Si vous ne pouvez pas utiliser Node.js, le script SQL `update_all_fiches_hash_with_secret.sql` est disponible, mais :

1. ⚠️ Les hash générés peuvent ne pas correspondre exactement au backend
2. ⚠️ Vous devrez vérifier manuellement que les hash sont corrects
3. ⚠️ Il est recommandé de tester d'abord sur une seule fiche

### Étapes pour utiliser le script SQL :

1. **Modifier le HASH_SECRET** dans le script (ligne 44) :
   ```sql
   SET @hash_secret = 'crm-jws-group-secret-key-2024-change-in-production';
   ```

2. **Tester d'abord** sur une seule fiche :
   ```sql
   -- Tester sur la fiche ID = 1
   SELECT 
     1 as id,
     `calculate_fiche_hash`(1, @hash_secret) as hash_genere,
     '9b8edfe529207aa2MQ' as hash_attendu_dans_url;
   ```

3. **Si le hash généré correspond**, exécuter le script complet

4. **Si le hash ne correspond pas**, utilisez le script Node.js à la place

## Vérification

Après avoir exécuté le script (Node.js ou SQL), vérifiez que les hash sont corrects :

1. Ouvrez une fiche dans l'application
2. Regardez l'URL dans la barre de navigation
3. Vérifiez que le hash dans l'URL correspond au hash dans la base de données

```sql
-- Vérifier le hash d'une fiche
SELECT 
  id,
  hash,
  -- Le hash devrait correspondre à celui dans l'URL
  CASE 
    WHEN hash IS NULL THEN '❌ NULL'
    WHEN LENGTH(hash) < 17 THEN '❌ Trop court'
    ELSE '✅ OK'
  END as status
FROM fiches
WHERE id = 1;
```

