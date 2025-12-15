# Analyse des éléments manquants dans Dashboard.jsx

## Rôles et leurs fonction IDs
- **Agent Qualification**: fonction 3
- **RE Qualification**: fonction 2 (Superviseur) - contexte Qualification
- **RP Qualification**: fonction 2 (Superviseur) - contexte Qualification  
- **Qualité Qualification**: fonction 4
- **Confirmateur**: fonction 6
- **RE Confirmation**: fonction 2 (Superviseur) - contexte Confirmation
- **RP Confirmation**: fonction 2 (Superviseur) - contexte Confirmation
- **Commercial**: fonction 5

## Éléments manquants dans Dashboard.jsx

### 1. Confirmateur (fonction 6) - ❌ MANQUANT

**Exigences:**
- ✅ Affiche des cards et la liste des fiches confirmées aujourd'hui par toute l'équipe
- ❌ **Le tableau des confirmateurs en bas de page n'est PAS visible**

**Problème actuel:**
- Le tableau des confirmateurs est affiché si `hasPermission('dashboard_view_confirmateurs_tabs')` est vrai
- Pour Confirmateur, ce tableau doit être masqué même si la permission existe

**Solution nécessaire:**
```jsx
// Ligne 879 - Modifier la condition
{hasPermission('dashboard_view_confirmateurs_tabs') && 
 user?.fonction !== 6 && // Ajouter cette condition pour masquer pour Confirmateur
 !isLoadingStats && dashboardStats && (
  // ... tableau confirmateurs
)}
```

### 2. RE Confirmation (fonction 2 - contexte Confirmation) - ❌ MANQUANT

**Exigences:**
- ✅ Identique au Confirmateur : cards + fiches confirmées aujourd'hui par l'équipe
- ❌ **Tableau confirmateur non visible**

**Problème actuel:**
- Même problème que Confirmateur
- Besoin d'identifier si c'est un RE Confirmation vs RE Qualification
- Probablement besoin d'une permission ou d'un champ supplémentaire pour différencier

**Solution nécessaire:**
- Ajouter une logique pour identifier RE Confirmation (peut nécessiter une permission spécifique ou un champ dans la base)
- Masquer le tableau des confirmateurs pour RE Confirmation

### 3. Panneau de recherche et filtres - ⚠️ À VÉRIFIER

**Pour Confirmateur et RE Confirmation:**
- Les exigences ne mentionnent pas explicitement si les filtres doivent être visibles
- Actuellement, les filtres sont toujours visibles (ligne 405-686)
- À vérifier avec le client si les filtres doivent être masqués pour ces rôles

### 4. Onglets (Tabs) - ⚠️ PARTIELLEMENT IMPLÉMENTÉ

**Actuel:**
- Les onglets sont affichés si `hasPermission('dashboard_view_confirmateurs_tabs')` (ligne 689)
- Onglets: "CONFIRMER / PRE-CONFIRMER / RDV_URGENT" et "Fiches créées aujourd'hui"

**Pour Confirmateur et RE Confirmation:**
- Les exigences mentionnent "fiches confirmées aujourd'hui par toute l'équipe"
- Cela correspond à l'onglet "confirmed"
- L'onglet "created" pourrait ne pas être nécessaire pour ces rôles

**Solution nécessaire:**
- Vérifier si les onglets doivent être simplifiés pour Confirmateur/RE Confirmation
- Peut-être afficher uniquement l'onglet "confirmed" pour ces rôles

### 5. Commercial (fonction 5) - ❌ NON MENTIONNÉ

**Exigences:**
- Page Planning Commercial : visualisation de ses rendez-vous
- Page Messages
- **Dashboard n'est PAS mentionné pour Commercial**

**Problème actuel:**
- Dashboard est accessible si permission `dashboard_view` existe
- Commercial pourrait ne pas avoir besoin d'accès au Dashboard, ou devrait voir une vue différente

**Solution nécessaire:**
- Soit masquer Dashboard pour Commercial
- Soit créer une vue Dashboard spécifique pour Commercial (non mentionnée dans les exigences)

### 6. Agent Qualification, RE Qualification, RP Qualification, Qualité Qualification - ✅ CORRECT

**Ces rôles n'ont PAS d'exigences spécifiques pour Dashboard:**
- Agent Qualification → Page Fiches (déjà implémenté)
- RE Qualification → Page Suivi Agent Qualif (déjà implémenté)
- RP Qualification → Page Production Qualif et Suivi Agent Qualif (déjà implémenté)
- Qualité Qualification → Page Contrôle Qualité (déjà implémenté)

## Résumé des modifications nécessaires

### Modifications critiques (à faire immédiatement):

1. **Masquer le tableau des confirmateurs pour Confirmateur (fonction 6)**
   - Ligne 879: Ajouter condition `user?.fonction !== 6`

2. **Masquer le tableau des confirmateurs pour RE Confirmation**
   - Identifier comment différencier RE Confirmation de RE Qualification
   - Ajouter la condition appropriée

3. **Vérifier la visibilité des onglets pour Confirmateur/RE Confirmation**
   - Peut-être simplifier pour n'afficher que l'onglet "confirmed"

### Modifications à vérifier avec le client:

4. **Visibilité des filtres pour Confirmateur/RE Confirmation**
   - Les exigences ne sont pas claires sur ce point

5. **Accès Dashboard pour Commercial**
   - Les exigences ne mentionnent pas Dashboard pour Commercial

### Code actuel à modifier:

**Ligne 879 - Tableau des confirmateurs:**
```jsx
// ACTUEL:
{hasPermission('dashboard_view_confirmateurs_tabs') && !isLoadingStats && dashboardStats && (

// À MODIFIER EN:
{hasPermission('dashboard_view_confirmateurs_tabs') && 
 user?.fonction !== 6 && // Masquer pour Confirmateur
 !isREConfirmation && // Masquer pour RE Confirmation (à définir)
 !isLoadingStats && dashboardStats && (
```

**Ligne 689 - Onglets:**
```jsx
// ACTUEL:
{hasPermission('dashboard_view_confirmateurs_tabs') && (

// À VÉRIFIER:
// Peut-être simplifier pour Confirmateur/RE Confirmation
{hasPermission('dashboard_view_confirmateurs_tabs') && 
 (user?.fonction !== 6 && !isREConfirmation) && ( // Afficher tous les onglets seulement si pas Confirmateur/RE Confirmation
```

## Questions à clarifier

1. Comment identifier un RE Confirmation vs RE Qualification? (même fonction 2)
   - Permission spécifique?
   - Champ dans la base de données?
   - Contexte basé sur les pages accessibles?

2. Les filtres doivent-ils être masqués pour Confirmateur/RE Confirmation?

3. Les onglets doivent-ils être simplifiés pour Confirmateur/RE Confirmation?

4. Commercial doit-il avoir accès au Dashboard? Si oui, quelle vue?

