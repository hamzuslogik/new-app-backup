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
- MySQL (base de données sur 151.80.58.72)

## Installation

### Backend

1. Naviguer dans le dossier backend :
```bash
cd nouvelle_application/backend
```

2. Installer les dépendances :
```bash
npm install
```

3. Configurer les variables d'environnement :
```bash
cp .env.example .env
# Éditer .env avec vos configurations
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
cd nouvelle_application/frontend
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

La configuration de la base de données se trouve dans `backend/.env` :

```env
DB_HOST=151.80.58.72
DB_USER=hamzus
DB_PASSWORD=hamzusLogiKk
DB_NAME=crm
```

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
- **bcryptjs** - Hashage des mots de passe
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

