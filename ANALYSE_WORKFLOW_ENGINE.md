# Analyse d'Intégration d'un Workflow Engine dans le CRM

## 📋 Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture Actuelle](#architecture-actuelle)
3. [Faisabilité Technique](#faisabilité-technique)
4. [Points d'Intégration Identifiés](#points-dintégration-identifiés)
5. [Actions Automatisables](#actions-automatisables)
6. [Solutions de Workflow Engine](#solutions-de-workflow-engine)
7. [Architecture Proposée](#architecture-proposée)
8. [Plan d'Implémentation](#plan-dimplémentation)
9. [Avantages et Défis](#avantages-et-défis)
10. [Recommandation](#recommandation)

---

## Vue d'ensemble

Cette analyse évalue la faisabilité d'intégrer un moteur de workflow (Workflow Engine) dans le CRM existant pour permettre la création et l'exécution automatisée d'actions basées sur des événements et des conditions.

**Objectif** : Automatiser les processus métier répétitifs et créer des workflows configurables sans modification du code.

---

## Architecture Actuelle

### Backend
- **Framework** : Express.js (Node.js)
- **Base de données** : MySQL
- **Structure** : Routes modulaires, services séparés
- **Middleware** : Authentification JWT, permissions

### Points Forts Existants
✅ Système de logs (`modifica`, `fiches_histo`)  
✅ Système de notifications  
✅ Service SMS modulaire  
✅ Middleware système extensible  
✅ Routes API bien structurées  

### Points à Améliorer
❌ Pas de système d'événements centralisé  
❌ Logique métier dispersée dans les routes  
❌ Pas de hooks/triggers configurables  
❌ Actions automatisées codées en dur  

---

## Faisabilité Technique

### ✅ **FAISABLE** - Score : 8/10

**Raisons de la faisabilité** :

1. **Architecture modulaire** : Structure Express.js permet l'ajout de middleware et services
2. **Base de données flexible** : MySQL permet de stocker les définitions de workflows
3. **Services existants** : SMS, notifications peuvent être utilisés comme actions
4. **Logs existants** : Système de tracking permet de détecter les événements
5. **API REST** : Points d'entrée clairs pour déclencher des workflows

**Défis techniques** :

1. **Refactoring nécessaire** : Extraire la logique métier des routes
2. **Performance** : Évaluer l'impact des workflows sur les performances
3. **Complexité** : Gérer les workflows conditionnels et les dépendances
4. **Debugging** : Traçabilité des exécutions de workflows

---

## Points d'Intégration Identifiés

### 1. Événements de Fiches

#### 1.1. Création de Fiche
- **Route** : `POST /api/fiches`
- **Point d'intégration** : Après insertion réussie
- **Données disponibles** : Toute la fiche créée
- **Exemple de workflow** : Notification automatique, assignation automatique

#### 1.2. Modification de Fiche
- **Route** : `PUT /api/fiches/:id`, `PATCH /api/fiches/:id/field`
- **Point d'intégration** : Après mise à jour réussie
- **Données disponibles** : Anciennes et nouvelles valeurs
- **Exemple de workflow** : Validation automatique, notification de changement

#### 1.3. Changement d'État
- **Route** : `PUT /api/fiches/:id/etat-rapide`, `PATCH /api/fiches/:id/field` (id_etat_final)
- **Point d'intégration** : Après insertion dans `fiches_histo`
- **Données disponibles** : Ancien état, nouvel état, fiche complète
- **Exemple de workflow** : 
  - État 7 (CONFIRMER) → Envoyer SMS de rappel RDV
  - État 13 (SIGNER) → Notifier le commercial
  - État 2 (NRP) → Assigner à la qualité

#### 1.4. Archivage
- **Route** : `PUT /api/fiches/:id/archive`
- **Point d'intégration** : Après archivage
- **Exemple de workflow** : Notification aux admins, export automatique

### 2. Événements de RDV

#### 2.1. Création de RDV
- **Route** : `POST /api/fiches/:id/rdv`
- **Point d'intégration** : Après création du RDV
- **Exemple de workflow** : SMS de confirmation, notification au confirmateur

#### 2.2. Validation de RDV
- **Route** : `POST /api/planning/validate-rdv`
- **Point d'intégration** : Après validation
- **Exemple de workflow** : SMS de rappel 24h avant, notification

#### 2.3. Décalage de RDV
- **Route** : `POST /api/decalages`
- **Point d'intégration** : Après création du décalage
- **Exemple de workflow** : Notification au confirmateur, SMS au client

### 3. Événements de Comptes Rendus

#### 3.1. Création de Compte Rendu
- **Route** : `POST /api/compte-rendu`
- **Point d'intégration** : Après création
- **Exemple de workflow** : Notification aux admins, assignation automatique

#### 3.2. Approbation de Compte Rendu
- **Route** : `POST /api/compte-rendu/:id/approve`
- **Point d'intégration** : Après approbation
- **Exemple de workflow** : Application des modifications, notification au commercial

#### 3.3. Rejet de Compte Rendu
- **Route** : `POST /api/compte-rendu/:id/reject`
- **Point d'intégration** : Après rejet
- **Exemple de workflow** : Notification au commercial avec commentaires

### 4. Événements Temporels

#### 4.1. Événements Programmés
- **Déclencheurs** : Cron jobs, tâches planifiées
- **Exemples** :
  - Rappel RDV 24h avant
  - Relance fiches en attente > 7 jours
  - Rapport quotidien/hebdomadaire

#### 4.2. Événements Basés sur Dates
- **Déclencheurs** : Conditions sur `date_rdv_time`, `date_insert_time`, etc.
- **Exemples** :
  - Fiche créée il y a X jours sans action
  - RDV dans moins de 24h
  - Fiche confirmée depuis plus de 30 jours

### 5. Événements Utilisateur

#### 5.1. Connexion
- **Route** : `POST /api/auth/login`
- **Exemple de workflow** : Notification de connexion, statistiques du jour

#### 5.2. Actions Spécifiques
- **Exemples** :
  - Import en masse terminé → Notification
  - Validation de fiche → Mise à jour statistiques

---

## Actions Automatisables

### 1. Actions de Notification

#### 1.1. Notifications Internes
- **Service existant** : `POST /api/notifications`
- **Paramètres** : Type, message, destination, métadonnées
- **Exemples** :
  - Notifier un utilisateur spécifique
  - Notifier un groupe (admins, confirmateurs, etc.)
  - Notifier avec lien vers la fiche

#### 1.2. Envoi d'Email
- **Service à créer** : Service email (SMTP)
- **Paramètres** : Destinataire, sujet, template, données
- **Exemples** :
  - Email de confirmation de RDV
  - Email de relance
  - Email de rapport

#### 1.3. Envoi de SMS
- **Service existant** : `backend/services/sms.service.js`
- **Route** : `POST /api/fiches/:id/sms`
- **Paramètres** : Téléphone, message, confirmateur
- **Exemples** :
  - SMS de rappel RDV
  - SMS de confirmation
  - SMS de relance

### 2. Actions sur les Fiches

#### 2.1. Modification de Champs
- **Route** : `PATCH /api/fiches/:id/field`
- **Paramètres** : Champ, valeur
- **Exemples** :
  - Assignation automatique selon règles
  - Mise à jour de champs calculés
  - Changement d'état automatique

#### 2.2. Changement d'État
- **Route** : `PUT /api/fiches/:id/etat-rapide`
- **Paramètres** : Nouvel état
- **Exemples** :
  - Passage automatique à l'état suivant
  - Retour à l'état précédent selon conditions

#### 2.3. Création de Tâches (à implémenter)
- **Action future** : Créer une tâche pour un utilisateur
- **Exemples** :
  - Tâche de relance
  - Tâche de validation
  - Tâche de suivi

### 3. Actions de Calcul

#### 3.1. Calculs Automatiques
- **Exemples** :
  - Calcul de consommation (existant partiellement)
  - Calcul de score de qualification
  - Calcul de probabilité de conversion

#### 3.2. Mise à Jour de Statistiques
- **Exemples** :
  - Mise à jour des KPIs
  - Mise à jour des compteurs
  - Génération de rapports

### 4. Actions d'Intégration

#### 4.1. Webhooks
- **Action à créer** : Envoi de webhook HTTP
- **Paramètres** : URL, méthode, headers, body
- **Exemples** :
  - Notifier un système externe
  - Synchroniser avec un autre CRM
  - Intégration avec outils tiers

#### 4.2. Appels API Externes
- **Exemples** :
  - Enrichissement de données (adresses, coordonnées)
  - Vérification de données
  - Synchronisation avec calendrier externe

### 5. Actions Conditionnelles

#### 5.1. Conditions Simples
- **Opérateurs** : `=`, `!=`, `>`, `<`, `>=`, `<=`, `contains`, `startsWith`, `endsWith`
- **Exemples** :
  - Si `id_etat_final = 7` → Envoyer SMS
  - Si `date_rdv_time < maintenant + 24h` → Rappel
  - Si `id_centre = X` → Assigner à Y

#### 5.2. Conditions Complexes
- **Opérateurs logiques** : `AND`, `OR`, `NOT`
- **Exemples** :
  - Si `id_etat_final = 7 AND date_rdv_time < demain` → Rappel
  - Si `id_centre = X OR id_agent = Y` → Notification spéciale

---

## Solutions de Workflow Engine

### Option 1 : Solution Custom (Recommandée)

#### Avantages
✅ Contrôle total sur la logique  
✅ Intégration native avec l'architecture existante  
✅ Pas de dépendances externes  
✅ Adapté aux besoins spécifiques du CRM  
✅ Coût de licence nul  

#### Inconvénients
❌ Développement initial plus long  
❌ Maintenance à prévoir  
❌ Tests nécessaires  

#### Architecture Proposée
```
backend/
  services/
    workflow/
      engine.js          # Moteur principal
      executor.js        # Exécuteur de workflows
      conditions.js     # Évaluateur de conditions
      actions.js        # Exécuteur d'actions
      events.js         # Gestionnaire d'événements
  routes/
    workflow.routes.js  # API de gestion des workflows
  models/
    workflow.js        # Modèle de données
```

### Option 2 : Bibliothèque Open Source

#### 2.1. Temporal.io
- **Type** : Orchestration de workflows
- **Langage** : Multi-langage (Node.js supporté)
- **Avantages** : Très puissant, scalable, fiable
- **Inconvénients** : Complexe, nécessite infrastructure
- **Recommandation** : ⭐⭐⭐ (Trop complexe pour ce cas)

#### 2.2. Zeebe (Camunda Cloud)
- **Type** : Workflow engine BPMN
- **Langage** : Multi-langage
- **Avantages** : Standard BPMN, interface graphique
- **Inconvénients** : Infrastructure dédiée, courbe d'apprentissage
- **Recommandation** : ⭐⭐ (Overkill pour ce cas)

#### 2.3. Bull / BullMQ
- **Type** : Queue system avec workflows
- **Langage** : Node.js
- **Avantages** : Simple, basé sur Redis, bien documenté
- **Inconvénients** : Nécessite Redis, orienté queues
- **Recommandation** : ⭐⭐⭐⭐ (Bon compromis)

#### 2.4. Node-RED
- **Type** : Flow-based programming
- **Langage** : Node.js
- **Avantages** : Interface graphique, extensible
- **Inconvénients** : Interface séparée, moins intégré
- **Recommandation** : ⭐⭐⭐ (Intéressant mais séparé)

### Option 3 : Solution SaaS

#### 3.1. Zapier / Make (Integromat)
- **Avantages** : Interface graphique, nombreuses intégrations
- **Inconvénients** : Coût, dépendance externe, sécurité des données
- **Recommandation** : ⭐⭐ (Pas adapté pour workflows internes)

#### 3.2. n8n (Self-hosted)
- **Avantages** : Open source, interface graphique, self-hosted
- **Inconvénients** : Infrastructure séparée, intégration à prévoir
- **Recommandation** : ⭐⭐⭐⭐ (Bon compromis si interface graphique souhaitée)

---

## Architecture Proposée

### Structure de Base de Données

```sql
-- Table principale des workflows
CREATE TABLE `workflows` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nom` varchar(255) NOT NULL,
  `description` text,
  `actif` tinyint(1) DEFAULT 1,
  `priorite` int(11) DEFAULT 0,
  `date_creation` datetime DEFAULT CURRENT_TIMESTAMP,
  `date_modif` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

-- Table des déclencheurs (événements)
CREATE TABLE `workflow_triggers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_workflow` int(11) NOT NULL,
  `type` varchar(50) NOT NULL, -- 'fiche_created', 'fiche_updated', 'etat_changed', 'rdv_created', 'scheduled', etc.
  `event_data` json, -- Configuration spécifique à l'événement
  `conditions` json, -- Conditions à vérifier avant déclenchement
  PRIMARY KEY (`id`),
  KEY `idx_workflow` (`id_workflow`),
  KEY `idx_type` (`type`)
) ENGINE=InnoDB;

-- Table des actions
CREATE TABLE `workflow_actions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_workflow` int(11) NOT NULL,
  `ordre` int(11) NOT NULL,
  `type` varchar(50) NOT NULL, -- 'notification', 'sms', 'email', 'update_field', 'change_etat', 'webhook', etc.
  `config` json NOT NULL, -- Configuration de l'action
  `conditions` json, -- Conditions pour exécuter cette action
  `delay` int(11) DEFAULT 0, -- Délai en secondes avant exécution
  PRIMARY KEY (`id`),
  KEY `idx_workflow` (`id_workflow`)
) ENGINE=InnoDB;

-- Table d'exécution (logs)
CREATE TABLE `workflow_executions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_workflow` int(11) NOT NULL,
  `id_fiche` int(11) DEFAULT NULL,
  `id_user` int(11) DEFAULT NULL,
  `status` varchar(20) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'cancelled'
  `trigger_data` json, -- Données du déclencheur
  `started_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `error_message` text,
  PRIMARY KEY (`id`),
  KEY `idx_workflow` (`id_workflow`),
  KEY `idx_fiche` (`id_fiche`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB;

-- Table des résultats d'actions
CREATE TABLE `workflow_action_results` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_execution` int(11) NOT NULL,
  `id_action` int(11) NOT NULL,
  `status` varchar(20) DEFAULT 'pending',
  `result_data` json,
  `error_message` text,
  `executed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_execution` (`id_execution`),
  KEY `idx_action` (`id_action`)
) ENGINE=InnoDB;
```

### Structure du Code

```
backend/
  services/
    workflow/
      engine.js           # Moteur principal - Orchestration
      trigger.js          # Gestion des déclencheurs
      condition.js        # Évaluation des conditions
      action/
        base.js          # Classe de base pour actions
        notification.js  # Action : Notification interne
        sms.js           # Action : Envoi SMS
        email.js         # Action : Envoi Email
        updateField.js   # Action : Mise à jour champ
        changeEtat.js    # Action : Changement d'état
        webhook.js       # Action : Webhook HTTP
        delay.js         # Action : Délai/Attente
      executor.js        # Exécuteur de workflows
      scheduler.js        # Planificateur (cron jobs)
  routes/
    workflow.routes.js    # API REST pour gestion workflows
  middleware/
    workflow.middleware.js # Middleware pour déclencher workflows
```

### Flux d'Exécution

```
1. Événement déclenché (ex: changement d'état)
   ↓
2. Middleware workflow intercepte l'événement
   ↓
3. Engine recherche les workflows actifs pour cet événement
   ↓
4. Pour chaque workflow :
   a. Évaluer les conditions du trigger
   b. Si conditions OK → Créer exécution
   c. Exécuter les actions dans l'ordre
   d. Gérer les erreurs et retry
   ↓
5. Logger les résultats
```

---

## Plan d'Implémentation

### Phase 1 : Infrastructure de Base (2-3 semaines)

#### 1.1. Base de Données
- [ ] Créer les tables de workflows
- [ ] Créer les index pour performance
- [ ] Scripts de migration

#### 1.2. Services de Base
- [ ] Créer `workflow/engine.js` (orchestration)
- [ ] Créer `workflow/trigger.js` (détection événements)
- [ ] Créer `workflow/condition.js` (évaluation conditions)
- [ ] Créer `workflow/executor.js` (exécution)

#### 1.3. Actions de Base
- [ ] Action : Notification interne
- [ ] Action : SMS (utiliser service existant)
- [ ] Action : Mise à jour champ
- [ ] Action : Changement d'état

#### 1.4. Middleware
- [ ] Middleware pour intercepter les événements
- [ ] Intégration dans les routes existantes

### Phase 2 : API et Interface (2 semaines)

#### 2.1. API Backend
- [ ] `GET /api/workflows` - Liste des workflows
- [ ] `POST /api/workflows` - Créer un workflow
- [ ] `PUT /api/workflows/:id` - Modifier un workflow
- [ ] `DELETE /api/workflows/:id` - Supprimer un workflow
- [ ] `POST /api/workflows/:id/activate` - Activer/Désactiver
- [ ] `GET /api/workflows/:id/executions` - Historique d'exécution
- [ ] `POST /api/workflows/:id/test` - Tester un workflow

#### 2.2. Interface Frontend
- [ ] Page de gestion des workflows
- [ ] Éditeur de workflow (drag & drop ou formulaire)
- [ ] Liste des workflows avec statut
- [ ] Historique d'exécution
- [ ] Tests de workflows

### Phase 3 : Actions Avancées (2-3 semaines)

#### 3.1. Actions Supplémentaires
- [ ] Action : Email (créer service email)
- [ ] Action : Webhook HTTP
- [ ] Action : Délai/Attente
- [ ] Action : Conditions multiples

#### 3.2. Événements Temporels
- [ ] Scheduler (cron jobs)
- [ ] Événements basés sur dates
- [ ] Rappels programmés

### Phase 4 : Optimisations (1-2 semaines)

#### 4.1. Performance
- [ ] Queue system (Bull/BullMQ) pour exécution asynchrone
- [ ] Cache des workflows actifs
- [ ] Optimisation des requêtes

#### 4.2. Monitoring
- [ ] Dashboard d'exécution
- [ ] Alertes sur erreurs
- [ ] Métriques de performance

### Phase 5 : Documentation et Tests (1 semaine)

#### 5.1. Documentation
- [ ] Documentation API
- [ ] Guide utilisateur
- [ ] Exemples de workflows

#### 5.2. Tests
- [ ] Tests unitaires
- [ ] Tests d'intégration
- [ ] Tests de charge

---

## Avantages et Défis

### Avantages

#### 1. Automatisation
✅ Réduction des tâches manuelles répétitives  
✅ Gain de temps pour les utilisateurs  
✅ Réduction des erreurs humaines  

#### 2. Flexibilité
✅ Configuration sans modification du code  
✅ Adaptation rapide aux changements métier  
✅ Personnalisation par centre/équipe  

#### 3. Traçabilité
✅ Historique complet des actions automatisées  
✅ Debugging facilité  
✅ Audit trail  

#### 4. Scalabilité
✅ Gestion de volumes importants  
✅ Exécution asynchrone possible  
✅ Performance optimisée  

### Défis

#### 1. Complexité
⚠️ Courbe d'apprentissage pour les utilisateurs  
⚠️ Risque de workflows complexes difficiles à maintenir  
⚠️ Debugging de workflows conditionnels  

#### 2. Performance
⚠️ Impact sur les performances si mal conçu  
⚠️ Risque de workflows en boucle  
⚠️ Gestion des timeouts  

#### 3. Maintenance
⚠️ Dépendances entre workflows  
⚠️ Migration de workflows lors de changements  
⚠️ Versioning des workflows  

#### 4. Sécurité
⚠️ Validation des actions exécutées  
⚠️ Permissions sur création/modification de workflows  
⚠️ Protection contre injections  

---

## Recommandation

### ✅ **RECOMMANDATION : Solution Custom**

**Justification** :

1. **Contrôle Total** : Adaptation parfaite aux besoins spécifiques du CRM
2. **Intégration Native** : Utilisation des services existants (SMS, notifications)
3. **Coût** : Pas de licence, développement interne
4. **Maintenance** : Équipe interne maîtrise le code
5. **Performance** : Optimisé pour les besoins réels

### Architecture Recommandée

```
Solution Custom + Queue System (Bull/BullMQ)
```

**Pourquoi Bull/BullMQ** :
- Exécution asynchrone des workflows
- Retry automatique en cas d'échec
- Priorisation des workflows
- Monitoring intégré
- Basé sur Redis (léger)

### Plan de Déploiement

1. **MVP (4-6 semaines)** :
   - Workflows simples (1 trigger → 1-2 actions)
   - Actions de base (notification, SMS, update field)
   - Interface basique de gestion

2. **Version Complète (8-12 semaines)** :
   - Conditions complexes
   - Actions avancées (email, webhook)
   - Événements temporels
   - Interface avancée

3. **Optimisations (2-4 semaines)** :
   - Queue system
   - Performance
   - Monitoring

### Exemple de Workflow Simple

**Nom** : "Rappel RDV 24h avant"

**Déclencheur** :
- Type : `scheduled` (cron: toutes les heures)
- Condition : `date_rdv_time BETWEEN NOW() AND NOW() + INTERVAL 25 HOUR`

**Actions** :
1. Action SMS : Envoyer SMS de rappel au client
2. Action Notification : Notifier le confirmateur

**Configuration JSON** :
```json
{
  "nom": "Rappel RDV 24h avant",
  "actif": true,
  "trigger": {
    "type": "scheduled",
    "cron": "0 * * * *",
    "conditions": {
      "field": "date_rdv_time",
      "operator": "between",
      "value": ["NOW()", "NOW() + INTERVAL 25 HOUR"]
    }
  },
  "actions": [
    {
      "ordre": 1,
      "type": "sms",
      "config": {
        "template": "Rappel: Votre RDV est prévu demain à {date_rdv_time}",
        "tel_field": "tel"
      }
    },
    {
      "ordre": 2,
      "type": "notification",
      "config": {
        "type": "rdv_reminder",
        "message": "Rappel RDV envoyé pour fiche #{id}",
        "destination": "id_confirmateur"
      }
    }
  ]
}
```

---

## Conclusion

**L'intégration d'un Workflow Engine est non seulement faisable mais hautement recommandée** pour ce CRM. 

La solution custom offre le meilleur compromis entre :
- **Fonctionnalités** : Adaptées aux besoins spécifiques
- **Coût** : Développement interne sans licence
- **Maintenance** : Contrôle total du code
- **Performance** : Optimisé pour le contexte

Avec une architecture bien pensée et une implémentation progressive, le système de workflows transformera le CRM en un outil véritablement automatisé et efficace.

---

*Document généré le : 2026-01-22*  
*Version : 1.0*  
*Auteur : Analyse technique CRM*

