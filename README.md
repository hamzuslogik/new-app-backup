# CRM JWS Group - Application React/Node.js

Application CRM moderne développée avec React.js (frontend) et Node.js (backend), reproduisant les fonctionnalités du système CRM existant.

## Structure du projet

```
nouvelle_application/
├── backend/          # API Node.js/Express
│   ├── config/       # Configuration (base de données)
│   ├── middleware/   # Middlewares (auth, etc.)
│   ├── routes/       # Routes API
│   └── server.js     # Point d'entrée du serveur
└── frontend/         # Application React
    └── src/
        ├── components/   # Composants React
        ├── pages/        # Pages de l'application
        ├── contexts/     # Contextes React (Auth)
        └── config/      # Configuration (API)
```

## Prérequis

- Node.js (v16 ou supérieur)
- npm ou yarn
- MySQL (serveur accessible depuis votre environnement)

## Installation

### Backend

1. Naviguer dans le dossier backend :
```bash
cd backend
```

2. Installer les dépendances :
```bash
npm install
```

3. Créer le fichier `backend/.env` à partir du modèle ci-dessous (ne jamais committer `.env`) :
```bash
# Exemple : copier le bloc « Configuration » de ce README dans backend/.env
```

4. Démarrer le serveur :
```bash
# Mode développement (avec nodemon)
npm run dev

# Mode production
npm start
```

Le serveur backend sera accessible sur `http://localhost:5000`

### Frontend

1. Naviguer dans le dossier frontend :
```bash
cd frontend
```

2. Installer les dépendances :
```bash
npm install
```

3. Démarrer l'application :
```bash
npm run dev
```

L'application frontend sera accessible sur `http://localhost:3000`

## Configuration de la base de données

Créer `backend/.env` (fichier local, **non versionné**) avec vos valeurs :

```env
# Base de données
DB_HOST=votre-hote-mysql
DB_USER=votre-utilisateur
DB_PASSWORD=votre-mot-de-passe
DB_NAME=crm

# Sécurité (obligatoire en production — valeurs longues et aléatoires)
JWT_SECRET=changez-moi-secret-jwt-long-et-aleatoire
FICHE_HASH_SECRET=changez-moi-secret-hash-fiche

# Application
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Derrière nginx / reverse proxy (pour IP client et anti-brute-force)
# TRUST_PROXY=1
```

Variables optionnelles : `JWT_EXPIRE`, `ENABLE_WORKFLOW_SCHEDULER`, etc. (voir `backend/server.js` et la doc d’exploitation interne).

## API Endpoints

### Authentification
- `POST /api/auth/login` - Connexion
- `GET /api/auth/verify` - Vérifier le token
- `POST /api/auth/logout` - Déconnexion

### Fiches
- `GET /api/fiches` - Liste des fiches (avec filtres)
- `GET /api/fiches/:id` - Détail d'une fiche
- `POST /api/fiches` - Créer une fiche
- `PUT /api/fiches/:id` - Mettre à jour une fiche

### Utilisateurs
- `GET /api/users` - Liste des utilisateurs
- `GET /api/users/:id` - Détail d'un utilisateur
- `GET /api/users/fonction/:fonctionId` - Utilisateurs par fonction

### Messages
- `GET /api/messages` - Liste des messages
- `POST /api/messages` - Envoyer un message

### Décalages
- `GET /api/decalages` - Liste des décalages

### Gestion
- `GET /api/management/centres` - Liste des centres
- `GET /api/management/departements` - Liste des départements
- `GET /api/management/fonctions` - Liste des fonctions
- `GET /api/management/etats` - Liste des états

## Technologies utilisées

### Backend
- **Express.js** - Framework web Node.js
- **MySQL2** - Client MySQL avec support des promesses
- **JWT** - Authentification par tokens
- **bcryptjs** - Hashage (codes de secours ; mots de passe utilisateurs : SHA-256 — voir `AMELIORATIONS.md`)
- **dotenv** - Gestion des variables d'environnement
- **CORS** - Gestion des requêtes cross-origin

### Frontend
- **React 18** - Bibliothèque UI
- **React Router** - Routage
- **React Query** - Gestion des données serveur
- **Axios** - Client HTTP
- **Vite** - Build tool moderne
- **React Hook Form** - Gestion des formulaires
- **React Toastify** - Notifications

## Structure des rôles

L'application gère différents types de fonctions (rôles) :
- **Fonction 1, 2, 7** : Administrateurs/Superviseurs
- **Fonction 3** : Agents
- **Fonction 4** : (Rôle spécifique)
- **Fonction 5** : Commerciaux
- **Fonction 6** : Confirmateurs
- **Fonction 8, 9** : (Rôles spécifiques)

## Développement

### Backend
- Les routes sont organisées par module dans `backend/routes/`
- Le middleware d'authentification vérifie les tokens JWT
- Les permissions sont gérées par fonction dans les routes

### Frontend
- Les composants sont dans `frontend/src/components/`
- Les pages sont dans `frontend/src/pages/`
- Le contexte d'authentification gère l'état utilisateur global
- React Query gère le cache et la synchronisation des données

## Prochaines étapes

- [ ] Implémenter complètement la gestion des fiches (CRUD)
- [ ] Ajouter le système de planning hebdomadaire
- [ ] Implémenter les statistiques avec graphiques
- [ ] Ajouter le système de messagerie en temps réel
- [ ] Implémenter la gestion des décalages
- [ ] Ajouter les exports PDF/CSV
- [ ] Implémenter les notifications en temps réel
- [ ] Ajouter les tests unitaires et d'intégration

## Support

Pour toute question ou problème, contactez l'équipe de développement.

