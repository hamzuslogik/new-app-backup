# 🚀 Guide rapide : Convertir votre fichier en JSONL

## Méthode la plus simple (Recommandée)

### Étape 1 : Ouvrir le terminal
Ouvrez PowerShell ou CMD dans le dossier du projet.

### Étape 2 : Aller dans le dossier backend
```powershell
cd nouvelle_application\backend
```

### Étape 3 : Convertir votre fichier
```powershell
# Pour un fichier CSV
node convert_to_jsonl.js ..\votre_fichier.csv ..\votre_fichier.jsonl

# Pour un fichier Excel
node convert_to_jsonl.js ..\votre_fichier.xlsx ..\votre_fichier.jsonl

# Pour un fichier JSON
node convert_to_jsonl.js ..\votre_fichier.json ..\votre_fichier.jsonl
```

**Exemple concret :**
```powershell
# Si votre fichier s'appelle "mes_contacts.csv" et est dans le dossier racine
node convert_to_jsonl.js ..\mes_contacts.csv ..\mes_contacts.jsonl
```

### Étape 4 : Utiliser le fichier JSONL
Une fois converti, vous pouvez utiliser le fichier `.jsonl` dans l'interface d'importation du CRM.

## Alternative : Interface Web

1. Ouvrez le fichier `convert_file.html` dans votre navigateur
2. Glissez-déposez votre fichier
3. Cliquez sur "Convertir en JSONL"
4. Le fichier sera téléchargé automatiquement

## Formats supportés

✅ **CSV** (.csv, .txt)
✅ **Excel** (.xlsx, .xls)
✅ **JSON** (.json)
✅ **JSONL** (.jsonl) - peut être reconverti pour nettoyer

## Exemple complet

**Votre fichier CSV (`contacts.csv`) :**
```csv
nom,prenom,tel,gsm1,adresse,cp,ville
Dupont,Jean,0123456789,0612345678,"123 Rue",75001,Paris
Martin,Marie,0234567890,0623456789,"456 Avenue",69001,Lyon
```

**Commande :**
```powershell
cd nouvelle_application\backend
node convert_to_jsonl.js ..\contacts.csv ..\contacts.jsonl
```

**Résultat (`contacts.jsonl`) :**
```jsonl
{"nom":"Dupont","prenom":"Jean","tel":"0123456789","gsm1":"0612345678","adresse":"123 Rue","cp":"75001","ville":"Paris"}
{"nom":"Martin","prenom":"Marie","tel":"0234567890","gsm1":"0623456789","adresse":"456 Avenue","cp":"69001","ville":"Lyon"}
```

## Vérification

Après conversion, ouvrez le fichier `.jsonl` dans un éditeur de texte et vérifiez que :
- ✅ Chaque ligne est un objet JSON valide
- ✅ Il y a au moins un numéro de téléphone par ligne (`tel`, `gsm1`, ou `gsm2`)
- ✅ Les caractères spéciaux sont correctement encodés

## Problèmes courants

### "Format non supporté"
- Vérifiez l'extension du fichier
- Les formats supportés sont : .csv, .txt, .xlsx, .xls, .json, .jsonl

### "Aucune donnée trouvée"
- Vérifiez que le fichier n'est pas vide
- Vérifiez l'encodage (doit être UTF-8)

### "Erreur de parsing"
- Pour CSV : vérifiez le séparateur (virgule, point-virgule, tabulation)
- Pour Excel : vérifiez que le fichier n'est pas corrompu
- Pour JSON : vérifiez la syntaxe JSON

## Besoin d'aide ?

Si vous rencontrez des problèmes :
1. Vérifiez les logs du script (messages en couleur)
2. Vérifiez que le fichier source est valide
3. Essayez avec un petit fichier de test d'abord

