# Diagnostic : RDV non affichés en Production

## Problème
Les RDV s'affichent correctement en mode développement mais pas en mode production sur la page planning.

## Causes Probables

### 1. ⚠️ Variables d'environnement non définies au build
**Problème le plus fréquent** : Les variables `VITE_*` doivent être définies **AVANT** le build, pas à l'exécution.

**Vérification** :
```bash
# Sur le serveur de production
cd /var/www/crm-app/frontend
cat .env
```

**Solution** :
1. Vérifier que le fichier `.env` existe dans `frontend/`
2. Vérifier que `VITE_API_URL` est défini correctement :
   ```env
   VITE_API_URL=https://crm.voiptunisie.com/api
   ```
3. **Rebuild le frontend** après modification du `.env` :
   ```bash
   cd /var/www/crm-app/frontend
   npm run build
   ```

### 2. 🔍 Erreurs silencieuses dans les requêtes API
Le code actuel n'a pas de gestion d'erreur explicite pour la requête `/planning/week`.

**Vérification** :
- Ouvrir la console du navigateur (F12) en production
- Vérifier l'onglet Network pour voir les requêtes API
- Vérifier s'il y a des erreurs 401, 403, 404, 500

**Solution** : Ajouter une gestion d'erreur explicite (voir code ci-dessous)

### 3. 🔐 Problème d'authentification
Le token JWT peut être expiré ou invalide en production.

**Vérification** :
```javascript
// Dans la console du navigateur
console.log(localStorage.getItem('token'));
```

**Solution** :
- Se déconnecter et se reconnecter
- Vérifier que le token est bien envoyé dans les headers

### 4. 🌐 Problème CORS
Les requêtes peuvent être bloquées par CORS.

**Vérification** :
- Vérifier les logs backend : `pm2 logs crm-backend`
- Vérifier les erreurs CORS dans la console du navigateur

**Solution** :
Vérifier que `FRONTEND_URL` dans le `.env` backend correspond à l'URL de production :
```env
FRONTEND_URL=https://crm.voiptunisie.com
```

### 5. 🗄️ Problème de base de données
La connexion à la base de données peut être différente en production.

**Vérification** :
```bash
# Vérifier les logs backend
pm2 logs crm-backend --lines 100

# Vérifier la connexion à la base de données
cd /var/www/crm-app/backend
node -e "require('dotenv').config(); const mysql = require('mysql2/promise'); mysql.createConnection({host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME}).then(() => console.log('✅ Connexion OK')).catch(e => console.error('❌ Erreur:', e))"
```

### 6. ⏰ Problème de timezone
Les dates peuvent être interprétées différemment selon le timezone du serveur.

**Vérification** :
```bash
# Vérifier le timezone du serveur
date
timedatectl
```

### 7. 💾 Cache du navigateur
Le navigateur peut avoir mis en cache une ancienne version.

**Solution** :
- Vider le cache du navigateur (Ctrl+Shift+Delete)
- Tester en navigation privée
- Ajouter un paramètre de version dans l'URL pour forcer le rechargement

### 8. 📦 Build incomplet ou corrompu
Le build peut être incomplet ou corrompu.

**Solution** :
```bash
cd /var/www/crm-app/frontend
rm -rf dist node_modules
npm install
npm run build
```

## Guide de Diagnostic Étape par Étape

### Étape 1 : Vérifier les variables d'environnement
```bash
# Sur le serveur
cd /var/www/crm-app/frontend
cat .env

# Doit afficher :
# VITE_API_URL=https://crm.voiptunisie.com/api
```

### Étape 2 : Vérifier que le build utilise les bonnes variables
```bash
# Rebuild avec vérification
cd /var/www/crm-app/frontend
npm run build

# Vérifier dans dist/index.html ou dist/assets/*.js
# Chercher "VITE_API_URL" ou l'URL de l'API
grep -r "crm.voiptunisie.com" dist/
```

### Étape 3 : Vérifier les logs backend
```bash
pm2 logs crm-backend --lines 50

# Chercher les requêtes vers /planning/week
# Vérifier s'il y a des erreurs
```

### Étape 4 : Tester l'API directement
```bash
# Depuis le serveur
curl -H "Authorization: Bearer VOTRE_TOKEN" \
     https://crm.voiptunisie.com/api/planning/week?w=1&y=2024&dp=01

# Ou depuis votre machine locale
curl -H "Authorization: Bearer VOTRE_TOKEN" \
     https://crm.voiptunisie.com/api/planning/week?w=1&y=2024&dp=01
```

### Étape 5 : Vérifier dans le navigateur
1. Ouvrir la console (F12)
2. Aller sur l'onglet Network
3. Filtrer sur "planning"
4. Vérifier :
   - Les requêtes sont-elles envoyées ?
   - Quel est le statut HTTP (200, 401, 404, 500) ?
   - Quelle est la réponse de l'API ?

### Étape 6 : Vérifier les données retournées
Dans la console du navigateur :
```javascript
// Vérifier si les données sont bien reçues
// (après avoir ajouté les logs de debug)
```

## Solutions à Appliquer

### Solution 1 : Améliorer la gestion d'erreur dans Planning.jsx

Ajouter une gestion d'erreur explicite pour la requête `/planning/week` :

```javascript
// Récupérer le planning
const { data: planningData, isLoading, error, refetch } = useQuery(
  ['planning-week', week, year, dep],
  async () => {
    try {
      const res = await api.get('/planning/week', { 
        params: { w: week, y: year, dp: dep || '01' } 
      });
      console.log('✅ Planning data reçue:', res.data);
      return res.data;
    } catch (error) {
      console.error('❌ Erreur récupération planning:', error);
      console.error('❌ Détails:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url
      });
      throw error;
    }
  },
  { 
    keepPreviousData: true,
    enabled: !!week && !!year,
    retry: 2,
    onError: (error) => {
      console.error('❌ Erreur query planning:', error);
      toast.error(
        error.response?.data?.message || 
        `Erreur lors du chargement du planning: ${error.message}`
      );
    }
  }
);
```

### Solution 2 : Ajouter des logs de debug en production

Créer un fichier de configuration pour activer les logs en production :

```javascript
// frontend/src/utils/logger.js
const isDevelopment = import.meta.env.DEV;

export const logger = {
  log: (...args) => {
    if (isDevelopment || window.location.search.includes('debug=true')) {
      console.log(...args);
    }
  },
  error: (...args) => {
    // Toujours afficher les erreurs
    console.error(...args);
  },
  warn: (...args) => {
    if (isDevelopment || window.location.search.includes('debug=true')) {
      console.warn(...args);
    }
  }
};
```

### Solution 3 : Vérifier la configuration Nginx

Vérifier que le proxy Nginx fonctionne correctement :

```nginx
# Vérifier dans /etc/nginx/sites-available/crm.voiptunisie.com
location /api {
    proxy_pass http://localhost:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    
    # Timeouts augmentés
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}
```

### Solution 4 : Script de vérification rapide

Créer un script pour vérifier rapidement la configuration :

```bash
#!/bin/bash
# /var/www/crm-app/check-planning.sh

echo "🔍 Vérification de la configuration Planning..."

echo ""
echo "1. Variables d'environnement Frontend :"
cd /var/www/crm-app/frontend
if [ -f .env ]; then
    echo "✅ .env existe"
    grep VITE_API_URL .env || echo "❌ VITE_API_URL non trouvé"
else
    echo "❌ .env n'existe pas"
fi

echo ""
echo "2. Build Frontend :"
if [ -d dist ]; then
    echo "✅ dist/ existe"
    if grep -r "crm.voiptunisie.com" dist/ > /dev/null 2>&1; then
        echo "✅ URL de production trouvée dans le build"
    else
        echo "❌ URL de production non trouvée dans le build"
    fi
else
    echo "❌ dist/ n'existe pas - Build nécessaire"
fi

echo ""
echo "3. Backend PM2 :"
pm2 list | grep crm-backend || echo "❌ Backend non démarré"

echo ""
echo "4. Logs backend récents (dernières 10 lignes) :"
pm2 logs crm-backend --lines 10 --nostream

echo ""
echo "✅ Vérification terminée"
```

## Checklist de Déploiement

Avant de déployer en production, vérifier :

- [ ] Le fichier `.env` existe dans `frontend/` avec `VITE_API_URL=https://crm.voiptunisie.com/api`
- [ ] Le build a été fait **après** la création/modification du `.env`
- [ ] Le backend est démarré avec PM2 : `pm2 list`
- [ ] Les logs backend ne montrent pas d'erreurs : `pm2 logs crm-backend`
- [ ] Nginx est configuré correctement et redémarré : `sudo systemctl restart nginx`
- [ ] Le certificat SSL est valide
- [ ] Les permissions des fichiers sont correctes
- [ ] La base de données est accessible depuis le serveur

## Commandes de Déploiement Correct

```bash
# 1. Aller dans le répertoire frontend
cd /var/www/crm-app/frontend

# 2. Vérifier/créer le .env
nano .env
# Vérifier que VITE_API_URL=https://crm.voiptunisie.com/api

# 3. Installer les dépendances
npm install

# 4. Build (IMPORTANT : après avoir configuré .env)
npm run build

# 5. Vérifier que le build contient la bonne URL
grep -r "crm.voiptunisie.com" dist/ || echo "⚠️ URL non trouvée"

# 6. Redémarrer Nginx pour servir le nouveau build
sudo systemctl restart nginx

# 7. Vérifier les logs
pm2 logs crm-backend --lines 20
```

## Test Rapide

Pour tester rapidement si le problème vient de la configuration :

1. Ouvrir la console du navigateur (F12)
2. Aller sur l'onglet Network
3. Filtrer sur "planning"
4. Recharger la page planning
5. Vérifier :
   - La requête est-elle envoyée vers la bonne URL ?
   - Quel est le statut de la réponse ?
   - Quelle est la réponse JSON ?

Si la requête retourne une erreur 401, c'est un problème d'authentification.
Si la requête retourne une erreur 404, l'URL de l'API est incorrecte.
Si la requête retourne une erreur 500, c'est un problème backend.

