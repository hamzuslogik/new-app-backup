# Fonctionnalités des pages — CRM

Document de référence décrivant le rôle et les principales fonctionnalités de chaque page de l'application React (`frontend/`) et de l'intégration Vicidial (`index.php`).

Les accès sont contrôlés par **permissions** (codes du type `dashboard_view`) et parfois par **fonction** (rôle utilisateur : 1 = Admin, 3 = Agent qualif, 5 = Commercial, 6 = Confirmateur, etc.).

---

## 1. Authentification et profil

### Login
| | |
|---|---|
| **Route** | `/login` |
| **Permission** | Publique (non connecté) |

- Connexion au CRM avec identifiant et mot de passe.
- Redirection automatique vers la page d'accueil selon le rôle (`getHomePage`).
- Code de secours à 4 chiffres si l'adresse IP n'est pas autorisée pour la fonction de l'utilisateur.
- Message en cas de session expirée pour inactivité.

---

### Mon profil
| | |
|---|---|
| **Route** | `/mon-profil` |
| **Permission** | Fonctions 1, 2, 6, 7, 8, 9, 11, 12, 13, 14 |

- Modification des informations personnelles : pseudo, nom, prénom, e-mail, téléphone, genre.
- Changement de mot de passe (mot de passe actuel + nouveau).

---

### Code secours
| | |
|---|---|
| **Route** | `/code-secours` |
| **Permission** | Compte login `backoffice` uniquement |

- Génération de codes de secours à usage unique pour les connexions depuis une IP non autorisée.
- Consultation des codes disponibles / utilisés, copie dans le presse-papiers.
- Régénération (invalide les anciens codes).

---

### Notifications
| | |
|---|---|
| **Route** | `/notifications` |
| **Permission** | Tout utilisateur authentifié |

- Centre de notifications : toutes, lues, non lues.
- Marquage lu / tout marquer comme lu.
- Lien vers la page ou la fiche concernée.

---

## 2. Fiches et tableau de bord

### Tableau de bord (Dashboard)
| | |
|---|---|
| **Route** | `/dashboard` |
| **Permission** | `dashboard_view` |

- Recherche avancée de fiches et tableau de résultats (tri, pagination).
- Filtres riches : état, dates, centre, agent, commercial, confirmateur, RDV, produit, archives, département, etc.
- Ouverture de fiche en modal, export PDF, menu contextuel.
- Filtres et colonnes adaptés au rôle (confirmateur, commercial, RE confirmation…).
- Compteur de temps de génération de la liste.

---

### Recherche fiches (Dashboard Admin)
| | |
|---|---|
| **Route** | `/recherche-fiches` |
| **Permission** | `dashboard_view` |

- Interface dédiée à la recherche de fiches (modal de recherche ouvert par défaut).
- Filtres synchronisés avec l'URL, tableau avec détail en modal.
- Vue optimisée grand écran (viewport desktop).

---

### Fiches
| | |
|---|---|
| **Route** | `/fiches` |
| **Permission** | `fiches_view` |

- Liste et gestion des fiches : filtres, recherche rapide, production du mois.
- Création et édition en modal (données client, étude, produit PV/PAC, centre…).
- Archivage, motif KO, accès au détail complet.
- Chargement automatique du jour pour agents qualif, superviseurs et backoffice.

---

### Détail fiche (FicheDetail)
| | |
|---|---|
| **Route** | `/fiches/:id` |
| **Permission** | `fiches_detail` |

- Fiche client complète : coordonnées, critères techniques, étude, commentaires.
- Historique des états, modifications (modifica), affectation, planning, SMS, PDF.
- Workflows métier : changement d'état, confirmation RDV, KO/HC, signer (phase 3), validation, décalages, complétudes.
- Affichage en modal depuis l'app ou en page pleine selon le contexte d'accès.
- Champs en lecture seule pour certains rôles (ex. commercial sur champs confirmateur).

---

## 3. Planning et rendez-vous

### Planning
| | |
|---|---|
| **Route** | `/planning` |
| **Permission** | `planning_view` |

- Planning hebdomadaire par département et créneaux (9H, 11H, 13H, 16H, 18H, 19H30).
- Gestion des disponibilités : création, édition, duplication (admins).
- Navigation semaine / année / département.

---

### Planning commercial
| | |
|---|---|
| **Route** | `/planning-commercial` |
| **Permission** | `planning_commercial_view` |

- Planning journalier du commercial connecté (J à J+5).
- Fiches RDV du commercial, filtres département et état.
- Page d'accueil par défaut pour les commerciaux (fonction 5).

---

### Planning département (lecture)
| | |
|---|---|
| **Route** | `/planning-dep` |
| **Permission** | `planning_dep_view` |

- Grille planning par département en lecture seule.
- Génération PDF des besoins par date et département.

---

### Planning hebdomadaire
| | |
|---|---|
| **Route** | `/planning-hebdomadaire` |
| **Permission** | `planning_view` |

- Saisie du besoin commercial hebdomadaire : jour, département, nombre de commerciaux.
- Copie de planning entre semaines, suppression d'entrées.

---

### Planning hebdo iOS
| | |
|---|---|
| **Route** | `/planning-hebdo-ios` |
| **Permission** | Fonction 1 (admin) uniquement |

- Même contenu que le planning hebdomadaire, route dédiée pour usage iOS.

---

### Vue rendez-vous
| | |
|---|---|
| **Route** | `/rdv-vue` |
| **Permission** | `planning_view` |

- Vue consolidée des RDV du jour : affiliés, non affiliés, production, confirmer veille/lendemain.
- Sélecteur de date, tableau triable, ouverture fiche en modal.

---

### Alerte planning
| | |
|---|---|
| **Route** | `/alerte-planning` |
| **Permission** | Fonctions 1, 7, 11, 13, 14 (hors superviseur qualif et RE qualif) |

- Création et gestion des messages d'alerte affichés sur le planning.
- Ciblage par département, jour, créneau, fonctions et semaines.

---

### Décalages
| | |
|---|---|
| **Route** | `/decalages` |
| **Permission** | `decalage_view` |

- Demandes de décalage de RDV : liste filtrée par utilisateur.
- Acceptation / refus, lien vers la fiche, rafraîchissement automatique.

---

## 4. Affectation commerciale

### Affectation
| | |
|---|---|
| **Route** | `/affectation` |
| **Permission** | `affectation_view` |

- Affectation des fiches confirmées aux commerciaux.
- Onglets affectées / non affectées, filtres date, centre, produit, département.
- Sélection multiple, affecter / désaffecter.

---

### Affectation par département
| | |
|---|---|
| **Route** | `/affectation-dep` |
| **Permission** | `affectation_view` |

- Grille hebdomadaire d'affectation par département et créneau.
- Sélection multiple, calcul des distances entre adresses.
- Actions réservées aux admins (fonctions 1, 2, 7, 11).

---

## 5. Statistiques et indicateurs

### Statistiques
| | |
|---|---|
| **Route** | `/statistiques` |
| **Permission** | `statistiques_view` |

- Statistiques multi-vues : centre, confirmateur, commercial, agent, KO.
- Graphiques (camembert, barres), filtres dates / produit / centres.
- Drill-down vers le tableau de bord, export / impression.

---

### Statistiques RDV
| | |
|---|---|
| **Route** | `/statistiques-rdv` |
| **Permission** | `statistiques_rdv_view` |

- Tableau de bord RDV : confirmés aujourd'hui, annulés à reprogrammer, à venir.
- Tableau par confirmateur, rafraîchissement automatique.

---

### Statistiques fiches
| | |
|---|---|
| **Route** | `/statistiques-fiches` |
| **Permission** | `statistiques_fiches_view` (fonctions 1, 2, 7, 9 en interne) |

- Statistiques et liste détaillée de fiches sur période.
- Graphiques, tableau triable, filtres date / centre / champ date, onglets par état.

---

### Statistiques V2
| | |
|---|---|
| **Route** | `/statistiques-v2` |
| **Permission** | `statistiques_v2_view` |

- Tableau de bord analytique avancé : qualification et confirmation.
- Filtres multi-critères, graphiques variés, drill-down, export Excel/PDF.

---

### KPIs
| | |
|---|---|
| **Route** | `/kpis` |
| **Permission** | `kpis_view` |

- KPIs globaux : qualification, confirmation, confirmation JWS, porte ouverte.
- Filtres date/heure, graphiques et classements.

---

### KPI qualification
| | |
|---|---|
| **Route** | `/kpi-qualification` |
| **Permission** | `kpi_qualification_view` |

- KPI qualification : meilleur agent, meilleure équipe, taux de conformité.
- Périodes jour / semaine / mois, filtres périmètre RP / superviseur / agent.

---

### Mes indicateurs
| | |
|---|---|
| **Route** | `/mes-indicateurs` |
| **Permission** | `agent_qualification_kpis` + fonction 3 |

- Indicateurs personnels de l'agent qualification : production, HC, KO, taux.
- Réservé aux agents qualification (fonction 3).

---

### Production qualif
| | |
|---|---|
| **Route** | `/production-qualif` |
| **Permission** | `production_qualif_view` |

- Production qualification : vue statistiques et vue fiches détaillées.
- Filtres superviseur, états, commentaires qualité, export.

---

### Suivi télépro
| | |
|---|---|
| **Route** | `/suivi-telepro` |
| **Permission** | `suivi_telepro_view` |

- Suivi téléprospecteurs / confirmateurs : commissions, signatures, New/Repro.
- Filtres période et confirmateur, impression.

---

### Suivi agents qualif
| | |
|---|---|
| **Route** | `/suivi-agents-qualif` |
| **Permission** | `suivi_agents_view` |

- Production par agent qualification (états colorés, totaux, validées).
- Export CSV / Excel / PDF, édition commentaires qualité (admin).

---

### Suivi des agents
| | |
|---|---|
| **Route** | `/suivi-agents` |
| **Permission** | `suivi_agents_view` |

- Suivi agrégé par superviseur : stats équipe, production agents.
- Vue hiérarchique superviseur → agents.

---

### Stats agents qualité
| | |
|---|---|
| **Route** | `/stats-agents-qualite` |
| **Permission** | `stats_agents_qualite_view` |

- Statistiques qualité par agent (qualification et confirmation).
- Complétudes, audits, RDV audités, graphiques et export.

---

### Assistance IA
| | |
|---|---|
| **Route** | `/assistance-ia` |
| **Permission** | `assistance_ia_view` |

- Analyse IA des RDV pour une date : problèmes détectés, qualification, rapport synthétique.

---

## 6. Qualité

### Contrôle qualité
| | |
|---|---|
| **Route** | `/controle-qualite` |
| **Permission** | `controle_qualite_view` |

- Contrôle des fiches produites : liste filtrable par agent, état, date.
- Actions KO, HC, alertes (PERSO / TECHNIQUE), remarques vers agents, commentaires qualité.
- Page d'accueil pour la qualité qualification (fonction 4).

---

### Alertes
| | |
|---|---|
| **Route** | `/alertes` |
| **Permission** | `controle_qualite_view` ou fonctions 3, 2, 12 |

- Liste des alertes qualité envoyées / reçues avec statistiques.
- Vue adaptée agent qualif (reçues) vs qualité (envoyées).

---

### Remarques
| | |
|---|---|
| **Route** | `/remarques` |
| **Permission** | `controle_qualite_view` ou fonctions 2, 12 |

- Consultation et envoi de remarques qualité vers les agents.
- Filtres destinataire, nature, dates.

---

### Audit rendez-vous
| | |
|---|---|
| **Route** | `/audit-rdv` |
| **Permission** | Fonctions 4 et 13 |

- Audit des RDV du jour : édition du commentaire qualité.
- Sélecteur de date, sauvegarde inline.

---

### Liste des complétudes
| | |
|---|---|
| **Route** | `/liste-completudes` |
| **Permission** | Fonctions 4, 13, 14 |

- Demandes de complétude sur les fiches : liste filtrable par statut, dates, confirmateur.
- Traitement par RE confirmation (14) ou RP confirmation (13).

---

## 7. Confirmation, validation et comptes rendus

### Validation / Audit RDVs
| | |
|---|---|
| **Route** | `/validation` |
| **Permission** | `validation_view` |

- Validation ou audit des RDV à venir par département.
- Filtres date et statut validé ; libellé « Audit RDVs » pour la qualité confirmation (fonction 4).

---

### Mes rappels
| | |
|---|---|
| **Route** | `/mes-rappels` |
| **Permission** | `dashboard_view` + fonctions 6, 13, 14 |

- Rappels du confirmateur / RE / RP : bureau (19), annuler à reprogrammer (8), honoré à suivre (9).
- Filtres date et confirmateur.

---

### Rappels bureau
| | |
|---|---|
| **Route** | `/rappels-bureau` |
| **Permission** | Fonction 13 (RP confirmation) |

- Vue RP des rappels bureau par date et confirmateur de l'équipe.

---

### Compte rendu
| | |
|---|---|
| **Route** | `/compte-rendu` |
| **Permission** | `compte_rendu_view` |

- Liste des comptes rendus : filtres date, commercial, état, statut.
- Approbation / rejet admin, édition, modal tracking (backoffice).

---

### Comptes rendus en attente
| | |
|---|---|
| **Route** | `/compte-rendu-pending` |
| **Permission** | Fonctions 1, 2, 5, 7, 13 |

- File d'attente des comptes rendus à approuver ou rejeter.
- Détail des modifications proposées par le commercial.

---

### Tracking
| | |
|---|---|
| **Route** | `/tracking` |
| **Permission** | Fonction 11 (backoffice) |

- Liste des trackings RDV : filtres dates, recherche, pagination.
- Complément du suivi sur la page compte rendu.

---

### Phase 3
| | |
|---|---|
| **Route** | `/phase3` |
| **Permission** | `phase3_view` |

- Suivi post-signature : RDV affiliés / non affiliés, signés semaine / mois.
- Informations installateur, phase 3 (PAC, financement, etc.).

---

### Signatures
| | |
|---|---|
| **Route** | `/signatures` |
| **Permission** | `signatures_view` |

- KPI et statistiques signatures, liste active triable.
- Rejet signature (admin), modification propriétaire, ajout confirmateur.

---

### CQ Signatures
| | |
|---|---|
| **Route** | `/cq-signatures` |
| **Permission** | Fonctions 1, 11 |

- Contrôle qualité des signatures : hier, aujourd'hui, semaine, mois, période personnalisée.
- Filtres par état (SIGNER, COMPLET, PM, RETRACTER…).

---

## 8. Administration et configuration

### Gestion (Management)
| | |
|---|---|
| **Route** | `/management` |
| **Permission** | `management_view` |

- Configuration CRM : centres, utilisateurs, départements, produits, états, sous-états, professions, SMS, workflows.
- Extraction fiches, hash téléphone, import KO, paramètres globaux, connexions échouées.

---

### Utilisateurs
| | |
|---|---|
| **Route** | `/users` |
| **Permission** | `users_view` |

- Gestion des utilisateurs : CRUD, filtres (composant dédié).

---

### Mon équipe
| | |
|---|---|
| **Route** | `/mon-equipe` |
| **Permission** | Fonctions 2, 14 |

- Liste lecture seule des membres de l'équipe (agents qualif ou confirmateurs selon le rôle).
- Recherche pseudo, nom, mail, centre.

---

### Permissions
| | |
|---|---|
| **Route** | `/permissions` |
| **Permission** | `config_permissions` |

- Matrice des permissions par fonction (rôle) : pages et actions.
- Modèles, historique, testeur de permissions.

---

### Import en masse
| | |
|---|---|
| **Route** | `/import-masse` |
| **Permission** | `import_masse_view` + `fiches_create` |

- Import CSV / Excel de fiches : mapping colonnes, centre / produit / agent.
- Job asynchrone avec rapport (insérées, doublons, erreurs).

---

### Demandes d'insertion
| | |
|---|---|
| **Route** | `/demandes-insertion` |
| **Permission** | `demandes_insertion_view` |

- Traitement des demandes d'insertion (doublon téléphone) : approbation / rejet avec commentaire.
- Lien vers la fiche existante.

---

### Messages
| | |
|---|---|
| **Route** | `/messages` |
| **Permission** | `messages_view` |

- Messagerie interne : conversations, présence en ligne.
- Commercial en réception seule ; recherche utilisateurs, nouvelle conversation.

---

### Messages système
| | |
|---|---|
| **Route** | `/system-messages` |
| **Permission** | `management_view` |

- Bannières système : titre, type, priorité, dates, cibles (fonctions / utilisateurs).
- Affichées sur les autres pages via `SystemMessageBanner`.

---

## 9. Intégration Vicidial (hors React)

### INSERTION FICHE CRM (`index.php`)
| | |
|---|---|
| **URL** | `/index.php` (racine du projet) |
| **Authentification** | Session agent Vicidial (pseudo + mot de passe `vicidial_users`) |

- Connexion agent avec pseudo et mot de passe Vicidial.
- Chargement automatique du dernier lead qualifié « OK » de l'agent dans Vicidial.
- Formulaire d'insertion fiche : coordonnées, situation familiale, critères techniques (produit PV/PAC, étude, détails étude si OUI, etc.).
- Envoi à l'API CRM (`POST /fiches`) avec rattachement agent / centre via le pseudo CRM.
- État initial BRUT ; gestion des doublons (demande d'insertion ou auto-approbation selon configuration).
- Référentiels (centres, produits, professions, types de contrat) chargés depuis l'API avec cache.

---

## Référence des fonctions utilisateur

| ID | Rôle usuel |
|----|------------|
| 1 | Administrateur |
| 2 | RE / Superviseur qualification |
| 3 | Agent qualification |
| 4 | Qualité qualification / Qualité confirmation |
| 5 | Commercial |
| 6 | Confirmateur |
| 7 | Responsable ADV |
| 8 | Qualité qualification (exclu de certaines pages admin) |
| 9 | Partenaire |
| 11 | Backoffice |
| 12 | RP qualification |
| 13 | RP confirmation |
| 14 | RE confirmation |

---

*Document généré à partir des routes (`App.jsx`), de la sidebar (`Sidebar.jsx`) et du code des pages. Les permissions effectives peuvent être modifiées dans l'écran Permissions.*
