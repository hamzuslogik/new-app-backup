# Suggestions de KPI supplémentaires pour la page KPI Qualification

## KPI actuellement affichés
1. **Meilleur Agent** - Nombre de fiches validées
2. **Meilleure Équipe** - Nombre de fiches validées par équipe

---

## Suggestions de nouveaux KPI

### 1. **Taux de Conversion** ⭐ (Priorité haute)
**Description** : Pourcentage de fiches validées par rapport au total de fiches créées
**Formule** : (Fiches validées / Fiches totales) × 100
**Utilité** : Mesure l'efficacité globale de la qualification
**Affichage** : Carte avec pourcentage, indicateur visuel (barre de progression), comparaison avec période précédente

### 2. **Top 3 des Agents** ⭐ (Priorité haute)
**Description** : Classement des 3 meilleurs agents au lieu d'un seul
**Utilité** : Donne une vision plus large de la performance
**Affichage** : Liste avec médailles (🥇 🥈 🥉), photos, noms, scores

### 3. **Top 3 des Équipes** ⭐ (Priorité haute)
**Description** : Classement des 3 meilleures équipes
**Utilité** : Encourage la compétition saine entre équipes
**Affichage** : Liste avec médailles, superviseurs, nombre d'agents, scores

### 4. **Répartition par Phase** ⭐ (Priorité moyenne)
**Description** : Nombre de fiches validées par phase (Phase 1, 2, 3)
**Utilité** : Comprendre la distribution des validations
**Affichage** : Graphique en camembert ou barres, avec pourcentages

### 5. **Taux de Rejet** ⭐ (Priorité moyenne)
**Description** : Pourcentage de fiches rejetées (groupe 0) par rapport au total
**Formule** : (Fiches groupe 0 / Fiches totales) × 100
**Utilité** : Identifier les problèmes de qualité
**Affichage** : Carte avec pourcentage, indicateur de couleur (vert/orange/rouge selon seuil)

### 6. **Production Moyenne par Agent** (Priorité moyenne)
**Description** : Nombre moyen de fiches validées par agent actif
**Formule** : Fiches validées / Nombre d'agents actifs
**Utilité** : Mesure la productivité moyenne de l'équipe
**Affichage** : Carte avec nombre moyen, comparaison avec objectif

### 7. **Évolution vs Période Précédente** ⭐ (Priorité haute)
**Description** : Comparaison avec la période précédente (ex: cette semaine vs semaine dernière)
**Utilité** : Suivre les tendances et l'amélioration
**Affichage** : Indicateur avec flèche (↑/↓), pourcentage de variation, couleur (vert si amélioration)

### 8. **Temps Moyen de Traitement** (Priorité basse)
**Description** : Temps moyen entre la création d'une fiche et sa validation
**Formule** : Moyenne (date_validation - date_insert_time)
**Utilité** : Mesurer la rapidité de traitement
**Affichage** : Carte avec temps en heures/jours, comparaison avec objectif

### 9. **Taux de Qualité** (Priorité basse)
**Description** : Pourcentage de fiches validées sans retour/erreur
**Utilité** : Mesurer la qualité du travail (nécessite un champ de suivi des retours)
**Affichage** : Carte avec pourcentage, indicateur de qualité

### 10. **Répartition par Centre** (Priorité moyenne)
**Description** : Performance par centre (nombre de fiches validées par centre)
**Utilité** : Identifier les centres les plus performants
**Affichage** : Graphique en barres horizontales, liste des centres avec scores

### 11. **Fiches en Cours de Traitement** (Priorité moyenne)
**Description** : Nombre de fiches créées mais pas encore validées
**Utilité** : Suivre le backlog de travail
**Affichage** : Carte avec nombre, indicateur d'alerte si trop élevé

### 12. **Taux de Performance par Heure** (Priorité basse)
**Description** : Nombre de fiches validées par heure de travail
**Formule** : Fiches validées / Heures travaillées (nécessite suivi des heures)
**Utilité** : Mesurer l'efficacité horaire
**Affichage** : Carte avec ratio, comparaison avec objectif

---

## Recommandations d'implémentation

### Phase 1 (Priorité haute) - À implémenter en premier :
1. **Taux de Conversion**
2. **Top 3 des Agents**
3. **Top 3 des Équipes**
4. **Évolution vs Période Précédente**

### Phase 2 (Priorité moyenne) :
5. **Répartition par Phase**
6. **Taux de Rejet**
7. **Répartition par Centre**
8. **Fiches en Cours de Traitement**

### Phase 3 (Priorité basse) :
9. **Production Moyenne par Agent**
10. **Temps Moyen de Traitement**
11. **Taux de Qualité**
12. **Taux de Performance par Heure**

---

## Suggestions d'amélioration de l'interface

### Organisation visuelle :
- **Section "Performance"** : Meilleur agent, Top 3 agents, Top 3 équipes
- **Section "Métriques Globales"** : Taux de conversion, Taux de rejet, Production moyenne
- **Section "Analyse"** : Répartition par phase, Répartition par centre, Évolution
- **Section "Suivi"** : Fiches en cours, Temps moyen de traitement

### Graphiques recommandés :
- **Graphique en barres** : Top 3 agents/équipes, Répartition par centre
- **Graphique en camembert** : Répartition par phase
- **Graphique linéaire** : Évolution dans le temps
- **Indicateurs de tendance** : Flèches ↑/↓ avec couleurs pour l'évolution

### Couleurs suggérées :
- **Vert** : Performance positive, amélioration
- **Orange** : Performance moyenne, attention requise
- **Rouge** : Performance faible, action requise
- **Bleu** : Informations neutres, données générales

---

## Exemple de structure de données backend

```javascript
{
  jour: {
    // KPI existants
    best_agent: {...},
    best_team: {...},
    
    // Nouveaux KPI suggérés
    top3_agents: [...],
    top3_teams: [...],
    conversion_rate: 75.5, // %
    rejection_rate: 12.3, // %
    evolution: {
      current: 150,
      previous: 140,
      change: +7.14, // %
      trend: 'up' // 'up' | 'down' | 'stable'
    },
    phase_distribution: {
      phase1: 45,
      phase2: 60,
      phase3: 45
    },
    average_per_agent: 10.5,
    in_progress: 25,
    centers_performance: [
      { center_id: 1, center_nom: 'Centre A', count: 50 },
      { center_id: 2, center_nom: 'Centre B', count: 75 }
    ]
  },
  semaine: {...},
  mois: {...}
}
```

---

## Notes techniques

- Les calculs doivent exclure les fiches archivées (archive = 0 ou NULL)
- Les fiches validées = fiches avec groupe 1, 2 ou 3 (hors groupe 0)
- Les périodes doivent être cohérentes avec les filtres existants (jour, semaine, mois)
- Les comparaisons avec période précédente nécessitent de calculer les dates de la période précédente

