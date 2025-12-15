# Guide pour lancer le test automatique

## Utilisation

Le script de test automatique se trouve dans `backend/test_import_auto.js`

### Lancer avec les identifiants par défaut

```bash
cd backend
node test_import_auto.js
```

### Lancer avec vos propres identifiants

```bash
cd backend
node test_import_auto.js <login> <password> [centre_id]
```

**Exemple:**
```bash
node test_import_auto.js admin admin123 1
```

## Prérequis

1. **Le serveur backend doit être démarré**
   ```bash
   cd backend
   npm run dev
   # ou
   npm start
   ```

2. **Vous devez avoir un utilisateur valide dans la base de données**
   - Le login doit exister dans la table `utilisateurs`
   - Le mot de passe doit correspondre
   - L'utilisateur doit être actif (etat = 1)
   - La fonction de l'utilisateur doit être active
   - Le centre de l'utilisateur doit être actif

3. **Vous devez avoir la permission `fiches_create`**

## Configuration via variables d'environnement

Vous pouvez configurer les valeurs par défaut dans le fichier `.env` du backend:

```env
API_URL=http://localhost:5000
TEST_LOGIN=admin
TEST_PASSWORD=admin123
TEST_CENTRE_ID=1
```

## Ce que fait le test

1. **Connexion** - Se connecte à l'API avec les identifiants fournis
2. **Prévisualisation** - Charge et prévisualise les 10 contacts de test
3. **Mapping automatique** - Crée automatiquement le mapping des colonnes
4. **Importation** - Importe les contacts dans la base de données
5. **Résultats** - Affiche un résumé avec:
   - Nombre de contacts insérés
   - Nombre de doublons détectés
   - Nombre d'erreurs
   - Taux de succès

## Résolution des problèmes

### Erreur "Identifiants incorrects"
- Vérifiez que le login et le mot de passe sont corrects
- Vérifiez que l'utilisateur existe dans la base de données
- Vérifiez que le mot de passe correspond (sans hash dans l'ancien système)

### Erreur "Connexion refusée"
- Vérifiez que le serveur backend est démarré
- Vérifiez que l'URL de l'API est correcte (par défaut: http://localhost:5000)

### Erreur "Permission refusée"
- Vérifiez que l'utilisateur a la permission `fiches_create`
- Vérifiez que l'utilisateur, sa fonction et son centre sont actifs

### Erreur "Centre invalide"
- Vérifiez que le centre ID existe dans la base de données
- Vérifiez que le centre est actif (etat = 1)
- Vérifiez que l'utilisateur appartient à ce centre (sauf pour les admins)

