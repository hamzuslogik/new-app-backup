# Décalage d’un an sur date_rdv_time (état CONFIRMER)

## Contexte

En migration **yj_histo_fiche → fiches_histo**, la colonne **date_rdv_time** dans fiches_histo peut afficher **une année de plus** que **date_heure_playning** dans yj_histo_fiche, et uniquement pour les lignes à l’état CONFIRMER.

**Rappel structure yj_histo_fiche :** pas de colonne `id_etat` ; l’état est dans la colonne **`etat`** (libellé ex. "CONFIRMER"). La date planning est dans **`date_heure_playning`** uniquement (pas de `date_rdv_time` en source).

La dernière correction (soustraire 1 an pour l’état 7) a été annulée. Ce document vise à identifier la **vraie cause** du décalage.

---

## Causes possibles

### 1. **COALESCE lit la mauvaise colonne pour l’état 7**

Dans le script on utilise :

```sql
COALESCE(hf.date_rdv_time, hf.date_heure_playning)
```

- Pour l’état CONFIRMER (7), **les deux** colonnes peuvent être remplies dans yj_histo_fiche.
- **COALESCE** prend la **première** non NULL → donc **date_rdv_time**.
- Si c’est **date_rdv_time** (et non date_heure_playning) qui est erronée de +1 an en base pour l’état 7, alors le décalage vient **des données source** dans yj_histo_fiche, pas du script.

**Vérification :**

```sql
-- Comparer date_heure_playning et date_rdv_time pour l'état CONFIRMER (colonne "etat" dans yj)
SELECT id, id_fiche, etat,
       date_rdv_time,
       date_heure_playning,
       TIMESTAMPDIFF(YEAR, date_heure_playning, date_rdv_time) AS ecart_annee
FROM yj_histo_fiche
WHERE etat = 'CONFIRMER' OR etat = 7
  AND date_rdv_time IS NOT NULL
  AND date_heure_playning IS NOT NULL
LIMIT 20;
```

Si `ecart_annee = 1` partout, le problème est **dans yj_histo_fiche** : **date_rdv_time** y est déjà à +1 an par rapport à **date_heure_playning** pour l’état CONFIRMER.

**Piste correctif script :** pour l’état CONFIRMER (etat = 'CONFIRMER' ou id résolu = 7), préférer **date_heure_playning** quand elle est renseignée, par ex.  
`CASE WHEN (expression_etat) = 7 THEN COALESCE(date_heure_playning, date_rdv_time) ELSE COALESCE(date_rdv_time, date_heure_playning) END`.  
(Si en yj il n’y a que date_heure_playning, pas de date_rdv_time, cette piste ne s’applique pas.)

---

### 2. **Type / format de la colonne source**

- **date_heure_playning** en `VARCHAR` avec un format particulier (ex. `DD/MM/YYYY` ou année sur 2 chiffres) peut être mal interprété par MySQL lors de la copie vers un `DATETIME`.
- **Année sur 2 chiffres** : MySQL interprète 00–69 → 2000–2069 et 70–99 → 1970–1999. Une mauvaise conversion (ex. 25 → 2026 au lieu de 2025) peut donner un an d’écart.

**Vérification :**

```sql
-- Type et exemples pour l'état 7
SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'yj_histo_fiche'
  AND COLUMN_NAME IN ('date_heure_playning', 'date_rdv_time', 'date_rdv');

SELECT id_etat, date_heure_playning, date_rdv_time
FROM yj_histo_fiche
WHERE id_etat = 7
LIMIT 10;
```

Regarder si les valeurs sont cohérentes (DATE/DATETIME vs chaînes) et si l’année affichée correspond à ce qui est attendu.

---

### 3. **Application qui écrit dans yj_histo_fiche (état 7)**

Pour les passages à l’état CONFIRMER, l’ancienne application (ou un trigger) a pu :

- écrire **date_rdv_time** avec une année à laquelle il ajoute 1 (bug),
- ou recopier une date déjà incorrecte (ex. année +1) depuis un écran “planning”.

Le décalage serait alors **dans les données d’origine**, pas dans la requête de migration.

**Vérification :** comparer avec une autre source de vérité (fiches, planning, export) pour quelques fiches à l’état 7 et voir si la “bonne” date est **date_heure_playning** ou **date_rdv_time**.

---

### 4. **Timezone / TIMESTAMP**

Si **date_heure_playning** ou **date_rdv_time** est en `TIMESTAMP`, MySQL la stocke en UTC et la convertit selon la timezone de la session. Un changement de timezone (serveur, session, ou entre écriture et lecture) peut, dans de rares cas, faire basculer la date au 31/12 ou 01/01 et donner un écart d’un an. Moins fréquent qu’un décalage d’heure.

**Vérification :**

```sql
SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'yj_histo_fiche'
  AND COLUMN_NAME IN ('date_heure_playning', 'date_rdv_time');
```

Si type = `timestamp`, vérifier `@@session.time_zone` et la cohérence des dates à minuit (31/12 / 01/01).

---

## Synthèse recommandée

1. Exécuter la **requête de comparaison** (section 1) entre **date_rdv_time** et **date_heure_playning** pour **id_etat = 7**.
2. Si **date_rdv_time** est bien à +1 an par rapport à **date_heure_playning** dans yj_histo_fiche :
   - le problème vient des **données** (ou de l’app qui les remplit) ;
   - en migration, pour l’état 7, **préférer date_heure_playning** quand elle est non NULL (voir formule CASE/COALESCE ci-dessus).
3. Si les deux colonnes sont identiques en base et que le décalage n’apparaît qu’après migration, revérifier le **type** des colonnes et l’éventuelle **conversion** (VARCHAR → DATETIME, timezone).

Une fois la cause identifiée (données vs script vs type/timezone), on peut réintroduire une correction ciblée dans le script si besoin (par ex. priorité à date_heure_playning pour l’état 7, sans toucher aux autres états).
