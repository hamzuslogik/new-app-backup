# Guide d'importation avec fichiers JSON/JSONL

Le système d'importation supporte maintenant les formats **JSON** et **JSONL** (JSON Lines) en plus des formats CSV et Excel.

## Formats supportés

### 1. JSONL (JSON Lines) - Recommandé
Format où **chaque ligne est un objet JSON** séparé par un retour à la ligne.

**Exemple:**
```jsonl
{"nom":"Dupont","prenom":"Jean","tel":"0123456789","gsm1":"0612345678","adresse":"123 Rue de la République","cp":"75001","ville":"Paris","civ":"MR"}
{"nom":"Martin","prenom":"Marie","tel":"0234567890","gsm1":"0623456789","adresse":"456 Avenue des Champs","cp":"69001","ville":"Lyon","civ":"MME"}
{"nom":"Bernard","prenom":"Pierre","tel":"0345678901","gsm2":"0634567890","adresse":"789 Boulevard Saint-Michel","cp":"13001","ville":"Marseille","civ":"MR"}
```

**Avantages:**
- ✅ Facile à générer ligne par ligne
- ✅ Pas besoin de parser tout le fichier en mémoire
- ✅ Format standard pour les gros volumes de données
- ✅ Chaque ligne est indépendante (si une ligne est invalide, les autres sont traitées)

### 2. JSON (Tableau d'objets)
Format JSON classique avec un tableau d'objets.

**Exemple:**
```json
[
  {
    "nom": "Dupont",
    "prenom": "Jean",
    "tel": "0123456789",
    "gsm1": "0612345678",
    "adresse": "123 Rue de la République",
    "cp": "75001",
    "ville": "Paris",
    "civ": "MR"
  },
  {
    "nom": "Martin",
    "prenom": "Marie",
    "tel": "0234567890",
    "gsm1": "0623456789",
    "adresse": "456 Avenue des Champs",
    "cp": "69001",
    "ville": "Lyon",
    "civ": "MME"
  }
]
```

**Avantages:**
- ✅ Format JSON standard
- ✅ Facile à lire et modifier
- ✅ Supporte les structures complexes

## Structure des données

Chaque objet JSON doit contenir les champs suivants (au moins un téléphone est obligatoire) :

### Champs obligatoires
- **Au moins un de ces champs** : `tel`, `gsm1`, ou `gsm2`

### Champs optionnels
- `nom` - Nom de famille
- `prenom` - Prénom
- `tel` - Téléphone fixe
- `gsm1` - GSM 1
- `gsm2` - GSM 2
- `adresse` - Adresse complète
- `cp` - Code postal
- `ville` - Ville
- `civ` - Civilité (MR, MME)
- `email` - Email (sera ignoré car la colonne n'existe pas dans la table)
- Tous les autres champs de la table `fiches`

## Utilisation

### Via l'interface web

1. Allez sur la page **Import en Masse**
2. Cliquez sur **Choisir un fichier**
3. Sélectionnez votre fichier `.json` ou `.jsonl`
4. Cliquez sur **Charger et prévisualiser**
5. Configurez le mapping des colonnes
6. Sélectionnez le centre
7. Cliquez sur **Importer les fiches**

### Via l'API

**Endpoint:** `POST /api/import/preview`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Body:**
- `file`: Fichier JSON ou JSONL

**Réponse:**
```json
{
  "success": true,
  "data": {
    "fileColumns": ["nom", "prenom", "tel", ...],
    "previewData": [...],
    "totalRows": 10
  }
}
```

## Exemple de fichier JSONL

Un fichier `contacts.jsonl` avec 10 contacts est disponible dans le projet :
- `nouvelle_application/test_contacts.jsonl`

Vous pouvez l'utiliser comme modèle pour créer vos propres fichiers.

## Avantages du format JSON/JSONL

### Comparé au CSV

| Aspect | CSV | JSON/JSONL |
|--------|-----|-------------|
| **Structure** | Colonnes fixes | Flexible, champs optionnels |
| **Types de données** | Tout en string | Types natifs (nombre, booléen, etc.) |
| **Caractères spéciaux** | Problèmes avec guillemets, virgules | Géré automatiquement |
| **Encodage** | Problèmes fréquents | UTF-8 par défaut |
| **Validation** | Manuelle | Validation JSON automatique |
| **Lignes invalides** | Peut casser tout le fichier | Lignes indépendantes |

### Cas d'usage recommandés

**Utilisez JSONL si :**
- Vous avez beaucoup de données (milliers de lignes)
- Vous générez les données programmatiquement
- Vous voulez traiter ligne par ligne
- Vous avez des caractères spéciaux dans les données

**Utilisez JSON si :**
- Vous avez peu de données (< 1000 lignes)
- Vous voulez un format lisible
- Vous avez besoin de structures complexes

## Dépannage

### Erreur "Format de fichier non supporté"
- Vérifiez que l'extension est `.json` ou `.jsonl`
- Vérifiez que le fichier est bien un JSON valide

### Erreur "Erreur lors de la lecture du fichier JSON"
- Vérifiez la syntaxe JSON (utilisez un validateur JSON)
- Pour JSONL, vérifiez que chaque ligne est un objet JSON valide
- Vérifiez l'encodage (doit être UTF-8)

### Lignes ignorées
- Les lignes qui ne sont pas des objets JSON valides sont ignorées
- Vérifiez les logs du serveur pour voir quelles lignes sont ignorées

## Exemple de génération JSONL

### En Python
```python
import json

contacts = [
    {"nom": "Dupont", "prenom": "Jean", "tel": "0123456789"},
    {"nom": "Martin", "prenom": "Marie", "tel": "0234567890"}
]

with open('contacts.jsonl', 'w', encoding='utf-8') as f:
    for contact in contacts:
        f.write(json.dumps(contact, ensure_ascii=False) + '\n')
```

### En JavaScript/Node.js
```javascript
const fs = require('fs');

const contacts = [
  {nom: "Dupont", prenom: "Jean", tel: "0123456789"},
  {nom: "Martin", prenom: "Marie", tel: "0234567890"}
];

const jsonl = contacts.map(c => JSON.stringify(c)).join('\n');
fs.writeFileSync('contacts.jsonl', jsonl, 'utf8');
```

### En PHP
```php
$contacts = [
    ["nom" => "Dupont", "prenom" => "Jean", "tel" => "0123456789"],
    ["nom" => "Martin", "prenom" => "Marie", "tel" => "0234567890"]
];

$file = fopen('contacts.jsonl', 'w');
foreach ($contacts as $contact) {
    fwrite($file, json_encode($contact, JSON_UNESCAPED_UNICODE) . "\n");
}
fclose($file);
```

