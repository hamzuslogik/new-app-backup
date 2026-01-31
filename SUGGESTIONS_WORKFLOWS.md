# Suggestions de déclencheurs et d'actions pour les workflows

Ce document propose des idées d'évolutions pour le système de workflows du CRM (déclencheurs et actions à implémenter ou à prioriser).

---

## Suggestions de déclencheurs (triggers)

### Déjà en place
- **fiche_created** – Fiche créée  
- **fiche_updated** – Fiche modifiée  
- **etat_changed** – **Changement d'état fiche (n'importe quel état → n'importe quel état).** Config optionnelle : `etat_from` (état(s) source) et/ou `etat_to` (état(s) cible) ; si non renseignés, tous les changements d'état déclenchent le workflow. *Ne pas dupliquer avec des déclencheurs « qualification_done », « signature_done », « fiche_archived » (si archivage = état), « rdv_cancelled » : utiliser etat_changed avec les bons etat_from/etat_to.*  
- **rdv_created** – RDV créé  
- **rdv_validated** – RDV validé  
- **compte_rendu_created** – Compte rendu créé  
- **compte_rendu_approved** – Compte rendu approuvé  
- **scheduled** – Programmé (cron)

### Suggestions à ajouter (sans dupliquer etat_changed)

*Déjà couverts par **etat_changed** (configurer etat_from/etat_to avec les IDs d'états) : qualification_done, signature_done, rdv_cancelled (si « annulé » = un état), fiche_archived (si archivage = un état).*

| Déclencheur suggéré | Description | Cas d'usage |
|---------------------|-------------|-------------|
| **fiche_archived** | Fiche archivée (champ booléen `archive`). *Si archivage = un état → utiliser etat_changed.* | Notifier, reporting, webhook. |
| **fiche_assignee_changed** | Changement d'assignation (confirmateur, commercial, agent). | Alerter le nouvel assigné, synchroniser avec un outil externe. |
| **fiche_rdv_passed** | La date/heure du RDV est dépassée sans passage à un état « réalisé ». | Relance automatique, notification au confirmateur, mise à jour d'un indicateur. |
| **fiche_no_contact** | Plusieurs tentatives sans contact (à définir : N appels, délai). | Réassignation, changement d'état, alerte superviseur. |
| **rdv_rescheduled** | Date/heure du RDV modifiée. | SMS de confirmation, mise à jour agenda, notification confirmateur. |
| **deadline_approaching** | Échéance proche (J-1, J-0) sur un champ date (RDV, relance, etc.). | Rappel interne, SMS client, tâche automatique. |
| **batch_import_done** | Fin d'un import en masse de fiches. | Rapport par email, message système aux admins, webhook. |
| **user_login** / **user_logout** | Connexion / déconnexion d'un utilisateur (optionnel, à activer). | Logs, statistiques présence, alertes sécurité. |

---

## Suggestions d'actions (actions)

### Déjà en place
- **notification** – Notification interne (destinataire configurable)  
- **sms** – Envoi SMS (message, champ téléphone)  
- **email** – Email (à finaliser côté SMTP)  
- **update_field** – Mise à jour d'un champ fiche  
- **change_etat** – Changement d'état de la fiche  
- **webhook** – Appel HTTP externe  
- **system_message** – Message système (cibles, priorité, dates)

### Suggestions à ajouter

| Action suggérée | Description | Cas d'usage |
|-----------------|-------------|-------------|
| **assign_confirmateur** | Définir ou changer le confirmateur (id_confirmateur, éventuellement 2/3). | Répartition automatique, réassignation après NRP. |
| **assign_commercial** | Définir ou changer le commercial. | Répartition par secteur, réassignation après absence. |
| **add_comment** | Ajouter un commentaire / note sur la fiche (ou dans un champ dédié). | Traçabilité automatique (« Relance auto », « Workflow X »). |
| **create_task** | Créer une tâche ou un rappel lié à la fiche (si module tâches existe). | « Rappeler dans 24h », « Vérifier signature ». |
| **duplicate_fiche** | Dupliquer la fiche (avec règles : quels champs, nouvel état). | Réessai après échec, nouveau cycle. |
| **send_email** (compléter l'existant) | Envoi d'email avec template (client, commercial, admin). | Confirmation RDV, relance, rapport. |
| **log_audit** | Écrire une ligne dans un journal d'audit / table de logs. | Conformité, analyse des processus. |
| **trigger_another_workflow** | Déclencher un autre workflow par ID ou code. | Chaînes de workflows, sous-processus réutilisables. |
| **conditional_branch** | Branche conditionnelle (si champ = valeur, alors action A, sinon action B). | Comportement différent selon état, produit, centre. |
| **delay_then** | Planifier une action différée (ex. exécuter dans 24h). | Rappel J-1, relance après délai. |
| **add_to_list** | Ajouter la fiche à une liste / segment (si module listes existe). | Listes « À rappeler », « Signés ce mois ». |
| **slack_teams_message** | Envoyer un message dans Slack / Teams (webhook ou API). | Alertes équipe, canal dédié confirmations. |

---

## Priorisation suggérée

### Court terme (impact fort, coût modéré)
1. **rdv_rescheduled** – Gestion du changement de date/heure RDV (*rdv_cancelled* = utiliser **etat_changed** avec etat_to = état annulé).  
2. **send_email** – Finaliser l'action email (template, SMTP).  
3. **add_comment** – Traçabilité des actions automatiques.  
4. **assign_confirmateur** / **assign_commercial** – Répartition ou réassignation automatique.

### Moyen terme
1. **fiche_rdv_passed** – Relances et indicateurs.  
2. **deadline_approaching** (scheduled + conditions sur dates).  
3. **trigger_another_workflow** – Réutilisation et chaînage.  
4. **delay_then** – Actions différées (rappels, relances).

### Plus tard
1. **batch_import_done**, **user_login** / **user_logout**.  
2. **conditional_branch**, **create_task**, **add_to_list**.  
3. **slack_teams_message**, **log_audit**.

---

## Exemples de combinaisons déclencheur + action

| Objectif | Déclencheur | Action(s) |
|----------|-------------|-----------|
| Rappel RDV 24h avant | **scheduled** (cron quotidien) + condition date_rdv = J+1 | **sms** (rappel client) + **notification** (confirmateur) |
| Alerte RDV dépassé sans suite | **fiche_rdv_passed** (nouveau) | **notification** (confirmateur) + **add_comment** (« RDV passé non traité ») |
| Réassignation après NRP | **etat_changed** (etat_to = NRP) | **assign_confirmateur** (autre confirmateur) + **notification** |
| RDV annulé | **etat_changed** (etat_to = état « annulé ») | **sms** (client) + **notification** (commercial) |
| Confirmation de changement de RDV | **rdv_rescheduled** (nouveau) | **sms** (nouvelle date) + **notification** (commercial) |
| Relance après 48h sans contact | **scheduled** + condition date_modif &lt; J-2 | **sms** + **change_etat** (ex. « À rappeler ») |

---

## Notes techniques pour l'implémentation

- Chaque nouveau déclencheur doit être :  
  - branché dans le bon middleware ou service (création/modification fiche, changement d'état, cron, etc.) ;  
  - documenté dans `README_WORKFLOWS.md` (nom, config, variables disponibles).
- Chaque nouvelle action doit être :  
  - ajoutée dans le `switch` `executeAction` du workflow-executor ;  
  - exposée dans l'UI (WorkflowsTab) avec les champs de configuration nécessaires.
- Pour les déclencheurs basés sur le temps (**deadline_approaching**, **fiche_rdv_passed**), réutiliser le planificateur **scheduled** avec des conditions sur les champs date des fiches, ou ajouter une boucle dédiée dans le scheduler.

Ce fichier peut être utilisé comme backlog fonctionnel pour les évolutions du module workflows.
