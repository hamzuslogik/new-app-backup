# Guide : Comment rédiger un compte rendu en tant que commercial

## 📋 Vue d'ensemble

En tant que commercial (fonction 5), vous pouvez rédiger des comptes rendus pour documenter vos visites et interactions avec les clients. **Important** : Les comptes rendus ne sont enregistrés que lorsque vous changez l'état d'une fiche vers un état de **Phase 3** (états finaux).

## 🎯 Quand pouvez-vous rédiger un compte rendu ?

Les comptes rendus sont automatiquement créés **uniquement** lorsque vous modifiez l'état d'une fiche vers un état appartenant à la **Phase 3** (groupe = 3).

### États de Phase 3 (exemples courants) :
- **État 13** : SIGNER
- **État 16** : SIGNER RETRACTER  
- **État 38** : (État Phase 3)
- **État 44** : SIGNER PM
- **État 45** : SIGNER COMPLET
- Et tous les autres états configurés avec le groupe = 3

> ⚠️ **Note importante** : Si vous changez l'état vers un état de Phase 1 ou Phase 2, aucun compte rendu ne sera créé, même si vous remplissez le champ commentaire.

## 📝 Comment rédiger un compte rendu

### Étape 1 : Accéder à la fiche
1. Naviguez vers la page de détail de la fiche concernée
2. Vous pouvez y accéder depuis :
   - La liste des fiches
   - Le planning
   - Les résultats de recherche

### Étape 2 : Changer l'état vers Phase 3
1. Dans la page de détail de la fiche, cliquez sur **"Changer d'état"** ou sélectionnez un état dans la liste
2. **Sélectionnez un état de Phase 3** (les états sont généralement organisés par groupes : Phase 1, Phase 2, Phase 3)
3. Un formulaire spécifique à l'état sélectionné s'affichera

### Étape 3 : Remplir le formulaire
Selon l'état de Phase 3 sélectionné, vous devrez remplir différents champs :

#### Pour les états SIGNER (13, 44, 45) :
- **Date de signature** : Date et heure de la signature
- **Produit** : Type de produit (PAC ou PV)
- **Commercial** : Vous-même ou un autre commercial
- **Sous-état** : Sous-état spécifique si applicable
- **Informations Phase 3** : Détails techniques (puissance, installateur, prix, etc.)
- **Commentaire** : ⭐ **C'est ici que vous rédigez votre compte rendu**

#### Pour les autres états de Phase 3 :
- Les champs varient selon l'état
- **Commentaire** : Toujours présent pour rédiger votre compte rendu

### Étape 4 : Rédiger votre commentaire
Dans le champ **"Commentaire"** (ou **"conf_commentaire_produit"**), rédigez votre compte rendu :

**Exemples de contenu à inclure :**
- Résumé de la visite/entretien
- Intérêt du client
- Points discutés
- Remarques importantes
- Prochaines étapes
- Informations techniques relevées
- Objections ou questions du client

**Exemple de compte rendu :**
```
Client très intéressé par l'installation d'une PAC. 
Visite effectuée le 15/01/2024. 
Surface à chauffer : 120m². 
Consommation actuelle : 2000€/an en gaz.
Client souhaite un devis détaillé avec financement.
Rendez-vous de suivi prévu dans 2 semaines.
```

### Étape 5 : Enregistrer
1. Remplissez tous les champs obligatoires du formulaire
2. Cliquez sur le bouton de validation (ex: "Enregistrer", "Confirmer", etc.)
3. Le compte rendu sera automatiquement créé

## 🔄 Format du compte rendu enregistré

Le système enregistre automatiquement votre compte rendu avec le format suivant :

### Si la fiche a une qualification :
```
[QUALIFICATION_CODE] votre commentaire
```

**Exemple :**
```
[RDV_URGENT] Client très intéressé, souhaite signer rapidement. 
Visite effectuée, toutes les informations confirmées.
```

### Si la fiche n'a pas de qualification :
```
votre commentaire
```

**Exemple :**
```
Client intéressé par l'installation. 
Visite prévue la semaine prochaine.
```

## 📊 Informations automatiquement incluses

Lors de l'enregistrement, le système inclut automatiquement :

- ✅ **Votre identité** : Vous êtes automatiquement identifié comme le commercial
- ✅ **La qualification** : Si la fiche a une qualification (ex: RDV_URGENT), elle est ajoutée entre crochets
- ✅ **L'état de la fiche** : L'état Phase 3 sélectionné
- ✅ **La date de visite** : Déterminée automatiquement selon :
  - Date de rendez-vous (conf_rdv_date + conf_rdv_time)
  - Date d'appel (date_appel_date + date_appel_date_time)
  - Date de signature (date_sign_time_date + date_sign_time_time)
  - Date actuelle si aucune des dates ci-dessus n'est disponible
- ✅ **Le sous-état** : Si vous avez sélectionné un sous-état
- ✅ **Le rappel** : Date de rappel si applicable

## ⚠️ Points importants à retenir

1. **Phase 3 uniquement** : Le compte rendu n'est créé que pour les états de Phase 3. Si vous changez vers un état de Phase 1 ou Phase 2, votre commentaire sera enregistré dans la fiche mais ne créera pas de compte rendu.

2. **Qualification automatique** : La qualification de la fiche (si elle existe) est automatiquement ajoutée au début du compte rendu. Vous n'avez pas besoin de l'écrire manuellement.

3. **Mise à jour** : Si un compte rendu existe déjà pour cette fiche et ce commercial, il sera mis à jour au lieu d'en créer un nouveau.

4. **Consultation** : Vous pouvez consulter tous vos comptes rendus dans la section "Compte Rendu" du menu.

5. **Modification** : Une fois enregistré, le compte rendu peut être consulté mais sa modification directe n'est pas possible depuis l'interface standard. Il faudra créer une nouvelle mise à jour en changeant à nouveau l'état.

## 💡 Conseils pour rédiger un bon compte rendu

- **Soyez clair et précis** : Utilisez un langage professionnel
- **Incluez les informations essentielles** : Date, contexte, points clés discutés
- **Notez l'intérêt du client** : Niveau d'intérêt, objections, questions
- **Documentez les prochaines étapes** : Rendez-vous prévus, actions à suivre
- **Mentionnez les détails techniques** : Informations relevées sur le logement, consommation, etc.
- **Respectez la confidentialité** : Ne notez que les informations professionnelles pertinentes

## 🔍 Vérification

Après avoir enregistré votre compte rendu, vous pouvez le vérifier :
1. Allez dans la section **"Compte Rendu"** du menu
2. Filtrez par votre nom ou la fiche concernée
3. Votre compte rendu devrait apparaître avec :
   - La qualification (si applicable) entre crochets
   - Votre commentaire
   - La date de visite
   - L'état de la fiche

---

**Besoin d'aide ?** Contactez votre administrateur système si vous rencontrez des difficultés.

