# Guide de test de l'importation en masse

Ce guide explique comment tester l'importation en masse sans avoir besoin d'un fichier CSV.

## Fichiers de test créés

1. **test_contacts.json** - 10 contacts de test au format JSON
2. **test_contacts.csv** - 10 contacts de test au format CSV (pour test avec fichier)
3. **backend/routes/test-import.routes.js** - Routes de test pour l'importation

## Contacts de test

Les 10 contacts incluent :
- Nom, Prénom
- Téléphone (tel, gsm1, gsm2)
- Email
- Adresse complète (adresse, cp, ville)
- Civilité (MR/MME)

## Utilisation des routes de test

### 1. Prévisualiser les contacts de test

**Endpoint:** `GET /api/import/test-contacts/preview`

**Headers:**
```
Authorization: Bearer <votre_token>
```

**Réponse:**
```json
{
  "success": true,
  "data": {
    "fileColumns": ["nom", "prenom", "tel", "gsm1", ...],
    "previewData": [...],
    "totalRows": 10
  },
  "fields": [...]
}
```

### 2. Importer les contacts de test

**Endpoint:** `POST /api/import/test-contacts/process`

**Headers:**
```
Authorization: Bearer <votre_token>
Content-Type: application/json
```

**Body:**
```json
{
  "mapping": {
    "nom": "nom",
    "prenom": "prenom",
    "tel": "tel",
    "gsm1": "gsm1",
    "gsm2": "gsm2",
    "email": "email",
    "adresse": "adresse",
    "cp": "cp",
    "ville": "ville",
    "civ": "civ"
  },
  "id_centre": 1
}
```

**Réponse:**
```json
{
  "success": true,
  "message": "Importation de test terminée",
  "data": {
    "total": 10,
    "inserted": 8,
    "duplicates": 2,
    "duplicatesList": [...],
    "errors": 0,
    "errorsList": []
  }
}
```

## Exemple avec cURL

### Prévisualiser
```bash
curl -X GET http://localhost:5000/api/import/test-contacts/preview \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Importer
```bash
curl -X POST http://localhost:5000/api/import/test-contacts/process \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mapping": {
      "nom": "nom",
      "prenom": "prenom",
      "tel": "tel",
      "gsm1": "gsm1",
      "email": "email",
      "adresse": "adresse",
      "cp": "cp",
      "ville": "ville",
      "civ": "civ"
    },
    "id_centre": 1
  }'
```

## Exemple avec JavaScript/Fetch

```javascript
// Prévisualiser
const previewResponse = await fetch('http://localhost:5000/api/import/test-contacts/preview', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const previewData = await previewResponse.json();
console.log('Colonnes disponibles:', previewData.data.fileColumns);

// Importer
const importResponse = await fetch('http://localhost:5000/api/import/test-contacts/process', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    mapping: {
      nom: 'nom',
      prenom: 'prenom',
      tel: 'tel',
      gsm1: 'gsm1',
      email: 'email',
      adresse: 'adresse',
      cp: 'cp',
      ville: 'ville',
      civ: 'civ'
    },
    id_centre: 1
  })
});
const importResult = await importResponse.json();
console.log('Résultat:', importResult);
```

## Notes importantes

1. **Mapping obligatoire** : Au moins un champ de téléphone (tel, gsm1 ou gsm2) doit être mappé
2. **Centre requis** : L'ID du centre doit être fourni
3. **Permissions** : L'utilisateur doit avoir la permission `fiches_create`
4. **Doublons** : Les contacts avec des numéros de téléphone existants seront détectés comme doublons

## Dépannage

### Erreur "Mapping requis"
Vérifiez que vous envoyez bien le champ `mapping` dans le body de la requête.

### Erreur "Centre requis"
Vérifiez que vous envoyez bien le champ `id_centre` dans le body de la requête.

### Erreur "Aucun numéro de téléphone"
Assurez-vous que le mapping inclut au moins un des champs : `tel`, `gsm1`, ou `gsm2`.

### Aucun contact inséré
Vérifiez les logs du serveur pour voir les erreurs détaillées. Les contacts peuvent être rejetés s'ils :
- N'ont pas de numéro de téléphone valide
- Sont des doublons (téléphone déjà existant)
- Ont des erreurs de validation

