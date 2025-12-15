# Guide : Envoyer l'application vers GitHub

## Prérequis
- Avoir un compte GitHub (créer un compte sur [github.com](https://github.com) si nécessaire)
- Avoir Git installé sur votre machine (vérifier avec `git --version`)

## Étapes détaillées

### 1. Initialiser le dépôt Git (si pas déjà fait)

Ouvrez un terminal dans le dossier `nouvelle_application` et exécutez :

```bash
git init
```

### 2. Configurer Git (si pas déjà fait)

```bash
git config user.name "Votre Nom"
git config user.email "votre.email@example.com"
```

### 3. Vérifier les fichiers à ignorer

Les fichiers `.gitignore` sont déjà présents. Vérifiez qu'ils contiennent bien :
- `node_modules/`
- `.env` (fichiers de configuration sensibles)
- `dist/` et `build/` (fichiers compilés)
- `uploads/` et `photos/` (fichiers uploadés)

### 4. Ajouter tous les fichiers au staging

```bash
git add .
```

### 5. Créer le premier commit

```bash
git commit -m "Initial commit: Application CRM"
```

### 6. Créer un nouveau dépôt sur GitHub

1. Allez sur [github.com](https://github.com)
2. Cliquez sur le bouton **"+"** en haut à droite → **"New repository"**
3. Remplissez les informations :
   - **Repository name** : `crm-jwsgroup` (ou le nom de votre choix)
   - **Description** : Description de votre projet
   - **Visibility** : Choisissez **Public** ou **Private**
   - ⚠️ **NE COCHEZ PAS** "Initialize this repository with a README" (car vous avez déjà des fichiers)
4. Cliquez sur **"Create repository"**

### 7. Lier le dépôt local au dépôt GitHub

GitHub vous donnera une URL. Utilisez-la dans cette commande :

```bash
git remote add origin https://github.com/VOTRE_USERNAME/crm-jwsgroup.git
```

Remplacez `VOTRE_USERNAME` par votre nom d'utilisateur GitHub.

### 8. Pousser le code vers GitHub

```bash
git branch -M main
git push -u origin main
```

Si vous utilisez HTTPS, GitHub vous demandera vos identifiants :
- **Username** : Votre nom d'utilisateur GitHub
- **Password** : Utilisez un **Personal Access Token** (pas votre mot de passe)

### 9. Créer un Personal Access Token (si nécessaire)

Si GitHub demande un token au lieu d'un mot de passe :

1. Allez sur GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. Cliquez sur **"Generate new token (classic)"**
3. Donnez un nom au token (ex: "CRM Project")
4. Sélectionnez les permissions : **repo** (accès complet aux dépôts)
5. Cliquez sur **"Generate token"**
6. **Copiez le token** (vous ne pourrez plus le voir après)
7. Utilisez ce token comme mot de passe lors du `git push`

## Commandes rapides pour les mises à jour futures

Une fois le dépôt créé, pour envoyer vos modifications :

```bash
# Voir les fichiers modifiés
git status

# Ajouter les fichiers modifiés
git add .

# Créer un commit avec un message
git commit -m "Description des modifications"

# Envoyer vers GitHub
git push
```

## Structure recommandée du README.md

Créez un fichier `README.md` à la racine avec :

```markdown
# CRM JWS Group

Application de gestion de la relation client pour JWS Group.

## Technologies utilisées

- **Frontend** : React
- **Backend** : Node.js / Express
- **Base de données** : MySQL

## Installation

### Backend
```bash
cd backend
npm install
npm start
```

### Frontend
```bash
cd frontend
npm install
npm start
```

## Configuration

Copiez `.env.example` vers `.env` et configurez vos variables d'environnement.
```

## Dépannage

### Erreur : "remote origin already exists"
```bash
git remote remove origin
git remote add origin https://github.com/VOTRE_USERNAME/crm-jwsgroup.git
```

### Erreur : "failed to push some refs"
```bash
git pull origin main --allow-unrelated-histories
git push -u origin main
```

### Vérifier la configuration Git
```bash
git remote -v
git config --list
```

