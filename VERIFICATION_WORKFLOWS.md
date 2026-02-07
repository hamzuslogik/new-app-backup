# Vérification des fonctionnalités Workflow

## Bug corrigé (critique)

**Problème :** Lors d’une modification de fiche (PUT) avec changement d’état, l’ancien état était pris dans `req.body.id_etat_final`, qui contient le **nouveau** état envoyé par le client. Résultat : `oldEtatNum === newEtatNum`, le workflow `etat_changed` ne se déclenchait jamais depuis le détail fiche.

**Correction :** Dans `backend/middleware/workflow.middleware.js`, l’ancien état est maintenant pris depuis la fiche **avant** mise à jour :
- `oldEtat = oldFiche?.id_etat_final ?? req.body.old_etat`
- Plus d’utilisation de `req.body.id_etat_final` pour l’ancien état.

---

## Triggers (déclencheurs)

| Type | Où c’est déclenché | Données passées |
|------|--------------------|------------------|
| `fiche_created` | POST /fiches (création fiche) | `fiche`, `user` |
| `fiche_updated` | PUT /fiches/:id (modif sans changement d’état ni RDV créé) | `fiche`, `user`, `changes` |
| `etat_changed` | PUT /fiches/:id (changement d’état), PUT etat-rapide, valider-qualite, valider-qualite-ko | `fiche`, `user`, `old_etat`, `new_etat` |
| `rdv_created` | PUT /fiches/:id quand date_rdv_time passe de vide à une valeur | `fiche`, `user`, `old_date_rdv_time`, `new_date_rdv_time` |
| `rdv_validated` | POST /fiches/:id/valider (valider passe de 0 à 1) | `fiche`, `user`, `old_valider`, `new_valider`, `conf_rdv_avec`, `conf_presence_couple` |
| `compte_rendu_created` | POST /compte-rendu | `fiche`, `user`, `compte_rendu` |
| `compte_rendu_approved` | POST /compte-rendu/:id/approve (statut pending → approved) | `fiche`, `user`, `compte_rendu` |
| `scheduled` | Scheduler (cron) | `workflow_id`, `workflow_nom`, `cron_expression`, `scheduled_at` (pas de `fiche`) |

**Trigger `etat_changed` :**
- Filtres optionnels : état source (`etat_from` / `etat_from_any`) et état cible (`etat_to` / `etat_to_any`).
- « N’importe quel état » : `etat_from_any` / `etat_to_any` à true, ou champs non renseignés (rétrocompat).
- Liste vide sans cocher « n’importe quel état » = aucun match.

---

## Actions

| Type | Implémentation | Remarques |
|------|----------------|-----------|
| **notification** | `executeNotificationAction` | Type, message (variables `{fiche.xxx}`, `{user.xxx}`), destinataires : tous les admins, ou rôle sur la fiche (id_confirmateur, id_agent, id_commercial…), ou fonctions / utilisateurs explicites. Insertion avec `id_expediteur` / `afficher_expediteur` si les colonnes existent. |
| **sms** | `executeSMSAction` | Message (variables), champ téléphone (défaut `tel`). Utilise le fournisseur SMS par défaut. |
| **update_field** | `executeUpdateFieldAction` | `field`, `value` (variables). UPDATE sur `fiches`. |
| **change_etat** | `executeChangeEtatAction` | `etat_id`. Met à jour `fiches.id_etat_final` et insère une ligne dans `fiches_histo` (sans `id_confirmateur`). |
| **webhook** | `executeWebhookAction` | `url`, `method`, `headers`, `body`. Variables remplacées dans l’URL et le body. |
| **system_message** | `executeSystemMessageAction` | Crée un message système (table dédiée). Titre, message, type, priorité, cibles (fonctions / utilisateurs, avec variables comme `{fiche.id_confirmateur}`). |

Toutes les actions supportent :
- **Conditions** (AND) sur les données de l’événement (`fiche.xxx`, `user.xxx`, etc.).
- **Délai** (`delay_seconds`) avant exécution.

---

## Conditions

- **Champ** : notation pointée, ex. `fiche.id_etat_final`, `user.pseudo`.
- **Opérateurs** : `=`, `!=`, `>`, `>=`, `<`, `<=`, `contains`, `not_contains`, `starts_with`, `ends_with`, `in`, `not_in`.
- **Valeur** : littérale ou `NOW()`, `NOW() + 2 DAY`, etc.
- Absence de conditions ou tableau vide = toujours vrai.

---

## Frontend (Management > Workflows)

- **Triggers** : choix du type (fiche_created, fiche_updated, etat_changed, rdv_created, rdv_validated, compte_rendu_created, compte_rendu_approved).
- **etat_changed** : cases « Depuis n’importe quel état » / « Vers n’importe quel état » + listes multi-sélection d’états.
- **Actions** : notification, sms, update_field, change_etat, webhook, system_message avec formulaires associés.
- **Test** : POST /workflows/:id/test (simulation, pas d’exécution réelle).
- **Historique** : GET /workflows/:id/executions.

---

## Tables

- `workflows` : en-tête (nom, description, actif, priorité).
- `workflow_triggers` : type, config (JSON), conditions (JSON).
- `workflow_actions` : type, config (JSON), conditions (JSON), ordre, delay_seconds.
- `workflow_executions` : trace d’exécution (id_workflow, id_fiche, id_user, trigger_type, status, trigger_data, started_at, completed_at).
- `workflow_action_results` : résultat par action (id_execution, id_action, status, result_data / error_message).

---

## Points d’attention

1. **Scheduled** : les workflows `scheduled` reçoivent un `eventData` sans `fiche`. Les actions qui exigent `eventData.fiche` (notification ciblée fiche, sms, update_field, change_etat) ne sont pas adaptées telles quelles au trigger scheduled (ou il faut des conditions évitant d’exécuter ces actions sans fiche).
2. **update_field** : le nom de champ vient de la config (créée en back-office). En cas d’exposition à des saisies non contrôlées, valider la liste des colonnes autorisées pour éviter les injections SQL.
3. **change_etat** : l’insert dans `fiches_histo` se fait sans `id_confirmateur` (action système).

---

## Résumé

- **Correction appliquée** : ancien état du workflow `etat_changed` pris depuis `oldFiche.id_etat_final` (et non plus depuis le body).
- **Triggers** : 7 types + scheduled, tous branchés côté routes/middleware.
- **Actions** : 6 types implémentés et proposés dans l’UI.
- **Conditions et variables** : support complet sur triggers et actions.
