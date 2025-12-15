# Configuration des fichiers .env

## Backend

Créez un fichier `.env` dans le dossier `backend/` avec le contenu suivant :

```env
# Configuration du serveur
PORT=5000
NODE_ENV=development

# Configuration de la base de données MySQL
DB_HOST=151.80.58.72
DB_USER=hamzus
DB_PASSWORD=hamzusLogiKk
DB_NAME=crm

# Configuration JWT (Authentification)
JWT_SECRET=crm-jws-group-secret-key-2024-change-in-production
JWT_EXPIRE=7d

# Configuration CORS
FRONTEND_URL=http://localhost:3000

# Configuration Email (optionnel)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=
EMAIL_PASS=
EMAIL_FROM=noreply@crm.jwsgroup.fr

# Configuration SMS (optionnel)
SMS_API_KEY=
SMS_API_URL=

# Configuration Upload (optionnel)
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880
```

### Instructions pour créer le fichier .env backend

1. Naviguez dans le dossier backend :
```bash
cd nouvelle_application/backend
```

2. Créez le fichier `.env` :
```bash
# Sur Windows (PowerShell)
Copy-Item env.config.example .env

# Sur Linux/Mac
cp env.config.example .env
```

3. Ou créez-le manuellement et copiez le contenu de `env.config.example`

## Frontend

Créez un fichier `.env` dans le dossier `frontend/` avec le contenu suivant :

```env
# URL de l'API Backend
VITE_API_URL=http://localhost:5000/api

# Nom de l'application
VITE_APP_NAME=CRM JWS Group

# Version de l'application
VITE_APP_VERSION=1.0.0
```

### Instructions pour créer le fichier .env frontend

1. Naviguez dans le dossier frontend :
```bash
cd nouvelle_application/frontend
```

2. Créez le fichier `.env` :
```bash
# Sur Windows (PowerShell)
Copy-Item env.config.example .env

# Sur Linux/Mac
cp env.config.example .env
```

## Paramètres de la base de données

Les paramètres de connexion à la base de données MySQL sont :

- **Host**: 151.80.58.72
- **User**: hamzus
- **Password**: hamzusLogiKk
- **Database**: crm

## Sécurité

⚠️ **Important** : 
- Ne commitez JAMAIS le fichier `.env` dans Git
- Le fichier `.env` est déjà dans `.gitignore`
- Utilisez `env.config.example` comme modèle pour la documentation
- Changez le `JWT_SECRET` en production avec une clé forte et unique

## Vérification

Pour vérifier que les variables d'environnement sont bien chargées :

### Backend
```bash
cd backend
node -e "require('dotenv').config(); console.log(process.env.DB_HOST)"
```

### Frontend
Les variables doivent être préfixées par `VITE_` pour être accessibles dans le code React.

