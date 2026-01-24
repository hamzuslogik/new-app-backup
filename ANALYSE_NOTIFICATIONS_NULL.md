# Analyse des Notifications NULL dans la Table `notifications`

## Problème Identifié

Des lignes dans la table `notifications` contiennent uniquement des valeurs NULL pour les champs principaux (`type`, `id_fiche`, `message`, `destination`, etc.).

## Causes Possibles Identifiées

### 1. Workflow Executor - Message Vide après Remplacement de Variables

**Fichier** : `backend/services/workflow/workflow-executor.js` (lignes 178-206)

**Problème** :
```javascript
const processedMessage = replaceVariables(message, eventData);
// Si toutes les variables dans le message sont NULL, processedMessage peut être vide ou NULL
await query(`
  INSERT INTO notifications (type, id_fiche, message, destination, date_creation, lu)
  VALUES (?, ?, ?, ?, ?, 0)
`, [type || 'workflow', eventData.fiche?.id || null, processedMessage, destId, now]);
```

**Scénario** :
- Un workflow est configuré avec un message contenant uniquement des variables : `"{fiche.nom} {fiche.prenom}"`
- Si `fiche.nom` et `fiche.prenom` sont NULL dans `eventData`
- `processedMessage` devient une chaîne vide `""` ou `"null null"`
- La notification est créée avec un message vide

**Solution** : Valider que le message n'est pas vide après remplacement des variables

---

### 2. Workflow Executor - Destinataire NULL non Géré

**Fichier** : `backend/services/workflow/workflow-executor.js` (lignes 186-197)

**Problème** :
```javascript
let destId = destination;
if (destination === 'id_confirmateur' && eventData.fiche?.id_confirmateur) {
  destId = eventData.fiche.id_confirmateur;
} else if (destination === 'id_agent' && eventData.fiche?.id_agent) {
  destId = eventData.fiche.id_agent;
} else if (destination === 'id_commercial' && eventData.fiche?.id_commercial) {
  destId = eventData.fiche.id_commercial;
}

if (!destId) {
  throw new Error('Destinataire non trouvé pour la notification');
}
```

**Scénario** :
- Si l'erreur est catchée quelque part et ignorée, la notification pourrait être créée avec `destination = NULL`
- Si `destination` est une chaîne vide `""` au lieu de `null`, la condition `!destId` ne la détecte pas
- Si `destination` est un nombre (ID utilisateur) qui n'existe pas, `destId` reste cet ID invalide

**Solution** : Vérifier que `destId` est un nombre valide et que l'utilisateur existe

---

### 3. Workflow Executor - Type NULL ou Vide

**Fichier** : `backend/services/workflow/workflow-executor.js` (ligne 203)

**Problème** :
```javascript
[type || 'workflow', eventData.fiche?.id || null, processedMessage, destId, now]
```

**Scénario** :
- Si `type` est une chaîne vide `""`, `type || 'workflow'` retourne `'workflow'` (OK)
- Mais si `type` est explicitement `null` dans la config, cela pourrait poser problème
- Si la config du workflow n'a pas de `type`, `type` sera `undefined` et sera remplacé par `'workflow'` (OK)

**Solution** : Valider que `type` est une chaîne non vide

---

### 4. Routes de Notification - Validation Insuffisante

**Fichier** : `backend/routes/notification.routes.js` (lignes 313-387)

**Problème** :
```javascript
if (!type || !message) {
  return res.status(400).json({
    success: false,
    message: 'Type et message requis'
  });
}
```

**Scénario** :
- La validation vérifie `!type` et `!message`, mais :
  - Une chaîne vide `""` passe la validation (`!""` est `true`, mais `""` est falsy)
  - Si `type` ou `message` sont des espaces `"   "`, ils passent la validation
  - Si `destination` n'est pas fourni et qu'aucun admin n'est trouvé, une erreur est retournée (OK)

**Solution** : Valider avec `trim()` pour rejeter les chaînes vides ou uniquement des espaces

---

### 5. Routes Fiche - Notifications avec Valeurs Potentiellement NULL

**Fichier** : `backend/routes/fiche.routes.js` (lignes 2158-2209)

**Problème** :
```javascript
await query(
  `INSERT INTO notifications (type, id_fiche, message, destination, date_creation, lu, metadata)
   VALUES (?, ?, ?, ?, ?, 0, ?)`,
  ['demande_insertion_acceptee', insertId, messageAcceptation, demande.id_agent, now, metadataAcceptation]
).catch(err => {
  console.error('Erreur lors de la création de la notification pour l\'agent:', err);
});
```

**Scénario** :
- Si `demande.id_agent` est NULL, la notification est créée avec `destination = NULL`
- Si `insertId` est NULL (erreur lors de l'insertion), `id_fiche = NULL`
- Si `messageAcceptation` est construit avec des valeurs NULL, le message peut être vide
- Les erreurs sont catchées et ignorées, donc la notification peut être créée avec des valeurs NULL

**Solution** : Valider les valeurs avant insertion

---

### 6. Routes Decalage - Notifications avec Destinataires Potentiellement NULL

**Fichier** : `backend/routes/decalage.routes.js` (lignes 352-402)

**Problème** :
```javascript
await query(
  `INSERT INTO notifications (type, id_fiche, message, destination, date_creation, lu, metadata)
   VALUES (?, ?, ?, ?, ?, 0, ?)`,
  ['decalage_request', idFicheNum, notificationMessage, destination, now, metadata]
).catch(err => {
  console.error('Erreur lors de la création de la notification pour le confirmateur:', err);
});
```

**Scénario** :
- Si `destination` est NULL (confirmateur non trouvé), la notification est créée avec `destination = NULL`
- Si `confirmateurInfo.chef_equipe` est NULL mais que la condition `if (confirmateurInfo?.chef_equipe)` n'est pas vérifiée correctement
- Si `notificationMessage` est construit avec des valeurs NULL

**Solution** : Valider que `destination` existe avant insertion

---

### 7. Remplacement de Variables - Chaînes Vides

**Fichier** : `backend/services/workflow/workflow-executor.js` (fonction `replaceVariables`)

**Problème** :
```javascript
function replaceVariables(template, eventData) {
  if (typeof template !== 'string') {
    return template;
  }

  return template.replace(/\{([^}]+)\}/g, (match, key) => {
    const value = getFieldValue(key, eventData);
    return value !== null && value !== undefined ? String(value) : match;
  });
}
```

**Scénario** :
- Si le template est `"{fiche.nom}"` et `fiche.nom` est NULL, le résultat est `"{fiche.nom}"` (la variable n'est pas remplacée)
- Si le template est `"Bonjour {fiche.nom}"` et `fiche.nom` est NULL, le résultat est `"Bonjour {fiche.nom}"`
- Si le template est uniquement `"{fiche.nom}"` et `fiche.nom` est NULL, le résultat est `"{fiche.nom}"` (chaîne non vide, mais inutile)
- Si toutes les variables sont NULL et que le template ne contient que des variables, le message final peut être vide ou inutile

**Solution** : Valider le message final après remplacement

---

### 8. Exécution Asynchrone des Workflows - Données Incomplètes

**Fichier** : `backend/middleware/workflow.middleware.js`

**Problème** :
```javascript
executeWorkflow('fiche_created', {
  fiche,
  user: req.user
}).catch(error => {
  console.error('Erreur lors de l\'exécution des workflows (fiche_created):', error);
});
```

**Scénario** :
- Les workflows sont exécutés de manière asynchrone
- Si `fiche` est NULL ou incomplet au moment de l'exécution
- Si `req.user` est NULL ou incomplet
- Les workflows s'exécutent quand même avec des données incomplètes
- Les notifications sont créées avec des valeurs NULL

**Solution** : Valider les données de l'événement avant d'exécuter les workflows

---

### 9. Insertions Directes SQL - Pas de Validation

**Problème** :
- Des insertions SQL directes dans la base de données peuvent créer des notifications avec NULL
- Des scripts de migration ou de correction peuvent insérer des lignes NULL
- Des triggers MySQL (s'il y en a) peuvent créer des notifications avec NULL

**Solution** : Vérifier s'il y a des triggers ou scripts SQL qui insèrent dans notifications

---

### 10. Erreurs Silencieuses - Catch qui Ignore

**Problème** :
Dans plusieurs endroits, les erreurs sont catchées et seulement loggées :
```javascript
.catch(err => {
  console.error('Erreur lors de la création de la notification:', err);
});
```

**Scénario** :
- Si une erreur se produit pendant la construction des valeurs
- Si une partie de l'insertion échoue mais que l'insertion continue
- Les valeurs peuvent être NULL sans que l'erreur soit remontée

**Solution** : Ne pas ignorer les erreurs silencieusement, ou au moins ne pas insérer si les valeurs critiques sont NULL

---

## Solutions Recommandées

### Solution 1 : Validation dans Workflow Executor

Ajouter des validations strictes avant l'insertion :

```javascript
async function executeNotificationAction(config, eventData) {
  const { query } = require('../../config/database');
  const { type, message, destination } = config;
  
  // Validation des paramètres requis
  if (!type || typeof type !== 'string' || type.trim() === '') {
    throw new Error('Type de notification requis et non vide');
  }
  
  if (!message || typeof message !== 'string' || message.trim() === '') {
    throw new Error('Message de notification requis et non vide');
  }
  
  // Remplacer les variables dans le message
  const processedMessage = replaceVariables(message, eventData);
  
  // Vérifier que le message final n'est pas vide
  if (!processedMessage || processedMessage.trim() === '') {
    throw new Error('Message de notification vide après remplacement des variables');
  }
  
  // Déterminer le destinataire
  let destId = destination;
  if (destination === 'id_confirmateur' && eventData.fiche?.id_confirmateur) {
    destId = eventData.fiche.id_confirmateur;
  } else if (destination === 'id_agent' && eventData.fiche?.id_agent) {
    destId = eventData.fiche.id_agent;
  } else if (destination === 'id_commercial' && eventData.fiche?.id_commercial) {
    destId = eventData.fiche.id_commercial;
  }

  // Validation stricte du destinataire
  if (!destId || (typeof destId !== 'number' && typeof destId !== 'string')) {
    throw new Error('Destinataire non trouvé ou invalide pour la notification');
  }
  
  // Vérifier que l'utilisateur destinataire existe
  const userExists = await queryOne('SELECT id FROM utilisateurs WHERE id = ? AND etat > 0', [destId]);
  if (!userExists) {
    throw new Error(`Utilisateur destinataire (ID: ${destId}) non trouvé ou inactif`);
  }

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  await query(`
    INSERT INTO notifications (type, id_fiche, message, destination, date_creation, lu)
    VALUES (?, ?, ?, ?, ?, 0)
  `, [type.trim(), eventData.fiche?.id || null, processedMessage.trim(), destId, now]);

  return { success: true, message: 'Notification créée' };
}
```

### Solution 2 : Validation dans Routes de Notification

```javascript
router.post('/', authenticate, async (req, res) => {
  try {
    const { type, id_fiche, fiche_hash, message, destination, date_rdv_time, metadata } = req.body;

    // Validation stricte
    if (!type || typeof type !== 'string' || type.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Type de notification requis et non vide'
      });
    }

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Message de notification requis et non vide'
      });
    }

    if (!destination || (typeof destination !== 'number' && typeof destination !== 'string')) {
      return res.status(400).json({
        success: false,
        message: 'Destinataire requis'
      });
    }

    // Vérifier que le destinataire existe
    const userExists = await queryOne('SELECT id FROM utilisateurs WHERE id = ? AND etat > 0', [destination]);
    if (!userExists) {
      return res.status(400).json({
        success: false,
        message: 'Destinataire non trouvé ou inactif'
      });
    }

    // ... reste du code
  }
});
```

### Solution 3 : Nettoyer les Notifications NULL Existantes

Script SQL pour identifier et supprimer les notifications NULL :

```sql
-- Identifier les notifications avec des valeurs NULL critiques
SELECT 
  id,
  type,
  id_fiche,
  message,
  destination,
  date_creation,
  lu
FROM notifications
WHERE (type IS NULL OR type = '')
   OR (message IS NULL OR message = '')
   OR (destination IS NULL)
   OR (date_creation IS NULL);

-- Supprimer les notifications invalides (à exécuter avec précaution)
DELETE FROM notifications
WHERE (type IS NULL OR type = '')
   OR (message IS NULL OR message = '')
   OR (destination IS NULL)
   OR (date_creation IS NULL);
```

### Solution 4 : Contraintes de Base de Données

Ajouter des contraintes NOT NULL sur les colonnes critiques :

```sql
-- Vérifier les contraintes actuelles
SHOW CREATE TABLE notifications;

-- Ajouter des contraintes (si la table le permet)
ALTER TABLE notifications 
  MODIFY COLUMN type varchar(50) NOT NULL,
  MODIFY COLUMN message text NOT NULL,
  MODIFY COLUMN destination int(11) NOT NULL,
  MODIFY COLUMN date_creation datetime NOT NULL;
```

**Note** : Cette modification peut échouer si des lignes NULL existent déjà. Il faut d'abord nettoyer les données.

---

## Actions Immédiates Recommandées

1. **Nettoyer les données existantes** : Exécuter le script SQL pour supprimer les notifications NULL
2. **Ajouter des validations** : Implémenter les validations dans `workflow-executor.js` et `notification.routes.js`
3. **Ajouter des logs** : Logger toutes les tentatives de création de notification avec valeurs NULL
4. **Ajouter des contraintes** : Après nettoyage, ajouter des contraintes NOT NULL sur les colonnes critiques
5. **Monitoring** : Créer une requête de monitoring pour détecter les nouvelles notifications NULL

---

## Requête de Diagnostic

Pour identifier les notifications NULL :

```sql
SELECT 
  id,
  type,
  id_fiche,
  message,
  destination,
  date_creation,
  lu,
  metadata,
  action,
  CASE 
    WHEN type IS NULL OR type = '' THEN 'type NULL'
    WHEN message IS NULL OR message = '' THEN 'message NULL'
    WHEN destination IS NULL THEN 'destination NULL'
    WHEN date_creation IS NULL THEN 'date_creation NULL'
    ELSE 'OK'
  END as probleme
FROM notifications
WHERE type IS NULL 
   OR type = ''
   OR message IS NULL 
   OR message = ''
   OR destination IS NULL
   OR date_creation IS NULL
ORDER BY date_creation DESC
LIMIT 100;
```

---

*Document généré le : 2026-01-22*  
*Version : 1.0*

