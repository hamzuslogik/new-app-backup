# Installation des modules pour l'import en masse

## Modules requis

Les modules suivants sont nécessaires pour la fonctionnalité d'import en masse :

- `xlsx` : Pour lire les fichiers Excel (.xlsx, .xls)
- `csv-parser` : Pour lire les fichiers CSV
- `multer` : Pour gérer l'upload de fichiers (déjà installé)

## Installation

### Option 1 : Installation automatique

```bash
cd nouvelle_application/backend
npm install
```

### Option 2 : Installation manuelle

```bash
cd nouvelle_application/backend
npm install xlsx csv-parser
```

## Vérification

Pour vérifier que les modules sont installés :

```bash
cd nouvelle_application/backend
npm list xlsx csv-parser
```

Vous devriez voir :
```
+-- csv-parser@3.2.0
`-- xlsx@0.18.5
```

## Dossier uploads

Le dossier `uploads` doit exister dans `nouvelle_application/backend/` :

```bash
cd nouvelle_application/backend
mkdir uploads
```

## Redémarrage du serveur

Après l'installation, **redémarrer le serveur backend** :

```bash
cd nouvelle_application/backend
npm start
# ou en mode développement
npm run dev
```

## Résolution des problèmes

### Erreur "Cannot find module 'xlsx'"

1. Vérifier que vous êtes dans le bon répertoire : `nouvelle_application/backend`
2. Installer les modules : `npm install`
3. Vérifier le `package.json` contient bien `xlsx` et `csv-parser`
4. Redémarrer le serveur

### Erreur "Cannot find module 'csv-parser'"

Même procédure que ci-dessus.

### Erreur "ENOENT: no such file or directory, open 'uploads/...'"

Créer le dossier uploads :
```bash
cd nouvelle_application/backend
mkdir uploads
```

### Erreur "MulterError: Unexpected field"

Vérifier que le champ du formulaire s'appelle bien `file` dans le frontend.

## Test

Pour tester l'import :

1. Accéder à la page "Import en Masse" dans l'application
2. Sélectionner un fichier CSV ou Excel
3. Cliquer sur "Charger et prévisualiser"

Si tout fonctionne, vous devriez voir la prévisualisation des données.

