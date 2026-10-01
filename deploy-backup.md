# Guide de Déploiement - CRM JWS Group (BACKUP)

## Informations du Serveur

- **IP du serveur** : `137.74.42.39`
- **Nom de domaine** : `backup.jwsgroup.fr`
- **Certificat SSL** : Let's Encrypt (via Certbot)
- **Base de données** : Serveur distant `151.80.58.72` (MariaDB 10.6+ ou MySQL 5.7+)

> **Instance BACKUP** — distincte de la prod (`crm.jwsgroup.fr` / `51.75.254.170`).  
> Autoriser l’IP `137.74.42.39` sur le serveur MariaDB pour les connexions distantes.  
> Répertoire app : `/var/www/crm-backup-app` — process PM2 : `crm-backup-backend`.

---

## Prérequis

- Accès SSH au serveur avec les droits root ou sudo
- Le domaine `backup.jwsgroup.fr` doit pointer vers l'IP `137.74.42.39`
- Un compte GitHub avec le dépôt de l'application

---

## Étape 1 : Préparation du Serveur

### 1.1 Connexion au serveur

```bash
ssh root@137.74.42.39
# ou
ssh votre_utilisateur@137.74.42.39
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
   - **Valeur** : `137.74.42.39`
   - **TTL** : 3600 (ou valeur par défaut)

3. Vérifiez la propagation DNS :
```bash
dig backup.jwsgroup.fr
# ou
nslookup backup.jwsgroup.fr
```

---

## Étape 3 : Configuration de la Base de Données Distante

**Note importante :** La base de données est hébergée sur un serveur distant (`151.80.58.72`). Vous n'avez pas besoin d'installer MariaDB sur le serveur d'application, seulement le client MySQL/MariaDB pour les connexions.

### 3.1 Installation du client MariaDB (pour les connexions)

```bash
# Mettre à jour les dépôts
sudo apt update

# Installer uniquement le client MariaDB (pas le serveur)
sudo apt install -y mariadb-client

# Vérifier l'installation
mysql --version
# Devrait afficher : mysql Ver 15.1 Distrib 10.x.x-MariaDB
```

### 3.2 Tester la connexion à la base de données distante

```bash
# Tester la connexion
mysql -h 151.80.58.72 -u hamzus -p crm

# Si la connexion fonctionne, vous devriez voir le prompt MySQL
# Tapez EXIT; pour quitter
```

### 3.3 Vérifier que la base de données existe

```bash
# Se connecter et vérifier les tables
mysql -h 151.80.58.72 -u hamzus -p crm -e "SHOW TABLES;"
```

### 3.4 Initialiser la base de données (si nécessaire)

Si la base de données n'est pas encore initialisée, exécutez les scripts SQL sur le serveur distant :

```bash
cd /var/www/crm-backup-app

# Exécuter le schéma de base de données sur le serveur distant
mysql -h 151.80.58.72 -u hamzus -p crm < database_schema.sql

# Exécuter les autres scripts SQL si nécessaire
mysql -h 151.80.58.72 -u hamzus -p crm < create_permissions_tables.sql
mysql -h 151.80.58.72 -u hamzus -p crm < create_notifications_table.sql
mysql -h 151.80.58.72 -u hamzus -p crm < create_affectations_table.sql
# ... autres scripts SQL
```

**Note :** Assurez-vous que le serveur de base de données (`151.80.58.72`) autorise les connexions depuis l'IP de votre serveur d'application (`137.74.42.39`). Si nécessaire, configurez le pare-feu du serveur de base de données.

---

## Étape 4 : Installation de Node.js

### 4.1 Installation de Node.js (version LTS)

```bash
# Installer Node.js via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Vérifier l'installation
node --version
npm --version
```

### 4.2 Installation de PM2 (Gestionnaire de processus)

```bash
sudo npm install -g pm2

# Configurer PM2 pour démarrer au boot
pm2 startup systemd
# Suivre les instructions affichées
```

---

## Étape 5 : Installation de Nginx

```bash
sudo apt install -y nginx

# Démarrer et activer Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Vérifier le statut
sudo systemctl status nginx
```

---

## Étape 6 : Installation de Certbot (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
```

---

## Étape 7 : Cloner le Projet depuis GitHub

### 7.1 Créer un répertoire pour l'application

```bash
sudo mkdir -p /var/www
cd /var/www
```

### 7.2 Cloner le dépôt GitHub

```bash
# Option 1 : Avec HTTPS (nécessite un token GitHub)
git clone https://github.com/VOTRE_USERNAME/nom-du-depot.git crm-app

# Option 2 : Avec SSH (si vous avez configuré une clé SSH)
git clone git@github.com:VOTRE_USERNAME/nom-du-depot.git crm-app

# Remplacer VOTRE_USERNAME et nom-du-depot par vos informations
```

### 7.3 Définir les permissions

```bash
sudo chown -R $USER:$USER /var/www/crm-backup-app
cd /var/www/crm-backup-app
```

---

## Étape 8 : Configuration de l'Application

### 8.1 Configuration du Backend

```bash
cd /var/www/crm-backup-app/backend

# Créer le fichier .env
nano .env
```

Contenu du fichier `.env` pour le backend :

```env
# Configuration du serveur
PORT=5000
NODE_ENV=production

# Configuration de la base de données MariaDB
DB_HOST=151.80.58.72
DB_USER=hamzus
DB_PASSWORD=hamzusLogiKk
DB_NAME=crm

# Configuration JWT (Authentification)
JWT_SECRET=crm-jws-group-secret-key-2024-change-in-production
JWT_EXPIRE=7d

# Configuration CORS
FRONTEND_URL=https://backup.jwsgroup.fr

# Configuration Email (optionnel)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=
EMAIL_PASS=
EMAIL_FROM=noreply@backup.jwsgroup.fr

# Configuration SMS (optionnel)
SMS_API_KEY=
SMS_API_URL=

# Configuration Upload
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880
```

### 8.2 Configuration du Frontend

```bash
cd /var/www/crm-backup-app/frontend

# Créer le fichier .env
nano .env
```

Contenu du fichier `.env` pour le frontend :

```env
# URL de l'API Backend
VITE_API_URL=https://backup.jwsgroup.fr/api

# Nom de l'application
VITE_APP_NAME=CRM JWS Group (Backup)

# Version de l'application
VITE_APP_VERSION=1.0.0
```

### 8.3 Installation des dépendances

```bash
# Backend
cd /var/www/crm-backup-app/backend
npm install --production

# Frontend
cd /var/www/crm-backup-app/frontend
npm install
```

### 8.4 Build du Frontend

```bash
cd /var/www/crm-backup-app/frontend
npm run build
```

Le build sera créé dans le dossier `dist/`.

---

## Étape 9 : Configuration de Nginx

### 9.1 Créer la configuration Nginx

```bash
sudo nano /etc/nginx/sites-available/backup.jwsgroup.fr
```

Contenu de la configuration :

```nginx
# Redirection HTTP vers HTTPS
server {
    listen 80;
    server_name backup.jwsgroup.fr;
    
    # Redirection vers HTTPS (sera configuré après l'installation du certificat)
    return 301 https://$server_name$request_uri;
}

# Configuration HTTPS
server {
    listen 443 ssl http2;
    server_name backup.jwsgroup.fr;

    # Certificats SSL (seront ajoutés par Certbot)
    ssl_certificate /etc/letsencrypt/live/backup.jwsgroup.fr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/backup.jwsgroup.fr/privkey.pem;
    
    # Configuration SSL recommandée
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Taille maximale des uploads
    client_max_body_size 10M;

    # Logs
    access_log /var/log/nginx/crm-backup-access.log;
    error_log /var/log/nginx/crm-backup-error.log;

    # Servir le frontend (fichiers statiques)
    location / {
        root /var/www/crm-backup-app/frontend/dist;
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
        
        # Timeouts pour les requêtes longues
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # Servir les fichiers statiques uploadés
    location /uploads {
        alias /var/www/crm-backup-app/backend/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 9.2 Activer la configuration

```bash
# Créer le lien symbolique
sudo ln -s /etc/nginx/sites-available/backup.jwsgroup.fr /etc/nginx/sites-enabled/

# Tester la configuration
sudo nginx -t

# Si la configuration est valide, recharger Nginx
sudo systemctl reload nginx
```

---

## Étape 10 : Installation du Certificat SSL Let's Encrypt

### 10.1 Obtenir le certificat

```bash
sudo certbot --nginx -d backup.jwsgroup.fr
```

Certbot va :
1. Vérifier que le domaine pointe vers le serveur
2. Obtenir le certificat SSL
3. Configurer automatiquement Nginx pour utiliser HTTPS
4. Configurer le renouvellement automatique

### 10.2 Vérifier le renouvellement automatique

```bash
# Tester le renouvellement
sudo certbot renew --dry-run
```

Le certificat sera automatiquement renouvelé avant expiration.

---

## Étape 11 : Configuration de PM2 pour le Backend

### 11.1 Créer le fichier de configuration PM2

```bash
cd /var/www/crm-backup-app/backend
nano ecosystem.config.js
```

Contenu du fichier :

```javascript
module.exports = {
  apps: [{
    name: 'crm-backup-backend',
    script: './server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: '/root/.pm2/logs/crm-backup-backend-error.log',
    out_file: '/root/.pm2/logs/crm-backup-backend-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};
```

### 11.2 Démarrer le backend avec PM2

```bash
cd /var/www/crm-backup-app/backend
pm2 start ecosystem.config.js
```

### 11.3 Configurer PM2 pour démarrer au boot

```bash
# Générer le script de démarrage
pm2 startup systemd

# Sauvegarder la configuration actuelle
pm2 save
```

### 11.4 Commandes PM2 utiles

```bash
# Voir les processus
pm2 list

# Voir les logs
pm2 logs crm-backup-backend

# Redémarrer
pm2 restart crm-backup-backend

# Arrêter
pm2 stop crm-backup-backend

# Surveiller
pm2 monit
```

---

## Étape 12 : Configuration du Firewall

### 12.1 Configuration UFW — accès uniquement depuis 2 IPs

Accès autorisé **uniquement** depuis :
- `196.203.29.170`
- `41.226.50.142`

Ports concernés : **22** (SSH), **80** (HTTP), **443** (HTTPS).

> **Attention Certbot / Let's Encrypt :** avec le port 80 fermé au reste d’Internet, le renouvellement HTTP-01 échouera.
> Avant un renew : ouvrir temporairement `80/tcp`, lancer `sudo certbot renew`, puis refermer ;
> ou utiliser un challenge DNS.

```bash
# Politique par défaut
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Supprimer d’éventuelles règles trop ouvertes (ignorer l’erreur si absentes)
sudo ufw delete allow 22/tcp 2>/dev/null || true
sudo ufw delete allow 80/tcp 2>/dev/null || true
sudo ufw delete allow 443/tcp 2>/dev/null || true

# SSH — uniquement depuis les 2 IPs (IMPORTANT : reconnectez-vous depuis l’une d’elles)
sudo ufw allow from 196.203.29.170 to any port 22 proto tcp
sudo ufw allow from 41.226.50.142 to any port 22 proto tcp

# HTTP / HTTPS — uniquement depuis les 2 IPs
sudo ufw allow from 196.203.29.170 to any port 80 proto tcp
sudo ufw allow from 41.226.50.142 to any port 80 proto tcp
sudo ufw allow from 196.203.29.170 to any port 443 proto tcp
sudo ufw allow from 41.226.50.142 to any port 443 proto tcp

# Activer (confirmer avec y si demandé)
sudo ufw --force enable

# Vérifier
sudo ufw status numbered
```

Résultat attendu :

```text
To                         Action      From
--                         ------      ----
22/tcp                     ALLOW IN    196.203.29.170
22/tcp                     ALLOW IN    41.226.50.142
80/tcp                     ALLOW IN    196.203.29.170
80/tcp                     ALLOW IN    41.226.50.142
443/tcp                    ALLOW IN    196.203.29.170
443/tcp                    ALLOW IN    41.226.50.142
```

### 12.2 Renouvellement SSL (si besoin d’ouvrir 80 temporairement)

```bash
sudo ufw allow 80/tcp
sudo certbot renew
sudo ufw delete allow 80/tcp
sudo ufw status numbered
```

---

## Étape 13 : Vérification et Test

### 13.1 Vérifier que tous les services fonctionnent

```bash
# Vérifier la connexion à la base de données distante
mysql -h 151.80.58.72 -u hamzus -p crm -e "SELECT 1;"

# Vérifier Nginx
sudo systemctl status nginx

# Vérifier PM2
pm2 list

# Vérifier les logs
pm2 logs crm-backup-backend --lines 50
sudo tail -f /var/log/nginx/crm-backup-error.log
```

### 13.2 Tester la connexion à la base de données distante

```bash
# Tester la connexion au serveur distant
mysql -h 151.80.58.72 -u hamzus -p crm -e "SELECT VERSION();"

# Vérifier les tables
mysql -h 151.80.58.72 -u hamzus -p crm -e "SHOW TABLES;"
```

### 13.3 Tester l'application

1. Ouvrez votre navigateur et allez sur : `https://backup.jwsgroup.fr`
2. Vérifiez que :
   - Le certificat SSL est valide (cadenas vert)
   - Le frontend se charge correctement
   - L'API backend répond (testez la connexion)

---

## Étape 14 : Script de Déploiement Automatique

Créez un script pour faciliter les mises à jour futures :

```bash
nano /var/www/crm-backup-app/deploy.sh
```

Contenu du script :

```bash
#!/bin/bash

echo "🚀 Déploiement de l'application CRM..."

# Aller dans le répertoire de l'application
cd /var/www/crm-backup-app

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
pm2 restart crm-backup-backend

echo "✅ Déploiement terminé !"
```

Rendre le script exécutable :

```bash
chmod +x /var/www/crm-backup-app/deploy.sh
```

Utilisation :

```bash
/var/www/crm-backup-app/deploy.sh
```

---

## Maintenance et Mises à Jour

### Mettre à jour l'application

```bash
cd /var/www/crm-backup-app
git pull origin main
cd backend && npm install --production
cd ../frontend && npm install && npm run build
pm2 restart crm-backup-backend
```

### Voir les logs

```bash
# Logs backend
pm2 logs crm-backup-backend

# Logs MariaDB (sur le serveur de base de données 151.80.58.72)
# Note: Les logs sont sur le serveur distant, pas sur le serveur d'application

# Logs Nginx
sudo tail -f /var/log/nginx/crm-backup-access.log
sudo tail -f /var/log/nginx/crm-backup-error.log
```

### Renouveler le certificat SSL manuellement

```bash
sudo certbot renew
sudo systemctl reload nginx
```

### Sauvegarder la base de données

```bash
# Créer un script de sauvegarde
nano /usr/local/bin/backup-crm-backup-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/crm-backup"
DATE=$(date +%Y%m%d_%H%M%S)
DB_HOST="151.80.58.72"
DB_NAME="crm"
DB_USER="hamzus"
DB_PASS="hamzusLogiKk"

mkdir -p $BACKUP_DIR

# Sauvegarder depuis le serveur distant
mysqldump -h $DB_HOST -u $DB_USER -p$DB_PASS $DB_NAME | gzip > $BACKUP_DIR/crm_backup_app_$DATE.sql.gz

# Garder seulement les 7 derniers backups
find $BACKUP_DIR -name "crm_backup_app_*.sql.gz" -mtime +7 -delete

echo "Backup créé : $BACKUP_DIR/crm_backup_app_$DATE.sql.gz"
```

Rendre exécutable et ajouter au cron :

```bash
chmod +x /usr/local/bin/backup-crm-backup-db.sh

# Ajouter au crontab pour sauvegarde quotidienne à 2h du matin
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-crm-backup-db.sh >> /var/log/crm-backup-app.log 2>&1") | crontab -
```

---

## Dépannage

### Le backend ne démarre pas

```bash
# Vérifier les logs
pm2 logs crm-backup-backend

# Vérifier le fichier .env
cat /var/www/crm-backup-app/backend/.env

# Tester la connexion à la base de données
cd /var/www/crm-backup-app/backend
node -e "require('dotenv').config(); const mysql = require('mysql2/promise'); mysql.createConnection({host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME}).then(() => console.log('✅ Connexion OK')).catch(e => console.error('❌ Erreur:', e.message))"
```

### Problème de connexion à la base de données distante

```bash
# Tester la connexion au serveur distant
mysql -h 151.80.58.72 -u hamzus -p crm

# Vérifier la connectivité réseau
ping 151.80.58.72

# Tester le port MySQL (3306)
telnet 151.80.58.72 3306
# ou
nc -zv 151.80.58.72 3306

# Vérifier les logs de connexion sur le serveur de base de données
# (nécessite un accès au serveur 151.80.58.72)

# Vérifier que le pare-feu autorise les connexions depuis 137.74.42.39
# (nécessite un accès au serveur 151.80.58.72)
```

### Le frontend ne se charge pas

```bash
# Vérifier que le build existe
ls -la /var/www/crm-backup-app/frontend/dist

# Vérifier les permissions
sudo chown -R www-data:www-data /var/www/crm-backup-app/frontend/dist

# Vérifier les logs Nginx
sudo tail -f /var/log/nginx/crm-backup-error.log
```

### Erreur 502 Bad Gateway

```bash
# Vérifier que le backend fonctionne
pm2 list
pm2 logs crm-backup-backend

# Vérifier que le port 5000 est accessible
netstat -tlnp | grep 5000

# Redémarrer le backend
pm2 restart crm-backup-backend
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

## Informations sur la Base de Données Distante

### Configuration

La base de données est hébergée sur un serveur distant :
- **Serveur** : `151.80.58.72`
- **Utilisateur** : `hamzus`
- **Base de données** : `crm`
- **Type** : MariaDB 10.6+ ou MySQL 5.7+ (compatible)

### Vérifier la version et la configuration

```bash
# Se connecter au serveur distant
mysql -h 151.80.58.72 -u hamzus -p crm
```

Puis exécuter les commandes SQL :

```sql
-- Vérifier la version
SELECT VERSION();

-- Vérifier les modes SQL
SELECT @@sql_mode;

-- Vérifier l'encodage
SHOW VARIABLES LIKE 'character_set%';
SHOW VARIABLES LIKE 'collation%';

-- Vérifier les tables
SHOW TABLES;

-- Quitter
EXIT;
```

### Commandes utiles pour la base de données distante

```bash
# Se connecter à la base de données distante
mysql -h 151.80.58.72 -u hamzus -p crm

# Voir les processus (sur le serveur distant)
mysqladmin -h 151.80.58.72 -u hamzus -p processlist

# Vérifier la connectivité
ping 151.80.58.72
telnet 151.80.58.72 3306
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
sudo chown -R deploy:deploy /var/www/crm-backup-app
```

### 3. Configurer les sauvegardes automatiques

Le script de sauvegarde de la base de données a été créé à l'étape 14.

---

## Résumé des Commandes Importantes

```bash
# Déploiement initial
git clone https://github.com/VOTRE_USERNAME/nom-du-depot.git /var/www/crm-backup-app
cd /var/www/crm-backup-app/backend && npm install --production
cd ../frontend && npm install && npm run build
pm2 start /var/www/crm-backup-app/backend/ecosystem.config.js
sudo certbot --nginx -d backup.jwsgroup.fr

# Mise à jour
cd /var/www/crm-backup-app
git pull origin main
cd backend && npm install --production
cd ../frontend && npm install && npm run build
pm2 restart crm-backup-backend

# Logs
pm2 logs crm-backup-backend
sudo tail -f /var/log/nginx/crm-backup-error.log
# Note: Les logs de la base de données sont sur le serveur distant 151.80.58.72

# Redémarrage
pm2 restart crm-backup-backend
sudo systemctl restart nginx
# Note: La base de données est distante (151.80.58.72), redémarrer nécessite un accès au serveur de base de données

# Sauvegarde base de données
/usr/local/bin/backup-crm-backup-db.sh
```

---

## Support

En cas de problème, vérifiez :
1. Les logs PM2 : `pm2 logs crm-backup-backend`
2. Les logs Nginx : `sudo tail -f /var/log/nginx/crm-backup-error.log`
3. Les logs de la base de données : (sur le serveur distant 151.80.58.72, nécessite un accès SSH)
4. Le statut des services : `sudo systemctl status nginx` et `pm2 list`
5. La connexion à la base de données distante : `mysql -h 151.80.58.72 -u hamzus -p crm -e "SELECT 1;"`
5. La configuration DNS : `dig backup.jwsgroup.fr`
6. La connectivité réseau : `curl -I https://backup.jwsgroup.fr`

---

**✅ Votre application est maintenant déployée et accessible sur https://backup.jwsgroup.fr !**

**Note :** La base de données est hébergée sur le serveur distant `151.80.58.72`. Assurez-vous que ce serveur est accessible et que les connexions depuis `137.74.42.39` sont autorisées.

