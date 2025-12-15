# Guide de Déploiement - CRM JWS Group

## Informations du Serveur

- **IP du serveur** : `217.182.66.97`
- **Nom de domaine** : `crm.voiptunisie.com`
- **Certificat SSL** : Let's Encrypt (via Certbot)

---

## Prérequis

- Accès SSH au serveur avec les droits root ou sudo
- Le domaine `crm.voiptunisie.com` doit pointer vers l'IP `217.182.66.97`
- Un compte GitHub avec le dépôt de l'application

---

## Étape 1 : Préparation du Serveur

### 1.1 Connexion au serveur

```bash
ssh root@217.182.66.97
# ou
ssh votre_utilisateur@217.182.66.97
```

### 1.2 Mise à jour du système

```bash
sudo apt update
sudo apt upgrade -y
```

### 1.3 Installation des outils de base

```bash
sudo apt install -y curl wget git build-essential
```

---

## Étape 2 : Configuration DNS

Assurez-vous que le domaine pointe vers l'IP du serveur :

1. Allez dans votre panneau de contrôle DNS
2. Créez un enregistrement **A** :
   - **Type** : A
   - **Nom** : `crm` (ou `@` pour le domaine racine)
   - **Valeur** : `217.182.66.97`
   - **TTL** : 3600 (ou valeur par défaut)

3. Vérifiez la propagation DNS :
```bash
dig crm.voiptunisie.com
# ou
nslookup crm.voiptunisie.com
```

---

## Étape 3 : Installation de Node.js

### 3.1 Installation de Node.js (version LTS)

```bash
# Installer Node.js via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Vérifier l'installation
node --version
npm --version
```

### 3.2 Installation de PM2 (Gestionnaire de processus)

```bash
sudo npm install -g pm2
```

---

## Étape 4 : Installation de Nginx

```bash
sudo apt install -y nginx

# Démarrer et activer Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Vérifier le statut
sudo systemctl status nginx
```

---

## Étape 5 : Installation de Certbot (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
```

---

## Étape 6 : Cloner le Projet depuis GitHub

### 6.1 Créer un répertoire pour l'application

```bash
sudo mkdir -p /var/www
cd /var/www
```

### 6.2 Cloner le dépôt GitHub

```bash
# Option 1 : Avec HTTPS (nécessite un token GitHub)
git clone https://github.com/VOTRE_USERNAME/nom-du-depot.git crm-app

# Option 2 : Avec SSH (si vous avez configuré une clé SSH)
git clone git@github.com:VOTRE_USERNAME/nom-du-depot.git crm-app

# Remplacer VOTRE_USERNAME et nom-du-depot par vos informations
```

### 6.3 Définir les permissions

```bash
sudo chown -R $USER:$USER /var/www/crm-app
cd /var/www/crm-app
```

---

## Étape 7 : Configuration de l'Application

### 7.1 Configuration du Backend

```bash
cd /var/www/crm-app/backend

# Créer le fichier .env
nano .env
```

Contenu du fichier `.env` pour le backend :

```env
# Configuration du serveur
PORT=5000
NODE_ENV=production

# Configuration de la base de données MySQL
DB_HOST=151.80.58.72
DB_USER=hamzus
DB_PASSWORD=hamzusLogiKk
DB_NAME=crm

# Configuration JWT (Authentification)
JWT_SECRET=crm-jws-group-secret-key-2024-change-in-production
JWT_EXPIRE=7d

# Configuration CORS
FRONTEND_URL=https://crm.voiptunisie.com

# Configuration Email (optionnel)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=
EMAIL_PASS=
EMAIL_FROM=noreply@crm.voiptunisie.com

# Configuration SMS (optionnel)
SMS_API_KEY=
SMS_API_URL=

# Configuration Upload
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880
```

### 7.2 Configuration du Frontend

```bash
cd /var/www/crm-app/frontend

# Créer le fichier .env
nano .env
```

Contenu du fichier `.env` pour le frontend :

```env
# URL de l'API Backend
VITE_API_URL=https://crm.voiptunisie.com/api

# Nom de l'application
VITE_APP_NAME=CRM JWS Group

# Version de l'application
VITE_APP_VERSION=1.0.0
```

### 7.3 Installation des dépendances

```bash
# Backend
cd /var/www/crm-app/backend
npm install --production

# Frontend
cd /var/www/crm-app/frontend
npm install
```

### 7.4 Build du Frontend

```bash
cd /var/www/crm-app/frontend
npm run build
```

Le build sera créé dans le dossier `dist/`.

---

## Étape 8 : Configuration de Nginx

### 8.1 Créer la configuration Nginx

```bash
sudo nano /etc/nginx/sites-available/crm.voiptunisie.com
```

Contenu de la configuration :

```nginx
# Redirection HTTP vers HTTPS
server {
    listen 80;
    server_name crm.voiptunisie.com;
    
    # Redirection vers HTTPS (sera configuré après l'installation du certificat)
    return 301 https://$server_name$request_uri;
}

# Configuration HTTPS
server {
    listen 443 ssl http2;
    server_name crm.voiptunisie.com;

    # Certificats SSL (seront ajoutés par Certbot)
    ssl_certificate /etc/letsencrypt/live/crm.voiptunisie.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/crm.voiptunisie.com/privkey.pem;
    
    # Configuration SSL recommandée
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Taille maximale des uploads
    client_max_body_size 10M;

    # Logs
    access_log /var/log/nginx/crm-access.log;
    error_log /var/log/nginx/crm-error.log;

    # Servir le frontend (fichiers statiques)
    location / {
        root /var/www/crm-app/frontend/dist;
        try_files $uri $uri/ /index.html;
        index index.html;
        
        # Headers de sécurité
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
    }

    # Proxy pour l'API backend
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
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Servir les fichiers statiques uploadés
    location /uploads {
        alias /var/www/crm-app/backend/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 8.2 Activer la configuration

```bash
# Créer le lien symbolique
sudo ln -s /etc/nginx/sites-available/crm.voiptunisie.com /etc/nginx/sites-enabled/

# Tester la configuration
sudo nginx -t

# Si la configuration est valide, recharger Nginx
sudo systemctl reload nginx
```

---

## Étape 9 : Installation du Certificat SSL Let's Encrypt

### 9.1 Obtenir le certificat

```bash
sudo certbot --nginx -d crm.voiptunisie.com
```

Certbot va :
1. Vérifier que le domaine pointe vers le serveur
2. Obtenir le certificat SSL
3. Configurer automatiquement Nginx pour utiliser HTTPS
4. Configurer le renouvellement automatique

### 9.2 Vérifier le renouvellement automatique

```bash
# Tester le renouvellement
sudo certbot renew --dry-run
```

Le certificat sera automatiquement renouvelé avant expiration.

---

## Étape 10 : Configuration de PM2 pour le Backend

### 10.1 Démarrer le backend avec PM2

```bash
cd /var/www/crm-app/backend
pm2 start server.js --name "crm-backend"
```

### 10.2 Configurer PM2 pour démarrer au boot

```bash
# Générer le script de démarrage
pm2 startup

# Sauvegarder la configuration actuelle
pm2 save
```

### 10.3 Commandes PM2 utiles

```bash
# Voir les processus
pm2 list

# Voir les logs
pm2 logs crm-backend

# Redémarrer
pm2 restart crm-backend

# Arrêter
pm2 stop crm-backend

# Surveiller
pm2 monit
```

---

## Étape 11 : Configuration du Firewall

### 11.1 Configuration UFW (Uncomplicated Firewall)

```bash
# Autoriser SSH (important !)
sudo ufw allow 22/tcp

# Autoriser HTTP et HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Activer le firewall
sudo ufw enable

# Vérifier le statut
sudo ufw status
```

---

## Étape 12 : Vérification et Test

### 12.1 Vérifier que tous les services fonctionnent

```bash
# Vérifier Nginx
sudo systemctl status nginx

# Vérifier PM2
pm2 list

# Vérifier les logs
pm2 logs crm-backend --lines 50
sudo tail -f /var/log/nginx/crm-error.log
```

### 12.2 Tester l'application

1. Ouvrez votre navigateur et allez sur : `https://crm.voiptunisie.com`
2. Vérifiez que :
   - Le certificat SSL est valide (cadenas vert)
   - Le frontend se charge correctement
   - L'API backend répond (testez la connexion)

---

## Étape 13 : Script de Déploiement Automatique

Créez un script pour faciliter les mises à jour futures :

```bash
nano /var/www/crm-app/deploy.sh
```

Contenu du script :

```bash
#!/bin/bash

echo "🚀 Déploiement de l'application CRM..."

# Aller dans le répertoire de l'application
cd /var/www/crm-app

# Récupérer les dernières modifications depuis GitHub
echo "📥 Récupération des modifications..."
git pull origin main

# Backend
echo "📦 Installation des dépendances backend..."
cd backend
npm install --production

# Frontend
echo "📦 Installation des dépendances frontend..."
cd ../frontend
npm install

# Build du frontend
echo "🔨 Build du frontend..."
npm run build

# Redémarrer le backend
echo "🔄 Redémarrage du backend..."
pm2 restart crm-backend

echo "✅ Déploiement terminé !"
```

Rendre le script exécutable :

```bash
chmod +x /var/www/crm-app/deploy.sh
```

Utilisation :

```bash
/var/www/crm-app/deploy.sh
```

---

## Maintenance et Mises à Jour

### Mettre à jour l'application

```bash
cd /var/www/crm-app
git pull origin main
cd backend && npm install --production
cd ../frontend && npm install && npm run build
pm2 restart crm-backend
```

### Voir les logs

```bash
# Logs backend
pm2 logs crm-backend

# Logs Nginx
sudo tail -f /var/log/nginx/crm-access.log
sudo tail -f /var/log/nginx/crm-error.log
```

### Renouveler le certificat SSL manuellement

```bash
sudo certbot renew
sudo systemctl reload nginx
```

---

## Dépannage

### Le backend ne démarre pas

```bash
# Vérifier les logs
pm2 logs crm-backend

# Vérifier le fichier .env
cat /var/www/crm-app/backend/.env

# Tester la connexion à la base de données
cd /var/www/crm-app/backend
node -e "require('dotenv').config(); const mysql = require('mysql2/promise'); mysql.createConnection({host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME}).then(() => console.log('OK')).catch(e => console.error(e))"
```

### Le frontend ne se charge pas

```bash
# Vérifier que le build existe
ls -la /var/www/crm-app/frontend/dist

# Vérifier les permissions
sudo chown -R www-data:www-data /var/www/crm-app/frontend/dist

# Vérifier les logs Nginx
sudo tail -f /var/log/nginx/crm-error.log
```

### Erreur 502 Bad Gateway

```bash
# Vérifier que le backend fonctionne
pm2 list
pm2 logs crm-backend

# Vérifier que le port 5000 est accessible
netstat -tlnp | grep 5000

# Redémarrer le backend
pm2 restart crm-backend
```

### Problème avec le certificat SSL

```bash
# Vérifier le certificat
sudo certbot certificates

# Renouveler le certificat
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

---

## Sécurité Supplémentaire

### 1. Désactiver l'accès root via SSH

```bash
sudo nano /etc/ssh/sshd_config
```

Modifier :
```
PermitRootLogin no
```

Puis :
```bash
sudo systemctl restart sshd
```

### 2. Configurer un utilisateur non-root

```bash
# Créer un utilisateur
sudo adduser deploy

# Ajouter aux groupes nécessaires
sudo usermod -aG sudo deploy
sudo usermod -aG www-data deploy

# Transférer la propriété des fichiers
sudo chown -R deploy:deploy /var/www/crm-app
```

### 3. Configurer les sauvegardes automatiques

Créez un script de sauvegarde :

```bash
nano /var/www/crm-app/backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/crm"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Sauvegarder les fichiers
tar -czf $BACKUP_DIR/crm-app-$DATE.tar.gz /var/www/crm-app

# Garder seulement les 7 derniers backups
find $BACKUP_DIR -name "crm-app-*.tar.gz" -mtime +7 -delete
```

Ajouter au crontab :

```bash
crontab -e
```

Ajouter :
```
0 2 * * * /var/www/crm-app/backup.sh
```

---

## Résumé des Commandes Importantes

```bash
# Déploiement initial
git clone https://github.com/VOTRE_USERNAME/nom-du-depot.git /var/www/crm-app
cd /var/www/crm-app/backend && npm install --production
cd ../frontend && npm install && npm run build
pm2 start /var/www/crm-app/backend/server.js --name "crm-backend"
sudo certbot --nginx -d crm.voiptunisie.com

# Mise à jour
cd /var/www/crm-app
git pull origin main
cd backend && npm install --production
cd ../frontend && npm install && npm run build
pm2 restart crm-backend

# Logs
pm2 logs crm-backend
sudo tail -f /var/log/nginx/crm-error.log

# Redémarrage
pm2 restart crm-backend
sudo systemctl restart nginx
```

---

## Support

En cas de problème, vérifiez :
1. Les logs PM2 : `pm2 logs crm-backend`
2. Les logs Nginx : `sudo tail -f /var/log/nginx/crm-error.log`
3. Le statut des services : `sudo systemctl status nginx` et `pm2 list`
4. La configuration DNS : `dig crm.voiptunisie.com`
5. La connectivité réseau : `curl -I https://crm.voiptunisie.com`

---

**✅ Votre application est maintenant déployée et accessible sur https://crm.voiptunisie.com !**

