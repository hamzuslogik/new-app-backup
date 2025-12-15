# Guide de Déploiement - Ubuntu 22.04 avec MySQL 5.7 / MariaDB

Ce guide décrit les étapes pour déployer l'application CRM sur Ubuntu 22.04 avec MySQL 5.7 ou MariaDB (alternative recommandée).

## ⚠️ Avertissement Important

**MySQL 5.7 est en fin de vie (EOL) depuis octobre 2023** et ne reçoit plus de mises à jour de sécurité. 

**Recommandations :**
- **Pour la production :** Utilisez **MariaDB 10.6+** (compatible MySQL 5.7) ou **MySQL 8.0**
- **Pour les tests :** MySQL 5.7 peut être installé via les méthodes décrites ci-dessous
- Ce guide inclut plusieurs méthodes d'installation pour répondre à différents besoins

## 🚀 Installation Rapide Recommandée (MariaDB)

Si vous voulez une solution rapide et sécurisée, utilisez MariaDB (compatible MySQL 5.7) :

```bash
# Installation en 3 commandes
sudo apt update
sudo apt install -y mariadb-server mariadb-client
sudo mysql_secure_installation

# Puis continuez à la section 3 (Configuration de MySQL)
```

MariaDB est 100% compatible avec MySQL 5.7 pour cette application et est activement maintenu.

## Prérequis

- Serveur Ubuntu 22.04 LTS
- Accès root ou utilisateur avec privilèges sudo
- Connexion Internet active

## 1. Mise à jour du système

```bash
sudo apt update
sudo apt upgrade -y
```

## 2. Installation de MySQL 5.7

### ⚠️ Note importante sur MySQL 5.7

**MySQL 5.7 est en fin de vie (EOL) depuis octobre 2023** et n'est plus maintenu par Oracle. Il n'est plus disponible dans les dépôts récents du package `mysql-apt-config`.

**Recommandations :**
- **Pour la production :** Considérez migrer vers **MySQL 8.0** ou **MariaDB 10.6+** qui sont activement maintenus
- **Pour les tests/compatibilité :** Les méthodes ci-dessous permettent d'installer MySQL 5.7 si nécessaire
- **Sécurité :** MySQL 5.7 ne recevra plus de mises à jour de sécurité

Si vous devez absolument utiliser MySQL 5.7, voici plusieurs méthodes pour l'installer sur Ubuntu 22.04 :

### Méthode 1 : Installation depuis les archives MySQL (Recommandée si MySQL 5.7 requis)

Cette méthode utilise les archives officielles de MySQL.

```bash
# 1. Télécharger le package MySQL 5.7 depuis les archives
cd /tmp

# Vérifier la dernière version disponible sur https://downloads.mysql.com/archives/
# Exemple avec la version 5.7.44 (remplacer par la dernière version disponible)
wget https://downloads.mysql.com/archives/get/p/23/file/mysql-server_5.7.44-1ubuntu22.04_amd64.deb-bundle.tar

# 2. Extraire l'archive
tar -xvf mysql-server_5.7.44-1ubuntu22.04_amd64.deb-bundle.tar

# 3. Installer les dépendances nécessaires
sudo apt update
sudo apt install -y libaio1 libmecab2 libnuma1

# 4. Installer les packages dans l'ordre (important)
sudo dpkg -i mysql-common_5.7.44-1ubuntu22.04_amd64.deb
sudo dpkg -i mysql-community-client_5.7.44-1ubuntu22.04_amd64.deb
sudo dpkg -i mysql-client_5.7.44-1ubuntu22.04_amd64.deb
sudo dpkg -i mysql-community-server_5.7.44-1ubuntu22.04_amd64.deb

# Si des erreurs de dépendances apparaissent, corriger avec :
sudo apt-get install -f -y

# 5. Vérifier l'installation
mysql --version
# Devrait afficher : mysql Ver 14.14 Distrib 5.7.44
```

**Note :** Si le lien de téléchargement ne fonctionne pas, consultez https://downloads.mysql.com/archives/ pour trouver la dernière version disponible.

### Méthode 2 : Installation via les dépôts MySQL (Alternative)

Si la méthode 1 ne fonctionne pas, essayez cette approche :

```bash
# 1. Télécharger le package de configuration MySQL
cd /tmp
wget https://dev.mysql.com/get/mysql-apt-config_0.8.24-1_all.deb

# 2. Installer le package
sudo dpkg -i mysql-apt-config_0.8.24-1_all.deb

# 3. Si le menu ne contient pas MySQL 5.7, éditer manuellement le fichier
sudo nano /etc/apt/sources.list.d/mysql.list

# Ajouter ou modifier pour pointer vers les archives MySQL 5.7
# Le fichier devrait contenir quelque chose comme :
# deb http://repo.mysql.com/apt/ubuntu/ jammy mysql-5.7
# OU utiliser les archives :
# deb http://archive.mysql.com/apt/ubuntu/ jammy mysql-5.7

# 4. Ajouter la clé GPG
sudo apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 5072E1F5

# 5. Mettre à jour les dépôts
sudo apt update

# 6. Installer MySQL 5.7
sudo apt install mysql-server=5.7.* mysql-client=5.7.* -y
```

### Méthode 3 : Installation via Docker (Recommandée pour les tests)

Si vous préférez utiliser Docker pour isoler MySQL 5.7 :

```bash
# 1. Installer Docker
sudo apt update
sudo apt install -y docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker

# 2. Créer un fichier docker-compose.yml
cat > /opt/mysql5.7/docker-compose.yml <<EOF
version: '3.8'
services:
  mysql:
    image: mysql:5.7
    container_name: mysql57
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: votre_mot_de_passe_root
      MYSQL_DATABASE: crm
      MYSQL_USER: crm_user
      MYSQL_PASSWORD: votre_mot_de_passe
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      - ./init:/docker-entrypoint-initdb.d
    command: --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci

volumes:
  mysql_data:
EOF

# 3. Démarrer MySQL
cd /opt/mysql5.7
sudo docker-compose up -d

# 4. Vérifier que MySQL fonctionne
sudo docker ps | grep mysql57
```

### Méthode 4 : Utiliser MariaDB 10.6+ (Recommandé pour la production)

MariaDB est une alternative open-source compatible avec MySQL 5.7, activement maintenue :

```bash
# 1. Installer MariaDB
sudo apt update
sudo apt install -y mariadb-server mariadb-client

# 2. Démarrer et activer MariaDB
sudo systemctl start mariadb
sudo systemctl enable mariadb

# 3. Configuration sécurisée
sudo mysql_secure_installation

# 4. Vérifier la version
mysql --version
# Devrait afficher : mysql Ver 15.1 Distrib 10.6.x-MariaDB
```

**Avantages de MariaDB :**
- ✅ Compatible avec MySQL 5.7 (syntaxe SQL identique)
- ✅ Activement maintenu et sécurisé
- ✅ Disponible dans les dépôts Ubuntu par défaut
- ✅ Performances similaires ou meilleures
- ✅ Pas de problèmes de licence

**Note :** Testez votre application avec MariaDB avant de l'utiliser en production. La plupart des applications fonctionnent sans modification.

### 2.5 Configuration sécurisée de MySQL

Après l'installation (quelle que soit la méthode choisie) :

```bash
sudo mysql_secure_installation
```

Répondre aux questions :
- Valider le mot de passe ? Oui
- Niveau de validation du mot de passe : 1 (Medium)
- Mot de passe root : [votre mot de passe]
- Supprimer les utilisateurs anonymes ? Oui
- Désactiver la connexion root à distance ? Oui
- Supprimer la base de test ? Oui
- Recharger les privilèges ? Oui

### 2.6 Vérifier l'installation

```bash
mysql --version
# Devrait afficher : mysql Ver 14.14 Distrib 5.7.x
# OU pour MariaDB : mysql Ver 15.1 Distrib 10.x.x-MariaDB
```

### 2.7 Démarrer et activer MySQL

```bash
sudo systemctl start mysql
sudo systemctl enable mysql
sudo systemctl status mysql
```

## 3. Configuration de MySQL 5.7

### 3.1 Se connecter à MySQL

```bash
sudo mysql -u root -p
```

### 3.2 Créer la base de données et l'utilisateur

```sql
-- Créer la base de données
CREATE DATABASE IF NOT EXISTS `crm` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Créer l'utilisateur (remplacer 'password' par un mot de passe fort)
CREATE USER 'crm_user'@'localhost' IDENTIFIED BY 'votre_mot_de_passe_fort';

-- Accorder les privilèges
GRANT ALL PRIVILEGES ON crm.* TO 'crm_user'@'localhost';
FLUSH PRIVILEGES;

-- Quitter MySQL
EXIT;
```

### 3.3 Configuration MySQL pour l'application

Éditer le fichier de configuration MySQL :

```bash
sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf
```

Ajouter/modifier les paramètres suivants dans la section `[mysqld]` :

```ini
[mysqld]
# Encodage UTF-8
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci

# Taille maximale des paquets
max_allowed_packet = 256M

# Timeouts
wait_timeout = 28800
interactive_timeout = 28800

# Logs
general_log = 0
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow-query.log
long_query_time = 2

# InnoDB
innodb_buffer_pool_size = 1G
innodb_log_file_size = 256M
innodb_flush_log_at_trx_commit = 2
```

Redémarrer MySQL :

```bash
sudo systemctl restart mysql
sudo systemctl enable mysql
```

## 4. Installation de Node.js

### 4.1 Installer Node.js 18.x (LTS)

```bash
# Installer curl si nécessaire
sudo apt install curl -y

# Ajouter le dépôt NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Installer Node.js
sudo apt install -y nodejs

# Vérifier l'installation
node --version
npm --version
```

## 5. Installation de PM2

```bash
sudo npm install -g pm2

# Configurer PM2 pour démarrer au boot
pm2 startup systemd
# Suivre les instructions affichées
```

## 6. Installation de Git

```bash
sudo apt install git -y
```

## 7. Déploiement de l'application

### 7.1 Cloner ou copier l'application

```bash
# Créer le répertoire de l'application
sudo mkdir -p /var/www/crm-app
sudo chown $USER:$USER /var/www/crm-app

# Cloner le dépôt (si vous utilisez Git)
cd /var/www/crm-app
git clone [votre-repo-url] .

# OU copier les fichiers de l'application
# scp -r ./backend ./frontend user@server:/var/www/crm-app/
```

### 7.2 Configuration de l'environnement

Créer le fichier `.env` dans le répertoire `backend` :

```bash
cd /var/www/crm-app/backend
nano .env
```

Contenu du fichier `.env` :

```env
# Configuration de la base de données
DB_HOST=localhost
DB_USER=crm_user
DB_PASSWORD=votre_mot_de_passe_fort
DB_NAME=crm

# Configuration du serveur
NODE_ENV=production
PORT=3000

# JWT Secret (générer une clé aléatoire)
JWT_SECRET=votre_secret_jwt_tres_long_et_aleatoire

# Autres variables d'environnement si nécessaire
```

Générer un JWT_SECRET sécurisé :

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 7.3 Installation des dépendances

```bash
# Backend
cd /var/www/crm-app/backend
npm install --production

# Frontend (si nécessaire)
cd /var/www/crm-app/frontend
npm install --production
npm run build
```

## 8. Initialisation de la base de données

### 8.1 Exécuter les scripts SQL

```bash
cd /var/www/crm-app

# Se connecter à MySQL
mysql -u crm_user -p crm < database_schema.sql

# Exécuter les autres scripts SQL si nécessaire
mysql -u crm_user -p crm < create_permissions_tables.sql
mysql -u crm_user -p crm < create_notifications_table.sql
mysql -u crm_user -p crm < create_affectations_table.sql
# ... autres scripts SQL
```

### 8.2 Vérifier les tables

```bash
mysql -u crm_user -p crm -e "SHOW TABLES;"
```

## 9. Configuration de PM2

### 9.1 Créer le fichier de configuration PM2

```bash
cd /var/www/crm-app/backend
nano ecosystem.config.js
```

Contenu du fichier :

```javascript
module.exports = {
  apps: [{
    name: 'crm-backend',
    script: './server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/root/.pm2/logs/crm-backend-error.log',
    out_file: '/root/.pm2/logs/crm-backend-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};
```

### 9.2 Démarrer l'application avec PM2

```bash
cd /var/www/crm-app/backend
pm2 start ecosystem.config.js

# Vérifier le statut
pm2 status

# Voir les logs
pm2 logs crm-backend

# Sauvegarder la configuration PM2
pm2 save
```

## 10. Configuration de Nginx (optionnel mais recommandé)

### 10.1 Installer Nginx

```bash
sudo apt install nginx -y
```

### 10.2 Configuration Nginx

```bash
sudo nano /etc/nginx/sites-available/crm-app
```

Contenu de la configuration :

```nginx
server {
    listen 80;
    server_name votre-domaine.com;  # Remplacer par votre domaine ou IP

    # Frontend (si vous servez le frontend avec Nginx)
    location / {
        root /var/www/crm-app/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
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

    # Logs
    access_log /var/log/nginx/crm-app-access.log;
    error_log /var/log/nginx/crm-app-error.log;
}
```

Activer le site :

```bash
sudo ln -s /etc/nginx/sites-available/crm-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## 11. Configuration du pare-feu

```bash
# Autoriser SSH (si pas déjà fait)
sudo ufw allow 22/tcp

# Autoriser HTTP
sudo ufw allow 80/tcp

# Autoriser HTTPS (si vous utilisez SSL)
sudo ufw allow 443/tcp

# Activer le pare-feu
sudo ufw enable
```

## 12. Différences importantes : MySQL 5.7 vs MySQL 8

### 12.1 Mode SQL

MySQL 5.7 n'a **PAS** le mode `ONLY_FULL_GROUP_BY` activé par défaut, contrairement à MySQL 8. Les requêtes SQL avec `GROUP BY` fonctionneront sans nécessiter `ANY_VALUE()`.

Cependant, pour la compatibilité future, il est recommandé de garder les modifications apportées pour MySQL 8.

### 12.2 Fonctions SQL

- `DATABASE()` fonctionne dans MySQL 5.7 (mais `SCHEMA()` est préféré pour la compatibilité)
- `AUTO_INCREMENT=1` est accepté dans MySQL 5.7 (mais redondant)

### 12.3 Vérifier le mode SQL actuel

```sql
SELECT @@sql_mode;
```

Pour MySQL 5.7, vous devriez voir quelque chose comme :
```
ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION
```

## 13. Vérification du déploiement

### 13.1 Vérifier que l'application fonctionne

```bash
# Vérifier les processus PM2
pm2 status

# Vérifier les logs
pm2 logs crm-backend --lines 50

# Tester l'API
curl http://localhost:3000/api/health
```

### 13.2 Vérifier la connexion à la base de données

```bash
mysql -u crm_user -p crm -e "SELECT COUNT(*) as total_fiches FROM fiches;"
```

## 14. Maintenance et sauvegarde

### 14.1 Script de sauvegarde de la base de données

Créer un script de sauvegarde :

```bash
sudo nano /usr/local/bin/backup-crm-db.sh
```

Contenu :

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/crm"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="crm"
DB_USER="crm_user"
DB_PASS="votre_mot_de_passe"

mkdir -p $BACKUP_DIR

mysqldump -u $DB_USER -p$DB_PASS $DB_NAME | gzip > $BACKUP_DIR/crm_backup_$DATE.sql.gz

# Garder seulement les 7 derniers backups
find $BACKUP_DIR -name "crm_backup_*.sql.gz" -mtime +7 -delete

echo "Backup créé : $BACKUP_DIR/crm_backup_$DATE.sql.gz"
```

Rendre le script exécutable :

```bash
sudo chmod +x /usr/local/bin/backup-crm-db.sh
```

### 14.2 Automatiser la sauvegarde avec cron

```bash
sudo crontab -e
```

Ajouter la ligne suivante pour une sauvegarde quotidienne à 2h du matin :

```
0 2 * * * /usr/local/bin/backup-crm-db.sh >> /var/log/crm-backup.log 2>&1
```

## 15. Commandes utiles

### 15.1 Gestion PM2

```bash
# Redémarrer l'application
pm2 restart crm-backend

# Arrêter l'application
pm2 stop crm-backend

# Voir les logs en temps réel
pm2 logs crm-backend

# Voir les métriques
pm2 monit
```

### 15.2 Gestion MySQL

```bash
# Se connecter à MySQL
mysql -u crm_user -p crm

# Voir les processus MySQL
mysqladmin -u crm_user -p processlist

# Vérifier l'état de MySQL
sudo systemctl status mysql
```

### 15.3 Logs

```bash
# Logs PM2
pm2 logs crm-backend

# Logs Nginx
sudo tail -f /var/log/nginx/crm-app-access.log
sudo tail -f /var/log/nginx/crm-app-error.log

# Logs MySQL
sudo tail -f /var/log/mysql/error.log
```

## 16. Dépannage

### 16.1 L'application ne démarre pas

```bash
# Vérifier les logs PM2
pm2 logs crm-backend --err

# Vérifier que le port 3000 n'est pas utilisé
sudo netstat -tulpn | grep 3000

# Vérifier les variables d'environnement
cd /var/www/crm-app/backend
cat .env
```

### 16.2 Problèmes de connexion à la base de données

```bash
# Tester la connexion
mysql -u crm_user -p crm

# Vérifier les privilèges
mysql -u root -p -e "SHOW GRANTS FOR 'crm_user'@'localhost';"

# Vérifier que MySQL écoute
sudo netstat -tulpn | grep 3306
```

### 16.3 Problèmes de permissions

```bash
# Vérifier les permissions des fichiers
ls -la /var/www/crm-app/

# Corriger les permissions si nécessaire
sudo chown -R $USER:$USER /var/www/crm-app
sudo chmod -R 755 /var/www/crm-app
```

## 17. Mise à jour de l'application

```bash
cd /var/www/crm-app

# Sauvegarder la base de données avant la mise à jour
/usr/local/bin/backup-crm-db.sh

# Mettre à jour le code (si Git)
git pull origin main

# Installer les nouvelles dépendances
cd backend
npm install --production

# Redémarrer l'application
pm2 restart crm-backend

# Vérifier les logs
pm2 logs crm-backend --lines 50
```

## Notes importantes

1. **Sécurité** : Changez tous les mots de passe par défaut
2. **SSL/TLS** : Configurez un certificat SSL avec Let's Encrypt pour la production
3. **Monitoring** : Configurez un système de monitoring (ex: PM2 Plus, New Relic)
4. **Backups** : Testez régulièrement la restauration des sauvegardes
5. **Mises à jour** : Gardez le système et les dépendances à jour

## Support

En cas de problème, vérifiez :
- Les logs PM2 : `pm2 logs crm-backend`
- Les logs MySQL : `/var/log/mysql/error.log`
- Les logs Nginx : `/var/log/nginx/crm-app-error.log`

