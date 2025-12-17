# Mapping complet : yj_fiche → fiches

## Correspondances directes (même nom)

| yj_fiche | fiches | Notes |
|----------|--------|-------|
| `id` | `id` | Direct |
| `civ` | `civ` | Direct |
| `nom` | `nom` | Direct |
| `prenom` | `prenom` | Direct |
| `tel` | `tel` | Direct |
| `gsm1` | `gsm1` | Direct |
| `gsm2` | `gsm2` | Direct |
| `cp` | `cp` | Direct |
| `ville` | `ville` | Direct |
| `etude` | `etude` | Direct |
| `age_mr` | `age_mr` | Direct |
| `profession_mr` | `profession_mr` | Direct |
| `commentaire` | `commentaire` | Direct |
| `id_centre` | `id_centre` | Direct |
| `id_qualite` | `id_qualite` | Direct |
| `conf_commentaire_produit` | `conf_commentaire_produit` | Direct |
| `conf_profession_monsieur` | `conf_profession_monsieur` | Direct |
| `conf_profession_madame` | `conf_profession_madame` | Direct |
| `conf_presence_couple` | `conf_presence_couple` | Direct |
| `conf_rdv_avec` | `conf_rdv_avec` | Direct |
| `ph3_pac` | `ph3_pac` | Direct |
| `ph3_puissance` | `ph3_puissance` | Direct |
| `ph3_marque_ballon` | `ph3_marque_ballon` | Direct |
| `ph3_alimentation` | `ph3_alimentation` | Direct |
| `ph3_type` | `ph3_type` | Direct |
| `ph3_attente` | `ph3_attente` | Direct |
| `nbr_annee_finance` | `nbr_annee_finance` | Direct (int) |
| `credit_immobilier` | `credit_immobilier` | Direct |
| `credit_autre` | `credit_autre` | Direct |

## Correspondances avec changement de nom

| yj_fiche | fiches | Notes |
|----------|--------|-------|
| `Adresse` | `adresse` | Majuscule → minuscule |
| `maison_orientation` | `orientation_toiture` | Renommage |
| `profession_mme` | `profession_madame` | Renommage |
| `age_mme` | `age_madame` | Renommage |
| `enfant_encharge` | `nb_enfants` | Renommage + conversion int → varchar |
| `situation_conju` | `situation_conjugale` | Renommage |
| `revenu` | `revenu_foyer` | Renommage |
| `credit` | `credit_foyer` | Renommage |
| `zones_ombres` | `conf_zones_ombres` | Ajout préfixe conf_ |
| `site_classe` | `conf_site_classe` | Ajout préfixe conf_ |

## Correspondances avec conversion de type

| yj_fiche | fiches | Conversion |
|----------|--------|------------|
| `nb_chemines` (int) | `nb_chemines` (varchar) | CAST AS CHAR |
| `pac_nombre_pieces` (varchar) | `nb_pieces` (int) | CAST AS UNSIGNED |
| `pac_annee_chauf` (varchar) | `annee_systeme_chauffage` (int) | CAST AS UNSIGNED |
| `ph3_installateur` (varchar) | `ph3_installateur` (int) | CAST AS UNSIGNED (si numérique) |
| `ph3_prix` (int) | `ph3_prix` (decimal) | CAST AS DECIMAL(10,2) |
| `ph3_bonus_30` (varchar) | `ph3_bonus_30` (decimal) | CAST AS DECIMAL(10,2) (si numérique) |
| `ph3_mensualite` (varchar) | `ph3_mensualite` (decimal) | CAST AS DECIMAL(10,2) (si numérique) |
| `ph3_rr_model` (int) | `ph3_rr_model` (varchar) | CAST AS CHAR |
| `ph3_ballon` (tinyint) | `ph3_ballon` (varchar) | 1 → 'OUI', 0 → 'NON' |
| `cq_etat` (varchar) | `cq_etat` (int) | CAST AS UNSIGNED (si numérique) |
| `cq_dossier` (varchar) | `cq_dossier` (int) | CAST AS UNSIGNED (si numérique) |
| `archive` (tinyint) | `archive` (int) | CAST AS UNSIGNED |
| `valider` (tinyint) | `valider` (int) | CAST AS UNSIGNED |
| `conf_consommations` (int) | `conf_consommations` (int) | Direct si > 0, sinon NULL |

## Correspondances avec conversion via table de référence

| yj_fiche | fiches | Conversion |
|----------|--------|------------|
| `nom_agent` (varchar) | `id_agent` (int) | Recherche dans `utilisateurs` via `pseudo` |
| `nom_commercial` (varchar) | `id_commercial` (int) | Recherche dans `utilisateurs` via `pseudo` (si id_commercial vide) |
| `nom_commercial_2` (varchar) | `id_commercial_2` (int) | Recherche dans `utilisateurs` via `pseudo` |
| `nom_confirmateur` (varchar) | `id_confirmateur` (int) | Recherche dans `utilisateurs` via `pseudo` (fallback sur id_confirmateur) |
| `nom_confirmateur_2` (varchar) | `id_confirmateur_2` (int) | Recherche dans `utilisateurs` via `pseudo` |
| `nom_confirmateur_3` (varchar) | `id_confirmateur_3` (int) | Recherche dans `utilisateurs` via `pseudo` |
| `etat_final` (varchar) | `id_etat_final` (int) | Recherche dans `etats` via `titre`, sinon mapping manuel |

## Correspondances avec conversion de produit

| yj_fiche | fiches | Conversion |
|----------|--------|------------|
| `conf_produit` (varchar) | `produit` (int) | 'PAC' → 1, 'PV' → 2 |
| `conf_produit` (varchar) | `conf_produit` (int) | 'PAC' → 1, 'PV' → 2 |

## Correspondances avec conversion de dates

| yj_fiche | fiches | Conversion |
|----------|--------|------------|
| `date_heure_appel` (datetime) | `date_appel` (bigint) | UNIX_TIMESTAMP |
| `date_heure_appel` (datetime) | `date_appel_time` (datetime) | Direct |
| `date_insertion` (datetime) | `date_insert` (bigint) | UNIX_TIMESTAMP |
| `date_insertion` (datetime) | `date_insert_time` (datetime) | Direct |
| `date_heure_playning` (datetime) | `date_rdv` (bigint) | UNIX_TIMESTAMP |
| `date_heure_playning` (datetime) | `date_rdv_time` (datetime) | Direct |
| `date_heure_mod` (datetime) | `date_modif_time` (datetime) | Direct |

## Correspondances avec COALESCE (plusieurs sources)

| yj_fiche | fiches | Sources |
|----------|--------|---------|
| - | `consommation_chauffage` | `conf_consommation_chauffage` OU `pac_consomation` |
| - | `surface_habitable` | `pac_surface_habitable` |
| - | `surface_chauffee` | `pac_surface_chauf` |
| - | `proprietaire_maison` | `pac_propritaire_maison` |
| - | `age_maison` | `pac_age_maison` |
| - | `mode_chauffage` | `conf_energie` |

## Champs sans correspondance directe (NULL ou valeur par défaut)

| fiches | Valeur |
|--------|--------|
| `id_insert` | NULL |
| `id_qualif` | NULL |
| `date_audit` | NULL |
| `date_confirmation` | NULL |
| `date_qualif` | NULL |
| `date_affect` | NULL |
| `date_sign` | NULL |
| `date_sign_time` | NULL |
| `ko` | 0 |
| `hc` | 0 |
| `active` | 1 |
| `conf_orientation_toiture` | NULL |
| `conf_consommation_electricite` | NULL |
| `ph3_puissance_pv` | NULL |
| `consommation_electricite` | NULL |

## Champs yj_fiche non mappés (informations supplémentaires non migrées)

Les champs suivants de `yj_fiche` n'ont pas de correspondance directe dans `fiches` :
- `etude_observation` → pourrait être ajouté dans `commentaire`
- `installation`, `installation_type`, `installation_annee`, `installation_production`, `installation_prix` → informations d'installation
- `entretient` → pourrait être ajouté dans `commentaire`
- `motif_qualification` → pourrait être ajouté dans `commentaire`
- `adresse_ip` → information technique
- `sous_etat` → pas de correspondance
- `conf_prise_autre_personne` → pas de correspondance
- `conf_profession`, `conf_profession_detail`, `conf_profession_mme`, `conf_profession_detail_mme` → variantes de profession
- `conf_deja_fait_etude`, `conf_detail_etude` → informations d'étude
- `conf_revenu`, `conf_credit` → variantes de revenu/credit
- `conf_deja_installe`, `conf_type_installation`, `conf_annee_installation`, `conf_production_installation`, `conf_prix_installation` → informations d'installation
- `conf_annulee_precedemment`, `conf_annulee_precedemment_par` → historique
- `observation_qualite` → pourrait être ajouté dans `commentaire`
- `exportation`, `favorite`, `color`, `PENALITE`, `DETAIL_PENALITE` → métadonnées
- `ph3_nbr_unite`, `ph3_nbr_group` → détails techniques
- `ph3_marque_pac` → marque PAC
- `ph3_bonus_15` → bonus 15% (on a bonus_30)
- `decalage`, `valeur_mensualite` → informations financières
- `cq_observations`, `cq_date_modif` → observations qualité
- `Isolation` → information isolation
- `nom_qualite`, `nom_centre` → noms (déjà gérés via IDs)

