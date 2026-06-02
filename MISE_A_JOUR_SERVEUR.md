# Mise à jour du serveur après `git push --force`

Si GitHub a été reculé (revert sur `main`), un simple `git pull` affiche souvent **« Already up to date »** alors que le serveur est encore sur d’anciens commits **plus récents** que `origin/main`.

## Commandes à exécuter une fois sur le serveur

```bash
cd /var/www/crm-app   # adapter le chemin

git fetch origin main
git rev-parse HEAD
git rev-parse origin/main
# Si les deux SHA diffèrent, ou si le serveur est en avance sur origin :

git reset --hard origin/main

chmod +x deploy.sh
./deploy.sh --rebuild

# Vider le cache navigateur sur iPhone / PC après déploiement
```

## Script `deploy.sh` (dans le dépôt)

```bash
./deploy.sh           # sync + build si le commit a changé
./deploy.sh --rebuild # sync + build même sans changement Git (cache dist)
```

## Vérification

Le commit attendu après le revert du 2 juin 2026 :

```text
dc575e9 — Refactor overflow behavior and styling for improved responsiveness
```

```bash
git log -1 --oneline
# doit afficher dc575e9
```
