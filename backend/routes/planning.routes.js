const express = require('express');
const router = express.Router();
const { authenticate, checkPermission } = require('../middleware/auth.middleware');
const { query, queryOne } = require('../config/database');
const { encodeFicheId } = require('./fiche.routes');

// Helper pour obtenir le lundi d'une semaine ISO (plus robuste pour les transitions d'année)
function getMondayOfWeek(year, week) {
  // Trouver le 4 janvier de l'année (toujours dans la semaine 1 ISO)
  const simple = new Date(year, 0, 4);
  // Obtenir le jour de la semaine (0 = dimanche, 6 = samedi)
  // En ISO, lundi = 1, donc on ajuste
  const jan4Day = simple.getDay() || 7; // Convertir dimanche (0) en 7
  // Le lundi de la semaine 1 est le 4 janvier moins (jour - 1) jours
  const week1Monday = new Date(year, 0, 4 - (jan4Day - 1));
  // Ajouter (week - 1) semaines pour obtenir le lundi de la semaine demandée
  const targetMonday = new Date(week1Monday);
  targetMonday.setDate(week1Monday.getDate() + (week - 1) * 7);
  return targetMonday;
}

// Helper pour obtenir les jours de la semaine (Lundi à Vendredi)
function getWeekDays(year, week) {
  const monday = getMondayOfWeek(year, week);
  const days = [];
  const daysFr = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
  
  for (let i = 0; i < 5; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    days.push({
      date: dateStr,
      dayName: daysFr[i]
    });
  }
  return days;
}

// Helper pour convertir une heure en ID
function hourToId(hour) {
  const hourMap = {
    '09:00:00': '09-00-00',
    '11:00:00': '11-00-00',
    '13:00:00': '13-00-00',
    '16:00:00': '16-00-00',
    '18:00:00': '18-00-00',
    '19:30:00': '19-30-00'
  };
  return hourMap[hour] || hour.replace(/:/g, '-');
}

// Helper pour calculer le timeKey à partir d'une heure (HH:MM:SS)
// Évite les problèmes de fuseau horaire en calculant directement les secondes depuis minuit UTC
function hourToTimeKey(hour) {
  const [hours, minutes, seconds] = hour.split(':').map(Number);
  return hours * 3600 + minutes * 60 + (seconds || 0);
}

// Créneaux horaires
const TIME_SLOTS = [
  { hour: '09:00:00', start: '09:00:00', end: '10:59:59', name: '9H ( 9h uniquement )' },
  { hour: '11:00:00', start: '11:00:00', end: '12:59:59', name: '11H ( 11h à 12h )' },
  { hour: '13:00:00', start: '13:00:00', end: '15:59:59', name: '13H ( 13h à 14h30 )' },
  { hour: '16:00:00', start: '16:00:00', end: '17:59:59', name: '16H ( 16h à 17h )' },
  { hour: '18:00:00', start: '18:00:00', end: '19:29:59', name: '18H ( 18h à 19h )' },
  { hour: '19:30:00', start: '19:30:00', end: '20:00:00', name: '20H ( 19h30 à 20h )' }
];

// Helper pour obtenir le numéro de semaine ISO
function getWeekNumber(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Récupérer le planning d'une semaine avec rendez-vous
router.get('/week', authenticate, async (req, res) => {
  try {
    const { w, y, dp } = req.query;
    const week = parseInt(w) || getWeekNumber();
    const year = parseInt(y) || new Date().getFullYear();
    const dep = dp || '01';

    // Obtenir les jours de la semaine
    const days = getWeekDays(year, week);
    const weekStart = days[0].date;
    const weekEnd = days[days.length - 1].date;

    // Récupérer les disponibilités
    const availabilities = await query(
      `SELECT * FROM planning_availablity 
       WHERE week = ? AND year = ? AND dep = ? 
       ORDER BY date_day, hour ASC`,
      [week, year, dep]
    );

    // Organiser les disponibilités par date et heure
    const availMap = {};
    availabilities.forEach(av => {
      if (!availMap[av.date_day]) {
        availMap[av.date_day] = {};
      }
      // Stocker à la fois le nombre et l'heure complète pour faciliter l'accès
      availMap[av.date_day][av.hour] = av.nbr_com || 0;
    });

    // Récupérer les fiches avec rendez-vous (état final = 7) pour cette semaine
    await query('SET SESSION group_concat_max_len = 1000000');
    
    // Vérifier si les colonnes date_nouvelle et date_prevu existent dans decalages
    let decalageColumns = '';
    try {
      const colCheck = await queryOne(
        `SELECT COUNT(*) as count 
         FROM information_schema.columns 
         WHERE table_schema = SCHEMA() 
         AND table_name = 'decalages' 
         AND column_name = 'date_nouvelle'`
      );
      if (colCheck && colCheck.count > 0) {
        decalageColumns = 'MAX(decale.date_nouvelle) as date_nouvelle, MAX(decale.date_prevu) as date_prevu, MAX(decale.id_etat) as dec_etat, MAX(decale.id) as id_dec,';
      }
    } catch (e) {
      // Les colonnes n'existent pas, on continue sans
    }
    
    // Vérifier si la table qualif existe avant de faire la requête
    let useQualifTable = false;
    try {
      const qualifTableExists = await queryOne(
        `SELECT COUNT(*) as count 
         FROM information_schema.tables 
         WHERE table_schema = SCHEMA() 
         AND table_name = 'qualif'`
      );
      useQualifTable = qualifTableExists && qualifTableExists.count > 0;
    } catch (e) {
      // Si erreur lors de la vérification, supposer que la table n'existe pas
      useQualifTable = false;
    }

    // Construire la requête selon l'existence de la table qualif
    const qualificationSelect = useQualifTable 
      ? 'MAX(qualif.code) as qualification_code'
      : 'fiche.id_qualif as qualification_code';
    
    const qualifJoin = useQualifTable 
      ? 'LEFT JOIN qualif ON fiche.id_qualif = qualif.id'
      : '';

    // Construire la condition WHERE pour inclure uniquement CONFIRMER (état 7)
    const whereCondition = `WHERE fiche.date_rdv_time >= ? AND fiche.date_rdv_time <= ? 
       AND fiche.cp LIKE ?
       AND fiche.id_etat_final = 7`;

    const fiches = await query(
      `SELECT fiche.*, 
       ${decalageColumns}
       ${qualificationSelect},
       fiche.conf_presence_couple,
       fiche.conf_rdv_avec,
       fiche.valider,
       GROUP_CONCAT(DISTINCT histo.id_etat ORDER BY histo.id ASC SEPARATOR ',') as id_etat_histo,
       (SELECT histo2.id_etat 
        FROM fiches_histo histo2 
        WHERE histo2.id_fiche = fiche.id 
        ORDER BY histo2.id DESC 
        LIMIT 1) as dernier_etat
       FROM fiches fiche
       LEFT JOIN decalages decale ON fiche.id = decale.id_fiche
       LEFT JOIN fiches_histo histo ON fiche.id = histo.id_fiche
       ${qualifJoin}
       ${whereCondition}
       GROUP BY fiche.id
       ORDER BY fiche.date_rdv_time ASC`,
      [`${weekStart} 00:00:00`, `${weekEnd} 23:59:59`, `${dep}%`]
    );

    // Organiser les rendez-vous par date et créneau
    const planning = {};
    days.forEach(day => {
      planning[day.date] = {
        date: day.date,
        dayName: day.dayName,
        time: {}
      };

      TIME_SLOTS.forEach(slot => {
        // Calculer le timeKey directement à partir de l'heure pour éviter les problèmes de fuseau horaire
        const timeKey = hourToTimeKey(slot.hour);
        // Récupérer la disponibilité depuis la map
        const availability = availMap[day.date]?.[slot.hour];
        planning[day.date].time[timeKey] = {
          time_start: timeKey,
          time_end: hourToTimeKey(slot.end),
          heure_name: slot.name,
          av: availability !== undefined ? availability : null, // null si pas de planning créé
          planning: []
        };
        console.log(`[Planning] Création créneau - Date: ${day.date}, Slot: ${slot.hour}, TimeKey: ${timeKey} (type: ${typeof timeKey})`);
      });
    });

    // Récupérer tous les états uniques de toutes les fiches pour optimisation
    const allEtatIds = new Set();
    fiches.forEach(fiche => {
      if (fiche.id_etat_histo) {
        const histoArray = String(fiche.id_etat_histo).split(',').map(Number);
        histoArray.forEach(id => {
          if (id && !isNaN(id)) allEtatIds.add(id);
        });
      }
      if (fiche.dernier_etat && !isNaN(fiche.dernier_etat)) {
        allEtatIds.add(fiche.dernier_etat);
      }
      if (fiche.id_etat_final && !isNaN(fiche.id_etat_final)) {
        allEtatIds.add(fiche.id_etat_final);
      }
    });
    
    // Récupérer tous les titres des états en une seule requête
    let etatsMap = {};
    if (allEtatIds.size > 0) {
      const etatsList = await query(
        `SELECT id, titre FROM etats WHERE id IN (${Array.from(allEtatIds).map(() => '?').join(',')})`,
        Array.from(allEtatIds)
      );
      etatsList.forEach(etat => {
        etatsMap[etat.id] = etat.titre;
      });
    }

    // Assigner les fiches aux créneaux appropriés
    fiches.forEach(fiche => {
      let rdvDate, rdvTime;
      
      // Toujours utiliser date_rdv_time comme source principale
      // Après acceptation d'un décalage, date_rdv_time est mis à jour avec date_nouvelle
      // donc on utilise toujours date_rdv_time qui est la source de vérité
      if (fiche.date_rdv_time) {
        // Convertir en chaîne si nécessaire (peut être un objet Date ou une chaîne)
        const dateStr = typeof fiche.date_rdv_time === 'string' 
          ? fiche.date_rdv_time 
          : (fiche.date_rdv_time instanceof Date 
              ? fiche.date_rdv_time.toISOString().replace('T', ' ').substring(0, 19)
              : String(fiche.date_rdv_time || ''));
        
        if (dateStr) {
          rdvDate = dateStr.split(' ')[0] || dateStr.split('T')[0];
          rdvTime = dateStr.split(' ')[1] || null;
        }
      }

      if (!rdvDate || !rdvTime || !planning[rdvDate]) return;

      // Trouver le créneau approprié
      const rdvHour = rdvTime.substring(0, 5);
      let slot = null;
      
      for (const timeSlot of TIME_SLOTS) {
        const start = timeSlot.start.substring(0, 5);
        const end = timeSlot.end.substring(0, 5);
        if (rdvHour >= start && rdvHour <= end) {
          slot = timeSlot;
          break;
        }
      }

      if (!slot) {
        console.log(`[Planning] Aucun créneau trouvé pour RDV heure: ${rdvHour}, date: ${rdvDate}`);
        return;
      }

      // Calculer le timeKey directement à partir de l'heure pour éviter les problèmes de fuseau horaire
      const timeKey = hourToTimeKey(slot.hour);
      console.log(`[Planning] RDV trouvé - Fiche ID: ${fiche.id}, Date: ${rdvDate}, Heure: ${rdvTime}, Slot: ${slot.hour}, TimeKey: ${timeKey}, date_rdv_time: ${fiche.date_rdv_time}, date_nouvelle: ${fiche.date_nouvelle || 'N/A'}, dec_etat: ${fiche.dec_etat || 'N/A'}`);
      
      if (!planning[rdvDate].time[timeKey]) {
        const availableKeys = Object.keys(planning[rdvDate].time).map(k => ({ key: k, type: typeof k, value: parseInt(k) }));
        console.log(`[Planning] TimeKey ${timeKey} (type: ${typeof timeKey}) non trouvé dans planning[${rdvDate}].time. Clés disponibles:`, availableKeys);
        return;
      }

      // Déterminer les indicateurs d'état basés sur l'historique complet de la fiche
      // Utiliser id_etat_histo pour vérifier tous les états dans l'historique
      const etats = [];
      let hasAnnuler = false;
      let hasRefuser = false;
      let hasR2 = false;
      
      // Vérifier l'historique complet si disponible
      if (fiche.id_etat_histo) {
        const histoArray = String(fiche.id_etat_histo).split(',').map(Number);
        
        // Vérifier chaque état dans l'historique en utilisant la map des états pré-chargés
        histoArray.forEach(etatId => {
          if (etatId && !isNaN(etatId) && etatsMap[etatId]) {
            const titre = etatsMap[etatId].toUpperCase();
            // Vérifier si "RDV ANNULER" est présent dans le titre
            if (titre.includes('RDV ANNULER')) {
              hasAnnuler = true;
            }
            // Vérifier si "REFUSER" est présent dans le titre
            if (titre.includes('REFUSER')) {
              hasRefuser = true;
            }
            // Vérifier pour R2 (CLIENT HONORE A SUIVRE = état 9)
            if (etatId === 9 || titre.includes('CLIENT HONORE')) {
              hasR2 = true;
            }
          }
        });
      }
      
      // Si l'historique n'a pas été vérifié ou n'est pas disponible, vérifier le dernier état
      if (!hasAnnuler && !hasRefuser && !hasR2) {
        const dernierEtat = fiche.dernier_etat || fiche.id_etat_final;
        if (dernierEtat && etatsMap[dernierEtat]) {
          const titre = etatsMap[dernierEtat].toUpperCase();
          if (titre.includes('RDV ANNULER')) {
            hasAnnuler = true;
          }
          if (titre.includes('REFUSER')) {
            hasRefuser = true;
          }
          if (dernierEtat === 9 || titre.includes('CLIENT HONORE')) {
            hasR2 = true;
          }
        }
      }
      
      // Ajouter les badges trouvés
      if (hasR2) etats.push('R2');
      if (hasRefuser) etats.push('RF');
      if (hasAnnuler) etats.push('AN');
      
      // Vérifier la présence du couple (indépendamment de l'état)
      const isRdvSeul = fiche.conf_presence_couple === 'MME SEUL SANS MR' || 
                        fiche.conf_presence_couple === 'MR SEUL SANS MME' ||
                        fiche.conf_rdv_avec === 'SEUL';
      
      // Vérifier si RDV validé sans présence du couple
      const isRdvValidSansCouple = (fiche.valider === 1 || fiche.valider === true) && 
                                    fiche.conf_presence_couple === 'NON';
      
      if (isRdvSeul) {
        etats.push('RS');
      }
      
      // Ajouter le badge "SEUL" pour les RDV validés sans présence du couple
      if (isRdvValidSansCouple) {
        etats.push('SEUL');
      }

      const rdvData = {
        id: fiche.id,
        hash: encodeFicheId(fiche.id),
        date: rdvDate,
        rdv: rdvTime,
        cp: fiche.cp,
        ville: fiche.ville || null,
        valider: fiche.valider,
        operation: fiche.produit === 1 ? 'PAC' : fiche.produit === 2 ? 'PV' : '',
        id_commercial: fiche.id_commercial || 0,
        id_etat_final: fiche.id_etat_final || null, // État final de la fiche
        etat_check: etats.join(','), // Retourner tous les états séparés par virgule
        etats_list: etats, // Liste des états pour faciliter l'accès
        dec_statut: fiche.id_dec ? `DEC ${fiche.dec_etat}` : '',
        qualification: fiche.qualification_code || null, // Code de qualification (ex: RDV_URGENT)
        rdv_seul: isRdvSeul, // Indicateur RDV seul
        rdv_valid_sans_couple: isRdvValidSansCouple // Indicateur RDV validé sans présence du couple
      };
      
      planning[rdvDate].time[timeKey].planning.push(rdvData);
      console.log(`[Planning] RDV ajouté au planning - Date: ${rdvDate}, TimeKey: ${timeKey}, RDV:`, rdvData);
    });

    // Debug: compter le nombre total de RDV assignés
    let totalRdvs = 0;
    Object.keys(planning).forEach(date => {
      Object.keys(planning[date].time).forEach(timeKey => {
        totalRdvs += planning[date].time[timeKey].planning.length;
      });
    });
    console.log(`[Planning] Total RDV assignés: ${totalRdvs} sur ${fiches.length} fiches récupérées`);
    
    res.json({
      success: true,
      data: planning,
      week,
      year,
      dep,
      weekStart,
      weekEnd
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du planning:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du planning',
      error: error.message
    });
  }
});

// Récupérer la disponibilité d'une semaine
router.get('/availability', authenticate, async (req, res) => {
  try {
    const { w, y, dp } = req.query;
    const week = parseInt(w) || getWeekNumber();
    const year = parseInt(y) || new Date().getFullYear();
    const dep = dp || '01';

    const days = getWeekDays(year, week);
    const availabilities = await query(
      `SELECT *, DATE_FORMAT(date_day, '%Y-%m-%d') as date_day_str, TIME_FORMAT(hour, '%H:%i:%s') as hour_str
       FROM planning_availablity 
       WHERE week = ? AND year = ? AND dep = ? 
       ORDER BY date_day, hour ASC`,
      [week, year, dep]
    );

    console.log(`Nombre de disponibilités récupérées: ${availabilities.length}`);
    if (availabilities.length > 0) {
      console.log('Première disponibilité:', availabilities[0]);
    }

    // Organiser par date et heure
    const availMap = {};
    days.forEach(day => {
      availMap[day.date] = {};
      TIME_SLOTS.forEach(slot => {
        // Utiliser les champs formatés pour la comparaison
        const av = availabilities.find(a => {
          const aDate = a.date_day_str || (a.date_day instanceof Date 
            ? a.date_day.toISOString().split('T')[0] 
            : String(a.date_day).split('T')[0]);
          const aHour = a.hour_str || (a.hour instanceof Date 
            ? a.hour.toTimeString().split(' ')[0] 
            : String(a.hour));
          const slotHour = String(slot.hour);
          return aDate === day.date && aHour === slotHour;
        });
        availMap[day.date][slot.hour] = {
          nbr_com: av?.nbr_com ?? null, // null si pas de planning créé, 0 si bloqué
          force_crenaux: av?.force_crenaux || 0,
          is_closed: av?.is_closed || 0 // 1 si créneau fermé, 0 sinon
        };
      });
    });
    
    console.log('Disponibilités organisées (échantillon):', {
      sampleDate: days[0]?.date,
      sampleSlot: TIME_SLOTS[0]?.hour,
      value: availMap[days[0]?.date]?.[TIME_SLOTS[0]?.hour]
    });

    res.json({
      success: true,
      data: availMap,
      week,
      year,
      dep
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de la disponibilité:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la disponibilité'
    });
  }
});

// Créer un planning
router.post('/create', authenticate, checkPermission(1, 2, 7), async (req, res) => {
  try {
    const { week, year, dep, nbr_com, type } = req.body;

    if (!week || !year || !dep || !nbr_com || !type) {
      return res.status(400).json({
        success: false,
        message: 'Paramètres manquants'
      });
    }

    const days = getWeekDays(year, week);
    const now = new Date();
    const timestamp = Math.floor(now.getTime() / 1000);
    const dateModifTime = now.toISOString().slice(0, 19).replace('T', ' ');

    // Supprimer l'ancien planning s'il existe
    await query(
      `DELETE FROM planning_hbd WHERE week = ? AND year = ? AND dep = ?`,
      [week, year, dep]
    );
    await query(
      `DELETE FROM planning_availablity WHERE week = ? AND year = ? AND dep = ?`,
      [week, year, dep]
    );

    // Départements avec règles spéciales
    const expDep = ['35', '44', '49', '55', '54', '57', '67', '69'];
    const tabHeure = ['09:00:00', '11:00:00', '13:00:00', '16:00:00', '18:00:00', '19:30:00'];

    // Créer le planning pour chaque jour
    for (const day of days) {
      let nbAvHbd = 0;

      // Déterminer le nombre de commerciaux selon le type
      switch (type) {
        case 'semaine':
        case 'lundi-jeudi':
          nbAvHbd = day.dayName === 'Vendredi' ? 0 : parseInt(nbr_com);
          break;
        case 'lundi-mardi':
          nbAvHbd = ['Vendredi', 'Mercredi', 'Jeudi'].includes(day.dayName) ? 0 : parseInt(nbr_com);
          break;
        case 'mercredi-jeudi':
          nbAvHbd = ['Vendredi', 'Lundi', 'Mardi'].includes(day.dayName) ? 0 : parseInt(nbr_com);
          break;
        case 'vendredi':
          nbAvHbd = day.dayName === 'Vendredi' ? parseInt(nbr_com) : 0;
          break;
        default:
          nbAvHbd = parseInt(nbr_com);
      }

      // Insérer dans planning_hbd
      if (nbAvHbd > 0) {
        const dayTimestamp = Math.floor(new Date(day.date).getTime() / 1000);
        await query(
          `INSERT INTO planning_hbd (week, year, nbr_com, dep, timestamp, date_day, date_modif, date_modif_time)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [week, year, nbAvHbd, dep, dayTimestamp, day.date, timestamp, dateModifTime]
        );
      }

      // Créer les créneaux horaires
      let incrAv = 0;
      for (const hour of tabHeure) {
        let nbComHour = 0;

        // Logique de répartition selon le type et le jour
        if (nbAvHbd > 0) {
          switch (type) {
            case 'semaine':
            case 'lundi-jeudi':
              if (day.dayName === 'Lundi' && hour === '09:00:00' && !expDep.includes(dep)) {
                nbComHour = 0;
              } else if (day.dayName === 'Jeudi' && (hour === '18:00:00' || hour === '19:30:00')) {
                nbComHour = 0;
              } else if (day.dayName === 'Vendredi') {
                nbComHour = 0;
              } else {
                nbComHour = parseInt(nbr_com) === 1 && incrAv % 2 === 0 ? 2 : parseInt(nbr_com);
              }
              break;
            case 'lundi-mardi':
              if (day.dayName === 'Lundi' && hour === '09:00:00') {
                nbComHour = 0;
              } else if (['Vendredi', 'Mercredi', 'Jeudi'].includes(day.dayName)) {
                nbComHour = 0;
              } else {
                nbComHour = parseInt(nbr_com) === 1 && incrAv % 2 === 0 ? 2 : parseInt(nbr_com);
              }
              break;
            case 'mercredi-jeudi':
              if (day.dayName === 'Jeudi' && (hour === '18:00:00' || hour === '19:30:00')) {
                nbComHour = 0;
              } else if (['Vendredi', 'Lundi', 'Mardi'].includes(day.dayName)) {
                nbComHour = 0;
              } else {
                nbComHour = parseInt(nbr_com) === 1 && incrAv % 2 === 0 ? 2 : parseInt(nbr_com);
              }
              break;
            case 'vendredi':
              if (day.dayName === 'Vendredi') {
                nbComHour = parseInt(nbr_com) === 1 && incrAv % 2 === 0 ? 2 : parseInt(nbr_com);
              } else {
                nbComHour = 0;
              }
              break;
            default:
              nbComHour = parseInt(nbr_com);
          }
        }

        // Insérer dans planning_availablity
        await query(
          `INSERT INTO planning_availablity (week, year, dep, date_day, hour, force_crenaux, nbr_com, date_modif, date_modif_time)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [week, year, dep, day.date, hour, 0, nbComHour, timestamp, dateModifTime]
        );

        incrAv++;
      }
    }

    res.json({
      success: true,
      message: 'Planning créé avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la création du planning:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du planning',
      error: error.message
    });
  }
});

// Fermer/Ouvrir un créneau horaire (uniquement administrateurs)
router.put('/availability/toggle-closed', authenticate, checkPermission(1), async (req, res) => {
  try {
    const { week, year, dep, date, hour } = req.body;

    if (!week || !year || !dep || !date || !hour) {
      return res.status(400).json({
        success: false,
        message: 'Paramètres manquants'
      });
    }

    const now = new Date();
    const timestamp = Math.floor(now.getTime() / 1000);
    const dateModifTime = now.toISOString().slice(0, 19).replace('T', ' ');

    // Vérifier si la ligne existe
    const existing = await queryOne(
      `SELECT id, is_closed FROM planning_availablity 
       WHERE week = ? AND year = ? AND dep = ? AND date_day = ? AND hour = ?`,
      [week, year, dep, date, hour]
    );

    if (existing) {
      // Toggle is_closed (0 -> 1, 1 -> 0)
      const newIsClosed = existing.is_closed === 1 ? 0 : 1;
      await query(
        `UPDATE planning_availablity 
         SET is_closed = ?, date_modif = ?, date_modif_time = ?
         WHERE week = ? AND year = ? AND dep = ? AND date_day = ? AND hour = ?`,
        [newIsClosed, timestamp, dateModifTime, week, year, dep, date, hour]
      );

      res.json({
        success: true,
        data: {
          is_closed: newIsClosed,
          message: newIsClosed === 1 ? 'Créneau fermé' : 'Créneau ouvert'
        }
      });
    } else {
      // Créer la ligne avec is_closed = 1
      await query(
        `INSERT INTO planning_availablity 
         (week, year, dep, date_day, hour, force_crenaux, nbr_com, is_closed, date_modif, date_modif_time)
         VALUES (?, ?, ?, ?, ?, 0, 0, 1, ?, ?)`,
        [week, year, dep, date, hour, timestamp, dateModifTime]
      );

      res.json({
        success: true,
        data: {
          is_closed: 1,
          message: 'Créneau fermé'
        }
      });
    }
  } catch (error) {
    console.error('Erreur lors de la fermeture/ouverture du créneau:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la fermeture/ouverture du créneau',
      error: error.message
    });
  }
});

// Modifier la disponibilité (par créneau ou par jour)
router.put('/availability', authenticate, checkPermission(1, 2, 7), async (req, res) => {
  try {
    const { week, year, dep, date, hour, value, type } = req.body;

    if (!week || !year || !dep || !date || value === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Paramètres manquants'
      });
    }

    const now = new Date();
    const timestamp = Math.floor(now.getTime() / 1000);
    const dateModifTime = now.toISOString().slice(0, 19).replace('T', ' ');

    if (type === 'hour' && hour) {
      // Vérifier si la ligne existe
      const existing = await queryOne(
        `SELECT id FROM planning_availablity 
         WHERE week = ? AND year = ? AND dep = ? AND date_day = ? AND hour = ?`,
        [week, year, dep, date, hour]
      );

      if (existing) {
        // Mettre à jour si existe
        await query(
          `UPDATE planning_availablity 
           SET force_crenaux = 1, nbr_com = ?, date_modif = ?, date_modif_time = ?
           WHERE week = ? AND year = ? AND dep = ? AND date_day = ? AND hour = ?`,
          [parseInt(value), timestamp, dateModifTime, week, year, dep, date, hour]
        );
      } else {
        // Créer si n'existe pas
        await query(
          `INSERT INTO planning_availablity 
           (week, year, dep, date_day, hour, force_crenaux, nbr_com, date_modif, date_modif_time)
           VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
          [week, year, dep, date, hour, parseInt(value), timestamp, dateModifTime]
        );
      }

      const hourId = hourToId(hour);
      res.json({
        success: true,
        data: `${value}|${date}|${hourId}|hour`
      });
    } else if (type === 'day') {
      // Modifier tous les créneaux d'un jour
      // Pour chaque créneau horaire, mettre à jour ou créer
      for (const slot of TIME_SLOTS) {
        const existing = await queryOne(
          `SELECT id FROM planning_availablity 
           WHERE week = ? AND year = ? AND dep = ? AND date_day = ? AND hour = ?`,
          [week, year, dep, date, slot.hour]
        );

        if (existing) {
          await query(
            `UPDATE planning_availablity 
             SET nbr_com = ?, date_modif = ?, date_modif_time = ?
             WHERE week = ? AND year = ? AND dep = ? AND date_day = ? AND hour = ?`,
            [parseInt(value), timestamp, dateModifTime, week, year, dep, date, slot.hour]
          );
        } else {
          await query(
            `INSERT INTO planning_availablity 
             (week, year, dep, date_day, hour, force_crenaux, nbr_com, date_modif, date_modif_time)
             VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
            [week, year, dep, date, slot.hour, parseInt(value), timestamp, dateModifTime]
          );
        }
      }

      // Mettre à jour planning_hbd
      const existingHbd = await queryOne(
        `SELECT id FROM planning_hbd 
         WHERE week = ? AND year = ? AND dep = ? AND date_day = ?`,
        [week, year, dep, date]
      );

      if (existingHbd) {
        await query(
          `UPDATE planning_hbd 
           SET nbr_com = ?, date_modif = ?, date_modif_time = ?
           WHERE week = ? AND year = ? AND dep = ? AND date_day = ?`,
          [parseInt(value), timestamp, dateModifTime, week, year, dep, date]
        );
      } else {
        const dayTimestamp = Math.floor(new Date(date).getTime() / 1000);
        await query(
          `INSERT INTO planning_hbd 
           (week, year, nbr_com, dep, timestamp, date_day, date_modif, date_modif_time)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [week, year, parseInt(value), dep, dayTimestamp, date, timestamp, dateModifTime]
        );
      }

      res.json({
        success: true,
        data: `${value}|${date}`
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Type invalide'
      });
    }
  } catch (error) {
    console.error('Erreur lors de la modification de la disponibilité:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la modification de la disponibilité',
      error: error.message
    });
  }
});

// Dupliquer un planning
router.post('/duplicate', authenticate, checkPermission(1, 2, 7), async (req, res) => {
  try {
    const { sourceWeek, sourceYear, targetWeek, targetYear, dep } = req.body;

    if (!sourceWeek || !sourceYear || !targetWeek || !targetYear || !dep) {
      return res.status(400).json({
        success: false,
        message: 'Paramètres manquants (sourceWeek, sourceYear, targetWeek, targetYear, dep)'
      });
    }

    // Récupérer le planning source
    const sourceDays = getWeekDays(sourceYear, sourceWeek);
    const targetDays = getWeekDays(targetYear, targetWeek);

    // Supprimer d'abord les données existantes dans la semaine cible pour ce département
    await query(
      `DELETE FROM planning_hbd WHERE week = ? AND year = ? AND dep = ?`,
      [targetWeek, targetYear, dep]
    );
    await query(
      `DELETE FROM planning_availablity WHERE week = ? AND year = ? AND dep = ?`,
      [targetWeek, targetYear, dep]
    );

    const now = new Date();
    const timestamp = Math.floor(now.getTime() / 1000);
    const dateModifTime = now.toISOString().slice(0, 19).replace('T', ' ');

    // Dupliquer planning_hbd
    const sourceHbd = await query(
      `SELECT *, DATE_FORMAT(date_day, '%Y-%m-%d') as date_day_str FROM planning_hbd WHERE week = ? AND year = ? AND dep = ?`,
      [sourceWeek, sourceYear, dep]
    );

    console.log(`Duplication: ${sourceHbd.length} entrées planning_hbd trouvées`);

    for (const hbd of sourceHbd) {
      // Normaliser la date source
      let sourceDateStr = hbd.date_day_str;
      if (!sourceDateStr) {
        if (hbd.date_day instanceof Date) {
          sourceDateStr = hbd.date_day.toISOString().split('T')[0];
        } else {
          sourceDateStr = String(hbd.date_day).split('T')[0].split(' ')[0];
        }
      }
      
      // Trouver le jour correspondant dans la semaine source
      const sourceDay = sourceDays.find(d => d.date === sourceDateStr);
      
      if (sourceDay) {
        // Trouver le même jour dans la semaine cible
        const targetDay = targetDays.find(d => d.dayName === sourceDay.dayName);
        if (targetDay) {
          const targetDate = targetDay.date;
          const targetTimestamp = Math.floor(new Date(targetDate).getTime() / 1000);
          
          try {
            await query(
              `INSERT INTO planning_hbd (week, year, nbr_com, dep, timestamp, date_day, date_modif, date_modif_time)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [targetWeek, targetYear, hbd.nbr_com || 0, dep, targetTimestamp, targetDate, 
               timestamp, dateModifTime]
            );
          } catch (insertError) {
            console.error(`Erreur lors de l'insertion planning_hbd:`, insertError);
          }
        }
      }
    }

    // Dupliquer planning_availablity
    const sourceAv = await query(
      `SELECT *, DATE_FORMAT(date_day, '%Y-%m-%d') as date_day_str FROM planning_availablity WHERE week = ? AND year = ? AND dep = ?`,
      [sourceWeek, sourceYear, dep]
    );

    console.log(`Duplication: ${sourceAv.length} disponibilités trouvées pour semaine ${sourceWeek}/${sourceYear}, département ${dep}`);
    console.log(`Source days:`, sourceDays.map(d => `${d.date} (${d.dayName})`));
    console.log(`Target days:`, targetDays.map(d => `${d.date} (${d.dayName})`));

    let insertedCount = 0;
    for (const av of sourceAv) {
      // Normaliser la date source (peut être Date, string, ou date_day_str)
      let sourceDateStr = av.date_day_str;
      if (!sourceDateStr) {
        if (av.date_day instanceof Date) {
          sourceDateStr = av.date_day.toISOString().split('T')[0];
        } else {
          sourceDateStr = String(av.date_day).split('T')[0].split(' ')[0];
        }
      }
      
      // Trouver le jour correspondant dans la semaine source
      const sourceDay = sourceDays.find(d => d.date === sourceDateStr);
      
      if (sourceDay) {
        // Trouver le même jour dans la semaine cible
        const targetDay = targetDays.find(d => d.dayName === sourceDay.dayName);
        if (targetDay) {
          const targetDate = targetDay.date;
          
          // Normaliser l'heure (peut être Time ou string)
          let hourStr = av.hour;
          if (hourStr instanceof Date) {
            hourStr = hourStr.toTimeString().split(' ')[0];
          } else if (typeof hourStr === 'string' && hourStr.length > 8) {
            hourStr = hourStr.substring(0, 8);
          }
          
          try {
            await query(
              `INSERT INTO planning_availablity (week, year, dep, date_day, hour, force_crenaux, nbr_com, date_modif, date_modif_time)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [targetWeek, targetYear, dep, targetDate, hourStr, av.force_crenaux || 0, av.nbr_com || 0,
               timestamp, dateModifTime]
            );
            insertedCount++;
          } catch (insertError) {
            console.error(`Erreur lors de l'insertion de la disponibilité:`, insertError);
            console.error(`Données:`, { targetWeek, targetYear, dep, targetDate, hourStr, force_crenaux: av.force_crenaux, nbr_com: av.nbr_com });
          }
        } else {
          console.warn(`Jour cible non trouvé pour ${sourceDay.dayName}`);
        }
      } else {
        console.warn(`Jour source non trouvé pour date ${sourceDateStr}`);
      }
    }

    console.log(`Duplication terminée: ${insertedCount} disponibilités insérées sur ${sourceAv.length}`);

    res.json({
      success: true,
      message: 'Planning dupliqué avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la duplication du planning:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la duplication du planning',
      error: error.message
    });
  }
});

// Récupérer les départements disponibles
// Récupérer toutes les disponibilités hebdomadaires (groupées par département)
router.get('/hebdomadaire', authenticate, async (req, res) => {
  try {
    const { year, week } = req.query;
    const weekNum = parseInt(week) || getWeekNumber();
    const yearNum = parseInt(year) || new Date().getFullYear();

    if (!weekNum || !yearNum) {
      return res.status(400).json({
        success: false,
        message: 'Paramètres year et week requis'
      });
    }

    // Obtenir les jours de la semaine
    const days = getWeekDays(yearNum, weekNum);

    // Obtenir les dates de la semaine pour mapper les dates aux jours
    const weekDays = getWeekDays(yearNum, weekNum);
    const dateToDayMap = {};
    weekDays.forEach((day, index) => {
      dateToDayMap[day.date] = index + 1; // 1=Lundi, 2=Mardi, etc.
    });

    // Récupérer toutes les disponibilités de la semaine (tous départements)
    const availabilities = await query(
      `SELECT 
        pa.*,
        d.departement_nom,
        d.departement_code,
        DATE_FORMAT(pa.date_day, '%Y-%m-%d') as date_day_str
      FROM planning_availablity pa
      LEFT JOIN departements d ON pa.dep = d.departement_code
      WHERE pa.week = ? AND pa.year = ?
      ORDER BY pa.dep, pa.date_day, pa.hour ASC`,
      [weekNum, yearNum]
    );

    console.log(`Planning hebdomadaire - Nombre de disponibilités trouvées: ${availabilities.length}`);
    if (availabilities.length > 0) {
      console.log('Exemple de disponibilité:', {
        dep: availabilities[0].dep,
        date: availabilities[0].date_day_str,
        nbr_com: availabilities[0].nbr_com,
        week: availabilities[0].week,
        year: availabilities[0].year
      });
    }

    // Grouper par département et jour
    const grouped = {};
    availabilities.forEach(av => {
      const depKey = String(av.dep || av.departement_code || '').padStart(2, '0');
      if (!depKey || depKey === '00') return;
      
      const dateStr = av.date_day_str || (av.date_day instanceof Date 
        ? av.date_day.toISOString().split('T')[0] 
        : String(av.date_day).split('T')[0]);
      
      // Obtenir le jour de la semaine (1=Lundi, 2=Mardi, etc.)
      const dayOfWeek = dateToDayMap[dateStr];
      
      // Ignorer les jours hors semaine
      if (!dayOfWeek || dayOfWeek < 1 || dayOfWeek > 5) {
        return;
      }

      if (!grouped[depKey]) {
        // Utiliser le code du département au format "DEP {code}"
        const depCode = av.departement_code || av.dep || depKey;
        grouped[depKey] = {
          id: null,
          departement_id: depKey,
          departement_code: depCode,
          departement_nom: `DEP ${depCode}`, // Format: "DEP 01", "DEP 75", etc.
          lundi: 0,
          mardi: 0,
          mercredi: 0,
          jeudi: 0,
          vendredi: 0
        };
      }

      // Pour chaque jour, on prend le maximum du nombre commercial de tous les créneaux horaires
      // Quand on crée depuis le planning hebdomadaire, tous les créneaux d'un jour ont la même valeur
      const currentValue = parseInt(av.nbr_com || 0);
      
      // Utiliser MAX pour prendre la valeur la plus élevée parmi tous les créneaux horaires du jour
      if (dayOfWeek === 1) {
        grouped[depKey].lundi = Math.max(grouped[depKey].lundi, currentValue);
      } else if (dayOfWeek === 2) {
        grouped[depKey].mardi = Math.max(grouped[depKey].mardi, currentValue);
      } else if (dayOfWeek === 3) {
        grouped[depKey].mercredi = Math.max(grouped[depKey].mercredi, currentValue);
      } else if (dayOfWeek === 4) {
        grouped[depKey].jeudi = Math.max(grouped[depKey].jeudi, currentValue);
      } else if (dayOfWeek === 5) {
        grouped[depKey].vendredi = Math.max(grouped[depKey].vendredi, currentValue);
      }
    });
    
    console.log(`Planning hebdomadaire - Nombre de départements groupés: ${Object.keys(grouped).length}`);
    if (Object.keys(grouped).length > 0) {
      console.log('Exemple de département groupé:', Object.values(grouped)[0]);
    }

    // Convertir l'objet groupé en tableau
    const result = Object.values(grouped);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du planning hebdomadaire:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// Créer une disponibilité hebdomadaire
router.post('/hebdomadaire', authenticate, checkPermission(1, 2, 7), async (req, res) => {
  try {
    const { year, week, jour, id_departement, nombre_commercial, forcer } = req.body;

    if (!year || !week || !jour || !id_departement || !nombre_commercial) {
      return res.status(400).json({
        success: false,
        message: 'Paramètres manquants'
      });
    }

    const weekNum = parseInt(week);
    const yearNum = parseInt(year);
    const dep = String(id_departement).padStart(2, '0');
    const nbrCom = parseInt(nombre_commercial);

    // Obtenir les jours de la semaine
    const days = getWeekDays(yearNum, weekNum);
    
    // Parser la valeur jour (peut être un nombre ou une plage "1-4")
    let joursToProcess = [];
    if (jour.includes('-')) {
      // Plage de jours (ex: "1-4" pour Lundi à jeudi)
      const [start, end] = jour.split('-').map(n => parseInt(n));
      if (start < 1 || start > 5 || end < 1 || end > 5 || start > end) {
        return res.status(400).json({
          success: false,
          message: 'Plage de jours invalide'
        });
      }
      // Générer tous les jours de la plage
      for (let j = start; j <= end; j++) {
        joursToProcess.push(j);
      }
    } else {
      // Jour unique
      const jourNum = parseInt(jour);
      if (jourNum < 1 || jourNum > 5) {
        return res.status(400).json({
          success: false,
          message: 'Jour invalide (doit être entre 1 et 5)'
        });
      }
      joursToProcess.push(jourNum);
    }

    // Pour chaque créneau horaire, créer ou mettre à jour la disponibilité
    const now = new Date();
    const dateModifTime = now.toISOString().slice(0, 19).replace('T', ' ');

    // Traiter chaque jour de la plage
    for (const jourNum of joursToProcess) {
      // Obtenir la date correspondante au jour
      const targetDate = days[jourNum - 1].date;

      for (const slot of TIME_SLOTS) {
        // Vérifier si une disponibilité existe déjà
        const existing = await queryOne(
          `SELECT id FROM planning_availablity 
           WHERE week = ? AND year = ? AND dep = ? AND date_day = ? AND hour = ?`,
          [weekNum, yearNum, dep, targetDate, slot.hour]
        );

        if (existing) {
          // Mettre à jour
          await query(
            `UPDATE planning_availablity 
             SET nbr_com = ?, force_crenaux = ?, date_modif_time = ?
             WHERE id = ?`,
            [nbrCom, forcer === 'CRENAUX' ? 1 : 0, dateModifTime, existing.id]
          );
        } else {
          // Créer
          await query(
            `INSERT INTO planning_availablity 
             (week, year, dep, date_day, hour, nbr_com, force_crenaux, date_modif, date_modif_time)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [weekNum, yearNum, dep, targetDate, slot.hour, nbrCom, forcer === 'CRENAUX' ? 1 : 0, dateModifTime, dateModifTime]
          );
        }
      }
    }

    res.json({
      success: true,
      message: 'Disponibilité ajoutée avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la création de la disponibilité:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// Supprimer toutes les disponibilités d'un département pour une semaine
router.delete('/hebdomadaire/:departementId', authenticate, checkPermission(1, 2, 7), async (req, res) => {
  try {
    const { departementId } = req.params;
    const { year, week } = req.query;

    if (!year || !week || !departementId) {
      return res.status(400).json({
        success: false,
        message: 'Paramètres manquants'
      });
    }

    const weekNum = parseInt(week);
    const yearNum = parseInt(year);
    const dep = String(departementId).padStart(2, '0');

    await query(
      `DELETE FROM planning_availablity 
       WHERE week = ? AND year = ? AND dep = ?`,
      [weekNum, yearNum, dep]
    );

    res.json({
      success: true,
      message: 'Disponibilités supprimées avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la suppression:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// Dupliquer le planning d'une semaine vers plusieurs autres semaines
router.post('/hebdomadaire/duplicate', authenticate, checkPermission(1, 2, 7), async (req, res) => {
  try {
    const { source_week, source_year, target_weeks, target_year } = req.body;

    if (!source_week || !source_year || !target_weeks || !Array.isArray(target_weeks) || target_weeks.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Paramètres manquants ou invalides'
      });
    }

    const sourceWeek = parseInt(source_week);
    const sourceYear = parseInt(source_year);
    const targetYear = target_year ? parseInt(target_year) : sourceYear;

    // Récupérer toutes les disponibilités de la semaine source
    const sourceAvailabilities = await query(
      `SELECT * FROM planning_availablity 
       WHERE week = ? AND year = ?`,
      [sourceWeek, sourceYear]
    );

    if (sourceAvailabilities.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Aucune disponibilité trouvée pour la semaine source'
      });
    }

    const now = new Date();
    const dateModifTime = now.toISOString().slice(0, 19).replace('T', ' ');

    // Pour chaque semaine cible
    for (const targetWeek of target_weeks) {
      const targetWeekNum = parseInt(targetWeek);
      
      // Obtenir les jours de la semaine cible
      const targetDays = getWeekDays(targetYear, targetWeekNum);
      
      // Supprimer les disponibilités existantes pour cette semaine
      await query(
        `DELETE FROM planning_availablity WHERE week = ? AND year = ?`,
        [targetWeekNum, targetYear]
      );

      // Pour chaque disponibilité source, calculer le jour correspondant dans la semaine cible
      for (const sourceAv of sourceAvailabilities) {
        // Trouver le jour de la semaine source
        const sourceDate = new Date(sourceAv.date_day);
        const sourceDayIndex = sourceDate.getDay() === 0 ? 6 : sourceDate.getDay() - 1; // 0=Lundi, 4=Vendredi
        
        if (sourceDayIndex >= 0 && sourceDayIndex < 5 && targetDays[sourceDayIndex]) {
          const targetDate = targetDays[sourceDayIndex].date;

          await query(
            `INSERT INTO planning_availablity 
             (week, year, dep, date_day, hour, nbr_com, force_crenaux, date_modif, date_modif_time)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              targetWeekNum,
              targetYear,
              sourceAv.dep,
              targetDate,
              sourceAv.hour,
              sourceAv.nbr_com,
              sourceAv.force_crenaux,
              dateModifTime,
              dateModifTime
            ]
          );
        }
      }
    }

    res.json({
      success: true,
      message: `Planning dupliqué vers ${target_weeks.length} semaine(s) avec succès`
    });
  } catch (error) {
    console.error('Erreur lors de la duplication:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// Réinitialiser toutes les disponibilités d'une semaine (mettre tout à 0)
router.post('/hebdomadaire/reset', authenticate, checkPermission(1, 2, 7), async (req, res) => {
  try {
    const { year, week } = req.query;

    if (!year || !week) {
      return res.status(400).json({
        success: false,
        message: 'Paramètres year et week requis'
      });
    }

    const weekNum = parseInt(week);
    const yearNum = parseInt(year);

    await query(
      `UPDATE planning_availablity 
       SET nbr_com = 0 
       WHERE week = ? AND year = ?`,
      [weekNum, yearNum]
    );

    res.json({
      success: true,
      message: 'Toutes les disponibilités ont été mises à 0'
    });
  } catch (error) {
    console.error('Erreur lors de la réinitialisation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

// Calculer les distances entre codes postaux et villes
router.post('/calculate-distance', authenticate, async (req, res) => {
  try {
    console.log('[Distance] ===== Début du calcul de distances =====');
    const { adresses } = req.body;
    const { codes_postaux } = req.body; // Support pour l'ancien format aussi
    
    // Vérifier la configuration GraphHopper
    const hasGraphHopperKey = !!process.env.GRAPHHOPPER_API_KEY;
    console.log(`[Distance] Configuration GraphHopper: ${hasGraphHopperKey ? '✅ Clé API configurée' : '⚠️ Aucune clé API (utilisation limitée)'}`);

    // Support de l'ancien format (juste codes postaux)
    let adressesList = [];
    if (adresses && Array.isArray(adresses)) {
      adressesList = adresses;
    } else if (codes_postaux && Array.isArray(codes_postaux)) {
      // Convertir l'ancien format vers le nouveau
      adressesList = codes_postaux.map(cp => ({
        cp: String(cp || '').trim().replace(/\D/g, ''),
        ville: null
      }));
    }

    if (!adressesList || adressesList.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Au moins 2 adresses sont requises'
      });
    }

    // Nettoyer et normaliser les codes postaux et villes
    const cleanedAddresses = adressesList.map(addr => {
      const cpStr = String(addr.cp || addr || '').trim().replace(/\D/g, '');
      const cleanedCp = cpStr.padStart(5, '0').substring(0, 5);
      const cleanedVille = addr.ville ? String(addr.ville).trim() : null;
      return {
        cp: cleanedCp,
        ville: cleanedVille
      };
    }).filter(addr => addr.cp && addr.cp.length === 5);

    if (cleanedAddresses.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Au moins 2 adresses valides (code postal) sont requises'
      });
    }

    // Utiliser l'API gouvernementale française pour obtenir les coordonnées
    const axios = require('axios');
    const distances = [];
    let totalDistance = 0;

    // Fonction pour obtenir les coordonnées d'une adresse (code postal + ville) via l'API adresse.data.gouv.fr
    const getCoordinates = async (cp, ville) => {
      try {
        // Construire la requête avec code postal et ville si disponible
        let query = cp;
        if (ville && ville.trim()) {
          query = `${cp} ${ville}`;
        }

        const response = await axios.get(`https://api-adresse.data.gouv.fr/search/`, {
          params: {
            q: query,
            limit: 1,
            postcode: cp,
            type: 'housenumber' // Plus précis que 'municipality'
          },
          timeout: 5000
        });

        if (response.data && response.data.features && response.data.features.length > 0) {
          const coords = response.data.features[0].geometry.coordinates;
          return { lon: coords[0], lat: coords[1] };
        }
        
        // Si pas de résultat avec housenumber, essayer avec municipality
        const responseMunicipality = await axios.get(`https://api-adresse.data.gouv.fr/search/`, {
          params: {
            q: query,
            limit: 1,
            postcode: cp,
            type: 'municipality'
          },
          timeout: 5000
        });

        if (responseMunicipality.data && responseMunicipality.data.features && responseMunicipality.data.features.length > 0) {
          const coords = responseMunicipality.data.features[0].geometry.coordinates;
          return { lon: coords[0], lat: coords[1] };
        }
        
        return null;
      } catch (error) {
        console.error(`Erreur lors de la récupération des coordonnées pour CP ${cp}${ville ? `, Ville ${ville}` : ''}:`, error.message);
        return null;
      }
    };

    // Fonction pour calculer la distance et durée réelles via GraphHopper API
    const calculateRouteWithGraphHopper = async (lat1, lon1, lat2, lon2) => {
      try {
        // Utiliser GraphHopper API pour obtenir l'itinéraire réel
        // La clé API peut être définie dans les variables d'environnement
        // GraphHopper propose un plan gratuit avec limite de requêtes (inscription requise)
        // Pour obtenir une clé API: https://www.graphhopper.com/
        const apiKey = process.env.GRAPHHOPPER_API_KEY || '';
        
        if (!apiKey) {
          console.log('[GraphHopper] Aucune clé API configurée, tentative sans clé (limite très basse)');
        } else {
          console.log('[GraphHopper] Clé API détectée, utilisation de GraphHopper API');
        }
        
        // GraphHopper API endpoint
        const graphhopperUrl = 'https://graphhopper.com/api/1/route';

        // GraphHopper attend les points comme paramètres répétés : point=lat1,lon1&point=lat2,lon2
        // On doit construire l'URL manuellement ou utiliser paramsSerializer
        const params = {
          vehicle: 'car',
          locale: 'fr',
          instructions: 'false', // GraphHopper attend une chaîne
          calc_points: 'false', // GraphHopper attend une chaîne
          type: 'json'
        };

        // Ajouter la clé API si disponible
        if (apiKey) {
          params.key = apiKey;
        }
        
        console.log(`[GraphHopper] Calcul d'itinéraire: (${lat1}, ${lon1}) -> (${lat2}, ${lon2})`);
        
        // GraphHopper nécessite les points comme paramètres répétés dans l'URL
        // Construction manuelle de l'URL avec les points
        let urlWithParams = `${graphhopperUrl}?`;
        urlWithParams += `point=${encodeURIComponent(`${lat1},${lon1}`)}&`;
        urlWithParams += `point=${encodeURIComponent(`${lat2},${lon2}`)}&`;
        urlWithParams += `vehicle=${params.vehicle}&`;
        urlWithParams += `locale=${params.locale}&`;
        urlWithParams += `instructions=${params.instructions}&`;
        urlWithParams += `calc_points=${params.calc_points}&`;
        urlWithParams += `type=${params.type}`;
        if (apiKey) {
          urlWithParams += `&key=${encodeURIComponent(apiKey)}`;
        }
        
        console.log(`[GraphHopper] URL complète: ${urlWithParams.replace(apiKey || '', '***')}`);
        
        const response = await axios.get(urlWithParams, {
          timeout: 10000,
          headers: {
            'Accept': 'application/json'
          }
        });

        console.log(`[GraphHopper] Status: ${response.status}`);
        console.log(`[GraphHopper] Response data:`, JSON.stringify(response.data, null, 2).substring(0, 500));

        if (response.data && response.data.paths && response.data.paths.length > 0) {
          const path = response.data.paths[0];
          // Distance en mètres, convertir en km
          const distanceKm = (path.distance || 0) / 1000;
          // Durée en millisecondes, convertir en secondes
          const durationSeconds = Math.round((path.time || 0) / 1000);
          
          console.log(`[GraphHopper] ✅ Succès - Distance: ${distanceKm.toFixed(2)} km, Durée: ${formatDuration(durationSeconds)}`);
          
          return {
            distance: distanceKm,
            duration: durationSeconds
          };
        }
        
        console.warn('[GraphHopper] ⚠️ Aucun itinéraire trouvé dans la réponse');
        console.warn('[GraphHopper] Response structure:', {
          hasData: !!response.data,
          hasPaths: !!(response.data && response.data.paths),
          pathsLength: response.data?.paths?.length || 0,
          fullResponse: response.data
        });
        return null;
      } catch (error) {
        if (error.response) {
          console.error(`[GraphHopper] ❌ Erreur API (${error.response.status}):`, error.response.statusText);
          console.error(`[GraphHopper] Erreur complète:`, JSON.stringify(error.response.data, null, 2));
          console.error(`[GraphHopper] Headers de réponse:`, error.response.headers);
          if (error.response.status === 429) {
            console.error('[GraphHopper] Limite de requêtes atteinte, basculement vers estimation');
          } else if (error.response.status === 401 || error.response.status === 403) {
            console.error('[GraphHopper] Clé API invalide ou expirée, basculement vers estimation');
          } else if (error.response.status === 400) {
            console.error('[GraphHopper] Requête invalide, vérifier les paramètres');
          } else {
            console.error(`[GraphHopper] Erreur HTTP ${error.response.status}, basculement vers estimation`);
          }
        } else if (error.request) {
          console.error(`[GraphHopper] ❌ Pas de réponse du serveur (timeout ou réseau)`);
          console.error(`[GraphHopper] Request config:`, {
            url: error.config?.url,
            method: error.config?.method,
            params: error.config?.params
          });
        } else {
          console.error(`[GraphHopper] ❌ Erreur lors de la configuration de la requête:`, error.message);
          console.error(`[GraphHopper] Stack:`, error.stack);
        }
        // Fallback: utiliser la formule de Haversine et estimation
        return null;
      }
    };

    // Fonction de fallback: calculer la distance entre deux points (formule de Haversine)
    const calculateDistanceHaversine = (lat1, lon1, lat2, lon2) => {
      const R = 6371; // Rayon de la Terre en km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    // Fonction de fallback: estimer la durée d'itinéraire en voiture basée sur la distance
    const estimateDrivingDuration = (distanceKm) => {
      if (!distanceKm || distanceKm <= 0) return null;
      
      // Vitesse moyenne adaptée selon la distance :
      // - Courtes distances (< 10km) : 40 km/h (ville)
      // - Distances moyennes (10-50km) : 55 km/h (mixte)
      // - Longues distances (> 50km) : 70 km/h (autoroute/route)
      let averageSpeedKmh;
      if (distanceKm < 10) {
        averageSpeedKmh = 40;
      } else if (distanceKm < 50) {
        averageSpeedKmh = 55;
      } else {
        averageSpeedKmh = 70;
      }
      
      // Calculer la durée de base
      let durationHours = distanceKm / averageSpeedKmh;
      
      // Ajouter du temps pour :
      // - Départ et arrivée : 5 minutes
      // - Arrêts, feux, ralentissements : 15% supplémentaire
      durationHours += (5 / 60); // 5 minutes en heures
      durationHours *= 1.15; // 15% de temps supplémentaire
      
      return Math.round(durationHours * 3600); // Retourne en secondes
    };

    // Fonction pour formater la durée en heures et minutes
    const formatDuration = (seconds) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      if (hours > 0) {
        return `${hours}h ${minutes}min`;
      }
      return `${minutes}min`;
    };

    // Créer une clé unique pour chaque adresse (cp + ville) pour éviter les doublons
    const addressKey = (addr) => `${addr.cp}_${addr.ville || ''}`;
    const uniqueAddresses = [];
    const seenKeys = new Set();
    
    cleanedAddresses.forEach(addr => {
      const key = addressKey(addr);
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueAddresses.push(addr);
      }
    });

    // Récupérer les coordonnées pour toutes les adresses uniques
    const coordinatesMap = {};

    for (const addr of uniqueAddresses) {
      const key = addressKey(addr);
      const coords = await getCoordinates(addr.cp, addr.ville);
      if (coords) {
        coordinatesMap[key] = coords;
      }
    }

    // Calculer les distances et durées entre toutes les paires d'adresses
    for (let i = 0; i < cleanedAddresses.length; i++) {
      for (let j = i + 1; j < cleanedAddresses.length; j++) {
        const addr1 = cleanedAddresses[i];
        const addr2 = cleanedAddresses[j];
        const key1 = addressKey(addr1);
        const key2 = addressKey(addr2);
        const coords1 = coordinatesMap[key1];
        const coords2 = coordinatesMap[key2];

        if (coords1 && coords2) {
          // Essayer d'abord avec GraphHopper pour obtenir distance et durée réelles
          let distance = null;
          let durationSeconds = null;
          let method = 'unknown';
          
          console.log(`[Distance] Calcul entre CP ${addr1.cp}${addr1.ville ? ` (${addr1.ville})` : ''} et CP ${addr2.cp}${addr2.ville ? ` (${addr2.ville})` : ''}`);
          
          const routeResult = await calculateRouteWithGraphHopper(
            coords1.lat, 
            coords1.lon, 
            coords2.lat, 
            coords2.lon
          );

          if (routeResult) {
            // GraphHopper a réussi, utiliser les valeurs réelles
            distance = routeResult.distance;
            durationSeconds = routeResult.duration;
            method = 'GraphHopper';
            console.log(`[Distance] ✅ Utilisation GraphHopper - Distance: ${distance.toFixed(2)} km, Durée: ${formatDuration(durationSeconds)}`);
          } else {
            // Fallback: utiliser Haversine pour la distance et estimation pour la durée
            method = 'Estimation (Haversine)';
            distance = calculateDistanceHaversine(coords1.lat, coords1.lon, coords2.lat, coords2.lon);
            durationSeconds = estimateDrivingDuration(distance);
            console.log(`[Distance] ⚠️ GraphHopper indisponible, utilisation estimation - Distance: ${distance.toFixed(2)} km, Durée: ${formatDuration(durationSeconds)}`);
          }

          distances.push({
            cp1: addr1.cp,
            ville1: addr1.ville || null,
            cp2: addr2.cp,
            ville2: addr2.ville || null,
            distance,
            duration_seconds: durationSeconds,
            duration_formatted: durationSeconds ? formatDuration(durationSeconds) : null,
            method: method // Ajouter la méthode utilisée pour le debug
          });
          
          if (distance) {
            totalDistance += distance;
          }
        } else {
          distances.push({
            cp1: addr1.cp,
            ville1: addr1.ville || null,
            cp2: addr2.cp,
            ville2: addr2.ville || null,
            distance: null,
            duration_seconds: null,
            duration_formatted: null
          });
        }
      }
    }

    // Statistiques sur les méthodes utilisées
    const graphhopperCount = distances.filter(d => d.method === 'GraphHopper').length;
    const estimationCount = distances.filter(d => d.method === 'Estimation (Haversine)').length;
    
    console.log(`[Distance] ===== Résultats du calcul =====`);
    console.log(`[Distance] Total de paires calculées: ${distances.length}`);
    console.log(`[Distance] GraphHopper: ${graphhopperCount} | Estimation: ${estimationCount}`);
    console.log(`[Distance] Distance totale: ${totalDistance.toFixed(2)} km`);
    console.log(`[Distance] ===== Fin du calcul =====`);
    
    res.json({
      success: true,
      data: {
        distances,
        total_distance: totalDistance,
        stats: {
          total_pairs: distances.length,
          graphhopper_count: graphhopperCount,
          estimation_count: estimationCount
        }
      }
    });
  } catch (error) {
    console.error('Erreur lors du calcul des distances:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du calcul des distances',
      error: error.message
    });
  }
});

router.get('/departements', authenticate, async (req, res) => {
  try {
    // Requête identique à celle de l'ancienne application PHP
    // SELECT dep.departement_nom_uppercase as nom, dep.departement_code as code
    // FROM departements dep
    // GROUP BY dep.id order by dep.departement_code ASC
    const departements = await query(
      `SELECT dep.departement_nom_uppercase as nom, dep.departement_code as code
       FROM departements dep
       GROUP BY dep.id, dep.departement_nom_uppercase, dep.departement_code
       ORDER BY dep.departement_code ASC`
    );

    console.log(`Nombre de départements récupérés: ${departements.length}`);
    if (departements.length > 0) {
      console.log('Premier département:', departements[0]);
    }

    res.json({
      success: true,
      data: departements
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des départements:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
});

module.exports = router;
