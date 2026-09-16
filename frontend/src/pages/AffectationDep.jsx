import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaChevronLeft, FaChevronRight, FaCalendarAlt, FaUser, FaRoute } from 'react-icons/fa';
import { toast } from 'react-toastify';
import FicheDetailLink from '../components/FicheDetailLink';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import { ficheHasR2Placed } from '../utils/ficheR2Placed';
import './AffectationDep.css';

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
function hourToTimeKey(hour) {
  const [hours, minutes, seconds] = hour.split(':').map(Number);
  return hours * 3600 + minutes * 60 + (seconds || 0);
}

function formatRdvSlotTime(rdv) {
  const raw = rdv?.rdv;
  if (raw == null || raw === '') return '';
  const s = String(raw);
  const match = s.match(/(\d{1,2}):(\d{2})/);
  if (match) return `${match[1].padStart(2, '0')}:${match[2]}`;
  return s.substring(0, 5);
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
  { hour: '09:00:00', start: '09:00:00', end: '10:59:59', name: '9H', id: '09-00-00' },
  { hour: '11:00:00', start: '11:00:00', end: '12:59:59', name: '11H', id: '11-00-00' },
  { hour: '13:00:00', start: '13:00:00', end: '15:59:59', name: '13H', id: '13-00-00' },
  { hour: '16:00:00', start: '16:00:00', end: '17:59:59', name: '16H', id: '16-00-00' },
  { hour: '18:00:00', start: '18:00:00', end: '19:29:59', name: '18H', id: '18-00-00' },
  { hour: '19:30:00', start: '19:30:00', end: '20:00:00', name: '20H', id: '19-30-00' }
];

const AffectationDep = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Forcer le rendu desktop sur mobile (meme approche que Dashboard)
  useEffect(() => {
    const originalViewport = document.querySelector('meta[name="viewport"]');
    const originalContent = originalViewport?.getAttribute('content') || '';

    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.setAttribute('name', 'viewport');
      document.head.appendChild(viewport);
    }
    viewport.setAttribute('content', 'width=1400');

    document.body.classList.add('affectation-dep-page');
    document.documentElement.classList.add('affectation-dep-page');

    document.documentElement.style.minWidth = '1400px';
    document.documentElement.style.width = 'auto';
    document.documentElement.style.maxWidth = 'none';
    document.documentElement.style.overflowX = 'auto';
    document.body.style.minWidth = '1400px';
    document.body.style.width = 'auto';
    document.body.style.maxWidth = 'none';
    document.body.style.overflowX = 'auto';

    return () => {
      if (originalViewport && originalContent) {
        originalViewport.setAttribute('content', originalContent);
      } else if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1');
      }

      document.body.classList.remove('affectation-dep-page');
      document.documentElement.classList.remove('affectation-dep-page');

      document.documentElement.style.minWidth = '';
      document.documentElement.style.width = '';
      document.documentElement.style.maxWidth = '';
      document.documentElement.style.overflowX = '';
      document.body.style.minWidth = '';
      document.body.style.width = '';
      document.body.style.maxWidth = '';
      document.body.style.overflowX = '';
    };
  }, []);
  
  // Vérifier si l'utilisateur est admin (fonction 1, 2, 7, ou 11)
  const isAdmin = user?.fonction === 1 || user?.fonction === 2 || user?.fonction === 7 || user?.fonction === 11;
  
  const currentDate = new Date();
  const currentWeek = getWeekNumber(currentDate);
  const currentYear = currentDate.getFullYear();

  const [week, setWeek] = useState(parseInt(searchParams.get('w')) || currentWeek);
  const [year, setYear] = useState(parseInt(searchParams.get('y')) || currentYear);
  const [dep, setDep] = useState(searchParams.get('dp') || '');
  const [selectedRdvs, setSelectedRdvs] = useState(new Set());
  /** Affectations en attente : ficheId → id_commercial (appliquées au clic sur Appliquer) */
  const [pendingAssignments, setPendingAssignments] = useState({});
  const [isApplying, setIsApplying] = useState(false);
  /** Filtre liste RDV : n'afficher que ceux affectés à ce commercial (clic sans sélection). null = tous */
  const [filterCommercialId, setFilterCommercialId] = useState(null);
  const [distanceResults, setDistanceResults] = useState(null);
  const [showDistanceModal, setShowDistanceModal] = useState(false);
  
  // Bloquer le scroll du body quand le modal est ouvert
  useModalScrollLock(showDistanceModal);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);

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

  // Récupérer le planning
  const { data: planningData, isLoading: isLoadingPlanning, refetch: refetchPlanning } = useQuery(
    ['planning-week', week, year, dep, filterCommercialId],
    async () => {
      const params = { w: week, y: year, dp: dep || '01' };
      if (filterCommercialId != null) {
        params.ic = filterCommercialId;
      }
      const res = await api.get('/planning/week', { params });
      return res.data;
    },
    { 
      keepPreviousData: false,
      enabled: !!week && !!year && !!dep
    }
  );

  const planning = planningData?.data || {};

  // Récupérer les commerciaux
  const { data: commerciauxData } = useQuery('commerciaux', async () => {
    const res = await api.get('/management/utilisateurs');
    return (res.data.data || []).filter(u => u.fonction === 5 && u.etat > 0);
  });

  // Récupérer les utilisateurs pour les couleurs
  const { data: usersData } = useQuery('users', async () => {
    const res = await api.get('/management/utilisateurs');
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

  // Mutation pour affecter des RDV
  const affectMutation = useMutation(
    async ({ fichesIds, idCommercial }) => {
      const res = await api.post('/affectations/affecter', {
        fiches_ids: fichesIds,
        id_commercial: idCommercial
      });
      return res.data;
    }
  );

  // Mutation pour désaffecter un RDV
  const desaffectMutation = useMutation(
    async (ficheId) => {
      const res = await api.post('/affectations/desaffecter', {
        fiches_ids: [ficheId]
      });
      return res.data;
    },
    {
      onSuccess: () => {
        toast.success('Affectation annulée avec succès');
        refetchPlanning();
        queryClient.invalidateQueries(['planning-week']);
      },
      onError: (error) => {
        toast.error('Erreur lors de l\'annulation de l\'affectation: ' + (error.response?.data?.message || error.message));
      }
    }
  );

  // Gérer l'annulation de l'affectation d'un RDV
  const handleDesaffecter = (ficheId, e) => {
    e.stopPropagation();
    const key = Number(ficheId);
    if (pendingAssignments[key] != null) {
      setPendingAssignments((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }
    desaffectMutation.mutate(ficheId);
  };

  // Gérer la sélection/désélection d'un RDV
  const handleRdvToggle = (ficheId) => {
    const newSelected = new Set(selectedRdvs);
    if (newSelected.has(ficheId)) {
      newSelected.delete(ficheId);
    } else {
      newSelected.add(ficheId);
    }
    setSelectedRdvs(newSelected);
  };

  /** Clic commercial : avec RDV cochés → prévisualiser la couleur ; sinon → filtrer */
  const handleCommercialSidebarClick = (commercialId) => {
    if (selectedRdvs.size > 0) {
      if (!commercialId) {
        toast.error('Commercial invalide');
        return;
      }
      setPendingAssignments((prev) => {
        const next = { ...prev };
        selectedRdvs.forEach((ficheId) => {
          next[Number(ficheId)] = Number(commercialId);
        });
        return next;
      });
      setSelectedRdvs(new Set());
      return;
    }
    setFilterCommercialId((prev) => (prev === commercialId ? null : commercialId));
  };

  const handleApplyAssignments = async () => {
    const entries = Object.entries(pendingAssignments);
    if (entries.length === 0) {
      toast.warning('Aucune modification à appliquer');
      return;
    }
    const byCommercial = {};
    entries.forEach(([ficheId, commercialId]) => {
      const cid = Number(commercialId);
      if (!byCommercial[cid]) byCommercial[cid] = [];
      byCommercial[cid].push(Number(ficheId));
    });
    setIsApplying(true);
    try {
      let total = 0;
      for (const [commercialId, fichesIds] of Object.entries(byCommercial)) {
        const data = await affectMutation.mutateAsync({
          fichesIds,
          idCommercial: Number(commercialId),
        });
        total += Number(data?.success_count) || fichesIds.length;
      }
      toast.success(`${total} RDV(s) affecté(s) avec succès`);
      setPendingAssignments({});
      setSelectedRdvs(new Set());
      refetchPlanning();
      queryClient.invalidateQueries(['planning-week']);
    } catch (error) {
      toast.error('Erreur lors de l\'affectation: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsApplying(false);
    }
  };

  /** Filtre affichage : commercial principal (id_commercial) uniquement */
  const rdvMatchesCommercialFilter = (rdv) => {
    if (filterCommercialId == null) return true;
    const fid = Number(filterCommercialId);
    const pendingId = pendingAssignments[Number(rdv.id)];
    const c1 = pendingId != null
      ? Number(pendingId)
      : (rdv.id_commercial != null ? Number(rdv.id_commercial) : null);
    return c1 === fid;
  };

  // Calculer les distances entre les codes postaux des RDV sélectionnés
  const handleCalculateDistance = async () => {
    if (selectedRdvs.size < 2) {
      toast.warning('Veuillez sélectionner au moins 2 RDV pour calculer les distances');
      return;
    }

    setIsCalculatingDistance(true);
    try {
      // Récupérer les codes postaux des RDV sélectionnés
      const selectedRdvsArray = Array.from(selectedRdvs);
      const rdvsWithCp = [];
      
      // Parcourir tous les RDV du planning pour trouver ceux sélectionnés
      Object.keys(planning).forEach(date => {
        Object.keys(planning[date].time || {}).forEach(timeKey => {
          const slotRdvs = planning[date].time[timeKey].planning || [];
          slotRdvs.forEach(rdv => {
            if (selectedRdvsArray.includes(rdv.id) && rdv.cp) {
              rdvsWithCp.push({
                id: rdv.id,
                cp: String(rdv.cp).trim().replace(/\D/g, '').padStart(5, '0').substring(0, 5),
                ville: rdv.ville ? String(rdv.ville).trim() : null
              });
            }
          });
        });
      });

      if (rdvsWithCp.length < 2) {
        toast.warning('Au moins 2 RDV doivent avoir un code postal valide');
        setIsCalculatingDistance(false);
        return;
      }

      // Appeler l'endpoint backend pour calculer les distances
      const response = await api.post('/planning/calculate-distance', {
        adresses: rdvsWithCp.map(r => ({
          cp: r.cp,
          ville: r.ville || null
        }))
      });

      if (response.data && response.data.success) {
        setDistanceResults({
          rdvs: rdvsWithCp,
          distances: response.data.data.distances,
          totalDistance: response.data.data.total_distance
        });
        setShowDistanceModal(true);
      } else {
        toast.error('Erreur lors du calcul des distances et durées');
      }
    } catch (error) {
      console.error('Erreur lors du calcul des distances:', error);
      toast.error('Erreur lors du calcul des distances et durées: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsCalculatingDistance(false);
    }
  };

  // Fonction pour formater la durée en heures et minutes
  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes}min`;
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

  // Formater la plage de dates pour l'affichage
  const formatWeekRange = () => {
    if (days.length === 0) return '';
    const start = days[0];
    const end = days[days.length - 1];
    const formatDate = (dateStr) => {
      const [year, month, day] = dateStr.split('-');
      return `${day}-${month}-${year}`;
    };
    return `${formatDate(start.date)} Au ${formatDate(end.date)}`;
  };

  // Suivre le département (et la semaine) depuis l’URL : le menu DEP
  // reste sur /affectation-dep et ne remonte pas le composant.
  useEffect(() => {
    const urlDep = searchParams.get('dp') || '';
    const urlWeek = parseInt(searchParams.get('w'), 10);
    const urlYear = parseInt(searchParams.get('y'), 10);
    if (urlDep && urlDep !== dep) {
      setDep(urlDep);
    }
    if (Number.isFinite(urlWeek) && urlWeek > 0 && urlWeek !== week) {
      setWeek(urlWeek);
    }
    if (Number.isFinite(urlYear) && urlYear > 0 && urlYear !== year) {
      setYear(urlYear);
    }
  }, [searchParams]);

  // Initialiser le département si vide
  useEffect(() => {
    if (searchParams.get('dp')) return;
    if (!dep && departementsData && departementsData.length > 0) {
      const firstDep = departementsData[0].code || departementsData[0].departement_code;
      setDep(firstDep);
      updateSearchParams(week, year, firstDep);
    }
  }, [departementsData, dep]);

  // Réinitialiser la sélection et le filtre commercial quand on change de semaine/département
  useEffect(() => {
    setSelectedRdvs(new Set());
    setFilterCommercialId(null);
    setPendingAssignments({});
  }, [week, year, dep]);

  if (isLoadingPlanning || isLoadingDepartements) {
    return <div className="affectation-dep-loading">Chargement...</div>;
  }

  return (
    <div className="affectation-dep">
      {/* Header */}
      <div className="affectation-dep-header">
        <div className="header-left">
          <h1><FaCalendarAlt /> Affectation par Département - Semaine {week}:</h1>
        </div>
        <div className="header-right">
          <button className="nav-btn" onClick={handlePrevWeek} title="Semaine précédente">
            <FaChevronLeft />
          </button>
          <span className="week-dates">{formatWeekRange()}</span>
          <button className="nav-btn" onClick={handleNextWeek} title="Semaine suivante">
            <FaChevronRight />
          </button>
        </div>
      </div>

      {/* Contrôles */}
      <div className="affectation-dep-controls">
        <div className="dep-selector">
          <label>Département:</label>
          <select value={dep} onChange={handleDepChange} disabled={isLoadingDepartements}>
            <option value="">Sélectionner un département</option>
            {departementsData && departementsData.map(dept => (
              <option key={dept.code || dept.departement_code} value={dept.code || dept.departement_code}>
                {dept.nom || dept.departement_nom}
              </option>
            ))}
          </select>
        </div>
        {filterCommercialId != null && (
          <div className="filter-commercial-banner">
            <span>
              RDV de{' '}
              <strong>{getUserName(filterCommercialId) || `commercial #${filterCommercialId}`}</strong>
              {' '}
              — tous départements (semaine affichée). Disponibilités restent pour le département sélectionné.
            </span>
            <button
              type="button"
              className="btn-clear-commercial-filter"
              onClick={() => setFilterCommercialId(null)}
            >
              Tout afficher
            </button>
          </div>
        )}
        {selectedRdvs.size > 0 && (
          <>
            <div className="selected-count">
              {selectedRdvs.size} RDV sélectionné(s)
            </div>
            <button
              className="btn-calculate-distance"
              onClick={handleCalculateDistance}
              disabled={isCalculatingDistance || selectedRdvs.size < 2}
              title={selectedRdvs.size < 2 ? 'Sélectionnez au moins 2 RDV pour calculer les distances' : 'Calculer les distances entre les codes postaux'}
            >
              <FaRoute /> {isCalculatingDistance ? 'Calcul...' : 'Calculer distance'}
            </button>
          </>
        )}
      </div>

      <div className="affectation-dep-content">
        {/* Grille de planning */}
        <div className="planning-grid-container">
          <table className="planning-grid">
            <thead>
              <tr>
                <th>HEURE</th>
                {days.map(day => {
                  // Extraire le jour directement depuis la chaîne de date pour éviter les problèmes de fuseau horaire
                  const dayNum = day.date.split('-')[2];
                  const dayName = day.dayName.toUpperCase();
                  return (
                    <th key={day.date}>
                      {dayName}({dayNum})
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {TIME_SLOTS.map(slot => {
                const timeKey = hourToTimeKey(slot.hour);
                // Capturer isAdmin dans la portée de cette fonction map
                const userIsAdmin = isAdmin;
                return (
                  <tr key={slot.id}>
                    <td className="time-slot-header">{slot.name}</td>
                    {days.map(day => {
                      const dateData = planning[day.date];
                      const slotData = dateData?.time?.[timeKey];
                      const rdvs = slotData?.planning || [];
                      const rdvsFiltered =
                        filterCommercialId == null
                          ? rdvs
                          : rdvs.filter(rdvMatchesCommercialFilter);

                      return (
                        <td key={`${day.date}-${timeKey}`} className="planning-cell">
                          <div className="rdv-list">
                            {rdvsFiltered.map((rdv) => {
                              const pendingCommercialId = pendingAssignments[Number(rdv.id)];
                              const isPending = pendingCommercialId != null;
                              const commercialName = getUserName(rdv.id_commercial);
                              const pendingColor = isPending ? getUserColor(pendingCommercialId) : null;
                              const commercialColor = getUserColor(rdv.id_commercial);
                              const isSelected = selectedRdvs.has(rdv.id);
                              const isValide = rdv.valider === 1 || rdv.valider === true;
                              const isAssigned = Number(rdv.id_commercial) > 0;
                              const defaultColor = isValide ? '#00cc00' : '#9bb380';
                              const colorForPill = isPending ? pendingColor : commercialColor;
                              const hasCustomColor = Boolean(colorForPill && colorForPill !== '#cccccc' && (isPending || isAssigned));
                              const pillBackground = hasCustomColor ? colorForPill : defaultColor;
                              const cpLabel = rdv.cp && rdv.cp !== '0' && rdv.cp !== 0 ? String(rdv.cp) : '-';
                              const rdvTime = formatRdvSlotTime(rdv);
                              const showSeul = Boolean(
                                rdv.rdv_seul ||
                                rdv.rdv_valid_sans_couple ||
                                (rdv.etat_check && (String(rdv.etat_check).includes('SEUL') || String(rdv.etat_check).includes('RS'))) ||
                                (Array.isArray(rdv.etats_list) && (rdv.etats_list.includes('SEUL') || rdv.etats_list.includes('RS')))
                              );

                              return (
                                <div
                                  key={rdv.id}
                                  className={`rdv-item ${isSelected ? 'selected' : ''} ${isValide ? 'valide' : 'confirme'} ${isAssigned || isPending ? 'is-assigned' : ''}`}
                                >
                                  {(isAssigned || isPending) && (
                                    <button
                                      type="button"
                                      className="btn-desaffecter"
                                      onClick={(e) => handleDesaffecter(rdv.id, e)}
                                      title={isPending ? 'Annuler la pré-affectation' : 'Annuler l\'affectation'}
                                    >
                                      -
                                    </button>
                                  )}
                                  <div
                                    className="rdv-pill"
                                    style={{ backgroundColor: pillBackground }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => handleRdvToggle(rdv.id)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="rdv-checkbox"
                                    />
                                    <FicheDetailLink
                                      ficheHash={rdv.hash}
                                      ficheId={rdv.id}
                                      className="rdv-link"
                                      title={`RDV ${rdv.id} - CP: ${cpLabel} - ${commercialName || 'Non affecté'}`}
                                    >
                                      {cpLabel}
                                    </FicheDetailLink>
                                    {rdvTime ? <span className="rdv-time">{rdvTime}</span> : null}
                                  </div>
                                  {!isPending && isAssigned && commercialName ? (
                                    <span className="rdv-commercial-name">{commercialName}</span>
                                  ) : null}
                                  <div className="rdv-badges">
                                    {userIsAdmin && rdv.qualification === 'RDV_URGENT' && (
                                      <span className="badge urgent">RDV_URGENT</span>
                                    )}
                                    {userIsAdmin && (rdv.qualification === 'ANN' ||
                                      (rdv.etat_check && (rdv.etat_check.includes('AN') || rdv.etat_check === 'AN')) ||
                                      (rdv.etats_list && rdv.etats_list.includes('AN'))) && (
                                      <span className="badge ann">ANN</span>
                                    )}
                                    {userIsAdmin && ficheHasR2Placed(rdv) && (
                                      <span className="badge r2" title="R2 placé (commercial secondaire)">
                                        R2
                                      </span>
                                    )}
                                    {userIsAdmin && ((rdv.etat_check && (rdv.etat_check.includes('RF') || rdv.etat_check === 'RF')) ||
                                     (rdv.etats_list && rdv.etats_list.includes('RF'))) && (
                                      <span className="badge rf">REF</span>
                                    )}
                                    {showSeul && (
                                      <span className="badge seul">RDV SEUL</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                            {rdvsFiltered.length === 0 &&
                              rdvs.length > 0 &&
                              filterCommercialId != null && (
                              <div className="filter-slot-empty" title="Aucun RDV de ce commercial sur ce créneau">
                                —
                              </div>
                            )}
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

        {/* Sidebar avec liste des commerciaux */}
        <div className="commerciaux-sidebar">
          <div className="commerciaux-list">
            {commerciauxData && commerciauxData.map(commercial => (
              <button
                key={commercial.id}
                type="button"
                className={`commercial-button ${filterCommercialId === commercial.id ? 'commercial-button--filter-active' : ''}`}
                onClick={() => handleCommercialSidebarClick(commercial.id)}
                disabled={isApplying}
                style={{ 
                  backgroundColor: commercial.color || '#9cbfc8',
                  borderColor: commercial.color || '#9cbfc8'
                }}
                title={
                  selectedRdvs.size > 0
                    ? `Préparer l'affectation de ${selectedRdvs.size} RDV(s) à ${commercial.pseudo}`
                    : filterCommercialId === commercial.id
                      ? `Afficher tous les RDV (retirer le filtre)`
                      : `Voir uniquement les RDV affectés à ${commercial.pseudo}`
                }
              >
                <FaUser /> {commercial.pseudo}
              </button>
            ))}
            {(!commerciauxData || commerciauxData.length === 0) && (
              <div className="no-commerciaux">Aucun commercial disponible</div>
            )}
          </div>
          <div className="sidebar-footer">
            {selectedRdvs.size > 0 && (
              <button
                type="button"
                className="btn-clear-selection"
                onClick={() => setSelectedRdvs(new Set())}
              >
                Effacer la sélection
              </button>
            )}
            <button
              type="button"
              className="btn-appliquer"
              onClick={handleApplyAssignments}
              disabled={isApplying || Object.keys(pendingAssignments).length === 0}
            >
              {isApplying ? 'Application...' : 'Appliquer'}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de résultats de distance */}
      {showDistanceModal && distanceResults && (
        <div className="distance-modal-overlay" onClick={() => setShowDistanceModal(false)}>
          <div className="distance-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="distance-modal-header">
              <h2>Distances entre les adresses</h2>
              <button className="distance-modal-close" onClick={() => setShowDistanceModal(false)}>
                ×
              </button>
            </div>
            <div className="distance-modal-body">
              <div className="distance-summary">
                <p><strong>Distance totale:</strong> {distanceResults.totalDistance ? `${distanceResults.totalDistance.toFixed(2)} km` : 'N/A'}</p>
                <p><strong>Nombre de RDV:</strong> {distanceResults.rdvs.length}</p>
              </div>
              <div className="distance-table-container">
                <table className="distance-table">
                  <thead>
                    <tr>
                      <th>Code Postal 1</th>
                      <th>Ville 1</th>
                      <th>Code Postal 2</th>
                      <th>Ville 2</th>
                      <th>Distance (km)</th>
                      <th>Durée</th>
                    </tr>
                  </thead>
                  <tbody>
                    {distanceResults.distances.map((dist, index) => (
                      <tr key={index}>
                        <td>{dist.cp1}</td>
                        <td>{dist.ville1 || '-'}</td>
                        <td>{dist.cp2}</td>
                        <td>{dist.ville2 || '-'}</td>
                        <td>{dist.distance ? `${dist.distance.toFixed(2)}` : 'N/A'}</td>
                        <td>{dist.duration_formatted || (dist.duration_seconds ? formatDuration(dist.duration_seconds) : 'N/A')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AffectationDep;

