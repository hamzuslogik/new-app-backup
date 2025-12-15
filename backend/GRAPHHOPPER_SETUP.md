# Configuration GraphHopper API

## Description

GraphHopper est utilisé pour calculer des distances et durées d'itinéraire réelles en voiture entre les codes postaux et villes des rendez-vous sélectionnés dans la page "Affectation par Département".

## Avantages de GraphHopper

- ✅ Calcul d'itinéraires réels (pas seulement distance à vol d'oiseau)
- ✅ Durées précises basées sur les routes et conditions réelles
- ✅ Prise en compte des routes, autoroutes, et restrictions
- ✅ Fallback automatique si l'API n'est pas disponible

## Obtenir une clé API

1. Visitez le site de GraphHopper : https://www.graphhopper.com/
2. Créez un compte gratuit
3. Accédez à votre tableau de bord
4. Copiez votre clé API

## Configuration

### Option 1 : Variables d'environnement (Recommandé)

1. Créez un fichier `.env` dans le dossier `backend/` (ou copiez `env.config.example`)
2. Ajoutez la ligne suivante :

```env
GRAPHHOPPER_API_KEY=votre_cle_api_ici
```

3. Redémarrez le serveur backend

### Option 2 : Configuration directe

Si vous préférez ne pas utiliser de fichier `.env`, vous pouvez modifier directement le fichier `backend/routes/planning.routes.js` :

```javascript
const apiKey = process.env.GRAPHHOPPER_API_KEY || 'votre_cle_api_ici';
```

⚠️ **Attention** : Cette méthode n'est pas recommandée pour la production car elle expose la clé dans le code source.

## Plan gratuit GraphHopper

Le plan gratuit de GraphHopper inclut :
- **Limite** : 500 requêtes/jour
- **Fonctionnalités** : Calcul d'itinéraires de base
- **Support** : Communauté

Pour plus de requêtes, consultez les plans payants sur le site GraphHopper.

## Fonctionnement sans clé API

Si aucune clé API n'est configurée :
- Le système tentera d'utiliser GraphHopper sans clé (limite très basse)
- En cas d'échec, il basculera automatiquement vers :
  - Calcul de distance à vol d'oiseau (formule de Haversine)
  - Estimation de durée basée sur la distance et vitesse moyenne

## Test de la configuration

1. Configurez votre clé API dans `.env`
2. Redémarrez le serveur backend
3. Allez sur la page "Affectation par Département"
4. Sélectionnez au moins 2 RDV
5. Cliquez sur "Calculer distance"
6. Vérifiez que les distances et durées sont affichées

## Dépannage

### L'API GraphHopper retourne des erreurs

- Vérifiez que votre clé API est correcte
- Vérifiez que vous n'avez pas dépassé la limite de requêtes
- Consultez les logs du serveur backend pour plus de détails

### Les distances sont toujours estimées

- Vérifiez que `GRAPHHOPPER_API_KEY` est bien défini dans votre `.env`
- Vérifiez que le fichier `.env` est bien dans le dossier `backend/`
- Redémarrez le serveur après avoir modifié `.env`

## Support

Pour toute question concernant GraphHopper :
- Documentation : https://docs.graphhopper.com/
- Support GraphHopper : https://support.graphhopper.com/

