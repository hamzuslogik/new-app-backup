import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaChevronLeft, FaChevronRight, FaCalendarAlt, FaCheck, FaUser, FaRoute, FaMinus } from 'react-icons/fa';
import { toast } from 'react-toastify';
import FicheDetailLink from '../components/FicheDetailLink';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
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
  
  // Vérifier si l'utilisateur est admin (fonction 1, 2, 7, ou 11)
  const isAdmin = user?.fonction === 1 || user?.fonction === 2 || user?.fonction === 7 || user?.fonction === 11;
  
  const currentDate = new Date();
  const currentWeek = getWeekNumber(currentDate);
  const currentYear = currentDate.getFullYear();

  const [week, setWeek] = useState(parseInt(searchParams.get('w')) || currentWeek);
  const [year, setYear] = useState(parseInt(searchParams.get('y')) || currentYear);
  const [dep, setDep] = useState(searchParams.get('dp') || '');
  const [selectedRdvs, setSelectedRdvs] = useState(new Set());
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
  for (let i = 0; i < 5; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    days.push({ date: dateStr, dayName: daysFr[i] });
  }

  // Récupérer le planning
  const { data: planningData, isLoading: isLoadingPlanning, refetch: refetchPlanning } = useQuery(
    ['planning-week', week, year, dep],
    async () => {
      const res = await api.get('/planning/week', { params: { w: week, y: year, dp: dep || '01' } });
      return res.data;
    },
    { 
      keepPreviousData: true, 
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

  // Mutation pour affecter des RDV
  const affectMutation = useMutation(
    async ({ fichesIds, idCommercial }) => {
      const res = await api.post('/affectations/affecter', {
        fiches_ids: fichesIds,
        id_commercial: idCommercial
      });
      return res.data;
    },
    {
      onSuccess: (data) => {
        toast.success(`${data.success_count || selectedRdvs.size} RDV(s) affecté(s) avec succès`);
        setSelectedRdvs(new Set());
        refetchPlanning();
        queryClient.invalidateQueries(['planning-week', week, year, dep]);
      },
      onError: (error) => {
        toast.error('Erreur lors de l\'affectation: ' + (error.response?.data?.message || error.message));
      }
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
        queryClient.invalidateQueries(['planning-week', week, year, dep]);
      },
      onError: (error) => {
        toast.error('Erreur lors de l\'annulation de l\'affectation: ' + (error.response?.data?.message || error.message));
      }
    }
  );

  // Gérer l'annulation de l'affectation d'un RDV
  const handleDesaffecter = (ficheId, e) => {
    e.stopPropagation(); // Empêcher la propagation de l'événement
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

  // Gérer l'affectation à un commercial
  const handleAffecter = (idCommercial) => {
    if (selectedRdvs.size === 0) {
      toast.warning('Veuillez sélectionner au moins un RDV');
      return;
    }
    if (!idCommercial) {
      toast.error('Commercial invalide');
      return;
    }
    
    const fichesIds = Array.from(selectedRdvs);
    affectMutation.mutate({ fichesIds, idCommercial });
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

  // Initialiser le département si vide
  useEffect(() => {
    if (!dep && departementsData && departementsData.length > 0) {
      const firstDep = departementsData[0].code || departementsData[0].departement_code;
      setDep(firstDep);
      updateSearchParams(week, year, firstDep);
    }
  }, [departementsData, dep]);

  // Réinitialiser la sélection quand on change de semaine/département
  useEffect(() => {
    setSelectedRdvs(new Set());
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
                  const dayNum = new Date(day.date).getDate();
                  const dayName = day.dayName.toUpperCase();
                  return (
                    <th key={day.date}>
                      {dayName}({String(dayNum).padStart(2, '0')})
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
                      const availability = slotData?.av || 0;

                      return (
                        <td key={`${day.date}-${timeKey}`} className="planning-cell">
                          <div className="rdv-list">
                            {rdvs.map((rdv, index) => {
                              const commercialName = getUserName(rdv.id_commercial);
                              const commercialColor = getUserColor(rdv.id_commercial);
                              const isSelected = selectedRdvs.has(rdv.id);
                              const isValide = rdv.valider === 1 || rdv.valider === true;
                              const isConfirme = rdv.id_etat_final === 7;
                              const confirmerColor = getConfirmerColor();
                              
                              // Utiliser la couleur du commercial si disponible et différente de la couleur par défaut
                              // Sinon utiliser la couleur par défaut selon l'état (validé/non validé)
                              const defaultColor = isValide ? '#00cc00' : '#9bb380';
                              const hasCustomColor = commercialColor && commercialColor !== '#cccccc' && commercialColor !== null && commercialColor !== undefined;
                              const backgroundColor = hasCustomColor ? commercialColor : defaultColor;
                              
                              return (
                                <div
                                  key={rdv.id}
                                  className={`rdv-item ${isSelected ? 'selected' : ''} ${isValide ? 'valide' : 'confirme'} ${isConfirme ? 'rdv-confirme' : ''}`}
                                  style={{ 
                                    borderLeftColor: commercialColor,
                                    backgroundColor: isConfirme ? `${confirmerColor}20` : (hasCustomColor ? commercialColor : undefined)
                                  }}
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
                                    title={`RDV ${rdv.id} - CP: ${rdv.cp || '-'} - ${commercialName}`}
                                  >
                                    {rdv.cp ? String(rdv.cp) : '-'}
                                  </FicheDetailLink>
                                  {rdv.id_commercial && rdv.id_commercial > 0 && (
                                    <button
                                      className="btn-desaffecter"
                                      onClick={(e) => handleDesaffecter(rdv.id, e)}
                                      title="Annuler l'affectation"
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#dc3545',
                                        cursor: 'pointer',
                                        padding: '2px 4px',
                                        fontSize: '14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                    >
                                      <FaMinus />
                                    </button>
                                  )}
                                  <div className="rdv-badges">
                                    {/* Badges visibles uniquement pour les admins (sauf SEUL) */}
                                    {userIsAdmin && rdv.qualification === 'RDV_URGENT' && (
                                      <span className="badge urgent">RDV_URGENT</span>
                                    )}
                                    {userIsAdmin && (rdv.qualification === 'ANN' || 
                                      (rdv.etat_check && (rdv.etat_check.includes('AN') || rdv.etat_check === 'AN')) ||
                                      (rdv.etats_list && rdv.etats_list.includes('AN'))) && (
                                      <span className="badge ann">ANN</span>
                                    )}
                                    {userIsAdmin && ((rdv.etat_check && (rdv.etat_check.includes('R2') || rdv.etat_check === 'R2')) ||
                                     (rdv.etats_list && rdv.etats_list.includes('R2'))) && (
                                      <span className="badge r2">R2</span>
                                    )}
                                    {userIsAdmin && ((rdv.etat_check && (rdv.etat_check.includes('RF') || rdv.etat_check === 'RF')) ||
                                     (rdv.etats_list && rdv.etats_list.includes('RF'))) && (
                                      <span className="badge rf">REF</span>
                                    )}
                                    {userIsAdmin && (rdv.rdv_seul || 
                                      (rdv.etat_check && (rdv.etat_check.includes('RS') || rdv.etat_check === 'RS')) ||
                                      (rdv.etats_list && rdv.etats_list.includes('RS'))) && (
                                      <span className="badge rs">RDV SEUL</span>
                                    )}
                                    {/* Badge SEUL toujours visible */}
                                    {(rdv.rdv_valid_sans_couple ||
                                      (rdv.etat_check && (rdv.etat_check.includes('SEUL') || rdv.etat_check === 'SEUL')) ||
                                      (rdv.etats_list && rdv.etats_list.includes('SEUL'))) && (
                                      <span className="badge seul">SEUL</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                            {rdvs.length === 0 && availability > 0 && (
                              <div className="availability-indicator">Disponible: {availability}</div>
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
          <div className="sidebar-header">
            <h3>Commerciaux</h3>
            {selectedRdvs.size > 0 && (
              <div className="selected-info">
                {selectedRdvs.size} RDV sélectionné(s)
              </div>
            )}
          </div>
          <div className="commerciaux-list">
            {commerciauxData && commerciauxData.map(commercial => (
              <button
                key={commercial.id}
                className="commercial-button"
                onClick={() => handleAffecter(commercial.id)}
                disabled={selectedRdvs.size === 0 || affectMutation.isLoading}
                style={{ 
                  backgroundColor: commercial.color || '#9cbfc8',
                  borderColor: commercial.color || '#9cbfc8'
                }}
                title={`Affecter ${selectedRdvs.size} RDV(s) à ${commercial.pseudo}`}
              >
                <FaUser /> {commercial.pseudo}
              </button>
            ))}
            {(!commerciauxData || commerciauxData.length === 0) && (
              <div className="no-commerciaux">Aucun commercial disponible</div>
            )}
          </div>
          {selectedRdvs.size > 0 && (
            <div className="sidebar-footer">
              <button
                className="btn-clear-selection"
                onClick={() => setSelectedRdvs(new Set())}
              >
                Effacer la sélection
              </button>
            </div>
          )}
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

