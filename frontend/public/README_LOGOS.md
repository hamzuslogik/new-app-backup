# Logos et Icônes de l'Application

## Fichiers de logos

Ce dossier contient les fichiers de logos et d'icônes utilisés dans l'application :

- **`favicon.svg`** : Icône affichée dans l'onglet du navigateur (favicon)
- **`logo.svg`** : Logo complet "JWS Group" utilisé dans la sidebar et la page de login
- **`logo-icon.svg`** : Version icône du logo (carrée) utilisée dans le header et la sidebar réduite

## Remplacement des logos

Pour remplacer ces logos par les logos officiels de JWS Group :

1. **Remplacez les fichiers SVG** dans ce dossier (`frontend/public/`) :
   - Remplacez `favicon.svg` par votre favicon
   - Remplacez `logo.svg` par votre logo complet
   - Remplacez `logo-icon.svg` par votre icône de logo

2. **Formats supportés** :
   - SVG (recommandé pour la qualité et la scalabilité)
   - PNG (avec fond transparent)
   - JPG (si nécessaire)

3. **Tailles recommandées** :
   - `favicon.svg` : 100x100px ou 200x200px
   - `logo.svg` : Largeur ~200px, hauteur proportionnelle
   - `logo-icon.svg` : 60x60px ou 100x100px (carré)

4. **Si vous utilisez PNG/JPG** :
   - Mettez à jour les références dans les fichiers suivants :
     - `frontend/index.html` (ligne 5) : changer `type="image/svg+xml"` en `type="image/png"` ou `type="image/jpeg"`
     - `frontend/src/components/Header.jsx` : changer `/logo-icon.svg` en `/logo-icon.png`
     - `frontend/src/components/Sidebar.jsx` : changer les références `.svg` en `.png` ou `.jpg`
     - `frontend/src/pages/Login.jsx` : changer `/logo.svg` en `/logo.png`

## Emplacements des logos dans l'application

- **Header** : Icône du logo à côté du titre "CRM JWS Group"
- **Sidebar** : Logo complet en haut de la sidebar (version réduite quand la sidebar est repliée)
- **Page de Login** : Logo complet au-dessus du titre "ESPACE ADMINISTRATEUR"
- **Onglet du navigateur** : Favicon

## Notes

- Les fichiers SVG actuels sont des placeholders avec le texte "JWS" ou "JWS Group"
- Les logos sont automatiquement redimensionnés par CSS pour s'adapter à leur conteneur
- Assurez-vous que les logos ont un fond transparent ou un fond adapté au thème de l'application

