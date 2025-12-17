import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaChevronLeft, FaChevronRight, FaTrash } from 'react-icons/fa';
import { toast } from 'react-toastify';
import './PlanningHebdomadaire.css';

// Helper pour obtenir le numéro de semaine ISO
function getWeekNumber(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
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

// Helper pour formater les dates de la semaine
function formatWeekRange(year, week) {
  const monday = getMondayOfWeek(year, week);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  
  const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };
  
  return `${formatDate(monday)} Au ${formatDate(friday)}`;
}

// Jours de la semaine
const JOURS = [
  { value: '1-4', label: 'Lundi à jeudi' },
  { value: '1-2', label: 'Lundi à mardi' },
  { value: '1-3', label: 'Lundi à mercredi' },
  { value: '3-4', label: 'Mercredi à jeudi' },
  { value: '1', label: 'Lundi' },
  { value: '2', label: 'Mardi' },
  { value: '3', label: 'Mercredi' },
  { value: '4', label: 'Jeudi' },
  { value: '5', label: 'Vendredi' }
];

const PlanningHebdomadaire = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const currentDate = new Date();
  const currentWeek = getWeekNumber(currentDate);
  const currentYear = currentDate.getFullYear();

  const [week, setWeek] = useState(currentWeek);
  const [year, setYear] = useState(currentYear);
  
  // Formulaire d'ajout
  const [formData, setFormData] = useState({
    jour: '',
    id_departement: '',
    nombre_commercial: '',
    forcer: 'CRENAUX'
  });

  // Copie planning
  const [selectedWeeksToPaste, setSelectedWeeksToPaste] = useState([]);

  // Récupérer les départements depuis la base de données
  const { data: departementsData, isLoading: isLoadingDepartements } = useQuery(
    'planning-hebdomadaire-departements',
    async () => {
      try {
        // Essayer d'abord la route planning/departements
        const res = await api.get('/planning/departements');
        if (res.data && res.data.success && res.data.data) {
          return res.data.data.map(d => ({
            id: d.id || d.departement_id || d.code,
            code: d.code || d.departement_code,
            nom: d.nom || d.departement_nom_uppercase || d.departement_nom
          }));
        }
        
        // Fallback : utiliser la route management
        const resManagement = await api.get('/management/departements');
        if (resManagement.data && resManagement.data.success && resManagement.data.data) {
          return resManagement.data.data
            .filter(d => d.etat > 0) // Filtrer les départements actifs
            .map(d => ({
              id: d.id || d.departement_id || d.departement_code,
              code: d.departement_code,
              nom: d.departement_nom_uppercase || d.departement_nom
            }));
        }
        
        return [];
      } catch (error) {
        console.error('Erreur lors du chargement des départements:', error);
        // Dernier fallback
        try {
          const resManagement = await api.get('/management/departements');
          if (resManagement.data && resManagement.data.success && resManagement.data.data) {
            return resManagement.data.data
              .filter(d => d.etat > 0)
              .map(d => ({
                id: d.id || d.departement_id || d.departement_code,
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
    }
  );

  // Récupérer les disponibilités de la semaine depuis la base de données
  // Note: L'endpoint /planning/hebdomadaire n'existe peut-être pas encore côté backend
  // On gère le 404 silencieusement et on retourne un tableau vide
  const { data: disponibilitesData, isLoading, refetch } = useQuery(
    ['planning-hebdomadaire', year, week],
    async () => {
      try {
        const res = await api.get(`/planning/hebdomadaire?year=${year}&week=${week}`);
        console.log('Réponse planning hebdomadaire:', res.data);
        if (res.data) {
          // Gérer différentes structures de réponse
          if (res.data.success && res.data.data) {
            const data = Array.isArray(res.data.data) ? res.data.data : [];
            console.log('Données disponibilités (groupées):', data);
            return data;
          }
          // Si la réponse est directement un tableau
          if (Array.isArray(res.data)) {
            console.log('Données disponibilités (array direct):', res.data);
            return res.data;
          }
          // Si la réponse contient directement les données
          if (res.data.data && Array.isArray(res.data.data)) {
            console.log('Données disponibilités (res.data.data):', res.data.data);
            return res.data.data;
          }
        }
        return [];
      } catch (error) {
        // Si l'endpoint n'existe pas (404), retourner un tableau vide silencieusement
        // L'endpoint sera créé côté backend
        if (error.response?.status === 404 || error.code === 'ERR_NETWORK') {
          // Ne pas logger d'erreur pour les 404, c'est normal si l'endpoint n'est pas encore implémenté
          return [];
        }
        // Pour les autres erreurs, logger mais ne pas bloquer l'interface
        console.warn('Erreur lors du chargement des disponibilités (l\'endpoint /planning/hebdomadaire sera créé côté backend):', error.message);
        return [];
      }
    },
    {
      enabled: !!year && !!week,
      staleTime: 30000, // Cache 30 secondes
      retry: false, // Ne pas réessayer en cas d'erreur 404
    }
  );

  // Les disponibilités sont déjà groupées par département côté backend avec les champs lundi, mardi, etc.
  // On les utilise directement sans regrouper
  const disponibilitesGrouped = React.useMemo(() => {
    if (!disponibilitesData || !Array.isArray(disponibilitesData)) return {};
    
    // Le backend retourne déjà un tableau avec les données groupées
    // On convertit simplement en objet indexé par departement_id
    const grouped = {};
    disponibilitesData.forEach((item) => {
      const key = item.departement_id || item.id_departement || item.dep || item.departement_code;
      if (!key) return;
      
      // Récupérer le code du département (format: "01", "75", etc.)
      // Le backend retourne departement_code, sinon utiliser key et le formater
      const departementCode = item.departement_code || item.code || String(key).padStart(2, '0').substring(0, 2);
      
      grouped[key] = {
        id: item.id || null,
        departement_id: key,
        departement_code: departementCode,
        departement_nom: `DEP ${departementCode}`, // Format: "DEP 01", "DEP 75", etc.
        lundi: parseInt(item.lundi || 0),
        mardi: parseInt(item.mardi || 0),
        mercredi: parseInt(item.mercredi || 0),
        jeudi: parseInt(item.jeudi || 0),
        vendredi: parseInt(item.vendredi || 0)
      };
    });
    
    return grouped;
  }, [disponibilitesData]);

  // Navigation entre les semaines
  const handlePrevWeek = () => {
    if (week === 1) {
      setYear(year - 1);
      setWeek(52);
    } else {
      setWeek(week - 1);
    }
  };

  const handleNextWeek = () => {
    if (week === 52) {
      setYear(year + 1);
      setWeek(1);
    } else {
      setWeek(week + 1);
    }
  };

  // Créer une disponibilité
  const createMutation = useMutation(
    async (data) => {
      const res = await api.post('/planning/hebdomadaire', {
        ...data,
        year,
        week
      });
      return res.data;
    },
    {
      onSuccess: async () => {
        // Invalider toutes les queries liées au planning pour forcer le rafraîchissement
        await queryClient.invalidateQueries(['planning-hebdomadaire']);
        // Rafraîchir immédiatement les données
        await refetch();
        toast.success('Disponibilité ajoutée avec succès');
        setFormData({
          jour: '',
          id_departement: '',
          nombre_commercial: '',
          forcer: 'CRENAUX'
        });
      },
      onError: (error) => {
        toast.error('Erreur lors de l\'ajout: ' + (error.response?.data?.message || error.message));
      }
    }
  );

  // Supprimer une disponibilité
  const deleteMutation = useMutation(
    async (departementId) => {
      const res = await api.delete(`/planning/hebdomadaire/${departementId}?year=${year}&week=${week}`);
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['planning-hebdomadaire', year, week]);
        toast.success('Disponibilité supprimée avec succès');
      },
      onError: (error) => {
        toast.error('Erreur lors de la suppression: ' + (error.response?.data?.message || error.message));
      }
    }
  );

  // Dupliquer planning
  const duplicateMutation = useMutation(
    async ({ sourceWeek, sourceYear, targetWeeks, targetYear }) => {
      const res = await api.post('/planning/hebdomadaire/duplicate', {
        source_week: sourceWeek,
        source_year: sourceYear,
        target_weeks: targetWeeks,
        target_year: targetYear
      });
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['planning-hebdomadaire']);
        toast.success('Planning dupliqué avec succès');
      },
      onError: (error) => {
        toast.error('Erreur lors de la duplication: ' + (error.response?.data?.message || error.message));
      }
    }
  );

  // Mettre tous à 0
  const resetMutation = useMutation(
    async () => {
      const res = await api.post(`/planning/hebdomadaire/reset?year=${year}&week=${week}`);
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['planning-hebdomadaire', year, week]);
        toast.success('Toutes les disponibilités ont été mises à 0');
      },
      onError: (error) => {
        toast.error('Erreur lors de la réinitialisation: ' + (error.response?.data?.message || error.message));
      }
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.jour || !formData.id_departement || !formData.nombre_commercial) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    createMutation.mutate(formData);
  };

  const handleDuplicate = () => {
    if (!selectedWeeksToPaste.length) {
      toast.error('Veuillez sélectionner au moins une semaine de destination');
      return;
    }
    
    // Grouper les semaines par année
    const weeksByYear = {};
    selectedWeeksToPaste.forEach(weekOption => {
      // weekOption est toujours un objet {week, year}
      const weekNum = weekOption.week;
      const yearNum = weekOption.year;
      
      if (!weeksByYear[yearNum]) {
        weeksByYear[yearNum] = [];
      }
      weeksByYear[yearNum].push(weekNum);
    });

    // Dupliquer pour chaque année
    const duplicatePromises = Object.entries(weeksByYear).map(([yearNum, weeks]) => {
      return duplicateMutation.mutateAsync({
        sourceWeek: week,
        sourceYear: year,
        targetWeeks: weeks,
        targetYear: parseInt(yearNum)
      });
    });

    Promise.all(duplicatePromises)
      .then(() => {
        toast.success(`Planning dupliqué vers ${selectedWeeksToPaste.length} semaine(s) avec succès`);
        setSelectedWeeksToPaste([]);
      })
      .catch((error) => {
        toast.error('Erreur lors de la duplication: ' + (error.response?.data?.message || error.message));
      });
  };

  const handleReset = () => {
    if (window.confirm('Êtes-vous sûr de vouloir mettre toutes les disponibilités à 0 pour cette semaine ?')) {
      resetMutation.mutate();
    }
  };

  // Générer la liste des semaines pour la copie (année courante et année suivante)
  const availableWeeks = [];
  
  // Semaines restantes de l'année courante
  for (let i = week + 1; i <= 53; i++) {
    availableWeeks.push({ week: i, year: year, label: `Semaine ${i} (${year})` });
  }
  
  // Toutes les semaines de l'année suivante
  for (let i = 1; i <= 53; i++) {
    availableWeeks.push({ week: i, year: year + 1, label: `Semaine ${i} (${year + 1})` });
  }
  
  // Trier par année puis par semaine
  availableWeeks.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.week - b.week;
  });

  return (
    <div className="planning-hebdomadaire-page">
      {/* Header */}
      <div className="planning-hebdomadaire-header">
        <div className="header-left">
          <span className="header-title">Planning Hebdomadaire - Semaine {week}:</span>
        </div>
        <div className="header-right">
          <button className="nav-btn" onClick={handlePrevWeek} title="Semaine précédente">
            <FaChevronLeft />
          </button>
          <span className="week-dates">{formatWeekRange(year, week)}</span>
          <button className="nav-btn" onClick={handleNextWeek} title="Semaine suivante">
            <FaChevronRight />
          </button>
        </div>
      </div>

      {/* Formulaire d'ajout */}
      <div className="planning-hebdomadaire-form">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Jour *</label>
            <select
              value={formData.jour}
              onChange={(e) => setFormData({ ...formData, jour: e.target.value })}
              required
            >
              <option value="">-- Sélectionnez un Jour --</option>
              {JOURS.map(jour => (
                <option key={jour.value} value={jour.value}>{jour.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Département *:</label>
            <select
              value={formData.id_departement}
              onChange={(e) => setFormData({ ...formData, id_departement: e.target.value })}
              required
              disabled={isLoadingDepartements}
            >
              <option value="">-- Sélectionnez un Département --</option>
              {departementsData && departementsData.map(dept => (
                <option key={dept.id || dept.code} value={dept.id || dept.code}>
                  {dept.nom || dept.code}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Nombre Commercial *:</label>
            <input
              type="number"
              value={formData.nombre_commercial}
              onChange={(e) => setFormData({ ...formData, nombre_commercial: e.target.value })}
              placeholder="Nombre"
              min="0"
              required
            />
          </div>

          <div className="form-group">
            <label>Forcer :</label>
            <select
              value={formData.forcer}
              onChange={(e) => setFormData({ ...formData, forcer: e.target.value })}
            >
              <option value="CRENAUX">CRENAUX</option>
            </select>
          </div>

          <button type="submit" className="btn-ajouter" disabled={createMutation.isLoading}>
            {createMutation.isLoading ? 'Ajout...' : 'AJOUTER'}
          </button>
        </form>
      </div>

      {/* Section Copie planning */}
      <div className="planning-hebdomadaire-copy">
        <h3>Copie planning semaine : {week} ({year})</h3>
        <div className="copy-controls">
          <div className="week-selector-container">
            <label>Semaines de destination:</label>
            <select
              multiple
              size="8"
              value={selectedWeeksToPaste.map(w => `${w.year}-${w.week}`)}
              onChange={(e) => {
                const selectedValues = Array.from(e.target.selectedOptions, option => option.value);
                const weeks = selectedValues.map(val => {
                  const [y, w] = val.split('-');
                  return { week: parseInt(w), year: parseInt(y) };
                });
                setSelectedWeeksToPaste(weeks);
              }}
              className="week-selector"
            >
              {availableWeeks.map(weekOption => {
                const key = `${weekOption.year}-${weekOption.week}`;
                return (
                  <option key={key} value={key}>
                    {weekOption.label}
                  </option>
                );
              })}
            </select>
            <small style={{ marginTop: '8px', display: 'block', color: '#666', fontSize: '12px' }}>
              Maintenez Ctrl (ou Cmd sur Mac) pour sélectionner plusieurs semaines
            </small>
          </div>

          <div className="copy-buttons">
            <button
              className="btn-duplicate"
              onClick={handleDuplicate}
              disabled={duplicateMutation.isLoading}
            >
              {duplicateMutation.isLoading ? 'Duplication...' : 'Dupliquer planning'}
            </button>
            <button
              className="btn-reset"
              onClick={handleReset}
              disabled={resetMutation.isLoading}
            >
              {resetMutation.isLoading ? 'Réinitialisation...' : 'METTRE TOUS A 0'}
            </button>
          </div>
        </div>
      </div>

      {/* Tableau des disponibilités */}
      <div className="planning-hebdomadaire-table-container">
        <table className="planning-hebdomadaire-table">
          <thead>
            <tr>
              <th>DEPARTEMENT</th>
              <th>LUNDI</th>
              <th>MARDI</th>
              <th>MERCREDI</th>
              <th>JEUDI</th>
              <th>VENDREDI</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>
                  Chargement...
                </td>
              </tr>
            ) : Object.keys(disponibilitesGrouped).length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>
                  Aucune disponibilité pour cette semaine
                </td>
              </tr>
            ) : (
              Object.values(disponibilitesGrouped).map((item) => (
                <tr key={item.departement_id}>
                  <td>
                    <a href="#" className="departement-link">
                      {item.departement_nom}
                    </a>
                  </td>
                  <td>{item.lundi}</td>
                  <td>{item.mardi}</td>
                  <td>{item.mercredi}</td>
                  <td>{item.jeudi}</td>
                  <td>{item.vendredi}</td>
                  <td>
                    <button
                      className="btn-delete"
                      onClick={() => deleteMutation.mutate(item.departement_id)}
                      title="Supprimer l'Aperçu"
                    >
                      <FaTrash /> Supprimer l'Aperçu
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PlanningHebdomadaire;

