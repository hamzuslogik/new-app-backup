import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaUserCheck } from 'react-icons/fa';
import './Affectation.css';

const Affectation = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedFiches, setSelectedFiches] = useState([]);
  const [selectedCommercial, setSelectedCommercial] = useState('');
  const [activeTab, setActiveTab] = useState('non-affectes'); // 'affectes' ou 'non-affectes'
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

  const { data: departementsData } = useQuery('departements', async () => {
    const res = await api.get('/management/departements');
    return res.data.data || [];
  });

  // Récupérer les fiches confirmées
  const { data: fichesData, isLoading, refetch } = useQuery(
    ['fiches-confirmees', filters, activeTab],
    async () => {
      const params = { 
        ...filters,
        affectees: activeTab === 'affectes' ? '1' : '0' // 1 pour affectées, 0 pour non affectées
      };
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
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="affectation-page">
      <h2 className="page-title"><FaUserCheck /> Affectation des Fiches Confirmées</h2>

      {/* Onglets */}
      <div className="affectation-tabs">
        <button
          className={`tab-button ${activeTab === 'non-affectes' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('non-affectes');
            setSelectedFiches([]);
          }}
        >
          RDV Non Affectés
        </button>
        <button
          className={`tab-button ${activeTab === 'affectes' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('affectes');
            setSelectedFiches([]);
          }}
        >
          RDV Affectés
        </button>
      </div>

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
            <select
              value={filters.departement}
              onChange={(e) => handleFilterChange('departement', e.target.value)}
              className="form-control"
            >
              <option value="">Tous les départements</option>
              {departementsData?.map(dep => (
                <option key={dep.id} value={dep.departement_code}>
                  {dep.departement_code} - {dep.departement_nom}
                </option>
              ))}
            </select>
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
          {activeTab === 'non-affectes' && (
            <button
              onClick={handleAffecter}
              disabled={selectedFiches.length === 0 || !selectedCommercial || affectMutation.isLoading}
              className="btn btn-affect"
            >
              {affectMutation.isLoading ? 'Affectation...' : `Affecter ${selectedFiches.length} fiche(s)`}
            </button>
          )}
          {activeTab === 'affectes' && (
            <button
              onClick={handleDesaffecter}
              disabled={selectedFiches.length === 0 || desaffectMutation.isLoading}
              className="btn btn-desaffect"
            >
              {desaffectMutation.isLoading ? 'Désaffectation...' : `Désaffecter ${selectedFiches.length} fiche(s)`}
            </button>
          )}
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
            {activeTab === 'affectes' 
              ? 'Aucune fiche confirmée affectée trouvée' 
              : 'Aucune fiche confirmée non affectée trouvée'}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="fiches-table">
              <thead>
                <tr>
                  <th></th>
                  <th>ID</th>
                  <th>Client</th>
                  <th>Téléphone</th>
                  <th>Code postal</th>
                  <th>Adresse</th>
                  <th>Produit</th>
                  <th>Centre</th>
                  <th>Confirmateur</th>
                  <th>Commercial</th>
                  <th>Date RDV</th>
                  <th>RDV Validé</th>
                  <th>Date modif</th>
                </tr>
              </thead>
              <tbody>
                {fichesData?.map(fiche => (
                  <tr
                    key={fiche.id}
                    className={selectedFiches.includes(fiche.id) ? 'selected' : ''}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedFiches.includes(fiche.id)}
                        onChange={() => handleSelectFiche(fiche.id)}
                      />
                    </td>
                    <td>{fiche.id}</td>
                    <td>
                      <strong>{fiche.nom} {fiche.prenom}</strong>
                    </td>
                    <td>{fiche.tel || fiche.gsm1 || '-'}</td>
                    <td>{fiche.cp || fiche.code_postal || '-'}</td>
                    <td>
                      {fiche.adresse ? (
                        <span>{fiche.adresse}{fiche.ville ? `, ${fiche.ville}` : ''}</span>
                      ) : '-'}
                    </td>
                    <td>{fiche.produit_nom || '-'}</td>
                    <td>{fiche.centre_nom || '-'}</td>
                    <td>{fiche.confirmateur_nom || '-'}</td>
                    <td>
                      {fiche.commercial_nom ? (
                        <span className="badge badge-assigned">{fiche.commercial_nom}</span>
                      ) : (
                        <span className="badge badge-unassigned">Non affecté</span>
                      )}
                    </td>
                    <td>
                      {fiche.date_rdv_time ? (
                        formatDate(fiche.date_rdv_time)
                      ) : '-'}
                    </td>
                    <td>
                      {fiche.valider > 0 ? (
                        <span className="badge badge-validated" title={fiche.conf_rdv_avec ? `Avec: ${fiche.conf_rdv_avec}` : ''}>
                          ✓ Validé
                        </span>
                      ) : (
                        <span className="badge badge-not-validated">Non validé</span>
                      )}
                    </td>
                    <td>{formatDate(fiche.date_modif_time)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Affectation;

