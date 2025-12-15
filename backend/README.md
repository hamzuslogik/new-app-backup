# Backend API - CRM JWS Group

API REST développée avec Node.js et Express pour le système CRM.

## Installation

```bash
npm install
```

## Configuration

Copier le fichier `.env.example` vers `.env` et configurer les variables :

```env
PORT=5000
DB_HOST=151.80.58.72
DB_USER=hamzus
DB_PASSWORD=hamzusLogiKk
DB_NAME=crm
JWT_SECRET=your-secret-key
```

## Démarrage

```bash
# Mode développement
npm run dev

# Mode production
npm start
```

## Structure

- `config/` - Configuration (base de données)
- `middleware/` - Middlewares (authentification, etc.)
- `routes/` - Routes API organisées par module
- `server.js` - Point d'entrée

## API Endpoints

Voir le README principal pour la liste complète des endpoints.

