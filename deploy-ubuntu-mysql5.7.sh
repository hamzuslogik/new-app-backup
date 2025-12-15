#!/bin/bash

# Script de déploiement automatique pour Ubuntu 22.04 avec MySQL 5.7
# Usage: sudo ./deploy-ubuntu-mysql5.7.sh

set -e  # Arrêter en cas d'erreur

echo "=========================================="
echo "Déploiement CRM - Ubuntu 22.04 + MySQL 5.7"
echo "=========================================="

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Vérifier que le script est exécuté en root
if [ "$EUID" -ne 0 ]; then 
    print_error "Veuillez exécuter ce script en tant que root (sudo)"
    exit 1
fi

# 1. Mise à jour du système
print_info "Mise à jour du système..."
apt update && apt upgrade -y
print_success "Système mis à jour"

# 2. Installation des dépendances de base
print_info "Installation des dépendances de base..."
apt install -y curl wget git build-essential
print_success "Dépendances installées"

# 3. Installation de MySQL 5.7
print_info "Installation de MySQL 5.7..."

# Vérifier si MySQL est déjà installé
if command -v mysql &> /dev/null; then
    MYSQL_VERSION=$(mysql --version | grep -oP 'Ver \K[0-9]+\.[0-9]+')
    print_info "MySQL est déjà installé (version $MYSQL_VERSION)"
    
    if [[ $(echo "$MYSQL_VERSION >= 5.7" | bc -l) -eq 1 ]] || [[ "$MYSQL_VERSION" == "10."* ]]; then
        print_success "Version MySQL/MariaDB compatible détectée"
    else
        print_error "Version MySQL non compatible. Version requise: 5.7 ou supérieure"
        exit 1
    fi
else
    print_info "Choisissez la méthode d'installation :"
    echo "1) MariaDB 10.6+ (recommandé - compatible MySQL 5.7, activement maintenu)"
    echo "2) MySQL 5.7 depuis les archives (fin de vie, non recommandé)"
    echo "3) Docker avec MySQL 5.7 (pour tests uniquement)"
    read -p "Votre choix [1]: " INSTALL_METHOD
    INSTALL_METHOD=${INSTALL_METHOD:-1}
    
    case $INSTALL_METHOD in
        1)
            print_info "Installation de MariaDB (compatible MySQL 5.7)..."
            apt install -y mariadb-server mariadb-client
            systemctl start mariadb
            systemctl enable mariadb
            print_success "MariaDB installé"
            ;;
        2)
            print_info "Installation de MySQL 5.7 depuis les archives..."
            print_warning "MySQL 5.7 est en fin de vie. Considérez utiliser MariaDB (option 1)."
            cd /tmp
            
            # Télécharger MySQL 5.7
            print_info "Téléchargement de MySQL 5.7..."
            wget -q https://downloads.mysql.com/archives/get/p/23/file/mysql-server_5.7.44-1ubuntu22.04_amd64.deb-bundle.tar
            
            # Extraire
            tar -xf mysql-server_5.7.44-1ubuntu22.04_amd64.deb-bundle.tar
            
            # Installer les dépendances
            apt install -y libaio1 libmecab2 libnuma1
            
            # Installer les packages
            dpkg -i mysql-common_5.7.44-1ubuntu22.04_amd64.deb || true
            dpkg -i mysql-community-client_5.7.44-1ubuntu22.04_amd64.deb || true
            dpkg -i mysql-client_5.7.44-1ubuntu22.04_amd64.deb || true
            dpkg -i mysql-community-server_5.7.44-1ubuntu22.04_amd64.deb || true
            
            # Corriger les dépendances
            apt-get install -f -y
            
            print_success "MySQL 5.7 installé depuis les archives"
            ;;
        3)
            print_info "Installation via Docker..."
            apt install -y docker.io docker-compose
            
            mkdir -p /opt/mysql5.7
            cat > /opt/mysql5.7/docker-compose.yml <<DOCKEREOF
version: '3.8'
services:
  mysql:
    image: mysql:5.7
    container_name: mysql57
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: root_password_change_me
      MYSQL_DATABASE: crm
      MYSQL_USER: crm_user
      MYSQL_PASSWORD: user_password_change_me
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    command: --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci

volumes:
  mysql_data:
DOCKEREOF
            
            systemctl start docker
            systemctl enable docker
            cd /opt/mysql5.7
            docker-compose up -d
            
            print_success "MySQL 5.7 installé via Docker"
            print_warning "N'oubliez pas de modifier les mots de passe dans /opt/mysql5.7/docker-compose.yml"
            ;;
        *)
            print_error "Choix invalide"
            exit 1
            ;;
    esac
fi

# 4. Configuration MySQL
print_info "Configuration de MySQL..."

# Démarrer MySQL s'il n'est pas déjà démarré
systemctl start mysql
systemctl enable mysql

# Demander les informations de configuration
read -sp "Entrez le mot de passe root MySQL (laissez vide si déjà configuré): " MYSQL_ROOT_PASSWORD
echo

read -p "Nom de la base de données [crm]: " DB_NAME
DB_NAME=${DB_NAME:-crm}

read -p "Nom d'utilisateur MySQL [crm_user]: " DB_USER
DB_USER=${DB_USER:-crm_user}

read -sp "Mot de passe pour l'utilisateur MySQL: " DB_PASSWORD
echo

# Créer la base de données et l'utilisateur
print_info "Création de la base de données et de l'utilisateur..."

if [ -z "$MYSQL_ROOT_PASSWORD" ]; then
    MYSQL_CMD="mysql -u root"
else
    MYSQL_CMD="mysql -u root -p$MYSQL_ROOT_PASSWORD"
fi

$MYSQL_CMD <<EOF
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
EOF

print_success "Base de données et utilisateur créés"

# 5. Installation de Node.js
print_info "Installation de Node.js 18.x..."

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_info "Node.js est déjà installé ($NODE_VERSION)"
else
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
    print_success "Node.js installé"
fi

# 6. Installation de PM2
print_info "Installation de PM2..."

if command -v pm2 &> /dev/null; then
    print_info "PM2 est déjà installé"
else
    npm install -g pm2
    print_success "PM2 installé"
fi

# 7. Configuration de l'application
print_info "Configuration de l'application..."

read -p "Chemin d'installation de l'application [/var/www/crm-app]: " APP_PATH
APP_PATH=${APP_PATH:-/var/www/crm-app}

# Créer le répertoire si nécessaire
mkdir -p $APP_PATH
cd $APP_PATH

# Demander si on clone depuis Git ou si les fichiers sont déjà présents
read -p "Voulez-vous cloner depuis un dépôt Git? (o/n) [n]: " CLONE_GIT
if [[ $CLONE_GIT == "o" || $CLONE_GIT == "O" ]]; then
    read -p "URL du dépôt Git: " GIT_REPO
    if [ -d ".git" ]; then
        print_info "Mise à jour du dépôt existant..."
        git pull
    else
        print_info "Clonage du dépôt..."
        git clone $GIT_REPO .
    fi
else
    print_info "Assurez-vous que les fichiers de l'application sont dans $APP_PATH"
fi

# 8. Configuration de l'environnement
print_info "Configuration de l'environnement..."

if [ ! -f "$APP_PATH/backend/.env" ]; then
    read -p "Port de l'application [3000]: " APP_PORT
    APP_PORT=${APP_PORT:-3000}
    
    # Générer un JWT_SECRET
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
    
    cat > $APP_PATH/backend/.env <<EOF
# Configuration de la base de données
DB_HOST=localhost
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME

# Configuration du serveur
NODE_ENV=production
PORT=$APP_PORT

# JWT Secret
JWT_SECRET=$JWT_SECRET
EOF
    
    print_success "Fichier .env créé"
else
    print_info "Fichier .env existe déjà"
fi

# 9. Installation des dépendances
print_info "Installation des dépendances Node.js..."

if [ -d "$APP_PATH/backend" ]; then
    cd $APP_PATH/backend
    npm install --production
    print_success "Dépendances backend installées"
fi

if [ -d "$APP_PATH/frontend" ]; then
    cd $APP_PATH/frontend
    npm install --production
    npm run build
    print_success "Frontend construit"
fi

# 10. Initialisation de la base de données
print_info "Initialisation de la base de données..."

if [ -f "$APP_PATH/database_schema.sql" ]; then
    mysql -u $DB_USER -p$DB_PASSWORD $DB_NAME < $APP_PATH/database_schema.sql
    print_success "Schéma de base de données créé"
    
    # Exécuter les autres scripts SQL
    for sql_file in $APP_PATH/*.sql; do
        if [ -f "$sql_file" ] && [ "$(basename $sql_file)" != "database_schema.sql" ]; then
            print_info "Exécution de $(basename $sql_file)..."
            mysql -u $DB_USER -p$DB_PASSWORD $DB_NAME < "$sql_file" || true
        fi
    done
else
    print_error "Fichier database_schema.sql non trouvé"
fi

# 11. Configuration PM2
print_info "Configuration de PM2..."

cd $APP_PATH/backend

# Créer le fichier ecosystem.config.js
cat > ecosystem.config.js <<EOF
module.exports = {
  apps: [{
    name: 'crm-backend',
    script: './server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: ${APP_PORT:-3000}
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
EOF

# Démarrer l'application
print_info "Démarrage de l'application avec PM2..."
pm2 start ecosystem.config.js
pm2 save

# Configurer PM2 pour démarrer au boot
pm2 startup systemd -u root --hp /root

print_success "Application démarrée avec PM2"

# 12. Installation de Nginx (optionnel)
read -p "Voulez-vous installer et configurer Nginx? (o/n) [n]: " INSTALL_NGINX
if [[ $INSTALL_NGINX == "o" || $INSTALL_NGINX == "O" ]]; then
    print_info "Installation de Nginx..."
    apt install -y nginx
    
    read -p "Nom de domaine ou IP du serveur: " SERVER_NAME
    
    cat > /etc/nginx/sites-available/crm-app <<EOF
server {
    listen 80;
    server_name $SERVER_NAME;

    location / {
        root $APP_PATH/frontend/dist;
        try_files \$uri \$uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:${APP_PORT:-3000};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    access_log /var/log/nginx/crm-app-access.log;
    error_log /var/log/nginx/crm-app-error.log;
}
EOF
    
    ln -sf /etc/nginx/sites-available/crm-app /etc/nginx/sites-enabled/
    nginx -t
    systemctl restart nginx
    systemctl enable nginx
    
    print_success "Nginx configuré"
fi

# 13. Configuration du pare-feu
read -p "Voulez-vous configurer le pare-feu UFW? (o/n) [n]: " CONFIGURE_FIREWALL
if [[ $CONFIGURE_FIREWALL == "o" || $CONFIGURE_FIREWALL == "O" ]]; then
    print_info "Configuration du pare-feu..."
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable
    print_success "Pare-feu configuré"
fi

# 14. Création du script de sauvegarde
print_info "Création du script de sauvegarde..."

mkdir -p /var/backups/crm

cat > /usr/local/bin/backup-crm-db.sh <<EOF
#!/bin/bash
BACKUP_DIR="/var/backups/crm"
DATE=\$(date +%Y%m%d_%H%M%S)
DB_NAME="$DB_NAME"
DB_USER="$DB_USER"
DB_PASS="$DB_PASSWORD"

mkdir -p \$BACKUP_DIR

mysqldump -u \$DB_USER -p\$DB_PASS \$DB_NAME | gzip > \$BACKUP_DIR/crm_backup_\$DATE.sql.gz

find \$BACKUP_DIR -name "crm_backup_*.sql.gz" -mtime +7 -delete

echo "Backup créé : \$BACKUP_DIR/crm_backup_\$DATE.sql.gz"
EOF

chmod +x /usr/local/bin/backup-crm-db.sh

# Ajouter au cron pour sauvegarde quotidienne
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-crm-db.sh >> /var/log/crm-backup.log 2>&1") | crontab -

print_success "Script de sauvegarde créé et configuré"

# Résumé
echo ""
echo "=========================================="
print_success "Déploiement terminé avec succès!"
echo "=========================================="
echo ""
echo "Informations de connexion:"
echo "  - Base de données: $DB_NAME"
echo "  - Utilisateur: $DB_USER"
echo "  - Mot de passe: [configuré]"
echo "  - Port application: ${APP_PORT:-3000}"
echo ""
echo "Commandes utiles:"
echo "  - Voir les logs: pm2 logs crm-backend"
echo "  - Redémarrer: pm2 restart crm-backend"
echo "  - Statut: pm2 status"
echo ""
echo "Fichiers importants:"
echo "  - Configuration: $APP_PATH/backend/.env"
echo "  - Logs PM2: ~/.pm2/logs/"
echo "  - Sauvegardes: /var/backups/crm/"
echo ""

