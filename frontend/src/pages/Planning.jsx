import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaChevronLeft, FaChevronRight, FaPlus, FaCheck, FaTimes, FaCalendarAlt, FaLock } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import FicheDetailLink from '../components/FicheDetailLink';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
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

const Planning = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  
  // Vérifier si l'utilisateur est admin (fonction 1, 2, 7, ou 11)
  const isAdmin = user?.fonction === 1 || user?.fonction === 2 || user?.fonction === 7 || user?.fonction === 11;
  
  const currentDate = new Date();
  const currentWeek = getWeekNumber(currentDate);
  const currentYear = currentDate.getFullYear();

  const [week, setWeek] = useState(parseInt(searchParams.get('w')) || currentWeek);
  const [year, setYear] = useState(parseInt(searchParams.get('y')) || currentYear);
  const [dep, setDep] = useState(searchParams.get('dp') || '');
  const [viewMode, setViewMode] = useState(searchParams.get('mode') || 'planning'); // 'planning' ou 'availability'
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [editingAvailability, setEditingAvailability] = useState(null);

  // Récupérer les départements depuis la table departements
  const { data: departementsData, isLoading: isLoadingDepartements } = useQuery(
    'planning-departements', 
    async () => {
      try {
        // Utiliser la route planning/departements qui correspond exactement à la requête PHP
        const res = await api.get('/planning/departements');
        console.log('Réponse départements:', res.data);
        
        // Vérifier la structure de la réponse
        if (res.data && res.data.success && res.data.data) {
          const deps = res.data.data;
          console.log('Départements formatés:', deps);
          return deps;
        }
        
        // Fallback : essayer la route management si la route planning ne fonctionne pas
        const resManagement = await api.get('/management/departements');
        if (resManagement.data && resManagement.data.success && resManagement.data.data) {
          // Transformer les données pour correspondre au format attendu
          return resManagement.data.data.map(d => ({
            code: d.departement_code,
            nom: d.departement_nom_uppercase || d.departement_nom
          }));
        }
        
        return [];
      } catch (error) {
        console.error('Erreur lors du chargement des départements:', error);
        // Essayer la route management en cas d'erreur
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
    }, 
    {
      staleTime: 5 * 60 * 1000, // Cache 5 minutes
      retry: 2,
      onError: (error) => {
        console.error('Erreur query départements:', error);
        toast.error('Erreur lors du chargement des départements');
      }
    }
  );

  // Récupérer les utilisateurs pour les couleurs
  const { data: usersData } = useQuery('users', async () => {
    const res = await api.get('/management/utilisateurs');
    return res.data.data;
  });

  // Récupérer les états pour obtenir la couleur CONFIRMER
  const { data: etatsData } = useQuery('etats', async () => {
    const res = await api.get('/management/etats');
    return res.data.data || [];
  });

  // Récupérer le planning
  const { data: planningData, isLoading, refetch } = useQuery(
    ['planning-week', week, year, dep],
    async () => {
      const res = await api.get('/planning/week', { params: { w: week, y: year, dp: dep || '01' } });
      return res.data;
    },
    { 
      keepPreviousData: true,
      enabled: !!week && !!year // Le département peut être vide, on utilisera '01' par défaut
    }
  );

  // Récupérer la disponibilité
  const { data: availabilityData, refetch: refetchAvailability, isLoading: isLoadingAvailability } = useQuery(
    ['planning-availability', week, year, dep],
    async () => {
      const res = await api.get('/planning/availability', { params: { w: week, y: year, dp: dep || '01' } });
      console.log('Réponse disponibilité complète:', res.data);
      console.log('Données de disponibilité:', res.data?.data);
      return res.data;
    },
    { 
      keepPreviousData: true, 
      enabled: viewMode === 'availability' && !!week && !!year
    }
  );

  // Récupérer aussi le planning pour l'onglet disponibilité (pour compter les RDV)
  const { data: planningDataForAvailability } = useQuery(
    ['planning-week-for-availability', week, year, dep],
    async () => {
      const res = await api.get('/planning/week', { params: { w: week, y: year, dp: dep || '01' } });
      return res.data;
    },
    { 
      keepPreviousData: true, 
      enabled: viewMode === 'availability' && !!week && !!year
    }
  );

  // Mutation pour créer un planning
  const createMutation = useMutation(
    async (data) => {
      const res = await api.post('/planning/create', data);
      return res.data;
    },
    {
      onSuccess: () => {
        // Invalider toutes les queries de planning (toutes les variantes)
        queryClient.invalidateQueries(['planning-week']);
        queryClient.invalidateQueries(['planning-availability']);
        queryClient.invalidateQueries(['planning-modal']);
        queryClient.invalidateQueries(['availability-modal']);
        setShowCreateModal(false);
        toast.success('Planning créé avec succès');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de la création du planning');
      }
    }
  );

  // Mutation pour modifier la disponibilité
  const updateAvailabilityMutation = useMutation(
    async ({ week, year, dep, date, hour, value, type }) => {
      const res = await api.put('/planning/availability', { week, year, dep, date, hour, value, type });
      return res.data;
    },
    {
      onSuccess: () => {
        // Invalider toutes les queries de planning (toutes les variantes)
        queryClient.invalidateQueries(['planning-week']);
        queryClient.invalidateQueries(['planning-availability']);
        queryClient.invalidateQueries(['planning-modal']);
        queryClient.invalidateQueries(['availability-modal']);
        refetch();
        if (viewMode === 'availability') {
          refetchAvailability();
        }
        toast.success('Disponibilité mise à jour avec succès');
      },
      onError: (error) => {
        console.error('Erreur modification disponibilité:', error);
        toast.error(error.response?.data?.message || 'Erreur lors de la modification');
      }
    }
  );

  // Mutation pour fermer/ouvrir un créneau (uniquement administrateurs)
  const toggleClosedMutation = useMutation(
    async ({ week, year, dep, date, hour }) => {
      const res = await api.put('/planning/availability/toggle-closed', { week, year, dep, date, hour });
      return res.data;
    },
    {
      onSuccess: (data) => {
        // Invalider toutes les queries de planning
        queryClient.invalidateQueries(['planning-week']);
        queryClient.invalidateQueries(['planning-availability']);
        queryClient.invalidateQueries(['planning-modal']);
        queryClient.invalidateQueries(['availability-modal']);
        refetch();
        if (viewMode === 'availability') {
          refetchAvailability();
        }
        toast.success(data.data?.message || 'Créneau mis à jour avec succès');
      },
      onError: (error) => {
        console.error('Erreur fermeture/ouverture créneau:', error);
        toast.error(error.response?.data?.message || 'Erreur lors de la fermeture/ouverture du créneau');
      }
    }
  );

  // Mutation pour dupliquer un planning
  const duplicateMutation = useMutation(
    async ({ departments, sourceWeek, sourceYear, targetWeek, targetYear }) => {
      const results = [];
      const errors = [];
      
      // Dupliquer pour chaque département sélectionné
      for (const dep of departments) {
        try {
          const res = await api.post('/planning/duplicate', {
            sourceWeek,
            sourceYear,
            targetWeek,
            targetYear,
            dep
          });
          results.push({ dep, success: true, data: res.data });
        } catch (error) {
          errors.push({ 
            dep, 
            error: error.response?.data?.message || 'Erreur lors de la duplication' 
          });
        }
      }
      
      return { results, errors };
    },
    {
      onSuccess: (data) => {
        // Invalider toutes les queries de planning (toutes les variantes)
        queryClient.invalidateQueries(['planning-week']);
        queryClient.invalidateQueries(['planning-availability']);
        queryClient.invalidateQueries(['planning-modal']);
        queryClient.invalidateQueries(['availability-modal']);
        setShowDuplicateModal(false);
        
        const { results, errors } = data;
        const successCount = results.length;
        const errorCount = errors.length;
        
        if (errorCount === 0) {
          toast.success(`${successCount} planning${successCount > 1 ? 's' : ''} dupliqué${successCount > 1 ? 's' : ''} avec succès`);
        } else {
          toast.warning(`${successCount} planning${successCount > 1 ? 's' : ''} dupliqué${successCount > 1 ? 's' : ''}, ${errorCount} erreur${errorCount > 1 ? 's' : ''}`);
          errors.forEach(err => {
            toast.error(`Département ${err.dep}: ${err.error}`);
          });
        }
      },
      onError: (error) => {
        toast.error(error.message || 'Erreur lors de la duplication');
      }
    }
  );

  useEffect(() => {
    const newParams = new URLSearchParams();
    newParams.set('w', week.toString());
    newParams.set('y', year.toString());
    newParams.set('dp', dep);
    if (viewMode !== 'planning') {
      newParams.set('mode', viewMode);
    }
    setSearchParams(newParams, { replace: true });
  }, [week, year, dep, viewMode, setSearchParams]);

  // Recharger les données quand le département change
  useEffect(() => {
    if (dep && week && year) {
      // Invalider toutes les queries de planning pour forcer le rechargement
      queryClient.invalidateQueries(['planning-week']);
      queryClient.invalidateQueries(['planning-availability']);
      queryClient.invalidateQueries(['planning-modal']);
      queryClient.invalidateQueries(['availability-modal']);
    }
  }, [dep, week, year, queryClient]);

  const handlePrevWeek = () => {
    let newWeek = week - 1;
    let newYear = year;
    if (newWeek < 1) {
      newYear = year - 1;
      newWeek = getLastWeekNumber(newYear);
    }
    setWeek(newWeek);
    setYear(newYear);
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
  };

  const handleCreatePlanning = (formData) => {
    createMutation.mutate({
      week,
      year,
      dep,
      ...formData
    });
  };

  const handleUpdateAvailability = (date, hour, value, type = 'hour') => {
    // S'assurer que l'heure est au bon format (HH:MM:SS)
    let hourFormatted = hour;
    if (!hour.includes(':')) {
      // Convertir "09-00-00" en "09:00:00"
      hourFormatted = hour.replace(/-/g, ':');
    }
    // S'assurer qu'on a le format complet HH:MM:SS
    if (hourFormatted.split(':').length === 2) {
      hourFormatted = hourFormatted + ':00';
    }
    
    const numValue = parseInt(value) || 0;
    
    updateAvailabilityMutation.mutate({
      week,
      year,
      dep,
      date,
      hour: hourFormatted,
      value: numValue,
      type
    });
  };

  const handleDuplicatePlanning = (targetWeek, targetYear, departments) => {
    duplicateMutation.mutate({
      departments,
      sourceWeek: week,
      sourceYear: year,
      targetWeek,
      targetYear
    });
  };

  const planning = planningData?.data || {};
  const availability = availabilityData?.data || {};
  const weekStart = planningData?.weekStart;
  const weekEnd = planningData?.weekEnd;
  
  // Debug: afficher la structure des disponibilités
  if (viewMode === 'availability' && availabilityData) {
    console.log('Disponibilités pour affichage:', availability);
    console.log('Première date disponible:', Object.keys(availability)[0]);
    if (Object.keys(availability).length > 0) {
      const firstDate = Object.keys(availability)[0];
      console.log('Créneaux pour', firstDate, ':', availability[firstDate]);
    }
  }

  // Obtenir les jours de la semaine
  const days = [];
  if (weekStart) {
    const startDate = new Date(weekStart + 'T00:00:00');
    const daysFr = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
    for (let i = 0; i < 5; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push({
        date: date.toISOString().split('T')[0],
        dayName: daysFr[i]
      });
    }
  } else {
    // Si pas de données, générer les jours à partir de la semaine actuelle
    const monday = getMondayOfWeek(year, week);
    const daysFr = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
    for (let i = 0; i < 5; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      days.push({
        date: date.toISOString().split('T')[0],
        dayName: daysFr[i]
      });
    }
  }

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

  const getAvailabilityColor = (planningCount, availability) => {
    if (availability === 0) return '#cccccc';
    if (planningCount >= availability && planningCount > 0) return '#f44336'; // Rouge
    if (planningCount < availability && planningCount > 0) return '#f7a219'; // Orange
    return '#8BC34A'; // Vert
  };

  // Obtenir la couleur de l'état CONFIRMER (état 7)
  const getConfirmerColor = () => {
    if (!etatsData) return '#4caf50'; // Vert par défaut
    const confirmerEtat = etatsData.find(e => e.id === 7);
    return confirmerEtat?.color || '#4caf50';
  };

  if (isLoading && !planningData) {
    return (
      <div className="planning-loading">
        <div className="spinner"></div>
        <p>Chargement du planning...</p>
      </div>
    );
  }

  return (
    <div className="planning-page">
      <div className="planning-header">
        <h1><FaCalendarAlt /> Planning</h1>
        <div className="planning-controls">
          <select 
            value={dep} 
            onChange={(e) => {
              const newDep = e.target.value;
              setDep(newDep);
              // Forcer le rechargement immédiat quand le département change - invalider toutes les variantes
              queryClient.invalidateQueries(['planning-week']);
              queryClient.invalidateQueries(['planning-availability']);
              queryClient.invalidateQueries(['planning-modal']);
              queryClient.invalidateQueries(['availability-modal']);
            }} 
            className="dep-select"
            disabled={isLoadingDepartements}
          >
            <option value="">Sélectionner un département</option>
            {isLoadingDepartements ? (
              <option disabled>Chargement des départements...</option>
            ) : departementsData && departementsData.length > 0 ? (
              departementsData.map(d => {
                const code = d.code || d.departement_code || '';
                const nom = d.nom || d.departement_nom_uppercase || d.departement_nom || '';
                return (
                  <option key={code} value={code}>
                    {code} - {nom}
                  </option>
                );
              })
            ) : (
              <option disabled>Aucun département disponible</option>
            )}
          </select>
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
          <div className="view-mode-toggle">
            <button
              className={viewMode === 'planning' ? 'active' : ''}
              onClick={() => setViewMode('planning')}
            >
              Planning
            </button>
            <button
              className={viewMode === 'availability' ? 'active' : ''}
              onClick={() => setViewMode('availability')}
            >
              Disponibilité
            </button>
          </div>
          {(user?.fonction === 1 || user?.fonction === 2 || user?.fonction === 7) && (
            <>
              <button className="btn-create" onClick={() => setShowCreateModal(true)}>
                <FaPlus /> Créer
              </button>
              <button className="btn-duplicate" onClick={() => setShowDuplicateModal(true)}>
                Dupliquer
              </button>
            </>
          )}
        </div>
      </div>

      {viewMode === 'planning' ? (
        <PlanningView
          planning={planning}
          days={days}
          timeSlots={TIME_SLOTS}
          getUserColor={getUserColor}
          getUserName={getUserName}
          getAvailabilityColor={getAvailabilityColor}
          getConfirmerColor={getConfirmerColor}
          dep={dep}
          weekStart={weekStart}
          weekEnd={weekEnd}
          availability={availability}
          isAdmin={isAdmin}
        />
      ) : (
        <AvailabilityView
          availability={availability}
          planning={planningDataForAvailability?.data || planning}
          days={days}
          timeSlots={TIME_SLOTS}
          week={week}
          year={year}
          dep={dep}
          onUpdate={handleUpdateAvailability}
          canEdit={user?.fonction === 1 || user?.fonction === 2 || user?.fonction === 7}
          onToggleClosed={(date, hour) => {
            toggleClosedMutation.mutate({ week, year, dep, date, hour });
          }}
          isAdmin={user?.fonction === 1}
        />
      )}

      {/* Modal de création de planning */}
      {showCreateModal && (
        <CreatePlanningModal
          week={week}
          year={year}
          dep={dep}
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreatePlanning}
          isLoading={createMutation.isLoading}
        />
      )}

      {/* Modal de duplication */}
      {showDuplicateModal && (
        <DuplicatePlanningModal
          currentWeek={week}
          currentYear={year}
          currentDep={dep}
          departements={departementsData || []}
          onClose={() => setShowDuplicateModal(false)}
          onDuplicate={handleDuplicatePlanning}
          isLoading={duplicateMutation.isLoading}
        />
      )}
    </div>
  );
};

// Composant pour la vue Planning (avec rendez-vous)
const PlanningView = ({ planning, days, timeSlots, getUserColor, getUserName, getAvailabilityColor, getConfirmerColor, dep, weekStart, weekEnd, availability, isAdmin }) => {

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
                    const dayPlanning = planning[day.date]?.time?.[timeKey];
                    const rdvs = dayPlanning?.planning || [];
                    const availabilityValue = dayPlanning?.av;
                    // availability peut être null (pas de planning créé), 0 (bloqué), ou > 0 (disponible)
                    const hasPlanning = availabilityValue !== null && availabilityValue !== undefined;
                    const isBlocked = availabilityValue === 0;
                    // Vérifier si le créneau est fermé
                    const availData = availability?.[day.date]?.[slot.hour];
                    const isClosed = availData?.is_closed === 1;
                    const bgColor = hasPlanning && availabilityValue > 0 ? getAvailabilityColor(rdvs.length, availabilityValue) : '#cccccc';
                    
                    return (
                      <td
                        key={`${day.date}-${slot.hour}`}
                        className={`planning-cell ${isBlocked ? 'blocked' : ''} ${hasPlanning ? 'has-planning' : ''} ${isClosed ? 'closed-slot' : ''}`}
                        style={{ 
                          backgroundColor: isClosed ? 'rgba(255, 0, 0, 0.3)' : (isBlocked ? 'rgba(34, 45, 50, 0.8)' : 'transparent'),
                          position: 'relative'
                        }}
                      >
                        {/* Indicateur de créneau fermé */}
                        {isClosed && (
                          <div className="closed-slot-overlay">
                            <span className="closed-label">FERMÉ</span>
                          </div>
                        )}
                        
                        {/* Badge de disponibilité - toujours affiché si planning créé */}
                        {hasPlanning && !isClosed && (
                          <div className="availability-badge" style={{ backgroundColor: bgColor }}>
                            <Link
                              to={`/fiches?cp=${dep}&id_etat_final=7&date_champ=date_rdv_time&date_debut=${day.date} ${slot.start}&date_fin=${day.date} ${slot.end}&fiche_search=true`}
                              target="_blank"
                              className="availability-link"
                              title={`${rdvs.length} rendez-vous sur ${availabilityValue} disponibles`}
                            >
                              <span className="availability-count">{rdvs.length}</span>
                              <span className="availability-separator">/</span>
                              <span className="availability-total">{availabilityValue}</span>
                            </Link>
                          </div>
                        )}
                        
                        
                        {/* Liste des rendez-vous */}
                        <div className="rdvs-list">
                          {rdvs.map((rdv, idx) => {
                            const isUrgent = rdv.qualification === 'RDV_URGENT';
                            const isConfirme = rdv.id_etat_final === 7;
                            // Obtenir la couleur de l'état CONFIRMER
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

// Composant pour la vue Disponibilité
const AvailabilityView = ({ availability, planning, days, timeSlots, week, year, dep, onUpdate, canEdit, onToggleClosed, isAdmin }) => {
  // Fonction pour déterminer la couleur de fond du badge "nbr rdv / total" dans l'onglet disponibilité
  const getAvailabilityBadgeColor = (rdvCount, totalAvailability) => {
    if (totalAvailability === null || totalAvailability === undefined || totalAvailability === 0) {
      return '#cccccc'; // Gris par défaut si pas de disponibilité
    }
    if (rdvCount > totalAvailability) {
      return '#f44336'; // Rouge : dépassé
    }
    if (rdvCount === totalAvailability && rdvCount > 0) {
      return '#4CAF50'; // Vert : blindé/complètement rempli
    }
    if (rdvCount > 0 && rdvCount < totalAvailability) {
      return '#ffc107'; // Jaune : partiellement rempli
    }
    return '#cccccc'; // Gris : aucun RDV
  };
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  
  // Debug: afficher la structure des disponibilités reçues
  console.log('AvailabilityView - availability reçu:', availability);
  console.log('AvailabilityView - planning reçu:', planning);
  console.log('AvailabilityView - jours:', days);
  console.log('AvailabilityView - créneaux:', timeSlots);
  if (availability && Object.keys(availability).length > 0) {
    const firstDate = Object.keys(availability)[0];
    console.log('AvailabilityView - première date:', firstDate, 'données:', availability[firstDate]);
  }

  const handleCellClick = (date, hour) => {
    if (!canEdit) return;
    // Vérifier si le créneau est fermé
    const availData = availability[date]?.[hour];
    const isClosed = availData?.is_closed === 1;
    if (isClosed) return; // Ne pas permettre l'édition si le créneau est fermé
    const currentValue = availData?.nbr_com ?? 0; // null devient 0 pour l'édition
    setEditingCell(`${date}-${hour}`);
    setEditValue(currentValue.toString());
  };

  const handleSave = (date, hour, type = 'hour') => {
    if (editValue === '' || editValue === null || editValue === undefined) {
      setEditingCell(null);
      setEditValue('');
      return;
    }
    const value = parseInt(editValue);
    if (isNaN(value) || value < 0) {
      return;
    }
    onUpdate(date, hour, value, type);
    setEditingCell(null);
    setEditValue('');
  };

  const handleDayTotal = (date) => {
    if (!canEdit) return;
    // Ne pas afficher le total existant, laisser le champ vide pour saisir une nouvelle valeur
    setEditingCell(`total-${date}`);
    setEditValue('');
  };

  const handleSaveDayTotal = (date) => {
    if (editValue === '') return;
    timeSlots.forEach(slot => {
      onUpdate(date, slot.hour, editValue, 'day');
    });
    setEditingCell(null);
    setEditValue('');
  };

  // Vérifier si tous les créneaux d'une journée sont fermés
  const isDayClosed = (date) => {
    return timeSlots.every(slot => {
      const availData = availability[date]?.[slot.hour];
      return availData?.is_closed === 1;
    });
  };

  // Toggle tous les créneaux d'une journée
  const handleToggleDayClosed = (date) => {
    if (!canEdit || !isAdmin) return;
    const allClosed = isDayClosed(date);
    // Toggle chaque créneau : si tous sont fermés, ouvrir tous, sinon fermer tous
    timeSlots.forEach(slot => {
      const availData = availability[date]?.[slot.hour];
      const isClosed = availData?.is_closed === 1;
      // Si tous sont fermés, on ouvre ceux qui sont fermés
      // Si pas tous fermés, on ferme ceux qui sont ouverts
      if (allClosed || !isClosed) {
        onToggleClosed(date, slot.hour);
      }
    });
  };

  return (
    <div className="availability-view">
      <div className="availability-table-container">
        <table className="availability-table">
          <thead>
            <tr>
              <th>Heure</th>
              {days.map(day => (
                <th key={day.date}>
                  <div className="day-header">
                    <span>{day.dayName} {day.date.split('-')[2]}</span>
                    {canEdit && (
                      <div className="day-total-controls">
                        {editingCell === `total-${day.date}` ? (
                          <>
                            <input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="total-input"
                              autoFocus
                            />
                            <button
                              className="save-btn"
                              onClick={() => handleSaveDayTotal(day.date)}
                            >
                              <FaCheck />
                            </button>
                            <button
                              className="cancel-btn"
                              onClick={() => setEditingCell(null)}
                            >
                              <FaTimes />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="total-btn"
                              onClick={() => handleDayTotal(day.date)}
                            >
                              Total
                            </button>
                            {isAdmin && (
                              <button
                                className="day-toggle-closed-btn"
                                onClick={() => handleToggleDayClosed(day.date)}
                                title={isDayClosed(day.date) ? "Débloquer tous les créneaux de la journée" : "Bloquer tous les créneaux de la journée"}
                              >
                                <FaLock style={{ color: isDayClosed(day.date) ? '#f44336' : '#666' }} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeSlots.map(slot => (
              <tr key={slot.hour}>
                <td className="time-slot-header" style={{ color: '#ffffff', backgroundColor: 'rgb(156, 191, 200)' }}>{slot.name}</td>
                  {days.map(day => {
                  const cellKey = `${day.date}-${slot.hour}`;
                  const isEditing = editingCell === cellKey;
                  // availability peut être null (pas de planning), 0 (bloqué), ou > 0 (disponible)
                  const availData = availability[day.date]?.[slot.hour];
                  const currentValue = availData?.nbr_com ?? null; // null si pas de planning créé
                  const isClosed = availData?.is_closed === 1; // Vérifier si le créneau est fermé
                  
                  // Récupérer le nombre de RDV pris pour ce créneau
                  // Calculer le timeKey directement à partir de l'heure pour éviter les problèmes de fuseau horaire
                  const timeKey = hourToTimeKey(slot.hour);
                  const dayPlanning = planning[day.date]?.time?.[timeKey];
                  const rdvCount = dayPlanning?.planning?.length || 0;
                  
                  // Badge rdv-count / availability-total (affiché en permanence sauf si fermé)
                  const renderRdvBadge = () => {
                    if (isClosed) return null;
                    if (currentValue === null) {
                      return rdvCount > 0 ? (
                        <span 
                          className="availability-rdv-info"
                          style={{ 
                            backgroundColor: getAvailabilityBadgeColor(rdvCount, currentValue), 
                            color: '#ffffff',
                            fontWeight: '700',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            display: 'inline-block',
                            position: 'absolute',
                            left: '2px',
                            top: '2px',
                            zIndex: 5
                          }}
                        >
                          <span className="rdv-count">{rdvCount}</span>
                          <span className="separator">/</span>
                          <span className="availability-total">-</span>
                        </span>
                      ) : null;
                    } else {
                      return (
                        <span 
                          className="availability-rdv-info"
                          style={{ 
                            backgroundColor: getAvailabilityBadgeColor(rdvCount, currentValue), 
                            color: '#ffffff',
                            fontWeight: '700',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            display: 'inline-block',
                            position: 'absolute',
                            left: '2px',
                            top: '2px',
                            zIndex: 5
                          }}
                        >
                          <span className="rdv-count">{rdvCount}</span>
                          <span className="separator">/</span>
                          <span className="availability-total">{currentValue}</span>
                        </span>
                      );
                    }
                  };
                  
                  return (
                    <td
                      key={cellKey}
                      className={`availability-cell ${isClosed ? 'closed-slot' : ''} ${canEdit ? 'editable' : ''}`}
                      onClick={(e) => {
                        // Ne pas déclencher le clic si on clique sur le bouton de fermeture ou sur les contrôles d'édition
                        if (e.target.closest('.toggle-closed-btn') || e.target.closest('.edit-controls') || e.target.closest('.availability-rdv-info')) {
                          return;
                        }
                        e.stopPropagation();
                        if (canEdit && !isClosed) {
                          handleCellClick(day.date, slot.hour);
                        }
                      }}
                    >
                      {/* Badge rdv-count / availability-total - toujours affiché */}
                      {renderRdvBadge()}
                      
                      {isEditing ? (
                        <div className="edit-controls" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="availability-input"
                            autoFocus
                            min="0"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSave(day.date, slot.hour);
                              } else if (e.key === 'Escape') {
                                setEditingCell(null);
                              }
                            }}
                          />
                          <button
                            className="save-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSave(day.date, slot.hour);
                            }}
                          >
                            <FaCheck />
                          </button>
                          <button
                            className="cancel-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCell(null);
                            }}
                          >
                            <FaTimes />
                          </button>
                        </div>
                      ) : (
                        <div className="availability-value">
                          {isClosed ? (
                            <div className="closed-slot-indicator">
                              <span className="closed-label">FERMÉ</span>
                              {isAdmin && (
                                <button
                                  className="toggle-closed-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleClosed(day.date, slot.hour);
                                  }}
                                  title="Ouvrir ce créneau"
                                >
                                  <FaLock />
                                </button>
                              )}
                            </div>
                          ) : (
                            <>
                              {currentValue === null && rdvCount === 0 ? (
                                <span>-</span>
                              ) : null}
                              {isAdmin && (
                                <button
                                  className="toggle-closed-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleClosed(day.date, slot.hour);
                                  }}
                                  title="Fermer ce créneau"
                                >
                                  <FaLock />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Modal de création de planning
const CreatePlanningModal = ({ week, year, dep, onClose, onSave, isLoading }) => {
  const [formData, setFormData] = useState({
    nbr_com: '',
    type: 'semaine'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.nbr_com || parseInt(formData.nbr_com) <= 0) {
      toast.error('Veuillez entrer un nombre de commerciaux valide');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Créer un planning</h2>
          <button className="modal-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="planning-form">
          <div className="form-group">
            <label>Nombre de commerciaux *</label>
            <input
              type="number"
              value={formData.nbr_com}
              onChange={(e) => setFormData({ ...formData, nbr_com: e.target.value })}
              min="1"
              required
            />
          </div>
          <div className="form-group">
            <label>Type de planning *</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              required
            >
              <option value="semaine">Semaine complète</option>
              <option value="lundi-jeudi">Lundi-Jeudi</option>
              <option value="lundi-mardi">Lundi-Mardi</option>
              <option value="mercredi-jeudi">Mercredi-Jeudi</option>
              <option value="vendredi">Vendredi uniquement</option>
            </select>
          </div>
          <div className="form-info">
            <p><strong>Semaine:</strong> {week}</p>
            <p><strong>Année:</strong> {year}</p>
            <p><strong>Département:</strong> {dep}</p>
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-cancel">
              Annuler
            </button>
            <button type="submit" className="btn-save" disabled={isLoading}>
              {isLoading ? 'Création...' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Modal de duplication
const DuplicatePlanningModal = ({ currentWeek, currentYear, currentDep, departements, onClose, onDuplicate, isLoading }) => {
  const [targetWeek, setTargetWeek] = useState('');
  const [targetYear, setTargetYear] = useState(currentYear);
  const [selectedDepartments, setSelectedDepartments] = useState(
    currentDep ? [currentDep] : []
  );
  const [selectAll, setSelectAll] = useState(false);

  // Initialiser la sélection quand la modal s'ouvre ou que currentDep change
  useEffect(() => {
    if (currentDep) {
      setSelectedDepartments([currentDep]);
      setSelectAll(false);
    } else {
      setSelectedDepartments([]);
      setSelectAll(false);
    }
  }, [currentDep]);

  // Synchroniser selectAll avec selectedDepartments
  useEffect(() => {
    const allCodes = departements.map(d => d.code || d.departement_code).filter(Boolean);
    if (selectedDepartments.length === allCodes.length && allCodes.length > 0) {
      setSelectAll(true);
    } else {
      setSelectAll(false);
    }
  }, [selectedDepartments, departements]);

  // Générer les options de semaines
  const weekOptions = [];
  for (let w = currentWeek; w <= 52; w++) {
    weekOptions.push(w);
  }

  // Gérer la sélection de tous les départements
  const handleSelectAll = (checked) => {
    setSelectAll(checked);
    if (checked) {
      const allCodes = departements.map(d => d.code || d.departement_code).filter(Boolean);
      setSelectedDepartments(allCodes);
    } else {
      setSelectedDepartments([]);
    }
  };

  // Gérer la sélection d'un département
  const handleDepartmentToggle = (depCode) => {
    if (selectedDepartments.includes(depCode)) {
      setSelectedDepartments(selectedDepartments.filter(d => d !== depCode));
      setSelectAll(false);
    } else {
      const newSelected = [...selectedDepartments, depCode];
      setSelectedDepartments(newSelected);
      // Si tous les départements valides sont sélectionnés, cocher "Tous"
      const allCodes = departements.map(d => d.code || d.departement_code).filter(Boolean);
      if (newSelected.length === allCodes.length && allCodes.length > 0) {
        setSelectAll(true);
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!targetWeek) {
      toast.error('Veuillez sélectionner une semaine cible');
      return;
    }
    if (selectedDepartments.length === 0) {
      toast.error('Veuillez sélectionner au moins un département');
      return;
    }
    onDuplicate(parseInt(targetWeek), parseInt(targetYear), selectedDepartments);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content duplicate-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Dupliquer le planning</h2>
          <button className="modal-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="planning-form">
          <div className="form-group">
            <label>Semaine source</label>
            <input type="text" value={`Semaine ${currentWeek} - ${currentYear}`} disabled />
          </div>
          <div className="form-group">
            <label>Année cible *</label>
            <input
              type="number"
              value={targetYear}
              onChange={(e) => setTargetYear(e.target.value)}
              min={currentYear}
              required
            />
          </div>
          <div className="form-group">
            <label>Semaine cible *</label>
            <select
              value={targetWeek}
              onChange={(e) => setTargetWeek(e.target.value)}
              required
            >
              <option value="">Sélectionner une semaine</option>
              {weekOptions.map(w => (
                <option key={w} value={w}>
                  Semaine {w}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Départements à dupliquer *</label>
            <div className="departments-selection">
              <div className="select-all-container">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                  <span>Tous les départements</span>
                </label>
              </div>
              <div className="departments-list">
                {departements.map(d => {
                  const code = d.code || d.departement_code || '';
                  const nom = d.nom || d.departement_nom_uppercase || d.departement_nom || '';
                  const isSelected = selectedDepartments.includes(code);
                  return (
                    <label key={code} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleDepartmentToggle(code)}
                      />
                      <span>{code} - {nom}</span>
                    </label>
                  );
                })}
              </div>
              {selectedDepartments.length > 0 && (
                <div className="selected-count">
                  {selectedDepartments.length} département{selectedDepartments.length > 1 ? 's' : ''} sélectionné{selectedDepartments.length > 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-cancel">
              Annuler
            </button>
            <button type="submit" className="btn-save" disabled={isLoading || selectedDepartments.length === 0}>
              {isLoading ? 'Duplication...' : `Dupliquer (${selectedDepartments.length})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Planning;
