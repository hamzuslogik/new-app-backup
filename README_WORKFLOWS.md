# Système de Workflows - Documentation

## Vue d'ensemble

Le système de workflows permet d'automatiser des actions basées sur des événements dans le CRM. Les workflows sont configurables via l'interface d'administration dans l'onglet "Workflows" de la page Gestion.

## Accès

- **Route Frontend** : `/management` → Onglet "Workflows"
- **Route API** : `/api/workflows`
- **Permissions** : Admin (1, 2, 7) et Backoffice (11)

## Structure d'un Workflow

Un workflow est composé de :
1. **Informations générales** : Nom, description, état (actif/inactif), priorité
2. **Déclencheurs** : Événements qui déclenchent le workflow
3. **Actions** : Actions à exécuter lorsque le workflow est déclenché

## Types de Déclencheurs

### 1. Fiche créée (`fiche_created`)
Déclenché lorsqu'une nouvelle fiche est créée.

### 2. Fiche modifiée (`fiche_updated`)
Déclenché lorsqu'une fiche est modifiée.

### 3. État changé (`etat_changed`)
Déclenché lorsqu'un changement d'état se produit.
- **Configuration optionnelle** :
  - `etat_from` : ID(s) de l'état source (peut être un tableau pour plusieurs états)
  - `etat_to` : ID(s) de l'état cible (peut être un tableau pour plusieurs états)
  - `etat_id` : ID de l'état cible (ancien format, toujours supporté pour compatibilité)
  
**Exemple** : Pour déclencher uniquement lors du passage de l'état 1 à l'état 7 :
- `etat_from` : `[1]`
- `etat_to` : `[7]`

### 4. RDV créé (`rdv_created`)
Déclenché lorsqu'un rendez-vous est créé.

### 5. RDV validé (`rdv_validated`)
Déclenché lorsqu'un rendez-vous est validé.

### 6. Compte rendu créé (`compte_rendu_created`)
Déclenché lorsqu'un compte rendu est créé par un commercial.

### 7. Compte rendu approuvé (`compte_rendu_approved`)
Déclenché lorsqu'un compte rendu est approuvé par un admin.

### 8. Programmé (`scheduled`)
Déclenché selon une expression cron.
- **Configuration requise** : `cron` - Expression cron (ex: `0 * * * *` pour toutes les heures)

## Types d'Actions

### 1. Notification interne (`notification`)
Envoie une notification interne à un utilisateur.

**Configuration** :
- `type` : Type de notification (ex: 'workflow', 'rdv_reminder')
- `message` : Message de la notification (peut contenir des variables)
- `destination` : Destinataire
  - `id_confirmateur` : Confirmateur de la fiche
  - `id_agent` : Agent de la fiche
  - `id_commercial` : Commercial de la fiche
  - `""` : Tous les admins

**Variables disponibles** : `{fiche.nom}`, `{fiche.prenom}`, `{fiche.id}`, `{user.pseudo}`, etc.

### 2. SMS (`sms`)
Envoie un SMS au client.

**Configuration** :
- `message` : Message SMS (peut contenir des variables)
- `tel_field` : Champ téléphone à utiliser ('tel', 'gsm1', 'gsm2')
- `id_confirmateur` : ID du confirmateur (requis)

**Variables disponibles** : `{fiche.nom}`, `{fiche.prenom}`, `{fiche.tel}`, `{fiche.date_rdv_time}`, etc.

### 3. Email (`email`)
Envoie un email (à implémenter).

### 4. Mettre à jour un champ (`update_field`)
Met à jour un champ de la fiche.

**Configuration** :
- `field` : Nom du champ à mettre à jour
- `value` : Nouvelle valeur (peut contenir des variables)

**Variables disponibles** : `{user.id}`, `{fiche.id_confirmateur}`, etc.

### 5. Changer l'état (`change_etat`)
Change l'état de la fiche.

**Configuration** :
- `etat_id` : ID du nouvel état

### 6. Webhook HTTP (`webhook`)
Envoie une requête HTTP à une URL externe.

**Configuration** :
- `url` : URL du webhook (peut contenir des variables)
- `method` : Méthode HTTP ('POST', 'GET', 'PUT', 'PATCH')
- `headers` : Headers HTTP (optionnel)
- `body` : Corps de la requête (optionnel, peut contenir des variables)

### 7. Message système (`system_message`)
Crée un message système qui sera affiché aux utilisateurs ciblés.

**Configuration** :
- `titre` : Titre du message (optionnel, peut contenir des variables)
- `message` : Contenu du message (requis, peut contenir des variables)
- `type` : Type de message ('info', 'success', 'warning', 'error')
- `priorite` : Priorité (1=normal, 2=important, 3=urgent)
- `cibles_fonctions` : Tableau d'IDs de fonctions ciblées (au moins une fonction ou un utilisateur requis)
- `cibles_utilisateurs` : Tableau d'IDs d'utilisateurs ciblés (au moins une fonction ou un utilisateur requis)
- `date_debut` : Date de début d'affichage (optionnel, format ISO)
- `date_fin` : Date de fin d'affichage (optionnel, format ISO)
- `actif` : Actif (1) ou inactif (0)
- `afficher_une_seule_fois` : Afficher une seule fois (1) ou toujours (0)

**Variables disponibles** : `{fiche.nom}`, `{fiche.prenom}`, `{user.pseudo}`, `{old_etat}`, `{new_etat}`, etc.

## Variables Disponibles

Les variables peuvent être utilisées dans les messages et configurations avec la syntaxe `{chemin}` :

### Variables de Fiche
- `{fiche.id}` : ID de la fiche
- `{fiche.nom}` : Nom du client
- `{fiche.prenom}` : Prénom du client
- `{fiche.tel}` : Téléphone
- `{fiche.id_etat_final}` : ID de l'état actuel
- `{fiche.id_confirmateur}` : ID du confirmateur
- `{fiche.id_agent}` : ID de l'agent
- `{fiche.id_commercial}` : ID du commercial
- `{fiche.date_rdv_time}` : Date du RDV
- Et tous les autres champs de la fiche

### Variables d'Utilisateur
- `{user.id}` : ID de l'utilisateur
- `{user.pseudo}` : Pseudo de l'utilisateur
- `{user.fonction}` : Fonction de l'utilisateur

### Variables d'Événement
- `{old_etat}` : Ancien état (pour événement etat_changed)
- `{new_etat}` : Nouvel état (pour événement etat_changed)

## Exemples de Workflows

### Exemple 1 : Rappel RDV 24h avant

**Nom** : Rappel RDV 24h avant

**Déclencheur** :
- Type : `scheduled`
- Cron : `0 * * * *` (toutes les heures)

**Actions** :
1. Action SMS :
   - Type : `sms`
   - Message : `Bonjour {fiche.prenom}, rappel: votre RDV est prévu le {fiche.date_rdv_time}.`
   - Champ téléphone : `tel`

2. Action Notification :
   - Type : `notification`
   - Message : `Rappel RDV envoyé pour {fiche.nom} {fiche.prenom}`
   - Destinataire : `id_confirmateur`

### Exemple 2 : Notification lors de confirmation

**Nom** : Notification confirmation

**Déclencheur** :
- Type : `etat_changed`
- État cible : `7` (CONFIRMER)

**Actions** :
1. Action Notification :
   - Type : `notification`
   - Message : `Fiche #{fiche.id} confirmée par {user.pseudo}`
   - Destinataire : `id_commercial`

### Exemple 3 : Assignation automatique

**Nom** : Assignation auto qualité

**Déclencheur** :
- Type : `etat_changed`
- État cible : `2` (NRP)

**Actions** :
1. Action Mise à jour champ :
   - Type : `update_field`
   - Champ : `id_qualite`
   - Valeur : `{user.id}`

## Priorité des Workflows

Les workflows sont exécutés dans l'ordre de leur priorité (plus petit = prioritaire). En cas d'égalité, l'ordre de création est utilisé.

## Délais d'Exécution

Chaque action peut avoir un délai en secondes avant son exécution. Utile pour :
- Envoyer un SMS 24h après la création d'un RDV
- Relancer après un certain temps
- Échelonner les actions

## Historique d'Exécution

Chaque exécution de workflow est enregistrée dans `workflow_executions` avec :
- Statut (pending, running, completed, failed)
- Données du déclencheur
- Résultats de chaque action
- Erreurs éventuelles

L'historique est accessible depuis l'interface de gestion des workflows.

## Test de Workflow

L'interface permet de tester un workflow sans l'exécuter réellement. Le test montre :
- Les déclencheurs qui seraient activés
- Les actions qui seraient exécutées
- La configuration de chaque action

## Limitations Actuelles

1. **Conditions** : Les conditions sur les déclencheurs et actions ne sont pas encore implémentées dans l'interface (mais supportées dans le code)
2. **Email** : L'action email nécessite la configuration d'un service SMTP
3. **Scheduled** : Les workflows programmés sont automatiquement exécutés par le planificateur intégré (vérifie toutes les minutes)
4. **Webhooks** : Les webhooks sont exécutés de manière synchrone (peut ralentir la réponse)

## Système Automatique

**Tous les workflows sont maintenant automatiques** - Aucun code supplémentaire n'est nécessaire pour qu'ils fonctionnent !

### Déclencheurs Automatiques

Tous les déclencheurs suivants sont automatiquement gérés par des middlewares :

1. **fiche_created** : Déclenché automatiquement lors de la création d'une fiche
2. **fiche_updated** : Déclenché automatiquement lors de la modification d'une fiche (sauf changement d'état ou création RDV)
3. **etat_changed** : Déclenché automatiquement lors d'un changement d'état (avec support de `etat_from` et `etat_to`)
4. **rdv_created** : Déclenché automatiquement quand `date_rdv_time` passe de NULL/vide à une valeur
5. **rdv_validated** : Déclenché automatiquement quand `valider` passe de 0/NULL à 1
6. **compte_rendu_created** : Déclenché automatiquement lors de la création d'un compte rendu
7. **compte_rendu_approved** : Déclenché automatiquement lors de l'approbation d'un compte rendu
8. **scheduled** : Déclenché automatiquement par le planificateur intégré (vérifie toutes les minutes)

### Planificateur Intégré

Le planificateur de workflows (`workflow-scheduler.js`) :
- Démarre automatiquement avec le serveur
- Vérifie toutes les minutes si des workflows programmés doivent être exécutés
- Supporte les expressions cron standard (format: `minute hour day month weekday`)
- Évite les exécutions multiples grâce à un système de cache

Pour désactiver le planificateur, définir `ENABLE_WORKFLOW_SCHEDULER=false` dans les variables d'environnement.

## Prochaines Améliorations

- Interface graphique pour créer des workflows (drag & drop)
- Conditions visuelles dans l'interface
- Templates de workflows
- Export/Import de workflows
- Logs détaillés avec visualisation

## Support Technique

Pour toute question ou problème, consulter les logs du serveur backend pour voir les erreurs d'exécution des workflows.

