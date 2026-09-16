import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaUserCheck, FaCheck, FaSearch } from 'react-icons/fa';
import { formatRdvDateTime } from '../utils/formatRdvDateTime';
import { ficheHasR2Placed } from '../utils/ficheR2Placed';
import { getEtatDisplayWithSousEtat } from '../utils/etatSignerComplet';
import FicheDetailLink from '../components/FicheDetailLink';
import './Affectation.css';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';

function getProduitName(produitId) {
  return produitId === 1 ? 'PAC' : produitId === 2 ? 'PV' : '';
}

function getProduitColor(produitId) {
  return produitId === 1 ? '#66D5D4' : produitId === 2 ? '#FFE441' : '#cccccc';
}

function getDecalageInfo(fiche) {
  const etatIdRaw = fiche?.decale_id_etat;
  const etatId = Number(etatIdRaw);
  const titre = String(fiche?.etat_dec || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const hasDecalage = Boolean(
    fiche?.decale_date_prevu ||
    fiche?.decale_date_nouvelle ||
    (fiche?.etat_dec && String(fiche.etat_dec).trim() !== '') ||
    (etatIdRaw != null && etatIdRaw !== '' && Number.isFinite(etatId))
  );
  if (!hasDecalage) return null;
  if (etatId === 6 || titre.includes('ANNUL')) return null;
  let status = 'pending';
  let text = 'En cours';
  if (etatId === 2 || titre.includes('ACCEPT') || titre.includes('VALID')) {
    status = 'accepted';
    text = 'Acceptée';
  } else if (etatId === 3 || etatId === 4 || titre.includes('REFUS')) {
    status = 'refused';
    text = 'Refusée';
  }
  return { status, text };
}

function formatConfirmateurs(fiche) {
  const parts = [
    fiche.confirmateur_nom,
    fiche.confirmateur_2_pseudo,
    fiche.confirmateur_3_pseudo,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' | ') : '-';
}

function formatCommercials(fiche) {
  const parts = [fiche.commercial_nom, fiche.commercial_2_pseudo].filter(Boolean);
  return parts.length > 0 ? parts.join(' | ') : '-';
}

const Affectation = () => {
  useForceDesktopViewport('affectation-page');
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedFiches, setSelectedFiches] = useState([]);
  const [selectedCommercial, setSelectedCommercial] = useState('');
  const [filters, setFilters] = useState({
    date_debut: new Date().toISOString().split('T')[0],
    date_fin: new Date().toISOString().split('T')[0],
    id_centre: '',
    produit: '',
    departement: '', // Code département (2 premiers chiffres du code postal)
    id_commercial: '' // Filtre par commercial
  });

  // Récupérer les données de référence
  const { data: centresData } = useQuery('centres', async () => {
    const res = await api.get('/management/centres');
    return res.data.data || [];
  });

  const { data: commerciauxData } = useQuery('commerciaux', async () => {
    const res = await api.get('/management/utilisateurs');
    return res.data.data?.filter(u => u.fonction === 5) || [];
  });

  const { data: produitsData } = useQuery('produits', async () => {
    const res = await api.get('/management/produits');
    return res.data.data || [];
  });

  const { data: etatsData } = useQuery('etats', async () => {
    const res = await api.get('/management/etats');
    return res.data.data || [];
  });

  // Récupérer les fiches confirmées
  const { data: fichesData, isLoading, refetch } = useQuery(
    ['fiches-confirmees', filters],
    async () => {
      const params = { ...filters };
      Object.keys(params).forEach(key => {
        if (!params[key] || params[key] === 'all') delete params[key];
      });
      const res = await api.get('/affectations/fiches-confirmees', { params });
      return res.data.data || [];
    },
    { enabled: true }
  );

  // Mutation pour affecter
  const affectMutation = useMutation(
    async ({ fiches_ids, id_commercial }) => {
      const res = await api.post('/affectations/affecter', {
        fiches_ids,
        id_commercial: parseInt(id_commercial)
      });
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('fiches-confirmees');
        setSelectedFiches([]);
        setSelectedCommercial('');
      }
    }
  );

  // Mutation pour désaffecter
  const desaffectMutation = useMutation(
    async ({ fiches_ids }) => {
      const res = await api.post('/affectations/desaffecter', {
        fiches_ids
      });
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('fiches-confirmees');
        setSelectedFiches([]);
      }
    }
  );

  const handleSelectFiche = (ficheId) => {
    setSelectedFiches(prev => {
      if (prev.includes(ficheId)) {
        return prev.filter(id => id !== ficheId);
      } else {
        return [...prev, ficheId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedFiches.length === fichesData?.length) {
      setSelectedFiches([]);
    } else {
      setSelectedFiches(fichesData?.map(f => f.id) || []);
    }
  };

  const handleAffecter = () => {
    if (selectedFiches.length === 0) {
      alert('Veuillez sélectionner au moins une fiche');
      return;
    }
    if (!selectedCommercial || selectedCommercial <= 0) {
      alert('Veuillez sélectionner un commercial');
      return;
    }
    if (window.confirm(`Affecter ${selectedFiches.length} fiche(s) au commercial sélectionné ?`)) {
      affectMutation.mutate({
        fiches_ids: selectedFiches,
        id_commercial: selectedCommercial
      });
    }
  };

  const handleDesaffecter = () => {
    if (selectedFiches.length === 0) {
      alert('Veuillez sélectionner au moins une fiche');
      return;
    }
    if (window.confirm(`Désaffecter ${selectedFiches.length} fiche(s) ?`)) {
      desaffectMutation.mutate({
        fiches_ids: selectedFiches
      });
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEtatColor = (fiche) => {
    if (fiche?.etat_color) return fiche.etat_color;
    const etat = (etatsData || []).find((e) => e.id === fiche?.id_etat_final || e.id === Number(fiche?.id_etat_final));
    return etat?.color || '#cccccc';
  };

  const checkIndicators = (histoString, fiche = {}) => {
    const r2Placed = ficheHasR2Placed(fiche);
    const presenceCouple = String(fiche?.conf_presence_couple || '').toUpperCase().trim();
    const hasRdvSeul = [
      'MME SEULE SANS MR',
      'MME SEUL SANS MR',
      'MR SEUL SANS MME',
      'NON',
    ].includes(presenceCouple) || String(fiche?.conf_rdv_avec || '').toUpperCase().trim() === 'SEUL';
    if (!histoString || !etatsData) {
      return { r2: r2Placed, rf: false, an: false, rs: hasRdvSeul };
    }
    const histoArray = String(histoString).split(',').map(Number);
    let hasAnnuler = false;
    let hasRefuser = false;
    histoArray.forEach((etatId) => {
      const etat = etatsData.find((e) => e.id === etatId);
      if (etat && etat.titre) {
        const titre = etat.titre.toUpperCase();
        if (titre.includes('RDV ANNULER')) hasAnnuler = true;
        if (titre.includes('REFUSER')) hasRefuser = true;
      }
    });
    return { r2: r2Placed, rf: hasRefuser, an: hasAnnuler, rs: hasRdvSeul };
  };

  return (
    <div className="affectation-page">
      <h2 className="page-title"><FaUserCheck /> Affectation des Fiches Confirmées</h2>

      {/* Filtres */}
      <div className="affectation-filters">
        <div className="filter-row">
          <div className="filter-group">
            <label>Date RDV début</label>
            <input
              type="date"
              value={filters.date_debut}
              onChange={(e) => handleFilterChange('date_debut', e.target.value)}
              className="form-control"
              title="Filtrer par date de rendez-vous - Date de début"
            />
          </div>

          <div className="filter-group">
            <label>Date RDV fin</label>
            <input
              type="date"
              value={filters.date_fin}
              onChange={(e) => handleFilterChange('date_fin', e.target.value)}
              className="form-control"
              title="Filtrer par date de rendez-vous - Date de fin"
            />
          </div>

          <div className="filter-group">
            <label>Centre</label>
            <select
              value={filters.id_centre}
              onChange={(e) => handleFilterChange('id_centre', e.target.value)}
              className="form-control"
            >
              <option value="">Tous les centres</option>
              {centresData?.map(centre => (
                <option key={centre.id} value={centre.id}>{centre.titre}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Produit</label>
            <select
              value={filters.produit}
              onChange={(e) => handleFilterChange('produit', e.target.value)}
              className="form-control"
            >
              <option value="">Tous les produits</option>
              {produitsData?.map(prod => (
                <option key={prod.id} value={prod.id}>{prod.titre}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Département</label>
            <input
              type="text"
              value={filters.departement}
              onChange={(e) => handleFilterChange('departement', e.target.value)}
              className="form-control"
              placeholder="Ex: 01, 75, 13"
              title="Filtrer par un ou plusieurs codes département, séparés par une virgule"
            />
          </div>

          <div className="filter-group">
            <label>Commercial</label>
            <select
              value={filters.id_commercial}
              onChange={(e) => handleFilterChange('id_commercial', e.target.value)}
              className="form-control"
            >
              <option value="">Tous les commerciaux</option>
              {commerciauxData?.map(com => (
                <option key={com.id} value={com.id}>{com.pseudo}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Actions d'affectation */}
      <div className="affectation-actions">
        <div className="action-group">
          <label>Commercial à affecter</label>
          <select
            value={selectedCommercial}
            onChange={(e) => setSelectedCommercial(e.target.value)}
            className="form-control commercial-select"
          >
            <option value="">Sélectionner un commercial</option>
            {commerciauxData?.map(com => (
              <option key={com.id} value={com.id}>{com.pseudo}</option>
            ))}
          </select>
        </div>

        <div className="action-buttons">
          <button
            onClick={handleAffecter}
            disabled={selectedFiches.length === 0 || !selectedCommercial || affectMutation.isLoading}
            className="btn btn-affect"
          >
            {affectMutation.isLoading ? 'Affectation...' : `Affecter ${selectedFiches.length} fiche(s)`}
          </button>
          <button
            onClick={handleDesaffecter}
            disabled={selectedFiches.length === 0 || desaffectMutation.isLoading}
            className="btn btn-desaffect"
          >
            {desaffectMutation.isLoading ? 'Désaffectation...' : `Désaffecter ${selectedFiches.length} fiche(s)`}
          </button>
        </div>
      </div>

      {/* Messages de succès/erreur */}
      {affectMutation.isSuccess && (
        <div className="alert alert-success">
          {affectMutation.data.message}
        </div>
      )}
      {affectMutation.isError && (
        <div className="alert alert-error">
          Erreur lors de l'affectation: {affectMutation.error?.response?.data?.message || affectMutation.error.message}
        </div>
      )}
      {desaffectMutation.isSuccess && (
        <div className="alert alert-success">
          {desaffectMutation.data.message}
        </div>
      )}
      {desaffectMutation.isError && (
        <div className="alert alert-error">
          Erreur lors de la désaffectation: {desaffectMutation.error?.response?.data?.message || desaffectMutation.error.message}
        </div>
      )}

      {/* Liste des fiches */}
      <div className="fiches-list">
        <div className="list-header">
          <div className="select-all">
            <input
              type="checkbox"
              checked={selectedFiches.length === fichesData?.length && fichesData?.length > 0}
              onChange={handleSelectAll}
            />
            <span>Tout sélectionner ({fichesData?.length || 0} fiches)</span>
          </div>
          <div className="selected-count">
            {selectedFiches.length} fiche(s) sélectionnée(s)
          </div>
        </div>

        {isLoading ? (
          <div className="loading">Chargement des fiches...</div>
        ) : fichesData?.length === 0 ? (
          <div className="no-data">
            Aucune fiche confirmée trouvée
          </div>
        ) : (
          <div className="fiches-table-container">
            <table className="fiches-table">
              <thead>
                <tr>
                  <th className="affectation-select-col"></th>
                  <th>Nom</th>
                  <th>Prénom</th>
                  <th>Téléphone</th>
                  <th>CP</th>
                  <th>Date Insertion</th>
                  <th>Date RDV</th>
                  <th>État Final</th>
                  <th>Confirmateur</th>
                  <th>Commercial</th>
                  <th>Centre</th>
                  <th>Produit</th>
                  <th>Validé</th>
                  <th className="affectation-actions-col">Actions</th>
                  <th className="dashboard-decalage-col">État décalage</th>
                </tr>
              </thead>
              <tbody>
                {fichesData?.map((fiche) => {
                  const indicators = checkIndicators(fiche.id_etat_histo, fiche);
                  const etatColor = getEtatColor(fiche);
                  const produitColor = getProduitColor(fiche.produit);
                  const decalageInfo = getDecalageInfo(fiche);
                  return (
                    <tr
                      key={fiche.id}
                      className={`fiche-row-by-etat ${selectedFiches.includes(fiche.id) ? 'selected' : ''}`}
                      style={{
                        backgroundColor: `${etatColor}40`,
                        borderLeft: `4px solid ${etatColor}`,
                      }}
                    >
                      <td className="affectation-select-col">
                        <input
                          type="checkbox"
                          checked={selectedFiches.includes(fiche.id)}
                          onChange={() => handleSelectFiche(fiche.id)}
                        />
                      </td>
                      <td data-label="Nom:" className="fiche-row-lead-cell">
                        <span className="fiche-row-lead-label">{fiche.nom || ''}</span>
                      </td>
                      <td data-label="Prénom:">{fiche.prenom || ''}</td>
                      <td data-label="Téléphone:">{fiche.tel || fiche.gsm1 || ''}</td>
                      <td data-label="CP:">{fiche.cp || fiche.code_postal || ''}</td>
                      <td data-label="Date Insertion:" style={{ textAlign: 'left' }}>{formatDate(fiche.date_insert_time)}</td>
                      <td data-label="Date RDV:" style={{ textAlign: 'left' }}>{formatRdvDateTime(fiche.date_rdv_time)}</td>
                      <td data-label="État:" className="etat-col-cell">
                        <span
                          className="etat-badge etat-badge--wrap"
                          style={{ backgroundColor: etatColor }}
                        >
                          {getEtatDisplayWithSousEtat(fiche, etatsData || [])}
                        </span>
                      </td>
                      <td data-label="Confirmateur:">{formatConfirmateurs(fiche)}</td>
                      <td data-label="Commercial:">{formatCommercials(fiche)}</td>
                      <td data-label="Centre:">{fiche.centre_nom || '-'}</td>
                      <td data-label="Produit:">
                        <span
                          className="produit-indicator"
                          style={{ backgroundColor: produitColor, color: '#ffffff' }}
                          title={getProduitName(fiche.produit) || fiche.produit_nom}
                        >
                          {getProduitName(fiche.produit) || fiche.produit_nom || '-'}
                        </span>
                      </td>
                      <td data-label="Validé:" style={{ textAlign: 'center' }}>
                        {fiche.valider > 0 ? (
                          <FaCheck
                            style={{ color: '#28a745', fontSize: '15.3px' }}
                            title={`Validée${fiche.conf_rdv_avec ? ` avec ${fiche.conf_rdv_avec}` : ''}`}
                          />
                        ) : (
                          <span style={{ color: '#ccc' }}>-</span>
                        )}
                      </td>
                      <td data-label="" className="affectation-actions-col">
                        <div className="fiche-indicators">
                          {indicators.r2 && (
                            <span className="indicator r2" title="R2 placé (commercial secondaire)">R2</span>
                          )}
                          {indicators.rf && <span className="indicator rf" title="Refus">REF</span>}
                          {indicators.an && <span className="indicator an" title="Annulation">ANN</span>}
                          {indicators.rs && <span className="indicator rs" title="SEUL">SEUL</span>}
                        </div>
                        <div className="dashboard-actions-cell">
                          <FicheDetailLink
                            ficheHash={fiche.hash}
                            ficheId={fiche.id}
                            className="btn-detail"
                            title="Voir les détails"
                          >
                            <FaSearch style={{ color: '#ffffff', fontSize: '11.9px' }} />
                          </FicheDetailLink>
                        </div>
                      </td>
                      <td data-label="État décalage:" className="dashboard-decalage-cell">
                        {decalageInfo && (
                          <span className={`dashboard-decalage-mention is-${decalageInfo.status}`}>
                            {decalageInfo.text}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Affectation;

