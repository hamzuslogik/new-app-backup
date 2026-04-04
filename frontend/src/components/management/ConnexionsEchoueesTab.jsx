import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import api from '../../config/api';
import { FaSync, FaFileExport, FaTrash, FaFilter } from 'react-icons/fa';
import LoadingSpinner from '../common/LoadingSpinner';
import Pagination from '../common/Pagination';
import { exportToCSV } from '../../utils/exportToCSV';
import useLocalStorage from '../../hooks/useLocalStorage';
import './ManagementTab.css';

const RAISON_OPTIONS = [
  { value: '', label: 'Toutes les raisons' },
  { value: 'login_inconnu', label: 'Login inconnu' },
  { value: 'mot_de_passe_incorrect', label: 'Mot de passe incorrect' },
  { value: 'ip_non_autorisee', label: 'IP non autorisée' },
  {
    value: 'compte_ou_fonction_centre_desactive',
    label: 'Compte / fonction / centre désactivé'
  }
];

const raisonLabel = (code) => {
  const o = RAISON_OPTIONS.find((x) => x.value === code);
  return o ? o.label : code;
};

function cleanParams(obj) {
  const out = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== '' && v !== null && v !== undefined) out[k] = v;
  });
  return out;
}

const ConnexionsEchoueesTab = () => {
  const [filterInputs, setFilterInputs] = useState({
    date_debut: '',
    date_fin: '',
    login: '',
    adresse_ip: '',
    raison_echec: ''
  });
  const [appliedFilters, setAppliedFilters] = useState({
    date_debut: '',
    date_fin: '',
    login: '',
    adresse_ip: '',
    raison_echec: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useLocalStorage(
    'management_connexions_echouees_per_page',
    25
  );
  const queryClient = useQueryClient();

  const queryParams = useMemo(() => {
    const offset = (currentPage - 1) * itemsPerPage;
    return cleanParams({
      limit: itemsPerPage,
      offset,
      ...appliedFilters
    });
  }, [currentPage, itemsPerPage, appliedFilters]);

  const { data, isLoading, refetch, isFetching } = useQuery(
    ['management-connexions-echouees', queryParams],
    async () => {
      const response = await api.get('/management/connexions-echouees', { params: queryParams });
      return response.data;
    },
    { keepPreviousData: true }
  );

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;

  const totalPages = useMemo(() => {
    if (total <= 0) return 1;
    return Math.max(1, Math.ceil(total / itemsPerPage));
  }, [total, itemsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [totalPages, currentPage]);

  const applyFilters = useCallback(() => {
    setAppliedFilters({ ...filterInputs });
    setCurrentPage(1);
  }, [filterInputs]);

  const resetFilters = useCallback(() => {
    const empty = {
      date_debut: '',
      date_fin: '',
      login: '',
      adresse_ip: '',
      raison_echec: ''
    };
    setFilterInputs(empty);
    setAppliedFilters(empty);
    setCurrentPage(1);
  }, []);

  const deleteMutation = useMutation(
    async (id) => {
      const response = await api.delete(`/management/connexions-echouees/${id}`);
      return response.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('management-connexions-echouees');
        toast.success('Ligne supprimée');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de la suppression');
      }
    }
  );

  const handleDelete = (id) => {
    if (window.confirm('Supprimer cette entrée du journal ?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleExportCsv = async () => {
    try {
      const params = cleanParams({
        limit: 5000,
        offset: 0,
        ...appliedFilters
      });
      const response = await api.get('/management/connexions-echouees', { params });
      const list = response.data?.data ?? [];
      if (list.length === 0) {
        toast.info('Aucune donnée à exporter avec les filtres actuels');
        return;
      }
      const columns = [
        { key: 'id', label: 'ID' },
        { key: 'date_tentative', label: 'Date / heure' },
        { key: 'login', label: 'Login' },
        { key: 'id_utilisateur', label: 'Id utilisateur' },
        { key: 'utilisateur_pseudo', label: 'Pseudo' },
        { key: 'adresse_ip', label: 'Adresse IP' },
        { key: 'raison_echec', label: 'Raison (code)' },
        { key: 'raison_libelle', label: 'Raison' }
      ];
      const mapped = list.map((r) => ({
        ...r,
        date_tentative:
          r.date_tentative != null
            ? new Date(r.date_tentative).toLocaleString('fr-FR')
            : '',
        raison_libelle: raisonLabel(r.raison_echec)
      }));
      exportToCSV(mapped, columns, 'connexions_echouees');
      toast.success(`${list.length} ligne(s) exportée(s)`);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Erreur export');
    }
  };

  const formatDateCell = (v) => {
    if (v == null) return '—';
    try {
      return new Date(v).toLocaleString('fr-FR');
    } catch {
      return String(v);
    }
  };

  return (
    <div className="management-tab">
      <div className="tab-header">
        <h2>Connexions échouées</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Recharger la liste"
          >
            <FaSync /> Actualiser
          </button>
          <button type="button" className="btn-primary" onClick={handleExportCsv}>
            <FaFileExport /> Exporter CSV
          </button>
        </div>
      </div>

      <div
        className="search-bar"
        style={{ flexWrap: 'wrap', alignItems: 'flex-end', gap: '0.75rem', marginBottom: '1rem' }}
      >
        <div className="form-group" style={{ margin: 0, minWidth: '140px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
            Du
          </label>
          <input
            type="date"
            className="search-input"
            value={filterInputs.date_debut}
            onChange={(e) => setFilterInputs({ ...filterInputs, date_debut: e.target.value })}
          />
        </div>
        <div className="form-group" style={{ margin: 0, minWidth: '140px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
            Au
          </label>
          <input
            type="date"
            className="search-input"
            value={filterInputs.date_fin}
            onChange={(e) => setFilterInputs({ ...filterInputs, date_fin: e.target.value })}
          />
        </div>
        <div className="form-group" style={{ margin: 0, flex: '1 1 140px', minWidth: '120px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
            Login
          </label>
          <input
            type="text"
            className="search-input"
            placeholder="Contient…"
            value={filterInputs.login}
            onChange={(e) => setFilterInputs({ ...filterInputs, login: e.target.value })}
          />
        </div>
        <div className="form-group" style={{ margin: 0, flex: '1 1 120px', minWidth: '100px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
            IP
          </label>
          <input
            type="text"
            className="search-input"
            placeholder="Contient…"
            value={filterInputs.adresse_ip}
            onChange={(e) => setFilterInputs({ ...filterInputs, adresse_ip: e.target.value })}
          />
        </div>
        <div className="form-group" style={{ margin: 0, minWidth: '220px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
            Raison
          </label>
          <select
            className="search-input"
            value={filterInputs.raison_echec}
            onChange={(e) => setFilterInputs({ ...filterInputs, raison_echec: e.target.value })}
          >
            {RAISON_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn-primary" onClick={applyFilters}>
          <FaFilter /> Appliquer les filtres
        </button>
        <button type="button" className="btn-secondary" onClick={resetFilters}>
          Réinitialiser
        </button>
      </div>

      {isLoading ? (
        <LoadingSpinner text="Chargement du journal…" />
      ) : (
        <>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date / heure</th>
                  <th>Login</th>
                  <th>Utilisateur</th>
                  <th>IP</th>
                  <th>Raison</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length > 0 ? (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td data-label="Date :">{formatDateCell(row.date_tentative)}</td>
                      <td data-label="Login :">{row.login || '—'}</td>
                      <td data-label="Utilisateur :">
                        {row.id_utilisateur != null ? (
                          <span title={`ID ${row.id_utilisateur}`}>
                            {row.utilisateur_pseudo || `ID ${row.id_utilisateur}`}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td data-label="IP :">{row.adresse_ip || '—'}</td>
                      <td data-label="Raison :">
                        <span title={row.raison_echec}>{raisonLabel(row.raison_echec)}</span>
                      </td>
                      <td data-label="">
                        <button
                          type="button"
                          className="btn-icon btn-danger"
                          title="Supprimer cette entrée"
                          onClick={() => handleDelete(row.id)}
                          disabled={deleteMutation.isLoading}
                        >
                          <FaTrash />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="text-center">
                      Aucune tentative enregistrée (ou aucun résultat pour ces filtres).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={total}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(n) => {
              setItemsPerPage(n);
              setCurrentPage(1);
            }}
          />
        </>
      )}
    </div>
  );
};

export default ConnexionsEchoueesTab;
