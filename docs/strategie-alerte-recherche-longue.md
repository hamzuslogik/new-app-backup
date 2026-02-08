# Stratégie d’alerte avant une recherche potentiellement longue

## Objectif

Avertir l’utilisateur avant de lancer une recherche qui risque d’être très longue (charge serveur, timeout, mauvaise expérience), tout en évitant d’afficher une alerte à chaque recherche normale.

---

## 1. Quand déclencher l’alerte

### Critères possibles (à combiner)

| Critère | Description | Avantage / inconvénient |
|--------|-------------|--------------------------|
| **Aucun filtre de date** | Recherche sans `date_debut` / `date_fin` (ou champs de date vides) | Simple ; les recherches « larges » sont souvent sans date. |
| **Pas de filtre restrictif** | Ni état, ni commercial, ni centre, ni critère (tel/nom), etc. | Évite les requêtes « tout parcourir ». |
| **Première recherche de la session** | Alerte uniquement la 1ère fois qu’on lance une recherche large dans l’onglet | Ne pas répéter l’alerte à chaque clic. |
| **Estimation côté backend** | Le backend renvoie un indicateur (ex. `estimate_slow: true`) selon les paramètres | Précis mais nécessite une route ou un flag. |
| **Historique** | Si une recherche similaire a déjà été lente (ex. temps > X s enregistré côté client) | Adaptatif, plus complexe à mettre en place. |

**Recommandation minimale :**  
Alerte si **aucun filtre de date** n’est renseigné **et** (aucun filtre « fort » : état, commercial, centre, **ou** critère vide).  
Optionnel : ne montrer l’alerte que la **première fois** par session (ou par jour) pour ce type de recherche.

---

## 2. Contenu de l’alerte

- **Titre :** ex. « Recherche potentiellement longue »
- **Message :** expliquer que la recherche peut prendre du temps (ex. 30 s à plusieurs minutes) et solliciter fortement le serveur.
- **Actions proposées :**
  - **Annuler** : fermer sans lancer la recherche.
  - **Continuer** : lancer quand même la recherche (et éventuellement enregistrer le choix « ne plus demander pour cette session »).
  - **Optionnel – Limiter** : proposer d’ajouter une plage de dates (ex. dernier mois) ou une limite de résultats (ex. 500) avant de lancer.

Exemple de libellé :

> « Cette recherche porte sur une période ou un périmètre très large et peut prendre longtemps. Souhaitez-vous continuer ou ajouter des critères (ex. dates) pour accélérer ? »

---

## 3. Où intégrer la logique

### Côté frontend (Dashboard / Fiches)

1. **Au clic sur « RECHERCHE » / soumission du formulaire**
   - Avant d’appeler `getQueryParams()` et l’API `/fiches`, exécuter une fonction du type `shouldWarnLongSearch(filters)`.
   - Si `true` et que l’utilisateur n’a pas coché « Ne plus afficher », afficher une modale / `confirm()` avec le message et les boutons (Annuler / Continuer [et optionnellement Limiter]).
   - Si l’utilisateur choisit « Continuer », lancer la recherche (et optionnellement mettre un flag en session pour ne plus réafficher l’alerte pour ce type de recherche dans la session).

2. **Règles pour `shouldWarnLongSearch(filters)` (exemple)**
   - Pas de `date_debut` **ou** pas de `date_fin` **ou** plage > 1 an (selon besoin).
   - **Et** au plus un filtre « fort » parmi : `id_etat_final`, `id_commercial`, `id_centre`, `critere` (non vide), `id_confirmateur`.
   - Optionnel : si `filters.fiche_search` et que c’est la première recherche large de la session → alerter.

### Côté backend (optionnel)

- Endpoint dédié (ex. `POST /fiches/check-search`) qui reçoit les mêmes paramètres que la recherche et renvoie `{ slow: true/false, reason?: string }` selon des règles métier (ex. volume estimé, index utilisés).
- Le frontend appelle ce check avant la vraie recherche ; si `slow === true`, afficher l’alerte puis, si l’utilisateur confirme, appeler `GET /fiches` comme aujourd’hui.

---

## 4. Expérience utilisateur

- **Ne pas bloquer** les recherches déjà bien filtrées (dates + au moins un filtre fort) : pas d’alerte.
- **Éviter la lassitude** : option « Ne plus afficher pour cette session » (stockage en sessionStorage) ou « Ne plus afficher pour les recherches de ce type » (règles + localStorage), avec possibilité de réactiver dans les paramètres plus tard si besoin.
- **Feedback pendant la recherche** : une fois « Continuer » cliqué, afficher un indicateur de chargement clair (spinner, message « Recherche en cours… Cela peut prendre du temps ») et désactiver le bouton de recherche jusqu’à la réponse.
- **Timeout côté frontend** : après un délai (ex. 45 s), afficher un message du type « La recherche prend plus de temps que prévu. Vous pouvez attendre ou annuler. » avec bouton « Annuler la recherche » (abort de la requête).

---

## 5. Résumé des étapes d’implémentation

1. Définir la règle `shouldWarnLongSearch(filters)` (et optionnellement un check backend).
2. À la soumission du formulaire de recherche, si la règle est vraie et que l’utilisateur n’a pas désactivé l’alerte, afficher une modale (ou `confirm`) avec le message et les actions.
3. Si l’utilisateur confirme : lancer la recherche, afficher un loader adapté et gérer un timeout optionnel avec message + annulation.
4. Optionnel : sessionStorage / localStorage pour « Ne plus afficher » et backend d’estimation.

Cette stratégie permet d’alerter avant les recherches potentiellement longues tout en gardant un usage fluide pour les recherches courantes.
