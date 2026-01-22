const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { query, queryOne } = require('../config/database');

/**
 * GET /api/ia-assistance/analyze
 * Analyse les rendez-vous pour une date donnée
 * Retourne : problèmes détectés, qualification des RDV, rapport synthétique
 */
router.get('/analyze', authenticate, async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'La date est requise'
      });
    }

    const targetDate = `${date} 00:00:00`;
    const targetDateEnd = `${date} 23:59:59`;

    // 1. Détecter les problèmes
    const problems = await detectProblems(targetDate, targetDateEnd);

    // 2. Qualifier les rendez-vous
    const qualifiedRdvs = await qualifyRdvs(targetDate, targetDateEnd);

    // 3. Générer le rapport synthétique
    const report = await generateReport(targetDate, targetDateEnd, problems, qualifiedRdvs);

    res.json({
      success: true,
      data: {
        date,
        problems,
        qualifiedRdvs,
        report
      }
    });
  } catch (error) {
    console.error('Erreur lors de l\'analyse IA:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'analyse',
      error: error.message
    });
  }
});

/**
 * Détecte les problèmes dans les rendez-vous
 */
async function detectProblems(dateStart, dateEnd) {
  const problems = [];

  // Problème 1: RDV avec date dans le passé
  const pastRdvs = await query(`
    SELECT f.id, f.hash, f.nom, f.prenom, f.tel, f.date_rdv_time, f.id_etat_final
    FROM fiches f
    WHERE f.date_rdv_time < NOW()
      AND DATE(f.date_rdv_time) = DATE(?)
      AND f.id_etat_final = 7
      AND (f.archive = 0 OR f.archive IS NULL)
    ORDER BY f.date_rdv_time DESC
    LIMIT 50
  `, [dateStart]);

  pastRdvs.forEach(rdv => {
    problems.push({
      type: 'RDV dans le passé',
      severity: 'high',
      description: `Le rendez-vous est programmé dans le passé (${new Date(rdv.date_rdv_time).toLocaleString('fr-FR')})`,
      fiche: {
        id: rdv.id,
        hash: rdv.hash,
        nom: rdv.nom,
        prenom: rdv.prenom,
        tel: rdv.tel
      },
      details: {
        date_rdv: rdv.date_rdv_time,
        etat: rdv.id_etat_final
      }
    });
  });

  // Problème 2: RDV confirmés sans date de RDV
  const rdvWithoutDate = await query(`
    SELECT f.id, f.hash, f.nom, f.prenom, f.tel, f.id_etat_final
    FROM fiches f
    WHERE f.id_etat_final = 7
      AND (f.date_rdv_time IS NULL OR f.date_rdv_time = '')
      AND DATE(f.date_modif_time) = DATE(?)
      AND (f.archive = 0 OR f.archive IS NULL)
    LIMIT 50
  `, [dateStart]);

  rdvWithoutDate.forEach(rdv => {
    problems.push({
      type: 'RDV confirmé sans date',
      severity: 'high',
      description: 'Le rendez-vous est confirmé mais aucune date de RDV n\'est renseignée',
      fiche: {
        id: rdv.id,
        hash: rdv.hash,
        nom: rdv.nom,
        prenom: rdv.prenom,
        tel: rdv.tel
      },
      details: {
        etat: rdv.id_etat_final
      }
    });
  });

  // Problème 3: Changements d'état fréquents (plus de 5 changements dans les 7 derniers jours)
  const frequentChanges = await query(`
    SELECT 
      f.id,
      f.hash,
      f.nom,
      f.prenom,
      f.tel,
      COUNT(fh.id) as change_count
    FROM fiches f
    INNER JOIN fiches_histo fh ON f.id = fh.id_fiche
    WHERE DATE(f.date_rdv_time) = DATE(?)
      AND f.id_etat_final = 7
      AND fh.date_creation >= DATE_SUB(?, INTERVAL 7 DAY)
      AND (f.archive = 0 OR f.archive IS NULL)
    GROUP BY f.id, f.hash, f.nom, f.prenom, f.tel
    HAVING change_count > 5
    LIMIT 50
  `, [dateStart, dateStart]);

  frequentChanges.forEach(rdv => {
    problems.push({
      type: 'Changements d\'état fréquents',
      severity: 'medium',
      description: `${rdv.change_count} changements d'état dans les 7 derniers jours`,
      fiche: {
        id: rdv.id,
        hash: rdv.hash,
        nom: rdv.nom,
        prenom: rdv.prenom,
        tel: rdv.tel
      },
      details: {
        nombre_changements: rdv.change_count
      }
    });
  });

  // Problème 4: RDV avec historique d'annulations
  const cancelledHistory = await query(`
    SELECT DISTINCT
      f.id,
      f.hash,
      f.nom,
      f.prenom,
      f.tel,
      COUNT(CASE WHEN fh.id_etat = 8 THEN 1 END) as cancellation_count
    FROM fiches f
    INNER JOIN fiches_histo fh ON f.id = fh.id_fiche
    WHERE DATE(f.date_rdv_time) = DATE(?)
      AND f.id_etat_final = 7
      AND (f.archive = 0 OR f.archive IS NULL)
    GROUP BY f.id, f.hash, f.nom, f.prenom, f.tel
    HAVING cancellation_count > 0
    LIMIT 50
  `, [dateStart]);

  cancelledHistory.forEach(rdv => {
    problems.push({
      type: 'Historique d\'annulations',
      severity: 'medium',
      description: `Ce rendez-vous a été annulé ${rdv.cancellation_count} fois dans le passé`,
      fiche: {
        id: rdv.id,
        hash: rdv.hash,
        nom: rdv.nom,
        prenom: rdv.prenom,
        tel: rdv.tel
      },
      details: {
        nombre_annulations: rdv.cancellation_count
      }
    });
  });

  // Problème 5: RDV sans commercial assigné
  const rdvWithoutCommercial = await query(`
    SELECT f.id, f.hash, f.nom, f.prenom, f.tel, f.id_commercial
    FROM fiches f
    WHERE DATE(f.date_rdv_time) = DATE(?)
      AND f.id_etat_final = 7
      AND (f.id_commercial IS NULL OR f.id_commercial = 0)
      AND (f.archive = 0 OR f.archive IS NULL)
    LIMIT 50
  `, [dateStart]);

  rdvWithoutCommercial.forEach(rdv => {
    problems.push({
      type: 'RDV sans commercial assigné',
      severity: 'low',
      description: 'Le rendez-vous est confirmé mais aucun commercial n\'est assigné',
      fiche: {
        id: rdv.id,
        hash: rdv.hash,
        nom: rdv.nom,
        prenom: rdv.prenom,
        tel: rdv.tel
      },
      details: {
        id_commercial: rdv.id_commercial
      }
    });
  });

  return problems;
}

/**
 * Qualifie les rendez-vous selon leur historique
 */
async function qualifyRdvs(dateStart, dateEnd) {
  // Récupérer tous les RDV confirmés pour la date
  const rdvs = await query(`
    SELECT 
      f.id as fiche_id,
      f.hash,
      f.nom,
      f.prenom,
      f.tel,
      f.date_rdv_time,
      f.id_etat_final,
      f.id_commercial,
      f.id_confirmateur,
      f.date_modif_time
    FROM fiches f
    WHERE DATE(f.date_rdv_time) = DATE(?)
      AND f.id_etat_final = 7
      AND (f.archive = 0 OR f.archive IS NULL)
    ORDER BY f.date_rdv_time ASC
  `, [dateStart]);

  const qualifiedRdvs = [];

  for (const rdv of rdvs) {
    // Calculer le score de qualification
    let score = 100;

    // Récupérer l'historique des états
    const history = await query(`
      SELECT id_etat, date_creation
      FROM fiches_histo
      WHERE id_fiche = ?
      ORDER BY date_creation ASC
    `, [rdv.fiche_id]);

    const stateChanges = history.length;
    const hasCancellations = history.some(h => h.id_etat === 8);

    // Pénalités selon les critères
    // -10 points par changement d'état (max -50)
    score -= Math.min(stateChanges * 10, 50);

    // -20 points si annulations dans l'historique
    if (hasCancellations) {
      score -= 20;
    }

    // -15 points si pas de commercial assigné
    if (!rdv.id_commercial || rdv.id_commercial === 0) {
      score -= 15;
    }

    // -10 points si pas de confirmateur
    if (!rdv.id_confirmateur || rdv.id_confirmateur === 0) {
      score -= 10;
    }

    // Bonus si confirmé récemment (dans les 24h)
    const modifDate = new Date(rdv.date_modif_time);
    const now = new Date();
    const hoursSinceModif = (now - modifDate) / (1000 * 60 * 60);
    if (hoursSinceModif < 24) {
      score += 5;
    }

    // S'assurer que le score reste entre 0 et 100
    score = Math.max(0, Math.min(100, score));

    qualifiedRdvs.push({
      fiche_id: rdv.fiche_id,
      hash: rdv.hash,
      nom: rdv.nom,
      prenom: rdv.prenom,
      tel: rdv.tel,
      date_rdv_time: rdv.date_rdv_time,
      score: Math.round(score),
      state_changes: stateChanges,
      has_cancellations: hasCancellations,
      has_commercial: !!(rdv.id_commercial && rdv.id_commercial > 0),
      has_confirmateur: !!(rdv.id_confirmateur && rdv.id_confirmateur > 0)
    });
  }

  // Trier par score décroissant
  qualifiedRdvs.sort((a, b) => b.score - a.score);

  return qualifiedRdvs;
}

/**
 * Génère un rapport synthétique
 */
async function generateReport(dateStart, dateEnd, problems, qualifiedRdvs) {
  // Statistiques générales
  const totalRdv = await queryOne(`
    SELECT COUNT(*) as count
    FROM fiches
    WHERE DATE(date_rdv_time) = DATE(?)
      AND id_etat_final = 7
      AND (archive = 0 OR archive IS NULL)
  `, [dateStart]);

  const confirmedRdv = totalRdv?.count || 0;
  const problemsCount = problems.length;
  
  // Calculer le score moyen
  const averageScore = qualifiedRdvs.length > 0
    ? qualifiedRdvs.reduce((sum, rdv) => sum + rdv.score, 0) / qualifiedRdvs.length
    : 0;

  // Générer le résumé textuel
  const summary = generateSummary(confirmedRdv, problemsCount, averageScore, problems, qualifiedRdvs);

  // Générer les recommandations
  const recommendations = generateRecommendations(problems, qualifiedRdvs);

  // Générer les tendances
  const trends = generateTrends(problems, qualifiedRdvs);

  return {
    total_rdv: confirmedRdv,
    confirmed_rdv: confirmedRdv,
    problems_count: problemsCount,
    average_score: Math.round(averageScore * 10) / 10,
    summary,
    recommendations,
    trends
  };
}

/**
 * Génère un résumé textuel
 */
function generateSummary(totalRdv, problemsCount, averageScore, problems, qualifiedRdvs) {
  const lines = [];

  lines.push(`Analyse des rendez-vous pour le ${new Date().toLocaleDateString('fr-FR')}`);
  lines.push('');
  lines.push(`Total de rendez-vous confirmés : ${totalRdv}`);
  
  if (problemsCount > 0) {
    lines.push(`⚠️ ${problemsCount} problème(s) détecté(s) nécessitant une attention.`);
  } else {
    lines.push(`✅ Aucun problème détecté.`);
  }

  lines.push(`Score moyen de qualification : ${Math.round(averageScore)}/100`);

  if (qualifiedRdvs.length > 0) {
    const excellentCount = qualifiedRdvs.filter(r => r.score >= 80).length;
    const lowCount = qualifiedRdvs.filter(r => r.score < 40).length;
    
    if (excellentCount > 0) {
      lines.push(`✅ ${excellentCount} rendez-vous avec une qualification excellente (≥80/100)`);
    }
    
    if (lowCount > 0) {
      lines.push(`⚠️ ${lowCount} rendez-vous avec une qualification faible (<40/100) nécessitent une attention particulière`);
    }
  }

  return lines.join('\n');
}

/**
 * Génère des recommandations
 */
function generateRecommendations(problems, qualifiedRdvs) {
  const recommendations = [];

  // Analyser les problèmes pour générer des recommandations
  const highSeverityProblems = problems.filter(p => p.severity === 'high');
  if (highSeverityProblems.length > 0) {
    recommendations.push(`Traiter en priorité les ${highSeverityProblems.length} problème(s) de haute sévérité détectés.`);
  }

  const pastRdvs = problems.filter(p => p.type === 'RDV dans le passé');
  if (pastRdvs.length > 0) {
    recommendations.push(`Contacter ${pastRdvs.length} client(s) avec des rendez-vous dans le passé pour reprogrammer.`);
  }

  const rdvWithoutDate = problems.filter(p => p.type === 'RDV confirmé sans date');
  if (rdvWithoutDate.length > 0) {
    recommendations.push(`Compléter les dates de rendez-vous pour ${rdvWithoutDate.length} fiche(s) confirmée(s) sans date.`);
  }

  const lowScoreRdvs = qualifiedRdvs.filter(r => r.score < 40);
  if (lowScoreRdvs.length > 0) {
    recommendations.push(`Vérifier ${lowScoreRdvs.length} rendez-vous avec une qualification faible (historique d'annulations ou changements fréquents).`);
  }

  const rdvWithoutCommercial = problems.filter(p => p.type === 'RDV sans commercial assigné');
  if (rdvWithoutCommercial.length > 0) {
    recommendations.push(`Assigner un commercial à ${rdvWithoutCommercial.length} rendez-vous non assignés.`);
  }

  if (recommendations.length === 0) {
    recommendations.push('Aucune action urgente requise. Tous les rendez-vous semblent en ordre.');
  }

  return recommendations;
}

/**
 * Génère les tendances observées
 */
function generateTrends(problems, qualifiedRdvs) {
  const trends = [];

  if (qualifiedRdvs.length > 0) {
    const avgScore = qualifiedRdvs.reduce((sum, r) => sum + r.score, 0) / qualifiedRdvs.length;
    if (avgScore >= 70) {
      trends.push('Qualité générale des rendez-vous : Excellente');
    } else if (avgScore >= 50) {
      trends.push('Qualité générale des rendez-vous : Correcte');
    } else {
      trends.push('Qualité générale des rendez-vous : À améliorer');
    }
  }

  const cancellationProblems = problems.filter(p => p.type === 'Historique d\'annulations');
  if (cancellationProblems.length > 0) {
    trends.push(`${cancellationProblems.length} rendez-vous avec un historique d'annulations détecté`);
  }

  const frequentChanges = problems.filter(p => p.type === 'Changements d\'état fréquents');
  if (frequentChanges.length > 0) {
    trends.push(`${frequentChanges.length} rendez-vous avec des changements d'état fréquents (instabilité)`);
  }

  if (trends.length === 0) {
    trends.push('Aucune tendance particulière observée');
  }

  return trends;
}

module.exports = router;

