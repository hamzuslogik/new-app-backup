# Guide de conversion vers JSONL

## Pourquoi convertir en JSONL ?

Le format JSONL (JSON Lines) est **plus fiable** pour l'importation car :
- ✅ Pas de problèmes d'encodage
- ✅ Pas de problèmes avec les caractères spéciaux
- ✅ Pas de problèmes avec les séparateurs
- ✅ Format simple et standard
- ✅ Facile à générer

## Méthodes de conversion

### Méthode 1 : Script Node.js (Recommandé)

**Script disponible:** `backend/convert_to_jsonl.js`

**Utilisation:**
```bash
cd backend
node convert_to_jsonl.js votre_fichier.csv
```

**Exemples:**
```bash
# Convertir CSV en JSONL
node convert_to_jsonl.js contacts.csv contacts.jsonl

# Convertir Excel en JSONL
node convert_to_jsonl.js contacts.xlsx contacts.jsonl

# Le fichier de sortie sera créé automatiquement si non spécifié
node convert_to_jsonl.js data.csv  # Crée data.jsonl
```

**Avantages:**
- ✅ Supporte CSV, Excel, JSON
- ✅ Détection automatique du séparateur CSV
- ✅ Nettoyage automatique des données
- ✅ Affiche un aperçu des données

### Méthode 2 : Interface Web

**Fichier disponible:** `convert_file.html`

1. Ouvrez le fichier `convert_file.html` dans votre navigateur
2. Glissez-déposez votre fichier CSV/Excel/JSON
3. Cliquez sur "Convertir en JSONL"
4. Le fichier JSONL sera téléchargé automatiquement

**Note:** Pour les fichiers Excel, vous devrez peut-être utiliser le script Node.js car la bibliothèque XLSX est requise.

### Méthode 3 : Conversion manuelle

#### Depuis CSV

**Format CSV:**
```csv
nom,prenom,tel,gsm1,adresse,cp,ville,civ
Dupont,Jean,0123456789,0612345678,"123 Rue",75001,Paris,MR
Martin,Marie,0234567890,0623456789,"456 Avenue",69001,Lyon,MME
```

**Format JSONL résultant:**
```jsonl
{"nom":"Dupont","prenom":"Jean","tel":"0123456789","gsm1":"0612345678","adresse":"123 Rue","cp":"75001","ville":"Paris","civ":"MR"}
{"nom":"Martin","prenom":"Marie","tel":"0234567890","gsm1":"0623456789","adresse":"456 Avenue","cp":"69001","ville":"Lyon","civ":"MME"}
```

#### Depuis Excel

1. Ouvrez votre fichier Excel
2. Exportez en CSV (Fichier > Enregistrer sous > CSV)
3. Utilisez le script pour convertir le CSV en JSONL

#### Depuis JSON

**Format JSON (tableau):**
```json
[
  {"nom":"Dupont","prenom":"Jean","tel":"0123456789"},
  {"nom":"Martin","prenom":"Marie","tel":"0234567890"}
]
```

**Format JSONL résultant:**
```jsonl
{"nom":"Dupont","prenom":"Jean","tel":"0123456789"}
{"nom":"Martin","prenom":"Marie","tel":"0234567890"}
```

### Méthode 4 : Conversion programmatique

#### En Python
```python
import csv
import json

def csv_to_jsonl(csv_file, jsonl_file):
    with open(csv_file, 'r', encoding='utf-8') as csvf:
        reader = csv.DictReader(csvf)
        with open(jsonl_file, 'w', encoding='utf-8') as jsonlf:
            for row in reader:
                # Nettoyer les valeurs vides
                cleaned = {k: v for k, v in row.items() if v and v.strip()}
                if cleaned:  # Ignorer les lignes vides
                    jsonlf.write(json.dumps(cleaned, ensure_ascii=False) + '\n')

csv_to_jsonl('contacts.csv', 'contacts.jsonl')
```

#### En JavaScript/Node.js
```javascript
const fs = require('fs');
const csv = require('csv-parser');

const results = [];
fs.createReadStream('contacts.csv')
  .pipe(csv())
  .on('data', (data) => results.push(data))
  .on('end', () => {
    const jsonl = results
      .map(obj => JSON.stringify(obj))
      .join('\n');
    fs.writeFileSync('contacts.jsonl', jsonl, 'utf8');
  });
```

#### En PHP
```php
<?php
$csvFile = 'contacts.csv';
$jsonlFile = 'contacts.jsonl';

if (($handle = fopen($csvFile, "r")) !== FALSE) {
    $headers = fgetcsv($handle); // Première ligne = en-têtes
    
    $jsonl = fopen($jsonlFile, 'w');
    
    while (($data = fgetcsv($handle)) !== FALSE) {
        $row = array_combine($headers, $data);
        // Nettoyer les valeurs vides
        $row = array_filter($row, function($v) {
            return $v !== '' && $v !== null;
        });
        if (!empty($row)) {
            fwrite($jsonl, json_encode($row, JSON_UNESCAPED_UNICODE) . "\n");
        }
    }
    
    fclose($handle);
    fclose($jsonl);
}
?>
```

## Structure attendue

Chaque ligne JSONL doit être un objet avec au moins un numéro de téléphone :

```jsonl
{"nom":"Dupont","prenom":"Jean","tel":"0123456789","adresse":"123 Rue","cp":"75001","ville":"Paris","civ":"MR"}
```

**Champs importants:**
- **Obligatoire:** Au moins un de `tel`, `gsm1`, ou `gsm2`
- **Optionnels:** `nom`, `prenom`, `adresse`, `cp`, `ville`, `civ`, etc.

## Vérification

Après conversion, vérifiez votre fichier JSONL :

1. **Ouvrez le fichier** dans un éditeur de texte
2. **Vérifiez que chaque ligne** est un objet JSON valide
3. **Testez avec un validateur JSON** ligne par ligne
4. **Vérifiez qu'il y a des numéros de téléphone**

## Exemple complet

**Fichier CSV source (`contacts.csv`):**
```csv
nom,prenom,tel,gsm1,adresse,cp,ville,civ
Dupont,Jean,0123456789,0612345678,"123 Rue de la République",75001,Paris,MR
Martin,Marie,0234567890,0623456789,"456 Avenue des Champs",69001,Lyon,MME
```

**Commande:**
```bash
cd backend
node convert_to_jsonl.js ../contacts.csv ../contacts.jsonl
```

**Fichier JSONL résultant (`contacts.jsonl`):**
```jsonl
{"nom":"Dupont","prenom":"Jean","tel":"0123456789","gsm1":"0612345678","adresse":"123 Rue de la République","cp":"75001","ville":"Paris","civ":"MR"}
{"nom":"Martin","prenom":"Marie","tel":"0234567890","gsm1":"0623456789","adresse":"456 Avenue des Champs","cp":"69001","ville":"Lyon","civ":"MME"}
```

## Dépannage

### Erreur "Format non supporté"
- Vérifiez l'extension du fichier (.csv, .xlsx, .xls, .json)
- Pour Excel, utilisez le script Node.js

### Erreur "Aucune donnée trouvée"
- Vérifiez que le fichier n'est pas vide
- Vérifiez l'encodage (doit être UTF-8)
- Pour CSV, vérifiez le séparateur

### Caractères spéciaux mal encodés
- Utilisez UTF-8 pour tous les fichiers
- Le JSONL gère automatiquement l'encodage UTF-8

