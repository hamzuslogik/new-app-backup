# Messages Système

## Vue d'ensemble

Le système de messages système permet aux administrateurs de créer et gérer des messages qui seront affichés aux utilisateurs lors de leur connexion à l'application.

## Installation

### 1. Créer les tables dans la base de données

Exécutez le script SQL pour créer les tables nécessaires :

```bash
mysql -h 151.80.58.72 -u hamzus -p crm < create_system_messages_table.sql
```

### 2. Redémarrer le serveur backend

Le serveur backend doit être redémarré pour charger les nouvelles routes.

## Utilisation

### Accès à la page de gestion

1. Connectez-vous en tant qu'administrateur (fonction 1, 2, 7 ou 11)
2. Accédez à la page "Messages Système" dans le menu latéral
3. Ou directement via l'URL : `/system-messages`

### Créer un nouveau message

1. Cliquez sur le bouton "Nouveau message"
2. Remplissez le formulaire :
   - **Titre** (optionnel) : Titre du message
   - **Message** (obligatoire) : Contenu du message
   - **Type** : Information, Succès, Avertissement, Erreur
   - **Priorité** : Normal, Important, Urgent
   - **Date de début** (optionnel) : Date à partir de laquelle le message sera affiché
   - **Date de fin** (optionnel) : Date jusqu'à laquelle le message sera affiché
   - **Message actif** : Activer/désactiver le message
   - **Afficher une seule fois** : Si coché, le message ne sera affiché qu'une seule fois par utilisateur
   - **Fonctions ciblées** : Sélectionner les fonctions concernées (laisser vide pour toutes)
   - **Centres ciblés** : Sélectionner les centres concernés (laisser vide pour tous)
   - **Utilisateurs ciblés** : Sélectionner les utilisateurs concernés (laisser vide pour tous)
3. Cliquez sur "Enregistrer"

### Modifier un message

1. Cliquez sur l'icône "Modifier" (✏️) sur le message souhaité
2. Modifiez les champs nécessaires
3. Cliquez sur "Enregistrer"

### Supprimer un message

1. Cliquez sur l'icône "Supprimer" (🗑️) sur le message souhaité
2. Confirmez la suppression

## Affichage des messages

Les messages système sont automatiquement affichés aux utilisateurs lors de leur connexion, selon les critères suivants :

1. **Message actif** : Le message doit être actif (`actif = 1`)
2. **Dates** : La date actuelle doit être entre la date de début et la date de fin (si définies)
3. **Ciblage** : Le message doit correspondre aux critères de ciblage (fonction, centre, utilisateur)
4. **Affichage unique** : Si "Afficher une seule fois" est activé, le message ne sera affiché qu'une seule fois par utilisateur

### Types de messages

- **Information** (bleu) : Messages informatifs généraux
- **Succès** (vert) : Messages de confirmation ou de réussite
- **Avertissement** (jaune) : Messages d'avertissement
- **Erreur** (rouge) : Messages d'erreur ou critiques

### Priorités

- **Normal** : Priorité standard
- **Important** : Message important nécessitant l'attention
- **Urgent** : Message urgent nécessitant une action immédiate

## Structure de la base de données

### Table `system_messages`

| Colonne | Type | Description |
|---------|------|-------------|
| id | INT | Identifiant unique |
| titre | VARCHAR(255) | Titre du message (optionnel) |
| message | TEXT | Contenu du message |
| type | VARCHAR(50) | Type : info, success, warning, error |
| priorite | INT | Priorité : 1=normal, 2=important, 3=urgent |
| date_debut | DATETIME | Date de début d'affichage |
| date_fin | DATETIME | Date de fin d'affichage |
| actif | TINYINT(1) | 1=actif, 0=inactif |
| afficher_une_seule_fois | TINYINT(1) | 1=afficher une seule fois, 0=toujours afficher |
| cibles_fonctions | TEXT | IDs des fonctions ciblées (JSON array) |
| cibles_centres | TEXT | IDs des centres ciblés (JSON array) |
| cibles_utilisateurs | TEXT | IDs des utilisateurs ciblés (JSON array) |
| date_creation | DATETIME | Date de création |
| date_modification | DATETIME | Date de modification |
| id_createur | INT | ID de l'utilisateur créateur |

### Table `system_messages_lus`

| Colonne | Type | Description |
|---------|------|-------------|
| id | INT | Identifiant unique |
| id_message | INT | ID du message |
| id_utilisateur | INT | ID de l'utilisateur |
| date_lecture | DATETIME | Date de lecture |

## API Backend

### Routes disponibles

#### GET `/api/system-messages`
Récupère les messages système actifs pour l'utilisateur connecté.

**Réponse :**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "titre": "Bienvenue",
      "message": "Bienvenue sur la plateforme CRM",
      "type": "info",
      "priorite": 1,
      "deja_lu": 0
    }
  ]
}
```

#### GET `/api/system-messages/all`
Récupère tous les messages système (admin uniquement).

#### GET `/api/system-messages/:id`
Récupère un message système spécifique (admin uniquement).

#### POST `/api/system-messages`
Crée un nouveau message système (admin uniquement).

**Body :**
```json
{
  "titre": "Titre du message",
  "message": "Contenu du message",
  "type": "info",
  "priorite": 1,
  "date_debut": "2026-01-01T00:00:00",
  "date_fin": "2026-12-31T23:59:59",
  "actif": 1,
  "afficher_une_seule_fois": 0,
  "cibles_fonctions": [1, 2, 7],
  "cibles_centres": null,
  "cibles_utilisateurs": null
}
```

#### PUT `/api/system-messages/:id`
Met à jour un message système (admin uniquement).

#### DELETE `/api/system-messages/:id`
Supprime un message système (admin uniquement).

#### POST `/api/system-messages/:id/marquer-lu`
Marque un message comme lu pour l'utilisateur connecté.

## Permissions

La page de gestion des messages système nécessite la permission `management_view`, qui est généralement accordée aux administrateurs (fonctions 1, 2, 7, 11).

## Exemples d'utilisation

### Message d'information général

- **Titre** : "Maintenance prévue"
- **Message** : "Une maintenance est prévue le 15 février de 22h à 23h. Le système sera temporairement indisponible."
- **Type** : Information
- **Priorité** : Normal
- **Ciblage** : Tous les utilisateurs

### Message urgent pour une fonction spécifique

- **Titre** : "Formation obligatoire"
- **Message** : "Une formation obligatoire est prévue le 20 février. Veuillez vous inscrire avant le 15 février."
- **Type** : Avertissement
- **Priorité** : Urgent
- **Ciblage** : Fonction "Agent Qualification" uniquement

### Message de bienvenue (une seule fois)

- **Titre** : "Bienvenue"
- **Message** : "Bienvenue sur la plateforme CRM. N'hésitez pas à consulter l'aide si vous avez des questions."
- **Type** : Information
- **Priorité** : Normal
- **Afficher une seule fois** : Oui
- **Ciblage** : Tous les utilisateurs

## Notes importantes

1. **Performance** : Les messages sont chargés une fois par session et mis en cache pendant 5 minutes
2. **Affichage** : Les messages sont affichés dans une modale au-dessus de l'interface
3. **Navigation** : Si plusieurs messages sont disponibles, l'utilisateur peut naviguer entre eux avec les boutons "Précédent" et "Suivant"
4. **Marquage comme lu** : Les messages avec "Afficher une seule fois" sont automatiquement marqués comme lus lorsqu'ils sont affichés

## Dépannage

### Le message ne s'affiche pas

1. Vérifier que le message est actif (`actif = 1`)
2. Vérifier que la date actuelle est entre la date de début et la date de fin
3. Vérifier que l'utilisateur correspond aux critères de ciblage
4. Vérifier que le message n'a pas déjà été lu (si "Afficher une seule fois" est activé)

### Le message s'affiche pour tous les utilisateurs alors qu'il devrait être ciblé

1. Vérifier que les critères de ciblage sont correctement définis dans le formulaire
2. Vérifier que les IDs des fonctions/centres/utilisateurs sont corrects
3. Vérifier que les données sont bien sauvegardées en JSON dans la base de données
