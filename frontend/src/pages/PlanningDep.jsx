import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaChevronLeft, FaChevronRight, FaCalendarAlt } from 'react-icons/fa';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import './Planning.css';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';

// Helper pour obtenir le numéro de semaine ISO
function getWeekNumber(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Helper pour obtenir le dernier numéro de semaine ISO d'une année
function getLastWeekNumber(year) {
  // Le 28 décembre est toujours dans la dernière semaine ISO de l'année
  // (selon ISO 8601, la semaine 1 de l'année suivante contient le 4 janvier)
  return getWeekNumber(new Date(year, 11, 28));
}

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

// Helper pour calculer le timeKey à partir d'une heure (HH:MM:SS)
// Évite les problèmes de fuseau horaire en calculant directement les secondes depuis minuit UTC
function hourToTimeKey(hour) {
  const [hours, minutes, seconds] = hour.split(':').map(Number);
  return hours * 3600 + minutes * 60 + (seconds || 0);
}

// Helper pour formater une date en YYYY-MM-DD en heure locale (évite le décalage UTC)
function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Créneaux horaires
const TIME_SLOTS = [
  { hour: '09:00:00', start: '09:00:00', end: '10:59:59', name: '9H ( 9h uniquement )', id: '09-00-00' },
  { hour: '11:00:00', start: '11:00:00', end: '12:59:59', name: '11H ( 11h à 12h )', id: '11-00-00' },
  { hour: '13:00:00', start: '13:00:00', end: '15:59:59', name: '13H ( 13h à 14h30 )', id: '13-00-00' },
  { hour: '16:00:00', start: '16:00:00', end: '17:59:59', name: '16H ( 16h à 17h )', id: '16-00-00' },
  { hour: '18:00:00', start: '18:00:00', end: '19:29:59', name: '18H ( 18h à 19h )', id: '18-00-00' },
  { hour: '19:30:00', start: '19:30:00', end: '20:00:00', name: '20H ( 19h30 à 20h )', id: '19-30-00' }
];

const PlanningDep = () => {
  useForceDesktopViewport('planning-dep-page');
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Vérifier si l'utilisateur est admin (fonction 1, 2, 7, ou 11)
  const isAdmin = user?.fonction === 1 || user?.fonction === 2 || user?.fonction === 7 || user?.fonction === 11;
  
  const currentDate = new Date();
  const currentWeek = getWeekNumber(currentDate);
  const currentYear = currentDate.getFullYear();

  const [week, setWeek] = useState(parseInt(searchParams.get('w')) || currentWeek);
  const [year, setYear] = useState(parseInt(searchParams.get('y')) || currentYear);
  const [dep, setDep] = useState(searchParams.get('dp') || '');
  const [besoinDate, setBesoinDate] = useState(formatDateLocal(new Date()));
  const [besoinDep, setBesoinDep] = useState('all');
  const [isGeneratingBesoin, setIsGeneratingBesoin] = useState(false);
  const [besoinRows, setBesoinRows] = useState([]);

  // Récupérer les départements
  const { data: departementsData, isLoading: isLoadingDepartements } = useQuery(
    'planning-departements', 
    async () => {
      try {
        const res = await api.get('/planning/departements');
        if (res.data && res.data.success && res.data.data) {
          return res.data.data;
        }
        const resManagement = await api.get('/management/departements');
        if (resManagement.data && resManagement.data.success && resManagement.data.data) {
          return resManagement.data.data
            .filter(d => (d.etat == null || d.etat > 0))
            .map(d => ({
              code: d.departement_code,
              nom: d.departement_nom_uppercase || d.departement_nom
            }));
        }
        return [];
      } catch (error) {
        console.error('Erreur lors du chargement des départements:', error);
        try {
          const resManagement = await api.get('/management/departements');
          if (resManagement.data && resManagement.data.success && resManagement.data.data) {
            return resManagement.data.data
              .filter(d => (d.etat == null || d.etat > 0))
              .map(d => ({
                code: d.departement_code,
                nom: d.departement_nom_uppercase || d.departement_nom
              }));
          }
        } catch (err) {
          console.error('Erreur route management:', err);
        }
        return [];
      }
    }
  );

  // Calculer les jours de la semaine (Lundi à Vendredi uniquement)
  const weekStart = getMondayOfWeek(year, week);
  const days = [];
  const daysFr = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
  // Extraire les composants du lundi pour éviter les problèmes de fuseau horaire
  const weekStartYear = weekStart.getFullYear();
  const weekStartMonth = weekStart.getMonth();
  const weekStartDay = weekStart.getDate();
  for (let i = 0; i < 5; i++) {
    // Créer la date directement avec les composants (évite les problèmes de fuseau horaire)
    const date = new Date(weekStartYear, weekStartMonth, weekStartDay + i);
    const dateStr = formatDateLocal(date);
    days.push({ date: dateStr, dayName: daysFr[i] });
  }
  const weekEnd = new Date(days[4].date);

  // Récupérer le planning
  const { data: planningData, isLoading: isLoadingPlanning } = useQuery(
    ['planning-week', week, year, dep],
    async () => {
      const res = await api.get('/planning/week', { params: { w: week, y: year, dp: dep || '01' } });
      console.log('[PlanningDep] Planning reçu:', res.data);
      console.log('[PlanningDep] Planning data:', res.data?.data);
      return res.data;
    },
    { 
      keepPreviousData: true, 
      enabled: !!week && !!year && !!dep
    }
  );

  const planning = planningData?.data || {};
  
  // Debug: afficher la structure du planning et compter les RDV
  useEffect(() => {
    if (planning && Object.keys(planning).length > 0) {
      console.log('[PlanningDep] Planning structuré:', planning);
      console.log('[PlanningDep] Nombre de dates dans planning:', Object.keys(planning).length);
      
      // Afficher les TimeKeys pour chaque créneau
      TIME_SLOTS.forEach(slot => {
        const timeKey = hourToTimeKey(slot.hour);
        console.log(`[PlanningDep] TimeKey pour ${slot.hour}: ${timeKey}`);
      });
      
      let totalRdvs = 0;
      Object.keys(planning).forEach(date => {
        const dateData = planning[date];
        if (dateData?.time) {
          const timeKeys = Object.keys(dateData.time);
          console.log(`[PlanningDep] Date ${date} - TimeKeys disponibles:`, timeKeys);
          
          timeKeys.forEach(timeKey => {
            const rdvs = dateData.time[timeKey]?.planning || [];
            totalRdvs += rdvs.length;
            if (rdvs.length > 0) {
              // Trouver le créneau correspondant
              const slot = TIME_SLOTS.find(s => {
                const sTimeKey = hourToTimeKey(s.hour);
                return sTimeKey === parseInt(timeKey);
              });
              const slotHour = slot ? slot.hour : 'inconnu';
              console.log(`[PlanningDep] RDV trouvés pour ${date} à timeKey ${timeKey}: ${rdvs.length}`, rdvs);
              console.log(`[PlanningDep] Créneau correspondant: ${slotHour}`);
            }
          });
        }
      });
      console.log(`[PlanningDep] Total RDV dans le planning: ${totalRdvs}`);
    } else {
      console.log('[PlanningDep] Planning vide ou non défini');
    }
  }, [planning]);

  const getAvailabilityColor = (rdvCount, availability) => {
    if (availability === 0) return 'rgba(34, 45, 50, 0.8)';
    const ratio = rdvCount / availability;
    if (ratio >= 1) return '#d32f2f'; // Rouge - complet
    if (ratio >= 0.8) return '#ff9800'; // Orange - presque complet
    if (ratio >= 0.5) return '#ffc107'; // Jaune - moitié
    return '#4caf50'; // Vert - disponible
  };

  // Navigation
  const handlePrevWeek = () => {
    let newWeek = week - 1;
    let newYear = year;
    if (newWeek < 1) {
      newYear = year - 1;
      newWeek = getLastWeekNumber(newYear);
    }
    setWeek(newWeek);
    setYear(newYear);
    updateSearchParams(newWeek, newYear, dep);
  };

  const handleNextWeek = () => {
    let newWeek = week + 1;
    let newYear = year;
    const lastWeek = getLastWeekNumber(year);
    if (newWeek > lastWeek) {
      newYear = year + 1;
      newWeek = 1;
    }
    setWeek(newWeek);
    setYear(newYear);
    updateSearchParams(newWeek, newYear, dep);
  };

  const updateSearchParams = (w, y, dp) => {
    const params = new URLSearchParams();
    if (w) params.set('w', w);
    if (y) params.set('y', y);
    if (dp) params.set('dp', dp);
    setSearchParams(params);
  };

  const handleDepChange = (e) => {
    const newDep = e.target.value;
    setDep(newDep);
    updateSearchParams(week, year, newDep);
  };

  // Initialiser le département si vide
  useEffect(() => {
    if (!dep && departementsData && departementsData.length > 0) {
      const firstDep = departementsData[0].code || departementsData[0].departement_code;
      setDep(firstDep);
      updateSearchParams(week, year, firstDep);
    }
  }, [departementsData, dep]);

  const computeBesoinForPlanning = (planningByDate, targetDate) => {
    const dayPlanning = planningByDate?.[targetDate]?.time || {};
    let disponibilite = 0;
    let rdvPris = 0;

    Object.values(dayPlanning).forEach((slot) => {
      const av = slot?.av;
      if (av !== null && av !== undefined && !Number.isNaN(Number(av))) {
        disponibilite += Number(av);
      }
      rdvPris += Array.isArray(slot?.planning) ? slot.planning.length : 0;
    });

    return {
      disponibilite,
      rdvPris,
      besoin: Math.max(disponibilite - rdvPris, 0),
    };
  };

  const handleGenerateBesoin = async () => {
    if (!besoinDate) return;
    if (!departementsData || departementsData.length === 0) return;

    try {
      setIsGeneratingBesoin(true);
      const selectedDate = new Date(`${besoinDate}T12:00:00`);
      const targetWeek = getWeekNumber(selectedDate);
      const targetYear = selectedDate.getFullYear();

      const depItems = (besoinDep === 'all'
        ? departementsData
        : departementsData.filter((d) => (d.code || d.departement_code) === besoinDep)
      ).map((d) => ({
        code: d.code || d.departement_code || '',
        nom: d.nom || d.departement_nom_uppercase || d.departement_nom || '',
      })).filter((d) => d.code);

      const rows = await Promise.all(
        depItems.map(async (d) => {
          const res = await api.get('/planning/week', {
            params: { w: targetWeek, y: targetYear, dp: d.code },
          });
          const planningByDate = res?.data?.data || {};
          const metrics = computeBesoinForPlanning(planningByDate, besoinDate);
          return { departement: d.code, nom: d.nom, ...metrics };
        })
      );

      rows.sort((a, b) => {
        if (b.besoin !== a.besoin) return b.besoin - a.besoin;
        return a.departement.localeCompare(b.departement);
      });

      setBesoinRows(rows);
    } catch (error) {
      console.error('Erreur lors de la génération des besoins:', error);
      setBesoinRows([]);
    } finally {
      setIsGeneratingBesoin(false);
    }
  };

  return (
    <div className="planning">
      <div className="planning-header">
        <h1><FaCalendarAlt /> Planning Département (Lecture seule)</h1>
        <div className="planning-controls" style={{ marginBottom: '12px' }}>
          <div className="departement-selector">
            <label>Date:</label>
            <input
              type="date"
              value={besoinDate}
              onChange={(e) => setBesoinDate(e.target.value)}
            />
          </div>
          <div className="departement-selector">
            <label>Département:</label>
            <select value={besoinDep} onChange={(e) => setBesoinDep(e.target.value)} disabled={isLoadingDepartements}>
              <option value="all">Tous les départements</option>
              {(departementsData || []).map((d) => {
                const code = d.code || d.departement_code || '';
                const nom = d.nom || d.departement_nom_uppercase || d.departement_nom || '';
                return (
                  <option key={`besoin-${code}`} value={code}>
                    {code} - {nom}
                  </option>
                );
              })}
            </select>
          </div>
          <button
            type="button"
            className="nav-btn"
            onClick={handleGenerateBesoin}
            disabled={isGeneratingBesoin || !besoinDate}
          >
            {isGeneratingBesoin ? 'Génération...' : 'Générer besoin'}
          </button>
        </div>
        <div className="planning-controls">
          <div className="departement-selector">
            <label>Département:</label>
            <select value={dep} onChange={handleDepChange} disabled={isLoadingDepartements}>
              <option value="">Sélectionner un département</option>
              {(departementsData || []).map(d => {
                const code = d.code || d.departement_code || '';
                const nom = d.nom || d.departement_nom_uppercase || d.departement_nom || '';
                return (
                  <option key={code} value={code}>
                    {code} - {nom}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="week-navigation">
            <button onClick={handlePrevWeek} className="nav-btn">
              <FaChevronLeft />
            </button>
            <span className="week-info">
              Semaine {week} - {weekStart && format(new Date(weekStart), 'dd/MM/yyyy', { locale: fr })} au {weekEnd && format(new Date(weekEnd), 'dd/MM/yyyy', { locale: fr })}
            </span>
            <button onClick={handleNextWeek} className="nav-btn">
              <FaChevronRight />
            </button>
          </div>
        </div>
      </div>

      {besoinRows.length > 0 && (
        <div className="planning-table-container" style={{ marginBottom: '16px' }}>
          <table className="planning-table">
            <thead>
              <tr>
                <th>Département</th>
                <th>Date</th>
                <th>Disponibilité</th>
                <th>RDV pris</th>
                <th>Besoin</th>
              </tr>
            </thead>
            <tbody>
              {besoinRows.map((row) => (
                <tr key={`row-besoin-${row.departement}`}>
                  <td>{row.departement}{row.nom ? ` - ${row.nom}` : ''}</td>
                  <td>{besoinDate}</td>
                  <td>{row.disponibilite}</td>
                  <td>{row.rdvPris}</td>
                  <td>{row.besoin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isLoadingPlanning ? (
        <div className="loading">Chargement du planning...</div>
      ) : (
        <PlanningView
          planning={planning}
          days={days}
          timeSlots={TIME_SLOTS}
          getAvailabilityColor={getAvailabilityColor}
        />
      )}
    </div>
  );
};

// Composant pour la vue Planning (avec rendez-vous) - Lecture seule
const PlanningView = ({ planning, days, timeSlots, getAvailabilityColor }) => {
  return (
    <div className="planning-view">
      <div className="planning-table-container">
        <table className="planning-table">
          <thead>
            <tr>
              <th>Heure</th>
              {days.map(day => (
                <th key={day.date}>
                  <div className="day-header-planning">
                    <span>{day.dayName} {day.date.split('-')[2]}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeSlots.map(slot => {
              // Calculer le timeKey directement à partir de l'heure pour éviter les problèmes de fuseau horaire
              const timeKey = hourToTimeKey(slot.hour);
              return (
                <tr key={slot.hour}>
                  <td className="time-slot-header">{slot.name}</td>
                  {days.map(day => {
                    // Essayer d'abord avec le timeKey comme nombre
                    let dayPlanning = planning[day.date]?.time?.[timeKey];
                    
                    // Si pas trouvé, essayer avec le timeKey comme string
                    if (!dayPlanning) {
                      dayPlanning = planning[day.date]?.time?.[String(timeKey)];
                    }
                    
                    // Si toujours pas trouvé, essayer de trouver la clé correspondante
                    if (!dayPlanning && planning[day.date]?.time) {
                      const availableKeys = Object.keys(planning[day.date].time);
                      const matchingKey = availableKeys.find(k => parseInt(k) === timeKey);
                      if (matchingKey) {
                        dayPlanning = planning[day.date].time[matchingKey];
                        console.log(`[PlanningDep] Clé trouvée par correspondance - Date: ${day.date}, TimeKey recherché: ${timeKey}, Clé trouvée: ${matchingKey}`);
                      }
                    }
                    
                    const rdvs = dayPlanning?.planning || [];
                    const availability = dayPlanning?.av;
                    
                    // Debug: afficher les informations de débogage pour chaque cellule
                    if (rdvs.length > 0) {
                      console.log(`[PlanningDep] RDV trouvés pour ${day.date} à ${slot.hour} (timeKey: ${timeKey}): ${rdvs.length}`, rdvs);
                    }
                    
                    // Debug spécifique pour identifier le problème
                    if (planning[day.date]?.time) {
                      const directAccess = planning[day.date].time[timeKey];
                      const stringAccess = planning[day.date].time[String(timeKey)];
                      const allKeys = Object.keys(planning[day.date].time);
                      const matchingKey = allKeys.find(k => parseInt(k) === timeKey);
                      
                      if (rdvs.length === 0 && (directAccess || stringAccess || matchingKey)) {
                        console.log(`[PlanningDep] DEBUG cellule spécifique:`, {
                          date: day.date,
                          slot: slot.hour,
                          timeKey: timeKey,
                          timeKeyType: typeof timeKey,
                          directAccess: directAccess,
                          stringAccess: stringAccess,
                          matchingKey: matchingKey,
                          matchingKeyData: matchingKey ? planning[day.date].time[matchingKey] : null,
                          allKeys: allKeys,
                          dayPlanning: dayPlanning
                        });
                        
                        // Vérifier si les RDV existent dans le planning mais ne sont pas accessibles
                        if (matchingKey && planning[day.date].time[matchingKey]?.planning?.length > 0) {
                          console.log(`[PlanningDep] PROBLÈME: RDV devrait être présent mais rdvs.length = ${rdvs.length}`, {
                            matchingKeyData: planning[day.date].time[matchingKey],
                            dayPlanning: dayPlanning
                          });
                        }
                      }
                    }
                    
                    if (!dayPlanning && planning[day.date]) {
                      const availableKeys = Object.keys(planning[day.date].time || {});
                      console.log(`[PlanningDep] Pas de dayPlanning pour TimeKey ${timeKey} (type: ${typeof timeKey}) - Date: ${day.date}, Clés disponibles:`, availableKeys.map(k => ({ key: k, type: typeof k, parsed: parseInt(k) })));
                    }
                    const hasPlanning = availability !== null && availability !== undefined;
                    const isBlocked = availability === 0;
                    const bgColor = hasPlanning && availability > 0 ? getAvailabilityColor(rdvs.length, availability) : '#cccccc';
                    
                    return (
                      <td
                        key={`${day.date}-${slot.hour}`}
                        className={`planning-cell ${isBlocked ? 'blocked' : ''} ${hasPlanning ? 'has-planning' : ''}`}
                        style={{ 
                          backgroundColor: isBlocked ? 'rgba(34, 45, 50, 0.8)' : 'transparent',
                          position: 'relative'
                        }}
                      >
                        {/* Badge de disponibilité */}
                        {hasPlanning && (
                          <div className="availability-badge" style={{ backgroundColor: bgColor }}>
                            <div
                              className="availability-link"
                              title={`${rdvs.length} rendez-vous sur ${availability} disponibles`}
                            >
                              <span className="availability-count">{rdvs.length}</span>
                              <span className="availability-separator">/</span>
                              <span className="availability-total">{availability}</span>
                            </div>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PlanningDep;

