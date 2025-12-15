import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaChevronLeft, FaChevronRight, FaCalendarAlt } from 'react-icons/fa';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import FicheDetailLink from '../components/FicheDetailLink';
import './Planning.css';

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
          return resManagement.data.data.map(d => ({
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
            return resManagement.data.data.map(d => ({
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
  for (let i = 0; i < 5; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
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

  // Récupérer les utilisateurs pour les couleurs
  const { data: usersData } = useQuery('users', async () => {
    const res = await api.get('/management/utilisateurs');
    return res.data.data || [];
  });

  // Récupérer les états pour obtenir la couleur CONFIRMER
  const { data: etatsData } = useQuery('etats', async () => {
    const res = await api.get('/management/etats');
    return res.data.data || [];
  });

  const getUserColor = (userId) => {
    if (!userId || !usersData) return '#cccccc';
    const user = usersData.find(u => u.id === userId);
    return user?.color || '#cccccc';
  };

  const getUserName = (userId) => {
    if (!userId || !usersData) return '';
    const user = usersData.find(u => u.id === userId);
    return user?.pseudo || '';
  };

  // Obtenir la couleur de l'état CONFIRMER (état 7)
  const getConfirmerColor = () => {
    if (!etatsData) return '#4caf50'; // Vert par défaut
    const confirmerEtat = etatsData.find(e => e.id === 7);
    return confirmerEtat?.color || '#4caf50';
  };

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

  return (
    <div className="planning">
      <div className="planning-header">
        <h1><FaCalendarAlt /> Planning Département (Lecture seule)</h1>
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

      {isLoadingPlanning ? (
        <div className="loading">Chargement du planning...</div>
      ) : (
        <PlanningView
          planning={planning}
          days={days}
          timeSlots={TIME_SLOTS}
          getUserColor={getUserColor}
          getUserName={getUserName}
          getAvailabilityColor={getAvailabilityColor}
          dep={dep}
          weekStart={weekStart}
          weekEnd={weekEnd}
        />
      )}
    </div>
  );
};

// Composant pour la vue Planning (avec rendez-vous) - Lecture seule
const PlanningView = ({ planning, days, timeSlots, getUserColor, getUserName, getAvailabilityColor, dep, weekStart, weekEnd }) => {
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
              // Capturer isAdmin dans la portée de cette fonction map
              const userIsAdmin = isAdmin;
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
                            <Link
                              to={`/fiches?cp=${dep}&id_etat_final=7&date_champ=date_rdv_time&date_debut=${day.date} ${slot.start}&date_fin=${day.date} ${slot.end}&fiche_search=true`}
                              target="_blank"
                              className="availability-link"
                              title={`${rdvs.length} rendez-vous sur ${availability} disponibles`}
                            >
                              <span className="availability-count">{rdvs.length}</span>
                              <span className="availability-separator">/</span>
                              <span className="availability-total">{availability}</span>
                            </Link>
                          </div>
                        )}
                        
                        
                        {/* Liste des rendez-vous */}
                        <div className="rdvs-list">
                          {rdvs.map((rdv, idx) => {
                            const isUrgent = rdv.qualification === 'RDV_URGENT';
                            const isConfirme = rdv.id_etat_final === 7;
                            const confirmerColor = getConfirmerColor();
                            return (
                            <div
                              key={`${rdv.id}-${idx}`}
                              className={`rdv-item ${isUrgent ? 'rdv-urgent-item' : ''} ${isConfirme ? 'rdv-confirme' : ''}`}
                              style={{ 
                                borderLeftColor: getUserColor(rdv.id_commercial),
                                backgroundColor: isConfirme ? `${confirmerColor}20` : 'white'
                              }}
                            >
                              <div className="rdv-header">
                                <span className="rdv-time">{rdv.rdv?.substring(0, 5)}</span>
                                {rdv.etat_check && userIsAdmin && (
                                  <span className={`etat-badge ${rdv.etat_check.toLowerCase()}`}>
                                    {rdv.etat_check}
                                  </span>
                                )}
                              </div>
                              <div className="rdv-content">
                                <FicheDetailLink 
                                  ficheId={rdv.id}
                                  className={`rdv-link ${rdv.qualification === 'RDV_URGENT' ? 'rdv-urgent' : ''}`}
                                >
                                  {rdv.operation} - {rdv.cp}
                                </FicheDetailLink>
                                {rdv.id_commercial > 0 && (
                                  <div className="rdv-commercial" style={{ color: getUserColor(rdv.id_commercial) }}>
                                    {getUserName(rdv.id_commercial)}
                                  </div>
                                )}
                              </div>
                              {rdv.dec_statut && (
                                <div className="rdv-decalage">{rdv.dec_statut}</div>
                              )}
                            </div>
                          );
                          })}
                        </div>
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

