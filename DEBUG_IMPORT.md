# Guide de débogage de l'importation

## Problèmes identifiés et solutions

### 1. Filtrage trop agressif
**Problème:** Le filtrage des en-têtes supprimait parfois toutes les lignes de données.

**Solution:**
- Filtrage moins agressif pour les fichiers JSON/JSONL (pas d'en-têtes)
- Seuil de détection d'en-têtes augmenté à 90% (au lieu de 80%)
- Minimum de 3 colonnes requis pour détecter un en-tête

### 2. Détection des téléphones améliorée
**Problème:** Les numéros de téléphone n'étaient pas toujours correctement détectés.

**Solution:**
- Recherche améliorée dans toutes les clés possibles
- Nettoyage automatique des numéros avec `cleanPhoneNumber()`
- Support de différentes variantes de noms de colonnes

### 3. Messages d'erreur améliorés
**Problème:** Les erreurs n'étaient pas assez explicites.

**Solution:**
- Messages d'erreur détaillés avec raisons
- Analyse des données pour comprendre pourquoi elles sont rejetées
- Logs de débogage améliorés

## Route de diagnostic

Une nouvelle route de diagnostic a été ajoutée pour identifier les problèmes :

**Endpoint:** `POST /api/import/diagnose`

**Utilisation:**
```bash
curl -X POST http://localhost:5000/api/import/diagnose \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@votre_fichier.csv"
```

**Réponse:**
```json
{
  "success": true,
  "diagnosis": {
    "fileName": "contacts.csv",
    "fileSize": 1234,
    "fileExtension": ".csv",
    "steps": [
      {
        "step": "1. Parsing",
        "status": "success",
        "dataRows": 10
      },
      {
        "step": "2. Détection colonnes",
        "status": "success",
        "columns": ["nom", "prenom", "tel"],
        "columnCount": 3
      },
      {
        "step": "3. Filtrage",
        "status": "success",
        "originalRows": 10,
        "filteredRows": 10,
        "removedRows": 0
      },
      {
        "step": "4. Analyse téléphones",
        "status": "success",
        "analysis": {
          "hasTel": 10,
          "hasGsm1": 5,
          "hasGsm2": 2,
          "hasAnyPhone": 10,
          "noPhone": 0
        }
      }
    ]
  },
  "recommendation": "Le fichier semble correct. Vous pouvez procéder à l'import."
}
```

## Vérifications à faire

### 1. Vérifier le format du fichier
- CSV: Séparateur correct (virgule, point-virgule, tabulation)
- Excel: Format .xlsx ou .xls valide
- JSON: Syntaxe JSON valide
- JSONL: Chaque ligne est un objet JSON valide

### 2. Vérifier les colonnes
- Les colonnes doivent contenir des données
- Au moins une colonne de téléphone (tel, gsm1, ou gsm2) doit être présente
- Les noms de colonnes doivent correspondre au mapping

### 3. Vérifier les données
- Les lignes ne doivent pas être complètement vides
- Au moins un numéro de téléphone par contact
- Les numéros de téléphone doivent être valides (contiennent des chiffres)

### 4. Vérifier le mapping
- Le mapping doit associer au moins un champ de téléphone
- Les noms de colonnes dans le mapping doivent correspondre aux colonnes du fichier

## Logs de débogage

Les logs du serveur contiennent maintenant plus d'informations :

1. **Lors de la prévisualisation:**
   - Nombre de lignes parsées
   - Colonnes détectées
   - Lignes filtrées

2. **Lors du traitement:**
   - Mapping utilisé
   - Premier contact avec détails
   - Vérification des téléphones
   - Progression de l'import

3. **En cas d'erreur:**
   - Détails de l'erreur SQL
   - Contact qui a causé l'erreur
   - Stack trace

## Solutions aux problèmes courants

### Problème: "Aucune donnée valide trouvée"
**Causes possibles:**
- Toutes les lignes sont vides
- Toutes les lignes sont détectées comme en-têtes
- Format de fichier incorrect

**Solutions:**
1. Utiliser la route `/diagnose` pour identifier le problème
2. Vérifier que le fichier contient des données
3. Pour CSV, vérifier le séparateur
4. Pour JSON, vérifier la syntaxe

### Problème: "Aucun numéro de téléphone valide"
**Causes possibles:**
- Les colonnes de téléphone ne sont pas mappées
- Les valeurs sont vides ou invalides
- Les noms de colonnes ne correspondent pas

**Solutions:**
1. Vérifier le mapping des colonnes tel/gsm1/gsm2
2. Vérifier que les colonnes contiennent des numéros
3. Utiliser la route `/test-mapping` pour tester le mapping

### Problème: "Tous les contacts sont des doublons"
**Causes possibles:**
- Les contacts existent déjà dans la base
- Les numéros de téléphone sont identiques

**Solutions:**
1. Vérifier dans la base de données si les contacts existent
2. Modifier les numéros de téléphone pour tester
3. Vérifier la logique de détection des doublons

## Test rapide

Pour tester rapidement avec un fichier JSONL :

1. Utilisez le fichier `test_contacts.jsonl` fourni
2. Ou créez votre propre fichier JSONL avec ce format :
```jsonl
{"nom":"Test","prenom":"User","tel":"0999999999","adresse":"123 Test","cp":"75001","ville":"Paris","civ":"MR"}
```

3. Uploadez via l'interface ou l'API
4. Vérifiez les logs du serveur pour voir ce qui se passe

