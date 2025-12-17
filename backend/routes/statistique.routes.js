const express = require('express');
const router = express.Router();
const { authenticate, checkPermission } = require('../middleware/auth.middleware');
const { checkPermissionCode } = require('../middleware/permissions.middleware');
const { query, queryOne } = require('../config/database');

// Récupérer les statistiques par type (centre, confirmateur, commercial, agent)
router.get('/all-stat', authenticate, async (req, res) => {
  try {
    const { 
      name_stat,      // CENTRE, CONFIRMATEUR, COMMERCIAL, AGENT
      type_id,        // id_centre, id_confirmateur, id_commercial, id_agent
      func_id,        // ID de la fonction pour filtrer les utilisateurs
      stat,           // 'net' ou 'taux'
      date_debut, 
      date_fin, 
      date,           // date_appel_time, date_insert_time, date_modif_time
      produit,        // 1 (PAC), 2 (PV), ou vide (les deux)
      id_centre,
      id_confirmateur,
      id_commercial,
      id_agent
    } = req.query;

    // Valeurs par défaut
    const champ_date = date || 'date_modif_time';
    const startDate = date_debut || new Date().toISOString().split('T')[0];
    const endDate = date_fin || new Date().toISOString().split('T')[0];
    const statType = stat || 'net';

    // Construire les conditions avec paramètres préparés
    const conditions = [];
    const queryParams = [`${startDate} 00:00:00`, `${endDate} 23:59:59`];
    
    if (produit && (produit === '1' || produit === '2')) {
      conditions.push('produit = ?');
      queryParams.push(parseInt(produit));
    }

    if (id_centre) {
      conditions.push('id_centre = ?');
      queryParams.push(parseInt(id_centre));
    } else if (id_confirmateur) {
      conditions.push('id_confirmateur = ?');
      queryParams.push(parseInt(id_confirmateur));
    } else if (id_commercial) {
      conditions.push('id_commercial = ?');
      queryParams.push(parseInt(id_commercial));
    } else if (id_agent) {
      conditions.push('id_agent = ?');
      queryParams.push(parseInt(id_agent));
    }

    const additionalConditions = conditions.length > 0 ? ' AND ' + conditions.join(' AND ') : '';

    // Récupérer les états avec leurs taux et couleurs
    const etats = await query(
      `SELECT id, titre, abbreviation, color, taux, groupe, ordre
       FROM etats
       ORDER BY ordre ASC`
    );

    // Organiser les états par ID pour faciliter l'accès
    const etatsMap = {};
    const etatsTaux = {};
    const etatsColor = {};
    etats.forEach(etat => {
      etatsMap[etat.id] = etat.abbreviation || etat.titre;
      etatsColor[etat.id] = etat.color || '#cccccc';
      
      // Mapper les taux : POSITIVE = 1, NEGATIVE = -1, NEUTRE = 0
      switch(etat.taux) {
        case 'POSITIVE':
          etatsTaux[etat.id] = 1;
          break;
        case 'NEGATIVE':
          etatsTaux[etat.id] = -1;
          break;
        case 'NEUTRE':
        default:
          etatsTaux[etat.id] = 0;
          break;
      }
    });

    // Valider le champ de date pour éviter les injections SQL
    // Note: date_appel_time n'existe pas dans le schéma, on utilise date_appel (bigint) si nécessaire
    const allowedDateFields = ['date_insert_time', 'date_modif_time', 'date_rdv_time'];
    const safeDateField = allowedDateFields.includes(champ_date) ? champ_date : 'date_modif_time';

    // Valider le champ de groupement
    const allowedGroupFields = ['id_centre', 'id_confirmateur', 'id_commercial', 'id_agent'];
    let groupByField = type_id || 'id_centre';
    if (name_stat === 'CENTRE') {
      groupByField = 'id_centre';
    } else if (name_stat === 'CONFIRMATEUR') {
      groupByField = 'id_confirmateur';
    } else if (name_stat === 'COMMERCIAL') {
      groupByField = 'id_commercial';
    } else if (name_stat === 'AGENT') {
      groupByField = 'id_agent';
    }
    
    if (!allowedGroupFields.includes(groupByField)) {
      groupByField = 'id_centre';
    }

    // Récupérer le total de fiches pour la période
    const totalResult = await queryOne(
      `SELECT COUNT(*) as total
       FROM fiches
       WHERE (archive = 0 OR archive IS NULL) 
       AND active = 1 
       AND ko = 0
       AND \`${safeDateField}\` >= ? 
       AND \`${safeDateField}\` <= ?${additionalConditions}`,
      queryParams
    );
    const total = totalResult.total || 0;

    // Récupérer les statistiques groupées
    const stats = await query(
      `SELECT id_etat_final, \`${groupByField}\`, COUNT(id_etat_final) AS stats
       FROM fiches
       WHERE (archive = 0 OR archive IS NULL) 
       AND active = 1 
       AND ko = 0
       AND \`${safeDateField}\` >= ? 
       AND \`${safeDateField}\` <= ?${additionalConditions}
       GROUP BY \`${groupByField}\`, id_etat_final
       ORDER BY id_etat_final ASC`,
      queryParams
    );

    // Organiser les données par utilisateur/centre
    const dataByEntity = {};
    const tauxByEntity = {};

    stats.forEach(stat => {
      const entityId = stat[groupByField];
      if (!entityId) return;

      if (!dataByEntity[entityId]) {
        dataByEntity[entityId] = {};
        tauxByEntity[entityId] = {
          neutre: 0,
          positive: 0,
          negative: 0
        };
      }

      const etatId = stat.id_etat_final;
      const count = stat.stats;
      const taux = etatsTaux[etatId] || 0;

      // Stocker le nombre par état
      dataByEntity[entityId][etatId] = count;

      // Calculer les totaux par type de taux
      if (taux === 0) {
        tauxByEntity[entityId].neutre += count;
      } else if (taux === 1) {
        tauxByEntity[entityId].positive += count;
      } else if (taux === -1) {
        tauxByEntity[entityId].negative += count;
      }
    });

    // Récupérer les noms des entités (centres, utilisateurs)
    let entitiesMap = {};
    if (name_stat === 'CENTRE') {
      const centres = await query('SELECT id, titre FROM centres WHERE etat > 0');
      centres.forEach(centre => {
        entitiesMap[centre.id] = centre.titre;
      });
    } else {
      // Pour les utilisateurs (confirmateur, commercial, agent)
      let fonctionFilter = '';
      if (func_id) {
        fonctionFilter = ` AND fonction = ${parseInt(func_id)}`;
      }
      const users = await query(
        `SELECT id, pseudo FROM utilisateurs WHERE etat > 0${fonctionFilter} ORDER BY pseudo ASC`
      );
      users.forEach(user => {
        entitiesMap[user.id] = user.pseudo;
      });
    }

    // Construire la réponse selon le type de statistique
    const result = {
      name_stat: name_stat,
      stat_type: statType,
      total: total,
      etats: etats.map(e => ({
        id: e.id,
        abbreviation: e.abbreviation || e.titre,
        color: e.color || '#cccccc',
        taux: etatsTaux[e.id] || 0
      })),
      data: []
    };

    // Construire les données pour chaque entité
    Object.keys(dataByEntity).forEach(entityId => {
      const entityName = entitiesMap[entityId] || `ID ${entityId}`;
      const entityData = {
        id: entityId,
        name: entityName,
        stats: {},
        totals: {
          neutre: tauxByEntity[entityId].neutre,
          positive: tauxByEntity[entityId].positive,
          negative: tauxByEntity[entityId].negative
        }
      };

      // Ajouter les stats par état
      etats.forEach(etat => {
        entityData.stats[etat.id] = dataByEntity[entityId][etat.id] || 0;
      });

      // Calculer le total et le taux de réussite
      const totalEntity = Object.values(entityData.stats).reduce((sum, val) => sum + val, 0);
      const positive = entityData.totals.positive;
      const negative = entityData.totals.negative;
      const tauxReussite = (positive + negative) > 0 
        ? Math.round((positive * 10000) / (positive + negative)) / 100
        : 0;

      entityData.total = totalEntity;
      entityData.taux_reussite = tauxReussite;

      result.data.push(entityData);
    });

    // Trier par nom
    result.data.sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: error.message
    });
  }
});

// GET /api/statistiques/fiches-par-centre
// Récupérer les statistiques de fiches par centre et date
// - Administrateurs (fonction 1, 2, 7) : voient toutes les fiches
// - Utilisateurs fonction 9 : voient uniquement les fiches de leurs centres assignés
router.get('/fiches-par-centre', authenticate, checkPermissionCode('statistiques_fiches_view'), async (req, res) => {
  try {
    const { 
      date_debut, 
      date_fin, 
      date_champ = 'date_modif_time', // date_modif_time ou date_insert_time
      id_centre // Filtre optionnel par centre
    } = req.query;

    // Valeurs par défaut pour les dates (mois en cours)
    const today = new Date();
    const startDate = date_debut || new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const endDate = date_fin || new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    // Déterminer les centres accessibles selon le rôle
    let allowedCentres = null;
    
    if ([1, 2, 7].includes(req.user.fonction)) {
      // Administrateurs : voient tous les centres
      allowedCentres = null;
    } else if (req.user.fonction === 9) {
      // Fonction 9 : récupérer les centres assignés depuis utilisateurs_centres
      const userCentres = await query(
        'SELECT id_centre FROM utilisateurs_centres WHERE id_utilisateur = ?',
        [req.user.id]
      );
      
      if (userCentres.length === 0) {
        // Aucun centre assigné, retourner vide
        return res.json({
          success: true,
          data: []
        });
      }
      
      allowedCentres = userCentres.map(uc => uc.id_centre);
    } else {
      // Autres utilisateurs : pas d'accès (déjà vérifié par checkPermissionCode, mais garder pour sécurité)
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Seuls les administrateurs et les utilisateurs de fonction 9 peuvent accéder à cette page.'
      });
    }

    // Déterminer le champ de date à utiliser
    const dateField = date_champ === 'date_modif_time' ? 'f.date_modif_time' : 'f.date_insert_time';
    
    // Construire les conditions
    const conditions = [
      'f.archive = 0',
      'f.ko = 0',
      `${dateField} >= ?`,
      `${dateField} <= ?`
    ];
    const params = [
      `${startDate} 00:00:00`,
      `${endDate} 23:59:59`
    ];

    // Filtrer par centres si nécessaire
    if (allowedCentres && allowedCentres.length > 0) {
      const placeholders = allowedCentres.map(() => '?').join(',');
      conditions.push(`f.id_centre IN (${placeholders})`);
      params.push(...allowedCentres);
    }

    // Filtre optionnel par centre spécifique
    if (id_centre) {
      const centreId = parseInt(id_centre);
      if (allowedCentres === null || allowedCentres.includes(centreId)) {
        conditions.push('f.id_centre = ?');
        params.push(centreId);
      } else {
        // L'utilisateur n'a pas accès à ce centre
        return res.status(403).json({
          success: false,
          message: 'Accès refusé à ce centre'
        });
      }
    }

    // Requête pour obtenir les statistiques par centre
    // Utiliser CAST pour convertir datetime en date si DATE() n'est pas supporté
    const stats = await query(
      `SELECT 
        c.id as centre_id,
        c.titre as centre_titre,
        DATE(${dateField}) as date,
        COUNT(*) as nombre_fiches,
        COUNT(DISTINCT f.id_agent) as nombre_agents,
        COUNT(DISTINCT f.id_commercial) as nombre_commerciaux,
        COUNT(DISTINCT f.id_confirmateur) as nombre_confirmateurs,
        SUM(CASE WHEN f.id_etat_final = 7 THEN 1 ELSE 0 END) as fiches_confirmees,
        SUM(CASE WHEN f.id_etat_final IN (13, 16, 38, 44, 45) THEN 1 ELSE 0 END) as fiches_signees,
        SUM(CASE WHEN f.produit = 1 THEN 1 ELSE 0 END) as fiches_pac,
        SUM(CASE WHEN f.produit = 2 THEN 1 ELSE 0 END) as fiches_pv
       FROM fiches f
       LEFT JOIN centres c ON f.id_centre = c.id
       WHERE ${conditions.join(' AND ')}
       GROUP BY c.id, c.titre, DATE(${dateField})
       ORDER BY c.titre ASC, DATE(${dateField}) DESC`,
      params
    );

    // Organiser les données par centre
    const statsByCentre = {};
    stats.forEach(stat => {
      const centreId = stat.centre_id;
      if (!statsByCentre[centreId]) {
        statsByCentre[centreId] = {
          centre_id: centreId,
          centre_titre: stat.centre_titre,
          dates: []
        };
      }
      statsByCentre[centreId].dates.push({
        date: stat.date,
        nombre_fiches: stat.nombre_fiches,
        nombre_agents: stat.nombre_agents,
        nombre_commerciaux: stat.nombre_commerciaux,
        nombre_confirmateurs: stat.nombre_confirmateurs,
        fiches_confirmees: stat.fiches_confirmees,
        fiches_signees: stat.fiches_signees,
        fiches_pac: stat.fiches_pac,
        fiches_pv: stat.fiches_pv
      });
    });

    // Calculer les totaux par centre
    const result = Object.values(statsByCentre).map(centre => {
      const totalFiches = centre.dates.reduce((sum, d) => sum + d.nombre_fiches, 0);
      const totalConfirmees = centre.dates.reduce((sum, d) => sum + d.fiches_confirmees, 0);
      const totalSignees = centre.dates.reduce((sum, d) => sum + d.fiches_signees, 0);
      
      return {
        ...centre,
        total_fiches: totalFiches,
        total_confirmees: totalConfirmees,
        total_signees: totalSignees,
        taux_confirmation: totalFiches > 0 ? ((totalConfirmees / totalFiches) * 100).toFixed(2) : 0,
        taux_signature: totalFiches > 0 ? ((totalSignees / totalFiches) * 100).toFixed(2) : 0
      };
    });

    res.json({
      success: true,
      data: result,
      filters: {
        date_debut: startDate,
        date_fin: endDate,
        date_champ: date_champ
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques de fiches par centre:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: error.message
    });
  }
});

// GET /api/statistiques/fiches-detaillees
// Récupérer les fiches détaillées par centre avec les mêmes filtres
router.get('/fiches-detaillees', authenticate, checkPermissionCode('statistiques_fiches_view'), async (req, res) => {
  try {
    const { 
      date_debut, 
      date_fin, 
      date_champ = 'date_modif_time',
      id_centre
    } = req.query;

    // Valeurs par défaut pour les dates (mois en cours)
    const today = new Date();
    const startDate = date_debut || new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const endDate = date_fin || new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    // Déterminer les centres accessibles selon le rôle
    let allowedCentres = null;
    
    if ([1, 2, 7].includes(req.user.fonction)) {
      allowedCentres = null;
    } else if (req.user.fonction === 9) {
      const userCentres = await query(
        'SELECT id_centre FROM utilisateurs_centres WHERE id_utilisateur = ?',
        [req.user.id]
      );
      
      if (userCentres.length === 0) {
        return res.json({
          success: true,
          data: []
        });
      }
      
      allowedCentres = userCentres.map(uc => uc.id_centre);
    } else {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé.'
      });
    }

    // Déterminer le champ de date à utiliser
    const dateField = date_champ === 'date_modif_time' ? 'f.date_modif_time' : 'f.date_insert_time';
    
    // Construire les conditions
    const conditions = [
      'f.archive = 0',
      'f.ko = 0',
      `${dateField} >= ?`,
      `${dateField} <= ?`
    ];
    const params = [
      `${startDate} 00:00:00`,
      `${endDate} 23:59:59`
    ];

    // Filtrer par centres si nécessaire
    if (allowedCentres && allowedCentres.length > 0) {
      const placeholders = allowedCentres.map(() => '?').join(',');
      conditions.push(`f.id_centre IN (${placeholders})`);
      params.push(...allowedCentres);
    }

    // Filtre optionnel par centre spécifique
    if (id_centre) {
      const centreId = parseInt(id_centre);
      if (allowedCentres === null || allowedCentres.includes(centreId)) {
        conditions.push('f.id_centre = ?');
        params.push(centreId);
      } else {
        return res.status(403).json({
          success: false,
          message: 'Accès refusé à ce centre'
        });
      }
    }

    // Récupérer les fiches détaillées
    const fiches = await query(
      `SELECT 
        f.id,
        f.hash,
        f.id_centre,
        f.nom,
        f.prenom,
        f.tel,
        f.gsm1,
        f.cp,
        f.date_insert_time,
        f.date_rdv_time,
        f.id_confirmateur,
        f.id_commercial,
        f.id_etat_final,
        conf.pseudo as confirmateur_nom,
        com.pseudo as commercial_nom,
        e.titre as etat_titre,
        e.color as etat_color
       FROM fiches f
       LEFT JOIN utilisateurs conf ON f.id_confirmateur = conf.id
       LEFT JOIN utilisateurs com ON f.id_commercial = com.id
       LEFT JOIN etats e ON f.id_etat_final = e.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY f.id_centre ASC, ${dateField} DESC
       LIMIT 10000`,
      params
    );

    res.json({
      success: true,
      data: fiches,
      filters: {
        date_debut: startDate,
        date_fin: endDate,
        date_champ: date_champ
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des fiches détaillées:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des fiches',
      error: error.message
    });
  }
});

// GET /api/statistiques/dashboard
// Récupérer les statistiques pour le Dashboard
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    const todayStart = `${todayStr} 00:00:00`;
    const todayEnd = `${todayStr} 23:59:59`;

    // 1. Nombre de RDV aujourd'hui confirmés (état CONFIRMER = 7) avec date_modif_time aujourd'hui
    const rdvTodayConfirmed = await queryOne(`
      SELECT COUNT(*) as count
      FROM fiches
      WHERE id_etat_final = 7
      AND DATE(date_modif_time) = ?
      AND (archive = 0 OR archive IS NULL)
    `, [todayStr]);

    // 2. Nombre de RDV aujourd'hui annulés à reprogrammer (état ANNULER À REPROGRAMMER = 8) avec date_modif_time aujourd'hui
    const rdvTodayAnnuler = await queryOne(`
      SELECT COUNT(*) as count
      FROM fiches
      WHERE id_etat_final = 8
      AND DATE(date_modif_time) = ?
      AND (archive = 0 OR archive IS NULL)
    `, [todayStr]);

    // 3. Nombre de RDV à venir (état CONFIRMER = 7) avec date_rdv_time >= aujourd'hui
    const rdvUpcoming = await queryOne(`
      SELECT COUNT(*) as count
      FROM fiches
      WHERE id_etat_final = 7
      AND DATE(date_rdv_time) >= ?
      AND (archive = 0 OR archive IS NULL)
    `, [todayStr]);

    // 4. Liste des confirmateurs actifs avec le nombre de RDV aujourd'hui et à venir
    // On compte les RDV où le confirmateur est impliqué (id_confirmateur, id_confirmateur_2, ou id_confirmateur_3)
    // Afficher tous les confirmateurs actifs (utilisateur, fonction et centre actifs), même ceux avec 0 RDV
    const confirmateursWithRdv = await query(`
      SELECT 
        u.id,
        u.pseudo,
        u.photo,
        u.genre,
        COALESCE((
          SELECT COUNT(DISTINCT f.id)
          FROM fiches f
          WHERE (
            f.id_confirmateur = u.id 
            OR f.id_confirmateur_2 = u.id 
            OR f.id_confirmateur_3 = u.id
          )
          AND f.id_etat_final = 7
          AND DATE(f.date_modif_time) = ?
          AND (f.archive = 0 OR f.archive IS NULL)
        ), 0) as rdv_today,
        COALESCE((
          SELECT COUNT(DISTINCT f.id)
          FROM fiches f
          WHERE (
            f.id_confirmateur = u.id 
            OR f.id_confirmateur_2 = u.id 
            OR f.id_confirmateur_3 = u.id
          )
          AND f.id_etat_final = 7
          AND DATE(f.date_rdv_time) >= ?
          AND (f.archive = 0 OR f.archive IS NULL)
        ), 0) as rdv_upcoming
      FROM utilisateurs u
      LEFT JOIN fonctions f ON u.fonction = f.id
      LEFT JOIN centres c ON u.centre = c.id
      WHERE u.fonction = 6
      AND u.etat > 0
      AND (f.etat > 0 OR f.etat IS NULL)
      AND (c.etat > 0 OR c.etat IS NULL)
      ORDER BY rdv_today DESC, rdv_upcoming DESC, u.pseudo ASC
    `, [todayStr, todayStr]);

    res.json({
      success: true,
      data: {
        rdvTodayConfirmed: rdvTodayConfirmed?.count || 0,
        rdvTodayAnnuler: rdvTodayAnnuler?.count || 0,
        rdvUpcoming: rdvUpcoming?.count || 0,
        confirmateurs: confirmateursWithRdv.map(conf => ({
          id: conf.id,
          pseudo: conf.pseudo,
          photo: conf.photo,
          genre: conf.genre,
          rdv_today: conf.rdv_today || 0,
          rdv_upcoming: conf.rdv_upcoming || 0
        })) || []
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques du Dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: error.message
    });
  }
});

// Suivi des agents qualification
router.get('/agents-qualif', authenticate, async (req, res) => {
  try {
    const { 
      date_debut, 
      date_fin,
      id_agent,
      id_centre,
      id_rp // Nouveau paramètre pour filtrer par RP (pour les administrateurs)
    } = req.query;

    // Valeurs par défaut : mois en cours
    const today = new Date();
    const startDateStr = date_debut || new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const endDateStr = date_fin || today.toISOString().split('T')[0];

    const startDate = `${startDateStr} 00:00:00`;
    const endDate = `${endDateStr} 23:59:59`;

    // Si l'utilisateur est un RE Qualification (a des agents sous sa responsabilité)
    // Filtrer uniquement ses agents
    let agentsQuery = `
      SELECT 
        u.id,
        u.pseudo,
        u.nom,
        u.prenom,
        u.photo,
        u.centre,
        c.titre as centre_nom
      FROM utilisateurs u
      LEFT JOIN fonctions f ON u.fonction = f.id
      LEFT JOIN centres c ON u.centre = c.id
      WHERE u.fonction = 3
      AND u.etat > 0
      AND (f.etat > 0 OR f.etat IS NULL)
      AND (c.etat > 0 OR c.etat IS NULL)
    `;

    const agentsParams = [];

    let agentIds = [];

    // Si un filtre RP est fourni (pour les administrateurs), filtrer par ce RP
    if (id_rp) {
      // Récupérer les superviseurs assignés au RP spécifié
      const superviseursAssignes = await query(
        `SELECT id FROM utilisateurs 
         WHERE id_rp_qualif = ? AND etat > 0
         AND EXISTS (
           SELECT 1 FROM utilisateurs agents
           WHERE agents.chef_equipe = utilisateurs.id
           AND agents.fonction = 3
           AND agents.etat > 0
         )`,
        [parseInt(id_rp)]
      );

      if (superviseursAssignes && superviseursAssignes.length > 0) {
        const superviseurIds = superviseursAssignes.map(s => s.id);
        // Récupérer les agents de tous ces superviseurs
        const agentsSousResponsabilite = await query(
          `SELECT id FROM utilisateurs 
           WHERE chef_equipe IN (${superviseurIds.map(() => '?').join(',')}) 
           AND fonction = 3 
           AND etat > 0`,
          superviseurIds
        );
        agentIds = agentsSousResponsabilite.map(a => a.id);
      }
    }
    // Vérifier si l'utilisateur est un RP Qualification (fonction 12)
    else if (req.user.fonction === 12) {
      // Récupérer les superviseurs assignés au RP connecté
      const superviseursAssignes = await query(
        `SELECT id FROM utilisateurs 
         WHERE id_rp_qualif = ? AND etat > 0
         AND EXISTS (
           SELECT 1 FROM utilisateurs agents
           WHERE agents.chef_equipe = utilisateurs.id
           AND agents.fonction = 3
           AND agents.etat > 0
         )`,
        [req.user.id]
      );

      if (superviseursAssignes && superviseursAssignes.length > 0) {
        const superviseurIds = superviseursAssignes.map(s => s.id);
        // Récupérer les agents de tous ces superviseurs
        const agentsSousResponsabilite = await query(
          `SELECT id FROM utilisateurs 
           WHERE chef_equipe IN (${superviseurIds.map(() => '?').join(',')}) 
           AND fonction = 3 
           AND etat > 0`,
          superviseurIds
        );
        agentIds = agentsSousResponsabilite.map(a => a.id);
      }
    } else {
      // RE Qualification : récupérer les agents directement sous la responsabilité
      // Vérifier si l'utilisateur a des agents sous sa responsabilité
      const agentsSousResponsabilite = await query(
        `SELECT id FROM utilisateurs 
         WHERE chef_equipe = ? AND fonction = 3 AND etat > 0`,
        [req.user.id]
      );
      if (agentsSousResponsabilite && agentsSousResponsabilite.length > 0) {
        agentIds = agentsSousResponsabilite.map(a => a.id);
      }
    }

    if (agentIds.length > 0) {
      // Filtrer uniquement les agents sous responsabilité
      agentsQuery += ` AND u.id IN (${agentIds.map(() => '?').join(',')})`;
      agentsParams.push(...agentIds);
    }

    if (id_agent) {
      agentsQuery += ' AND u.id = ?';
      agentsParams.push(parseInt(id_agent));
    }

    if (id_centre) {
      agentsQuery += ' AND u.centre = ?';
      agentsParams.push(parseInt(id_centre));
    }

    agentsQuery += ' ORDER BY u.pseudo ASC';

    const agents = await query(agentsQuery, agentsParams);

    // Récupérer tous les états avec groupe 0 (états utilisés pour la qualité)
    const etatsGroupe0 = await query(`
      SELECT id, titre, color, abbreviation, ordre
      FROM etats
      WHERE groupe = '0' OR groupe = 0
      ORDER BY ordre ASC
    `);

    // Récupérer les statistiques pour chaque agent
    const agentsStats = await Promise.all(
      agents.map(async (agent) => {
        const statsByEtat = {};

        // Initialiser les compteurs pour chaque état groupe 0
        etatsGroupe0.forEach(etat => {
          statsByEtat[etat.id] = {
            id: etat.id,
            titre: etat.titre,
            color: etat.color || '#cccccc',
            abbreviation: etat.abbreviation || etat.titre,
            count: 0
          };
        });

        // Compter les fiches créées par cet agent avec les états groupe 0
        const fichesConditions = [
          'f.id_agent = ?',
          'f.date_insert_time >= ?',
          'f.date_insert_time <= ?',
          '(f.archive = 0 OR f.archive IS NULL)'
        ];
        const fichesParams = [agent.id, startDate, endDate];

        const fichesStats = await query(`
          SELECT 
            f.id_etat_final,
            COUNT(*) as count
          FROM fiches f
          INNER JOIN etats e ON f.id_etat_final = e.id
          WHERE ${fichesConditions.join(' AND ')}
          AND (e.groupe = '0' OR e.groupe = 0)
          GROUP BY f.id_etat_final
        `, fichesParams);

        // Remplir les stats par état
        fichesStats.forEach(stat => {
          if (statsByEtat[stat.id_etat_final]) {
            statsByEtat[stat.id_etat_final].count = stat.count || 0;
          }
        });

        // Compter les fiches validées (hors groupe 0, donc phase 1, 2 ou 3)
        const idsGroupe0 = etatsGroupe0.map(e => e.id);
        let validatedCount = 0;
        if (idsGroupe0.length > 0) {
          const validatedResult = await queryOne(`
            SELECT COUNT(*) as count
            FROM fiches f
            INNER JOIN etats e ON f.id_etat_final = e.id
            WHERE ${fichesConditions.join(' AND ')}
            AND f.id_etat_final NOT IN (${idsGroupe0.map(() => '?').join(',')})
            AND (e.groupe = '1' OR e.groupe = 1 OR e.groupe = '2' OR e.groupe = 2 OR e.groupe = '3' OR e.groupe = 3)
          `, [...fichesParams, ...idsGroupe0]);
          validatedCount = validatedResult?.count || 0;
        }

        // Calculer le total de fiches créées
        const totalFiches = await queryOne(`
          SELECT COUNT(*) as total
          FROM fiches f
          WHERE f.id_agent = ?
          AND f.date_insert_time >= ?
          AND f.date_insert_time <= ?
          AND (f.archive = 0 OR f.archive IS NULL)
        `, [agent.id, startDate, endDate]);

        return {
          agent: {
            id: agent.id,
            pseudo: agent.pseudo,
            nom: agent.nom,
            prenom: agent.prenom,
            photo: agent.photo,
            centre: agent.centre,
            centre_nom: agent.centre_nom
          },
          stats: Object.values(statsByEtat),
          validated: validatedCount,
          total: totalFiches?.total || 0
        };
      })
    );

    res.json({
      success: true,
      data: {
        agents: agentsStats,
        etats: etatsGroupe0,
        period: {
          date_debut: startDateStr,
          date_fin: endDateStr
        }
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du suivi des agents qualification:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des statistiques',
      error: error.message
    });
  }
});

// =====================================================
// PRODUCTION QUALIF - RP Qualification
// =====================================================

// Récupérer la production par superviseur pour un RP Qualification
router.get('/production-qualif', authenticate, async (req, res) => {
  try {
    const { 
      date_debut, 
      date_fin,
      id_superviseur,
      id_etat_final
    } = req.query;

    // Valeurs par défaut : mois en cours
    const today = new Date();
    const startDateStr = date_debut || new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const endDateStr = date_fin || today.toISOString().split('T')[0];

    const startDate = `${startDateStr} 00:00:00`;
    const endDate = `${endDateStr} 23:59:59`;

    // Vérifier si l'utilisateur est un RP Qualification (fonction 12)
    // Si ce n'est pas un RP Qualification, retourner une liste vide
    if (req.user.fonction !== 12) {
      return res.json({
        success: true,
        data: {
          superviseurs: [],
          etats: [],
          period: {
            date_debut: startDateStr,
            date_fin: endDateStr
          }
        }
      });
    }

    // Récupérer les superviseurs assignés au RP connecté
    // Un superviseur (RE Qualification) est un utilisateur qui a des agents sous sa responsabilité
    // et qui est assigné au RP via le champ id_rp_qualif
    let superviseursQuery = `
      SELECT DISTINCT
        u.id,
        u.pseudo,
        u.nom,
        u.prenom
      FROM utilisateurs u
      LEFT JOIN fonctions f ON u.fonction = f.id
      WHERE u.id_rp_qualif = ?
      AND u.etat > 0
      AND (f.etat > 0 OR f.etat IS NULL)
      AND EXISTS (
        SELECT 1 FROM utilisateurs agents
        WHERE agents.chef_equipe = u.id
        AND agents.fonction = 3
        AND agents.etat > 0
      )
    `;

    const superviseursParams = [req.user.id];

    if (id_superviseur) {
      superviseursQuery += ' AND u.id = ?';
      superviseursParams.push(parseInt(id_superviseur));
    }

    superviseursQuery += ' ORDER BY u.pseudo ASC';

    const superviseurs = await query(superviseursQuery, superviseursParams);

    // Récupérer les états groupe 0
    const etatsGroupe0 = await query(`
      SELECT id, titre, color, abbreviation, ordre
      FROM etats
      WHERE (groupe = '0' OR groupe = 0)
      ORDER BY ordre ASC
    `);

    const idsGroupe0 = etatsGroupe0.map(e => e.id);

    // Pour chaque superviseur, calculer les stats
    const superviseursStats = await Promise.all(
      superviseurs.map(async (superviseur) => {
        // Récupérer les agents sous ce superviseur
        const agents = await query(
          `SELECT id FROM utilisateurs 
           WHERE chef_equipe = ? AND fonction = 3 AND etat > 0`,
          [superviseur.id]
        );

        const agentIds = agents.map(a => a.id);

        if (agentIds.length === 0) {
          return {
            superviseur,
            stats: {},
            total: 0
          };
        }

        const stats = {};

        // Stats par état groupe 0
        for (const etat of etatsGroupe0) {
          const conditions = [
            `f.id_agent IN (${agentIds.map(() => '?').join(',')})`,
            `f.date_appel_time >= ?`,
            `f.date_appel_time <= ?`,
            `f.id_etat_final = ?`,
            `(f.archive = 0 OR f.archive IS NULL)`,
            `f.date_appel_time IS NOT NULL`
          ];
          const params = [...agentIds, startDate, endDate, etat.id];

          if (id_etat_final && parseInt(id_etat_final) !== etat.id) {
            continue; // Skip si filtre par état et ce n'est pas le bon
          }

          const count = await queryOne(
            `SELECT COUNT(*) as count
             FROM fiches f
             WHERE ${conditions.join(' AND ')}`,
            params
          );

          stats[etat.id] = {
            id: etat.id,
            titre: etat.titre,
            abbreviation: etat.abbreviation || etat.titre,
            count: count?.count || 0
          };
        }

        // Stats pour les états hors groupe 0 (Validé)
        if (!id_etat_final || (id_etat_final === 'validated')) {
          const conditions = [
            `f.id_agent IN (${agentIds.map(() => '?').join(',')})`,
            `f.date_appel_time >= ?`,
            `f.date_appel_time <= ?`,
            `(f.archive = 0 OR f.archive IS NULL)`,
            `f.date_appel_time IS NOT NULL`
          ];
          const params = [...agentIds, startDate, endDate];

          if (idsGroupe0.length > 0) {
            conditions.push(`f.id_etat_final NOT IN (${idsGroupe0.map(() => '?').join(',')})`);
            params.push(...idsGroupe0);
          }

          const validatedCount = await queryOne(
            `SELECT COUNT(*) as count
             FROM fiches f
             WHERE ${conditions.join(' AND ')}`,
            params
          );

          stats['validated'] = {
            id: 'validated',
            titre: 'Validé',
            abbreviation: 'VALIDÉ',
            count: validatedCount?.count || 0
          };
        }

        // Calculer le total (BRUT) : toutes les fiches avec date d'appel dans la période, indépendamment de l'état actuel
        const totalResult = await queryOne(
          `SELECT COUNT(*) as total
           FROM fiches f
           WHERE f.id_agent IN (${agentIds.map(() => '?').join(',')})
           AND f.date_appel_time >= ?
           AND f.date_appel_time <= ?
           AND (f.archive = 0 OR f.archive IS NULL)
           AND f.date_appel_time IS NOT NULL`,
          [...agentIds, startDate, endDate]
        );

        const total = totalResult?.total || 0;

        return {
          superviseur,
          stats,
          total
        };
      })
    );

    res.json({
      success: true,
      data: {
        superviseurs: superviseursStats,
        etats: etatsGroupe0,
        period: {
          date_debut: startDateStr,
          date_fin: endDateStr
        }
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de la production qualif:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération de la production',
      error: error.message
    });
  }
});

// =====================================================
// KPI QUALIFICATION
// =====================================================

// Récupérer les KPI qualification (meilleurs agents et équipes)
router.get('/kpi-qualification', authenticate, async (req, res) => {
  try {
    const { month } = req.query; // Format: YYYY-MM (ex: 2025-01)
    
    // Récupérer les IDs des états groupe 0 pour exclure
    const etatsGroupe0 = await query(`
      SELECT id FROM etats
      WHERE (groupe = '0' OR groupe = 0)
    `);
    const idsGroupe0 = etatsGroupe0.map(e => e.id);

    // Dates pour jour, semaine, mois
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Semaine (lundi à dimanche)
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Ajuster pour lundi
    const monday = new Date(today.getFullYear(), today.getMonth(), diff);
    const weekStart = monday.toISOString().split('T')[0];
    const weekEnd = todayStr;
    
    // Mois - utiliser le mois sélectionné ou le mois en cours
    let monthStart, monthEnd;
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      // Mois sélectionné
      const [year, monthNum] = month.split('-').map(Number);
      monthStart = new Date(year, monthNum - 1, 1).toISOString().split('T')[0];
      // Dernier jour du mois
      const lastDay = new Date(year, monthNum, 0).getDate();
      monthEnd = new Date(year, monthNum - 1, lastDay).toISOString().split('T')[0];
    } else {
      // Mois en cours par défaut
      monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      monthEnd = todayStr;
    }

    const kpiData = {
      jour: {},
      semaine: {},
      mois: {}
    };

    // Pour chaque période (jour, semaine, mois)
    const periods = [
      { key: 'jour', start: todayStr, end: todayStr, label: 'Aujourd\'hui' },
      { key: 'semaine', start: weekStart, end: weekEnd, label: 'Cette semaine' },
      { key: 'mois', start: monthStart, end: monthEnd, label: 'Ce mois' }
    ];

    for (const period of periods) {
      const startDate = `${period.start} 00:00:00`;
      const endDate = `${period.end} 23:59:59`;

      // Meilleur agent (fiches validées uniquement - phase 1, 2, 3)
      const bestAgentQuery = `
        SELECT 
          u.id,
          u.pseudo,
          u.nom,
          u.prenom,
          u.photo,
          COUNT(DISTINCT f.id) as count_validated
        FROM fiches f
        INNER JOIN utilisateurs u ON f.id_agent = u.id
        INNER JOIN etats e ON f.id_etat_final = e.id
        WHERE u.fonction = 3
        AND u.etat > 0
        AND f.date_insert_time >= ?
        AND f.date_insert_time <= ?
        AND (f.archive = 0 OR f.archive IS NULL)
        ${idsGroupe0.length > 0 ? `AND f.id_etat_final NOT IN (${idsGroupe0.map(() => '?').join(',')})` : ''}
        AND (e.groupe = '1' OR e.groupe = 1 OR e.groupe = '2' OR e.groupe = 2 OR e.groupe = '3' OR e.groupe = 3)
        GROUP BY u.id, u.pseudo, u.nom, u.prenom, u.photo
        ORDER BY count_validated DESC
        LIMIT 1
      `;
      
      const bestAgentParams = idsGroupe0.length > 0 
        ? [startDate, endDate, ...idsGroupe0]
        : [startDate, endDate];
      
      const bestAgent = await queryOne(bestAgentQuery, bestAgentParams);

      // Meilleure équipe (superviseur avec ses agents)
      const bestTeamQuery = `
        SELECT 
          s.id as superviseur_id,
          s.pseudo as superviseur_pseudo,
          s.nom as superviseur_nom,
          s.prenom as superviseur_prenom,
          COUNT(DISTINCT f.id) as count_validated,
          COUNT(DISTINCT a.id) as nb_agents
        FROM fiches f
        INNER JOIN utilisateurs a ON f.id_agent = a.id
        INNER JOIN utilisateurs s ON a.chef_equipe = s.id
        INNER JOIN etats e ON f.id_etat_final = e.id
        WHERE a.fonction = 3
        AND a.etat > 0
        AND s.etat > 0
        AND f.date_insert_time >= ?
        AND f.date_insert_time <= ?
        AND (f.archive = 0 OR f.archive IS NULL)
        ${idsGroupe0.length > 0 ? `AND f.id_etat_final NOT IN (${idsGroupe0.map(() => '?').join(',')})` : ''}
        AND (e.groupe = '1' OR e.groupe = 1 OR e.groupe = '2' OR e.groupe = 2 OR e.groupe = '3' OR e.groupe = 3)
        GROUP BY s.id, s.pseudo, s.nom, s.prenom
        ORDER BY count_validated DESC
        LIMIT 1
      `;
      
      const bestTeam = await queryOne(bestTeamQuery, bestAgentParams);

      kpiData[period.key] = {
        period: period.label,
        date_start: period.start,
        date_end: period.end,
        best_agent: bestAgent ? {
          id: bestAgent.id,
          pseudo: bestAgent.pseudo,
          nom: bestAgent.nom,
          prenom: bestAgent.prenom,
          photo: bestAgent.photo,
          count: bestAgent.count_validated || 0
        } : null,
        best_team: bestTeam ? {
          superviseur: {
            id: bestTeam.superviseur_id,
            pseudo: bestTeam.superviseur_pseudo,
            nom: bestTeam.superviseur_nom,
            prenom: bestTeam.superviseur_prenom
          },
          count: bestTeam.count_validated || 0,
          nb_agents: bestTeam.nb_agents || 0
        } : null
      };
    }

    res.json({
      success: true,
      data: kpiData
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des KPI qualification:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des KPI',
      error: error.message
    });
  }
});

// Statistiques des agents pour un superviseur
router.get('/superviseur/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      date_debut, 
      date_fin
    } = req.query;

    // Vérifier que l'utilisateur est bien un superviseur
    const superviseur = await queryOne(
      `SELECT id, pseudo, nom, prenom, photo, fonction, centre, id_rp_qualif
       FROM utilisateurs
       WHERE id = ? AND etat > 0`,
      [id]
    );

    if (!superviseur) {
      return res.status(404).json({
        success: false,
        message: 'Superviseur non trouvé'
      });
    }

    // Vérification de sécurité pour RP Qualification
    // Si l'utilisateur connecté est un RP Qualification (fonction 12),
    // il ne peut voir que les superviseurs qui lui sont assignés (id_rp_qualif = user.id)
    if (req.user.fonction === 12) {
      if (!superviseur.id_rp_qualif || superviseur.id_rp_qualif !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Accès refusé : ce superviseur n\'est pas assigné à votre responsabilité'
        });
      }
    }

    // Vérification de sécurité pour RE Qualification
    // Si l'utilisateur connecté est un RE Qualification (a des agents sous sa responsabilité),
    // il ne peut voir que ses propres statistiques (id = user.id)
    if (req.user.fonction !== 12 && req.user.id !== parseInt(id)) {
      // Vérifier si l'utilisateur a des agents sous sa responsabilité (RE Qualification)
      const agentsSousResponsabilite = await query(
        `SELECT id FROM utilisateurs WHERE chef_equipe = ? AND fonction = 3 AND etat > 0`,
        [req.user.id]
      );
      
      if (agentsSousResponsabilite && agentsSousResponsabilite.length > 0) {
        // C'est un RE Qualification, il ne peut voir que ses propres statistiques
        return res.status(403).json({
          success: false,
          message: 'Accès refusé : vous ne pouvez voir que vos propres statistiques'
        });
      }
    }

    // Valeurs par défaut : mois en cours
    const today = new Date();
    const startDateStr = date_debut || new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const endDateStr = date_fin || today.toISOString().split('T')[0];

    const startDate = `${startDateStr} 00:00:00`;
    const endDate = `${endDateStr} 23:59:59`;

    // Récupérer tous les agents sous la supervision de cet utilisateur avec leurs statistiques en une seule requête optimisée
    const agents = await query(
      `SELECT 
        u.id,
        u.pseudo,
        u.nom,
        u.prenom,
        u.photo,
        u.centre,
        u.chef_equipe,
        c.titre as centre_nom
      FROM utilisateurs u
      LEFT JOIN centres c ON u.centre = c.id
      LEFT JOIN fonctions f ON u.fonction = f.id
      WHERE u.chef_equipe = ?
      AND u.fonction = 3
      AND u.etat > 0
      AND (f.etat > 0 OR f.etat IS NULL)
      AND (c.etat > 0 OR c.etat IS NULL)
      ORDER BY u.pseudo ASC`,
      [id]
    );

    if (!agents || agents.length === 0) {
      return res.json({
        success: true,
        data: {
          superviseur: {
            id: superviseur.id,
            pseudo: superviseur.pseudo,
            nom: superviseur.nom,
            prenom: superviseur.prenom,
            photo: superviseur.photo
          },
          agents: [],
          period: {
            date_debut: startDateStr,
            date_fin: endDateStr
          }
        }
      });
    }

    const agentIds = agents.map(a => a.id);

    // Récupérer toutes les statistiques en une seule requête optimisée
    // 1. Statistiques par agent (total période, aujourd'hui, cette semaine, ce mois)
    const statsQuery = `
      SELECT 
        f.id_agent,
        COUNT(CASE WHEN f.date_insert_time >= ? AND f.date_insert_time <= ? THEN 1 END) as total_periode,
        COUNT(CASE WHEN DATE(f.date_insert_time) = CURDATE() THEN 1 END) as aujourdhui,
        COUNT(CASE WHEN YEARWEEK(f.date_insert_time, 1) = YEARWEEK(CURDATE(), 1) THEN 1 END) as cette_semaine,
        COUNT(CASE WHEN YEAR(f.date_insert_time) = YEAR(CURDATE()) AND MONTH(f.date_insert_time) = MONTH(CURDATE()) THEN 1 END) as ce_mois
      FROM fiches f
      WHERE f.id_agent IN (${agentIds.map(() => '?').join(',')})
      AND (f.archive = 0 OR f.archive IS NULL)
      GROUP BY f.id_agent
    `;

    const statsParams = [startDate, endDate, ...agentIds];
    const statsResults = await query(statsQuery, statsParams);

    // 2. Fiches par état (groupe 0) pour tous les agents en une seule requête
    const etatsQuery = `
      SELECT 
        f.id_agent,
        f.id_etat_final,
        e.titre as etat_titre,
        e.color as etat_color,
        e.abbreviation as etat_abbreviation,
        COUNT(*) as count
      FROM fiches f
      INNER JOIN etats e ON f.id_etat_final = e.id
      WHERE f.id_agent IN (${agentIds.map(() => '?').join(',')})
      AND f.date_insert_time >= ?
      AND f.date_insert_time <= ?
      AND (f.archive = 0 OR f.archive IS NULL)
      AND (e.groupe = '0' OR e.groupe = 0)
      GROUP BY f.id_agent, f.id_etat_final, e.titre, e.color, e.abbreviation
      ORDER BY f.id_agent, count DESC
    `;

    const etatsParams = [...agentIds, startDate, endDate];
    const etatsResults = await query(etatsQuery, etatsParams);

    // Organiser les résultats par agent
    const statsMap = {};
    statsResults.forEach(stat => {
      statsMap[stat.id_agent] = {
        total: parseInt(stat.total_periode) || 0,
        aujourdhui: parseInt(stat.aujourdhui) || 0,
        cette_semaine: parseInt(stat.cette_semaine) || 0,
        ce_mois: parseInt(stat.ce_mois) || 0
      };
    });

    const etatsMap = {};
    etatsResults.forEach(etat => {
      if (!etatsMap[etat.id_agent]) {
        etatsMap[etat.id_agent] = [];
      }
      etatsMap[etat.id_agent].push({
        id_etat_final: etat.id_etat_final,
        etat_titre: etat.etat_titre,
        etat_color: etat.etat_color,
        etat_abbreviation: etat.etat_abbreviation,
        count: parseInt(etat.count) || 0
      });
    });

    // Construire le résultat final
    const agentsStats = agents.map(agent => {
      const stats = statsMap[agent.id] || {
        total: 0,
        aujourdhui: 0,
        cette_semaine: 0,
        ce_mois: 0
      };
      const par_etat = etatsMap[agent.id] || [];

      return {
        agent: {
          id: agent.id,
          pseudo: agent.pseudo,
          nom: agent.nom,
          prenom: agent.prenom,
          photo: agent.photo,
          centre: agent.centre,
          centre_nom: agent.centre_nom
        },
        statistiques: {
          total: stats.total,
          aujourdhui: stats.aujourdhui,
          cette_semaine: stats.cette_semaine,
          ce_mois: stats.ce_mois,
          par_etat: par_etat
        }
      };
    });

    res.json({
      success: true,
      data: {
        superviseur: {
          id: superviseur.id,
          pseudo: superviseur.pseudo,
          nom: superviseur.nom,
          prenom: superviseur.prenom,
          photo: superviseur.photo
        },
        agents: agentsStats,
        period: {
          date_debut: startDateStr,
          date_fin: endDateStr
        }
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques du superviseur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des statistiques',
      error: error.message
    });
  }
});

module.exports = router;
