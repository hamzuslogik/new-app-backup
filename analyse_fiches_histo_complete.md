# Analyse de la table `fiches_histo` pour l'affichage de l'historique

## Table responsable : `fiches_histo`

La table `fiches_histo` est utilisée pour afficher l'historique des états d'une fiche dans le modal de détails.

## Structure actuelle de `fiches_histo`

```sql
CREATE TABLE `fiches_histo` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_fiche` int(11) DEFAULT NULL,
  `id_etat` int(11) DEFAULT NULL,
  `date_rdv_time` datetime DEFAULT NULL,
  `date_creation` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_id_fiche` (`id_fiche`),
  KEY `idx_id_etat` (`id_etat`)
)
```

## Informations nécessaires pour l'affichage (d'après FicheDetail.jsx)

### ✅ Informations déjà stockées dans `fiches_histo` :
- `id_fiche` : ID de la fiche
- `id_etat` : ID de l'état
- `date_creation` : Date de création de l'entrée historique
- `date_rdv_time` : Date du rendez-vous (optionnel)

### ❌ Informations manquantes mais nécessaires :

#### Informations de base :
- `id_confirmateur`, `id_confirmateur_2`, `id_confirmateur_3` : IDs des confirmateurs
- `confirmateur_pseudo`, `confirmateur_2_pseudo`, `confirmateur_3_pseudo` : Pseudos des confirmateurs
- `conf_commentaire_produit` : Commentaire du confirmateur
- `conf_rdv_avec` : Avec qui le RDV a été pris
- `date_appel_time` : Date d'appel
- `date_sign_time` : Date de signature
- `id_sous_etat` : ID du sous-état
- `sous_etat_titre` : Titre du sous-état

#### Informations commerciales :
- `id_commercial` : ID du commercial
- `commercial_pseudo` : Pseudo du commercial
- `commentaire_commercial` : Commentaire commercial

#### Informations Phase 3 (pour les états SIGNER) :
- `ph3_pac` : Type de PAC (R/EAU, R/R)
- `ph3_type` / `ph3_financement` : Type de financement
- `ph3_prix` : Prix
- `ph3_puissance` : Puissance
- `ph3_consommation` : Consommation
- `ph3_bonus` / `ph3_bonus_30` : Bonus
- `ph3_mensualite` : Mensualité
- `ph3_nbr_annee_finance` : Nombre d'années de financement
- `ph3_ballon` : Ballon (OUI/NON)
- `ph3_alimentation` : Alimentation
- `ph3_installateur` : ID de l'installateur
- `installeur_nom` : Nom de l'installateur
- `credit_immobilier` : Crédit immobilier
- `credit_autre` : Autre crédit
- `valeur_mensualite` : Valeur de la mensualité

#### Informations qualité :
- `cq_etat` : État contrôle qualité
- `cq_dossier` : Dossier contrôle qualité
- `commentaire_qualite` : Commentaire qualité

#### Autres informations :
- `profession_mr`, `profession_madame` : Professions
- `type_contrat_mr`, `type_contrat_madame` : Types de contrat
- `revenu_foyer`, `credit_foyer` : Revenus et crédits
- `mode_chauffage`, `produit` : Mode de chauffage et produit
- `surface_chauffee`, `consommation_chauffage` : Surface et consommation
- `annee_systeme_chauffage` : Année du système
- `conf_orientation_toiture`, `conf_zones_ombres`, `conf_site_classe` : Informations toiture
- `conf_consommation_electricite` : Consommation électrique
- `nb_pans` : Nombre de pans

## Problème identifié

### ❌ Problème majeur : Enrichissement avec les données actuelles

Le backend (lignes 2471-2522 de `fiche.routes.js`) enrichit chaque entrée de l'historique avec les données **ACTUELLES** de la fiche :

```javascript
historique = historique.map(histo => ({
  ...histo,
  id_confirmateur: fiche.id_confirmateur,  // ❌ Valeur actuelle, pas historique
  confirmateur_pseudo: confirmateur?.pseudo || null,  // ❌ Valeur actuelle
  conf_commentaire_produit: fiche.conf_commentaire_produit || null,  // ❌ Valeur actuelle
  date_rdv_time: fiche.date_rdv_time || null,  // ❌ Valeur actuelle
  // ... etc
}));
```

**Conséquence** : Toutes les entrées historiques affichent les mêmes valeurs (celles d'aujourd'hui), pas les valeurs au moment du changement d'état.

**Exemple** :
- Si une fiche a changé d'état il y a 6 mois avec un confirmateur A
- Mais aujourd'hui le confirmateur est B
- L'historique affichera le confirmateur B pour toutes les entrées, même celle de il y a 6 mois

## Solutions proposées

### Option 1 : Enrichir la table `fiches_histo` (RECOMMANDÉ)

Ajouter les colonnes nécessaires pour stocker les valeurs au moment du changement d'état.

**Avantages** :
- Historique réel et précis
- Pas de perte d'information
- Performance optimale

**Inconvénients** :
- Modification de la structure de la table
- Modification du code backend pour stocker ces valeurs
- Migration des données existantes

### Option 2 : Utiliser la table `modifica`

La table `modifica` stocke déjà l'historique des modifications avec `ancien_valeur` et `nouvelle_valeur`.

**Avantages** :
- Pas de modification de structure
- Données déjà disponibles

**Inconvénients** :
- Nécessite de reconstruire l'historique à partir des modifications
- Plus complexe à requêter
- Peut ne pas contenir toutes les informations nécessaires

### Option 3 : Créer une table de snapshot

Créer une nouvelle table qui stocke un snapshot complet de la fiche à chaque changement d'état.

**Avantages** :
- Historique complet et précis
- Facile à requêter

**Inconvénients** :
- Beaucoup de données dupliquées
- Taille de la base de données importante

## Recommandation

**Option 1** : Enrichir la table `fiches_histo` avec les colonnes les plus importantes :
- `id_confirmateur`, `id_confirmateur_2`, `id_confirmateur_3`
- `conf_commentaire_produit`
- `date_appel_time`, `date_sign_time`
- `id_sous_etat`
- `id_commercial`
- `ph3_installateur`
- Les champs Phase 3 les plus utilisés (`ph3_pac`, `ph3_type`, `ph3_prix`, `ph3_puissance`, etc.)

Les autres champs peuvent rester enrichis depuis la fiche actuelle si nécessaire, mais les champs critiques doivent être historisés.

