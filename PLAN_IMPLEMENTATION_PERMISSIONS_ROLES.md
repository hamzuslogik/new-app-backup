# Plan d'Implémentation - Permissions et Restrictions par Rôle

## Vue d'ensemble

Ce document décrit le plan d'action pour implémenter les permissions et restrictions spécifiques pour chaque rôle dans l'application CRM.

---

## 📋 Table des Matières

1. [Agent Qualification](#1-agent-qualification)
2. [RE Qualification](#2-re-qualification)
3. [RP Qualification](#3-rp-qualification)
4. [Qualité Qualification](#4-qualité-qualification)
5. [Confirmateur](#5-confirmateur)
6. [RE Confirmation](#6-re-confirmation)
7. [RP Confirmation](#7-rp-confirmation)
8. [Commercial](#8-commercial)

---

## 1. Agent Qualification

### Fonction ID : 3 (à vérifier dans la base de données)

### Page : Fiches (`/fiches`)

#### Modifications à apporter :

1. **Filtrage des fiches**
   - ✅ Voir uniquement les fiches créées le jour même (`date_insert_time = aujourd'hui`)
   - ✅ Voir uniquement les fiches avec états du groupe 0
   - ✅ Pour les états hors groupe 0, afficher une card "Validé"

2. **Masquer les éléments**
   - ❌ Masquer le panneau de recherche et filtres (`showFilters` toujours `false`)
   - ❌ Masquer le bouton "Créer une fiche" (si présent)

3. **Section Production du mois**
   - ✅ Créer une nouvelle section en haut de la page
   - ✅ Afficher des cards avec la production du mois
   - ✅ Répartir par état du groupe 0
   - ✅ Afficher une card "Validé" pour les états hors groupe 0

#### Fichiers à modifier :
- `frontend/src/pages/Fiches.jsx`
- `frontend/src/pages/Fiches.css`
- `backend/routes/fiche.routes.js` (ajouter logique de filtrage)

#### Étapes d'implémentation :

1. **Backend - Route `/api/fiches`**
   ```javascript
   // Dans backend/routes/fiche.routes.js
   if (req.user.fonction === 3) {
     // Filtrer par date du jour
     const today = new Date();
     const startDate = `${today.toISOString().split('T')[0]} 00:00:00`;
     const endDate = `${today.toISOString().split('T')[0]} 23:59:59`;
     
     // Filtrer par groupe 0 ou états hors groupe 0
     // Récupérer les états groupe 0
     const etatsGroupe0 = await query(
       "SELECT id FROM etats WHERE groupe = '0' OR groupe = 0"
     );
     const idsGroupe0 = etatsGroupe0.map(e => e.id);
     
     // Ajouter condition WHERE
     conditions.push(`(f.date_insert_time >= ? AND f.date_insert_time <= ?)`);
     params.push(startDate, endDate);
     conditions.push(`(f.id_etat_final IN (${idsGroupe0.join(',')}) OR f.id_etat_final NOT IN (${idsGroupe0.join(',')}))`);
   }
   ```

2. **Backend - Route `/api/fiches/stats/mois`** (nouvelle route)
   ```javascript
   // Créer une route pour les statistiques du mois
   router.get('/stats/mois', authenticate, async (req, res) => {
     if (req.user.fonction === 3) {
       // Calculer les stats du mois pour l'agent
       // Par état groupe 0
       // + une catégorie "Validé" pour les autres
     }
   });
   ```

3. **Frontend - Page Fiches**
   ```javascript
   // Dans frontend/src/pages/Fiches.jsx
   const { user } = useAuth();
   const isAgentQualif = user?.fonction === 3;
   
   // Masquer les filtres
   const [showFilters] = useState(!isAgentQualif);
   
   // Charger les stats du mois si agent qualif
   const { data: statsMois } = useQuery(
     ['fiches-stats-mois'],
     async () => {
       const res = await api.get('/fiches/stats/mois');
       return res.data;
     },
     { enabled: isAgentQualif }
   );
   ```

4. **Frontend - Composant Cards Production**
   ```jsx
   {isAgentQualif && statsMois && (
     <div className="production-cards">
       {statsMois.map(stat => (
         <div className="production-card" key={stat.etat_id}>
           <h3>{stat.etat_nom}</h3>
           <p className="count">{stat.count}</p>
         </div>
       ))}
       <div className="production-card validated">
         <h3>Validé</h3>
         <p className="count">{statsMois.validated_count}</p>
       </div>
     </div>
   )}
   ```

### Page : Messages

#### À vérifier :
- Vérifier les permissions actuelles pour la page Messages
- S'assurer que l'agent peut accéder à ses messages

---

## 2. RE Qualification

### Fonction ID : À déterminer (probablement 8 ou autre)

### Page : Suivi Agent Qualif (`/suivi-agents-qualif`)

#### Modifications à apporter :

1. **Filtrage des fiches**
   - ✅ Voir uniquement les fiches créées le jour même par les agents sous sa responsabilité
   - ✅ Déterminer la relation superviseur → agents

2. **Filtres disponibles**
   - ✅ Agent (dropdown avec agents sous sa responsabilité)
   - ✅ Date (par défaut : aujourd'hui)
   - ✅ État (dropdown avec états)

3. **Recherche rapide**
   - ✅ Ajouter une barre de recherche dans le tableau
   - ✅ Filtrer en temps réel sur les colonnes visibles

#### Fichiers à modifier :
- `frontend/src/pages/SuiviAgentsQualif.jsx` (existe déjà)
- `backend/routes/statistique.routes.js` (route `/agents-qualif`)

#### Étapes d'implémentation :

1. **Backend - Relation superviseur/agents**
   ```sql
   -- Vérifier la structure de la table utilisateurs
   -- Probablement un champ chef_equipe ou superviseur_id
   ```

2. **Backend - Route mise à jour**
   ```javascript
   // Dans backend/routes/statistique.routes.js
   router.get('/agents-qualif', authenticate, async (req, res) => {
     if (req.user.fonction === RE_QUALIF_FONCTION_ID) {
       // Récupérer les agents sous sa responsabilité
       const agents = await query(`
         SELECT id FROM utilisateurs 
         WHERE chef_equipe = ? OR superviseur_id = ?
       `, [req.user.id, req.user.id]);
       
       // Filtrer les fiches par ces agents
       // Filtrer par date (aujourd'hui par défaut)
     }
   });
   ```

3. **Frontend - Ajout des filtres**
   ```jsx
   <div className="filters-panel">
     <select onChange={handleAgentFilter}>
       <option value="">Tous les agents</option>
       {agents.map(agent => (
         <option key={agent.id} value={agent.id}>{agent.pseudo}</option>
       ))}
     </select>
     
     <input type="date" value={dateFilter} onChange={handleDateFilter} />
     
     <select onChange={handleEtatFilter}>
       <option value="">Tous les états</option>
       {etats.map(etat => (
         <option key={etat.id} value={etat.id}>{etat.titre}</option>
       ))}
     </select>
   </div>
   
   <input 
     type="text" 
     placeholder="Recherche rapide..." 
     value={searchTerm}
     onChange={handleSearch}
     className="quick-search"
   />
   ```

### Page : Messages

#### À vérifier :
- Permissions d'accès aux messages

---

## 3. RP Qualification

### Fonction ID : À déterminer

### Page : Production Qualif (`/production-qualif`)

#### Modifications à apporter :

1. **Affichage par superviseur**
   - ✅ Afficher : nom du superviseur + nombre de fiches par état (BRUT, OK, KO, etc.)
   - ✅ Le RP ne voit que ses superviseurs assignés

2. **Filtres disponibles**
   - ✅ État
   - ✅ Superviseur (dropdown avec superviseurs assignés)
   - ✅ Date

3. **États visibles**
   - ✅ Groupe 0
   - ✅ "Validé" (pour tous les états hors groupe 0)

#### Fichiers à créer/modifier :
- `frontend/src/pages/ProductionQualif.jsx` (nouveau)
- `backend/routes/statistique.routes.js` (nouvelle route)

#### Étapes d'implémentation :

1. **Backend - Route `/api/statistiques/production-qualif`**
   ```javascript
   router.get('/production-qualif', authenticate, async (req, res) => {
     if (req.user.fonction === RP_QUALIF_FONCTION_ID) {
       // Récupérer les superviseurs assignés au RP
       const superviseurs = await query(`
         SELECT id, pseudo, nom, prenom 
         FROM utilisateurs 
         WHERE id IN (
           SELECT superviseur_id FROM rp_superviseurs 
           WHERE rp_id = ?
         )
       `, [req.user.id]);
       
       // Pour chaque superviseur, calculer les stats
       const stats = await Promise.all(
         superviseurs.map(async (superviseur) => {
           // Récupérer les agents sous ce superviseur
           const agents = await query(`
             SELECT id FROM utilisateurs 
             WHERE chef_equipe = ? OR superviseur_id = ?
           `, [superviseur.id, superviseur.id]);
           
           // Calculer les stats par état groupe 0
           // + catégorie "Validé"
           return {
             superviseur,
             stats: { ... }
           };
         })
       );
     }
   });
   ```

2. **Frontend - Page Production Qualif**
   ```jsx
   const ProductionQualif = () => {
     const [filters, setFilters] = useState({
       etat: '',
       superviseur: '',
       date_debut: '',
       date_fin: ''
     });
     
     const { data } = useQuery(
       ['production-qualif', filters],
       async () => {
         const res = await api.get('/statistiques/production-qualif', { params: filters });
         return res.data;
       }
     );
     
     return (
       <div>
         <Filters filters={filters} onChange={setFilters} />
         <table>
           <thead>
             <tr>
               <th>Superviseur</th>
               <th>BRUT</th>
               <th>OK</th>
               <th>KO</th>
               <th>Validé</th>
             </tr>
           </thead>
           <tbody>
             {data?.map(item => (
               <tr key={item.superviseur.id}>
                 <td>{item.superviseur.pseudo}</td>
                 <td>{item.stats.brut}</td>
                 <td>{item.stats.ok}</td>
                 <td>{item.stats.ko}</td>
                 <td>{item.stats.valide}</td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>
     );
   };
   ```

### Page : Suivi Agent Qualif (`/suivi-agents-qualif`)

#### Modifications à apporter :

1. **Filtrage**
   - ✅ Afficher les agents rattachés aux superviseurs assignés au RP

2. **Filtres disponibles**
   - ✅ Agent
   - ✅ Date
   - ✅ État
   - ✅ Recherche rapide

#### Fichiers à modifier :
- `frontend/src/pages/SuiviAgentsQualif.jsx`

### Page : Messages

#### À vérifier :
- Permissions d'accès

---

## 4. Qualité Qualification

### Fonction ID : 4 (probablement)

### Page : Contrôle Qualité (`/controle-qualite`)

#### Modifications à apporter :

1. **Affichage**
   - ✅ Voir la production de l'équipe Qualification (états groupe 0)

2. **Bouton de validation**
   - ✅ Ajouter un bouton/icône à la fin de chaque ligne
   - ✅ Permet de passer la fiche en état "En-Attente"
   - ✅ État "En-Attente" = probablement id_etat_final = 1 (à vérifier)

3. **Filtres disponibles**
   - ✅ Date
   - ✅ Agent
   - ✅ État

#### Fichiers à modifier :
- `frontend/src/pages/ControleQualite.jsx` (existe déjà)
- `backend/routes/fiche.routes.js` (route pour changer l'état)

#### Étapes d'implémentation :

1. **Backend - Route pour validation**
   ```javascript
   router.put('/fiches/:id/valider-qualite', authenticate, async (req, res) => {
     if (req.user.fonction === 4) {
       const { id } = req.params;
       
       // Vérifier que la fiche a un état groupe 0
       const fiche = await queryOne(`
         SELECT f.*, e.groupe 
         FROM fiches f
         INNER JOIN etats e ON f.id_etat_final = e.id
         WHERE f.id = ? AND (e.groupe = '0' OR e.groupe = 0)
       `, [id]);
       
       if (!fiche) {
         return res.status(404).json({ success: false, message: 'Fiche non trouvée' });
       }
       
       // Passer en état "En-Attente" (id = 1)
       await query(`
         UPDATE fiches 
         SET id_etat_final = 1, 
             date_modif = UNIX_TIMESTAMP(),
             date_modif_time = NOW()
         WHERE id = ?
       `, [id]);
       
       res.json({ success: true, message: 'Fiche validée' });
     }
   });
   ```

2. **Frontend - Ajout du bouton**
   ```jsx
   <td>
     <button 
       className="btn-validate"
       onClick={() => handleValidate(fiche.id)}
       title="Valider et passer en En-Attente"
     >
       <FaCheck /> Valider
     </button>
   </td>
   ```

### Page : Messages

#### À vérifier :
- Permissions d'accès

---

## 5. Confirmateur

### Fonction ID : 6

### Page d'accueil : Dashboard (`/dashboard`)

#### Modifications à apporter :

1. **Affichage**
   - ✅ Cards avec fiches confirmées aujourd'hui par toute l'équipe
   - ✅ Liste des fiches confirmées aujourd'hui

2. **Masquer**
   - ❌ Tableau des confirmateurs en bas de page (non visible)

#### Fichiers à modifier :
- `frontend/src/pages/Dashboard.jsx`

#### Étapes d'implémentation :

1. **Frontend - Dashboard**
   ```jsx
   const { user } = useAuth();
   const isConfirmateur = user?.fonction === 6;
   
   // Masquer le tableau des confirmateurs
   {!isConfirmateur && (
     <ConfirmateursTable />
   )}
   
   // Afficher les cards et liste des fiches confirmées
   {isConfirmateur && (
     <>
       <FichesConfirmeesCards />
       <FichesConfirmeesList />
     </>
   )}
   ```

2. **Backend - Route `/api/dashboard/fiches-confirmees`**
   ```javascript
   router.get('/dashboard/fiches-confirmees', authenticate, async (req, res) => {
     if (req.user.fonction === 6) {
       const today = new Date();
       const startDate = `${today.toISOString().split('T')[0]} 00:00:00`;
       const endDate = `${today.toISOString().split('T')[0]} 23:59:59`;
       
       // Récupérer les fiches confirmées aujourd'hui
       const fiches = await query(`
         SELECT f.*, u.pseudo as confirmateur_pseudo
         FROM fiches f
         INNER JOIN utilisateurs u ON f.id_confirmateur = u.id
         WHERE f.date_confirmation >= ? 
         AND f.date_confirmation <= ?
         AND f.id_etat_final = 7 -- CONFIRMER
       `, [startDate, endDate]);
       
       res.json({ success: true, data: fiches });
     }
   });
   ```

### Page : Messages

#### À vérifier :
- Permissions d'accès

### Page : Décalages (`/decalages`)

#### Modifications à apporter :

1. **Filtrage**
   - ✅ Voir uniquement les demandes de décalage qui le concernent
   - ✅ Filtrer par `destination = user.id` ou `id_confirmateur = user.id`

#### Fichiers à modifier :
- `frontend/src/pages/Decalages.jsx`
- `backend/routes/decalage.routes.js`

### Page : Planning Dép

#### À vérifier :
- Permissions d'accès

### Page : Validation

#### À vérifier :
- Permissions d'accès

---

## 6. RE Confirmation

### Fonction ID : À déterminer

### Page d'accueil : Dashboard (`/dashboard`)

#### Modifications à apporter :

1. **Identique au Confirmateur**
   - ✅ Cards + fiches confirmées aujourd'hui par l'équipe
   - ❌ Tableau confirmateur non visible

#### Fichiers à modifier :
- `frontend/src/pages/Dashboard.jsx`

### Page : Messages

#### À vérifier :
- Permissions d'accès

### Page : Décalages (`/decalages`)

#### Modifications à apporter :

1. **Filtrage**
   - ✅ Voir uniquement les décalages concernant ses confirmateurs
   - ✅ Déterminer la relation RE → confirmateurs

#### Fichiers à modifier :
- `frontend/src/pages/Decalages.jsx`
- `backend/routes/decalage.routes.js`

### Page : Planning Dép

#### À vérifier :
- Permissions d'accès

### Page : Validation

#### À vérifier :
- Permissions d'accès

---

## 7. RP Confirmation

### Fonction ID : À déterminer

#### Modifications à apporter :

1. **Accès complet sauf :**
   - ❌ Gestion (`/management`)
   - ❌ Permissions (`/permissions`)
   - ❌ Import en masse (`/import`)

#### Fichiers à modifier :
- Routes backend avec middleware de permission
- Navigation frontend

#### Étapes d'implémentation :

1. **Backend - Middleware de restriction**
   ```javascript
   // Dans chaque route concernée
   if (req.user.fonction === RP_CONFIRMATION_FONCTION_ID) {
     const restrictedRoutes = ['/management', '/permissions', '/import'];
     if (restrictedRoutes.some(route => req.path.startsWith(route))) {
       return res.status(403).json({ 
         success: false, 
         message: 'Accès refusé' 
       });
     }
   }
   ```

2. **Frontend - Navigation**
   ```jsx
   const { user } = useAuth();
   const isRPConfirmation = user?.fonction === RP_CONFIRMATION_FONCTION_ID;
   
   {!isRPConfirmation && (
     <>
       <NavLink to="/management">Gestion</NavLink>
       <NavLink to="/permissions">Permissions</NavLink>
       <NavLink to="/import">Import</NavLink>
     </>
   )}
   ```

---

## 8. Commercial

### Fonction ID : 5

### Page : Planning Commercial (`/planning-commercial`)

#### Modifications à apporter :

1. **Visualisation**
   - ✅ Voir uniquement ses rendez-vous
   - ✅ Filtrer par `id_commercial = user.id`

#### Fichiers à modifier :
- `frontend/src/pages/PlanningCommercial.jsx`
- `backend/routes/planning.routes.js`

#### Étapes d'implémentation :

1. **Backend - Route `/api/planning/commercial`**
   ```javascript
   router.get('/planning/commercial', authenticate, async (req, res) => {
     if (req.user.fonction === 5) {
       // Filtrer par id_commercial
       const rdvs = await query(`
         SELECT * FROM fiches
         WHERE id_commercial = ?
         AND id_etat_final = 7 -- CONFIRMER
         AND date_rdv_time IS NOT NULL
       `, [req.user.id]);
       
       res.json({ success: true, data: rdvs });
     }
   });
   ```

### Page : Messages

#### À vérifier :
- Permissions d'accès

---

## 📝 Checklist d'Implémentation

### Phase 1 : Préparation
- [ ] Identifier les IDs de fonction pour chaque rôle
- [ ] Vérifier la structure de la base de données (relations superviseur/agent, etc.)
- [ ] Créer les permissions nécessaires dans la table `permissions`
- [ ] Configurer les permissions par fonction dans `fonction_permissions`

### Phase 2 : Backend
- [ ] Modifier les routes pour filtrer selon les rôles
- [ ] Créer les nouvelles routes nécessaires (stats, production, etc.)
- [ ] Ajouter les middlewares de vérification
- [ ] Tester les routes avec Postman/Thunder Client

### Phase 3 : Frontend
- [ ] Modifier les pages existantes selon les rôles
- [ ] Créer les nouvelles pages nécessaires
- [ ] Ajouter les composants de filtrage et recherche
- [ ] Implémenter les cards de production
- [ ] Masquer/afficher les éléments selon les permissions

### Phase 4 : Tests
- [ ] Tester chaque rôle avec un compte de test
- [ ] Vérifier les filtres et restrictions
- [ ] Vérifier les permissions d'accès
- [ ] Tester les fonctionnalités de validation

### Phase 5 : Documentation
- [ ] Documenter les nouvelles routes API
- [ ] Mettre à jour la documentation des permissions
- [ ] Créer un guide utilisateur par rôle

---

## 🔍 Points à Vérifier

1. **Structure de la base de données**
   - Relation superviseur → agents
   - Relation RP → superviseurs
   - Relation RE → confirmateurs
   - Champ `groupe` dans la table `etats`

2. **IDs de fonction**
   - Agent Qualification : 3 (confirmé)
   - Qualité Qualification : 4 (probable)
   - Commercial : 5 (confirmé)
   - Confirmateur : 6 (confirmé)
   - RE Qualification : ?
   - RP Qualification : ?
   - RE Confirmation : ?
   - RP Confirmation : ?

3. **États**
   - Groupe 0 : Quels sont les états ?
   - "En-Attente" : Quel est l'ID ?
   - "Validé" : Comment regrouper les états hors groupe 0 ?

4. **Relations hiérarchiques**
   - Comment sont stockées les relations superviseur/agent ?
   - Comment sont stockées les relations RP/superviseur ?
   - Comment sont stockées les relations RE/confirmateur ?

---

## 📚 Ressources

- Fichier de permissions : `README_PERMISSIONS.md`
- Routes API : `backend/routes/`
- Pages frontend : `frontend/src/pages/`
- Base de données : Serveur distant `151.80.58.72`

---

## 🚀 Ordre de Priorité Recommandé

1. **Agent Qualification** (le plus simple, base pour les autres)
2. **Qualité Qualification** (validation simple)
3. **Confirmateur** (dashboard)
4. **Commercial** (planning)
5. **RE Qualification** (nécessite relations)
6. **RP Qualification** (nécessite relations)
7. **RE Confirmation** (nécessite relations)
8. **RP Confirmation** (restrictions simples)

---

*Document créé le : [Date actuelle]*
*Dernière mise à jour : [Date actuelle]*

