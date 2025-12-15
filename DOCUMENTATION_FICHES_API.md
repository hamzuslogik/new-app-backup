# Documentation API - Insertion et Modification de Fiches

## Table des matières
1. [Authentification](#authentification)
2. [Création d'une fiche](#création-dune-fiche)
3. [Modification complète d'une fiche](#modification-complète-dune-fiche)
4. [Modification d'un champ spécifique](#modification-dun-champ-spécifique)
5. [Champs disponibles](#champs-disponibles)
6. [Permissions requises](#permissions-requises)
7. [Validations et règles](#validations-et-règles)
8. [Exemples d'utilisation](#exemples-dutilisation)

---

## Authentification

### Type de token
L'API utilise des **tokens JWT (JSON Web Token)** envoyés comme **Bearer Token** dans les headers HTTP.

**Clarification** :
- **JWT** = Format du token (standard JSON Web Token - RFC 7519)
- **Bearer** = Méthode d'authentification HTTP (RFC 6750)
- Le token est un **JWT** envoyé via le schéma **Bearer** dans le header `Authorization`

### Format d'utilisation
```http
Authorization: Bearer <token_jwt>
```

**Exemple** :
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEyMywiaWF0IjoxNjE2MjM5MDIyfQ...
```

### Génération d'un token permanent
Pour les intégrations externes (comme Vicidial), vous pouvez générer un token permanent qui ne expire jamais :

**Via l'API** (nécessite d'être authentifié en tant qu'administrateur) :
```http
POST /api/auth/generate-permanent-token
Authorization: Bearer <votre_token_admin>
Content-Type: application/json

{
  "userId": 123  // Optionnel : si non fourni, utilise l'utilisateur connecté
}
```

**Via script Node.js** :
```bash
node backend/scripts/generate-permanent-token.js [userId|pseudo]
```

**Exemples** :
```bash
node backend/scripts/generate-permanent-token.js 123
node backend/scripts/generate-permanent-token.js USERNAME
```

---

## Création d'une fiche

### Endpoint
```
POST /api/fiches
```

### Authentification
Requiert un token JWT valide envoyé comme Bearer Token (voir section [Authentification](#authentification))

### Permission requise
`fiches_create`

### Description
Crée une nouvelle fiche dans le système. Le hash de l'ID est automatiquement calculé et stocké après l'insertion.

### Corps de la requête (JSON)

#### Champs obligatoires
Aucun champ n'est strictement obligatoire, mais il est recommandé d'inclure au moins :
- `nom` : Nom du client
- `prenom` : Prénom du client
- `tel` : Numéro de téléphone principal

#### Champs optionnels
Voir la section [Champs disponibles](#champs-disponibles) pour la liste complète.

### Comportement automatique

Lors de la création, le système applique automatiquement :

1. **Normalisation du téléphone** :
   - Si `tel` ne commence pas par `0`, un `0` est ajouté
   - Si `gsm1` est vide ou `0`, il est copié depuis `tel`
   - Si `gsm2` est vide ou `0`, il est copié depuis `tel`

2. **Valeurs par défaut** :
   - `id_agent` : ID de l'utilisateur connecté (ou valeur envoyée dans la requête si fournie, par exemple depuis l'intégration Vicidial)
   - `id_centre` : Centre de l'utilisateur connecté (si disponible)
   - `id_etat_final` : `1` (Nouveau) si non spécifié
   - `active` : `1`
   - `archive` : `0`
   - `ko` : `0`
   - `hc` : `0`
   - `valider` : `0`
   - `date_insert_time` : Date/heure actuelle
   - `date_modif_time` : Date/heure actuelle
   - `date_insert` : Timestamp Unix actuel

3. **Hash de l'ID** :
   - Après l'insertion, le hash de l'ID est calculé avec `encodeFicheId(insertId)`
   - Le hash est stocké dans la colonne `hash` de la table `fiches`

4. **Historique** :
   - Une entrée est créée dans `fiches_histo` avec l'état initial

### Réponse

#### Succès (201 Created)
```json
{
  "success": true,
  "message": "Fiche créée avec succès",
  "data": {
    "id": 12345
  }
}
```

#### Erreur (400 Bad Request)
```json
{
  "success": false,
  "message": "Aucun champ valide à insérer"
}
```

#### Erreur (500 Internal Server Error)
```json
{
  "success": false,
  "message": "Erreur lors de la création de la fiche",
  "error": "Message d'erreur détaillé"
}
```

---

## Modification complète d'une fiche

### Endpoint
```
PUT /api/fiches/:id
```

### Authentification
Requiert un token JWT valide envoyé comme Bearer Token (voir section [Authentification](#authentification))

### Permission requise
`fiches_edit`

### Description
Met à jour tous les champs d'une fiche. L'ID peut être fourni directement ou via son hash.

### Paramètres d'URL
- `id` : ID de la fiche (entier) ou hash de l'ID (string)

### Corps de la requête (JSON)
Tous les champs à modifier. Seuls les champs fournis seront mis à jour.

### Comportement automatique

1. **Historique des modifications** :
   - Les modifications sont enregistrées dans la table `modifica` (si elle existe)
   - Chaque champ modifié est loggé avec l'ancienne et la nouvelle valeur

2. **Changement d'état** :
   - Si `id_etat_final` est modifié, une entrée est créée dans `fiches_histo`
   - Si passage de l'état `CONFIRMER` (ID 7) à un état du groupe 2, `date_rdv_time` est automatiquement supprimée

3. **Date de modification** :
   - `date_modif_time` est automatiquement mise à jour avec la date/heure actuelle

### Réponse

#### Succès (200 OK)
```json
{
  "success": true,
  "message": "Fiche mise à jour avec succès",
  "data": {
    "id": 12345
  }
}
```

#### Erreur (404 Not Found)
```json
{
  "success": false,
  "message": "Fiche non trouvée"
}
```

#### Erreur (500 Internal Server Error)
```json
{
  "success": false,
  "message": "Erreur lors de la mise à jour de la fiche",
  "error": "Message d'erreur détaillé"
}
```

---

## Modification d'un champ spécifique

### Endpoint
```
PATCH /api/fiches/:id/field
```

### Authentification
Requiert un token JWT valide envoyé comme Bearer Token (voir section [Authentification](#authentification))

### Permission requise
Aucune permission spécifique requise (vérification basée sur le champ modifié)

### Description
Met à jour un seul champ d'une fiche. Utile pour des modifications rapides sans envoyer tous les champs.

### Paramètres d'URL
- `id` : ID de la fiche (entier) ou hash de l'ID (string)

### Corps de la requête (JSON)
```json
{
  "field": "nom_du_champ",
  "value": "nouvelle_valeur"
}
```

### Comportement automatique

1. **Historique des modifications** :
   - La modification est enregistrée dans `modifica` (si la table existe)

2. **Changement d'état** :
   - Si le champ modifié est `id_etat_final`, une entrée est créée dans `fiches_histo`
   - Si passage de l'état `CONFIRMER` (ID 7) à un état du groupe 2, `date_rdv_time` est automatiquement supprimée

3. **Date de modification** :
   - `date_modif_time` est automatiquement mise à jour

### Réponse

#### Succès (200 OK)
```json
{
  "success": true,
  "message": "Champ mis à jour avec succès",
  "data": {
    "field": "nom",
    "oldValue": "Dupont",
    "newValue": "Martin"
  }
}
```

#### Erreur (400 Bad Request)
```json
{
  "success": false,
  "message": "Le champ à modifier est requis"
}
```

#### Erreur (404 Not Found)
```json
{
  "success": false,
  "message": "Fiche non trouvée"
}
```

---

## Champs disponibles

### Informations personnelles
- `civ` : Civilité (MR, MME, MLLE, etc.)
- `nom` : Nom du client
- `prenom` : Prénom du client
- `tel` : Numéro de téléphone principal
- `gsm1` : Numéro de téléphone mobile 1
- `gsm2` : Numéro de téléphone mobile 2

### Adresse
- `adresse` : Adresse complète
- `cp` : Code postal
- `ville` : Ville

### Informations techniques
- `etude` : Type d'étude
- `produit` : ID du produit (1, 2, etc.)
- `consommation_chauffage` : Consommation de chauffage
- `surface_habitable` : Surface habitable
- `annee_systeme_chauffage` : Année du système de chauffage
- `surface_chauffee` : Surface chauffée
- `proprietaire_maison` : Propriétaire de la maison (OUI/NON)
- `nb_pieces` : Nombre de pièces
- `age_maison` : Âge de la maison
- `orientation_toiture` : Orientation de la toiture
- `nb_chemines` : Nombre de cheminées
- `mode_chauffage` : Mode de chauffage
- `consommation_electricite` : Consommation d'électricité

### Informations personnelles détaillées
- `age_mr` : Âge de monsieur
- `age_madame` : Âge de madame
- `revenu_foyer` : Revenu du foyer
- `credit_foyer` : Crédit du foyer
- `situation_conjugale` : Situation conjugale
- `nb_enfants` : Nombre d'enfants
- `profession_mr` : Profession de monsieur
- `profession_madame` : Profession de madame

### Assignations
- `id_agent` : ID de l'agent (automatique lors de la création)
- `id_centre` : ID du centre (automatique si non spécifié)
- `id_confirmateur` : ID du confirmateur principal
- `id_confirmateur_2` : ID du confirmateur secondaire
- `id_confirmateur_3` : ID du confirmateur tertiaire
- `id_commercial` : ID du commercial
- `id_commercial_2` : ID du commercial secondaire
- `id_qualite` : ID de la qualité
- `id_qualif` : ID de la qualification

### État et dates
- `id_etat_final` : ID de l'état final (défaut: 1)
- `date_appel` : Date d'appel (timestamp Unix)
- `date_audit` : Date d'audit (timestamp Unix)
- `date_confirmation` : Date de confirmation (timestamp Unix)
- `date_qualif` : Date de qualification (timestamp Unix)
- `date_rdv` : Date de rendez-vous (timestamp Unix)
- `date_rdv_time` : Date/heure de rendez-vous (datetime)
- `date_affect` : Date d'affectation (timestamp Unix)
- `date_sign` : Date de signature (timestamp Unix)
- `date_sign_time` : Date/heure de signature (datetime)

### Champs système
- `active` : Fiche active (0 ou 1, défaut: 1)
- `archive` : Fiche archivée (0 ou 1, défaut: 0)
- `ko` : Fiche KO (0 ou 1, défaut: 0)
- `hc` : Fiche HC (0 ou 1, défaut: 0)
- `valider` : Fiche validée (0 ou 1, défaut: 0)
- `hash` : Hash de l'ID (calculé automatiquement, ne pas fournir)

### Commentaires
- `commentaire` : Commentaire général
- `conf_commentaire_produit` : Commentaire produit (confirmation)
- `conf_consommations` : Consommations (confirmation)
- `conf_profession_monsieur` : Profession monsieur (confirmation)
- `conf_profession_madame` : Profession madame (confirmation)
- `conf_presence_couple` : Présence du couple (confirmation)
- `conf_produit` : Produit (confirmation)
- `conf_orientation_toiture` : Orientation toiture (confirmation)
- `conf_zones_ombres` : Zones d'ombres (confirmation)
- `conf_site_classe` : Site classé (confirmation)
- `conf_consommation_electricite` : Consommation électricité (confirmation)
- `conf_rdv_avec` : RDV avec (confirmation)

### Phase 3 (Installation)
- `ph3_installateur` : Installateur
- `ph3_pac` : PAC
- `ph3_puissance` : Puissance
- `ph3_puissance_pv` : Puissance PV
- `ph3_rr_model` : Modèle RR
- `ph3_ballon` : Ballon
- `ph3_marque_ballon` : Marque du ballon
- `ph3_alimentation` : Alimentation
- `ph3_type` : Type
- `ph3_prix` : Prix
- `ph3_bonus_30` : Bonus 30%
- `ph3_mensualite` : Mensualité
- `ph3_attente` : Attente
- `nbr_annee_finance` : Nombre d'années de financement
- `credit_immobilier` : Crédit immobilier
- `credit_autre` : Autre crédit

### Autres
- `cq_etat` : État CQ
- `cq_dossier` : Dossier CQ

---

## Permissions requises

### Création
- **Permission** : `fiches_create`
- **Vérification** : Via `checkPermissionCode('fiches_create')`

### Modification complète
- **Permission** : `fiches_edit`
- **Vérification** : Via `checkPermissionCode('fiches_edit')`

### Modification d'un champ
- **Permission** : Aucune permission spécifique requise
- **Vérification** : Basée sur le champ modifié et le rôle de l'utilisateur

---

## Validations et règles

### Règles de validation

1. **Téléphone** :
   - Si `tel` ne commence pas par `0`, un `0` est automatiquement ajouté
   - `gsm1` et `gsm2` sont automatiquement remplis avec `tel` s'ils sont vides

2. **État final** :
   - Si non spécifié lors de la création, `id_etat_final` est défini à `1` (Nouveau)
   - Si passage de l'état `CONFIRMER` (ID 7) à un état du groupe 2, `date_rdv_time` est automatiquement supprimée

3. **Dates** :
   - Les dates au format timestamp Unix sont acceptées pour les champs `date_*`
   - Les dates au format datetime sont acceptées pour les champs `*_time`
   - `date_insert_time` et `date_modif_time` sont automatiquement gérées

4. **Champs système** :
   - `id_agent` est automatiquement défini à l'ID de l'utilisateur connecté
   - `id_centre` est automatiquement défini au centre de l'utilisateur si non spécifié
   - `hash` est automatiquement calculé après l'insertion (ne pas fournir)

5. **Historique** :
   - Toute modification de `id_etat_final` crée une entrée dans `fiches_histo`
   - Toute modification est enregistrée dans `modifica` (si la table existe)

---

## Exemples d'utilisation

### Exemple 1 : Création d'une fiche simple

```bash
curl -X POST https://api.example.com/api/fiches \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nom": "Dupont",
    "prenom": "Jean",
    "tel": "0612345678",
    "adresse": "123 Rue de la République",
    "cp": "75001",
    "ville": "Paris",
    "produit": 1,
    "id_etat_final": 1
  }'
```

**Réponse** :
```json
{
  "success": true,
  "message": "Fiche créée avec succès",
  "data": {
    "id": 12345
  }
}
```

### Exemple 2 : Modification complète d'une fiche

```bash
curl -X PUT https://api.example.com/api/fiches/12345 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nom": "Martin",
    "prenom": "Pierre",
    "tel": "0623456789",
    "id_etat_final": 7,
    "date_rdv_time": "2024-12-25 14:30:00"
  }'
```

**Réponse** :
```json
{
  "success": true,
  "message": "Fiche mise à jour avec succès",
  "data": {
    "id": 12345
  }
}
```

### Exemple 3 : Modification d'un champ spécifique

```bash
curl -X PATCH https://api.example.com/api/fiches/12345/field \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "field": "id_etat_final",
    "value": 7
  }'
```

**Réponse** :
```json
{
  "success": true,
  "message": "Champ mis à jour avec succès",
  "data": {
    "field": "id_etat_final",
    "oldValue": 1,
    "newValue": 7
  }
}
```

### Exemple 4 : Utilisation avec hash au lieu d'ID

```bash
# Le hash peut être utilisé à la place de l'ID dans l'URL
curl -X PUT https://api.example.com/api/fiches/a1b2c3d4e5f6g7h8 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nom": "Nouveau Nom"
  }'
```

### Exemple 5 : Création avec tous les champs

```bash
curl -X POST https://api.example.com/api/fiches \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "civ": "MR",
    "nom": "Dupont",
    "prenom": "Jean",
    "tel": "0612345678",
    "gsm1": "0612345678",
    "gsm2": "0612345678",
    "adresse": "123 Rue de la République",
    "cp": "75001",
    "ville": "Paris",
    "produit": 1,
    "id_centre": 1,
    "id_etat_final": 1,
    "consommation_chauffage": 15000,
    "surface_habitable": 100,
    "nb_pieces": 5,
    "proprietaire_maison": "OUI",
    "commentaire": "Client intéressé par une installation solaire"
  }'
```

---

## Notes importantes

1. **Hash automatique** : Le hash de l'ID est calculé et stocké automatiquement après chaque insertion. Ne pas fournir le champ `hash` dans les requêtes.

2. **Historique** : Toutes les modifications sont enregistrées dans `modifica` (si la table existe) et dans `fiches_histo` pour les changements d'état.

3. **Dates** : Les dates peuvent être fournies au format timestamp Unix (pour `date_*`) ou datetime (pour `*_time`).

4. **Validation** : Les champs non valides ou inexistants dans le schéma sont ignorés silencieusement.

5. **Permissions** : Vérifiez que vous avez les permissions nécessaires avant d'effectuer des opérations.

6. **Hash dans l'URL** : Vous pouvez utiliser le hash de l'ID au lieu de l'ID numérique dans les URLs pour plus de sécurité.

---

## Codes d'erreur

- **200 OK** : Opération réussie
- **201 Created** : Fiche créée avec succès
- **400 Bad Request** : Requête invalide (champs manquants, format incorrect)
- **401 Unauthorized** : Token d'authentification manquant ou invalide
- **403 Forbidden** : Permission insuffisante
- **404 Not Found** : Fiche non trouvée
- **500 Internal Server Error** : Erreur serveur

---

## Support

Pour toute question ou problème, contactez l'équipe de développement.

