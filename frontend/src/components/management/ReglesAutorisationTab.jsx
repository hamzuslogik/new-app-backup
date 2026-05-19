import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import api from '../../config/api';
import { FaEdit, FaTrash, FaPlus, FaSearch, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import LoadingSpinner from '../common/LoadingSpinner';
import useKeyboardShortcuts from '../../hooks/useKeyboardShortcuts';
import useLocalStorage from '../../hooks/useLocalStorage';
import './ManagementTab.css';

const emptyForm = {
  libelle: '',
  actif: 1,
  id_etat_final: '',
  date_insert_debut: '',
  date_insert_fin: '',
  date_appel_debut: '',
  date_appel_fin: '',
  priorite: 0,
  centre_ids: [],
};

const ReglesAutorisationTab = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [searchTerm, setSearchTerm] = useLocalStorage('management_regles-autorisation_search', '');
  const queryClient = useQueryClient();

  useKeyboardShortcuts({
    escape: () => {
      if (showForm) {
        setShowForm(false);
        setEditingId(null);
        setFormData(emptyForm);
      }
    },
    'ctrl+s': (e) => {
      if (showForm) {
        e.preventDefault();
        const form = document.querySelector('.regles-autorisation-form');
        if (form) form.requestSubmit();
      }
    },
  }, [showForm]);

  const { data, isLoading } = useQuery('regles-autorisation', async () => {
    const response = await api.get('/management/regles-autorisation');
    return response.data.data || [];
  });

  const { data: centresData } = useQuery('centres', async () => {
    const response = await api.get('/management/centres');
    return response.data.data || [];
  });

  const { data: etatsData } = useQuery('etats', async () => {
    const response = await api.get('/management/etats');
    return response.data.data || [];
  });

  const filteredData = useMemo(() => {
    if (!data) return [];
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(
      (item) =>
        item.libelle?.toLowerCase().includes(term) ||
        item.id?.toString().includes(term) ||
        (item.centres || []).some((c) => c.centre_titre?.toLowerCase().includes(term))
    );
  }, [data, searchTerm]);

  const createMutation = useMutation(
    (payload) => api.post('/management/regles-autorisation', payload),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('regles-autorisation');
        toast.success('Règle créée');
        setShowForm(false);
        setFormData(emptyForm);
      },
      onError: (e) => toast.error(e.response?.data?.message || 'Erreur création'),
    }
  );

  const updateMutation = useMutation(
    ({ id, payload }) => api.put(`/management/regles-autorisation/${id}`, payload),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('regles-autorisation');
        toast.success('Règle mise à jour');
        setShowForm(false);
        setEditingId(null);
        setFormData(emptyForm);
      },
      onError: (e) => toast.error(e.response?.data?.message || 'Erreur mise à jour'),
    }
  );

  const deleteMutation = useMutation(
    (id) => api.delete(`/management/regles-autorisation/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('regles-autorisation');
        toast.success('Règle supprimée');
      },
      onError: (e) => toast.error(e.response?.data?.message || 'Erreur suppression'),
    }
  );

  const handleEdit = (rule) => {
    setEditingId(rule.id);
    setFormData({
      libelle: rule.libelle || '',
      actif: rule.actif ? 1 : 0,
      id_etat_final: rule.id_etat_final != null ? String(rule.id_etat_final) : '',
      date_insert_debut: rule.date_insert_debut ? String(rule.date_insert_debut).slice(0, 10) : '',
      date_insert_fin: rule.date_insert_fin ? String(rule.date_insert_fin).slice(0, 10) : '',
      date_appel_debut: rule.date_appel_debut ? String(rule.date_appel_debut).slice(0, 10) : '',
      date_appel_fin: rule.date_appel_fin ? String(rule.date_appel_fin).slice(0, 10) : '',
      priorite: rule.priorite ?? 0,
      centre_ids: rule.centre_ids || [],
    });
    setShowForm(true);
  };

  const toggleCentre = (idCentre) => {
    const n = Number(idCentre);
    setFormData((prev) => {
      const has = prev.centre_ids.includes(n);
      return {
        ...prev,
        centre_ids: has
          ? prev.centre_ids.filter((c) => c !== n)
          : [...prev.centre_ids, n],
      };
    });
  };

  const buildPayload = () => ({
    libelle: formData.libelle,
    actif: formData.actif ? 1 : 0,
    id_etat_final: formData.id_etat_final || null,
    date_insert_debut: formData.date_insert_debut || null,
    date_insert_fin: formData.date_insert_fin || null,
    date_appel_debut: formData.date_appel_debut || null,
    date_appel_fin: formData.date_appel_fin || null,
    priorite: parseInt(formData.priorite, 10) || 0,
    centre_ids: formData.centre_ids,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = buildPayload();
    if (editingId) {
      updateMutation.mutate({ id: editingId, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const formatRange = (debut, fin) => {
    if (!debut && !fin) return '—';
    if (debut && fin) return `${debut} → ${fin}`;
    if (debut) return `≥ ${debut}`;
    return `≤ ${fin}`;
  };

  const getEtatTitre = (id) => {
    if (id == null) return 'Tous';
    const e = (etatsData || []).find((x) => Number(x.id) === Number(id));
    return e?.titre || `#${id}`;
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="management-tab regles-autorisation-tab">
      <div className="tab-header">
        <div>
          <h2>Règles d&apos;autorisation automatique</h2>
          <p className="tab-description">
            Lors de la création d&apos;une fiche en doublon, si la fiche existante correspond à une règle active,
            elle est acceptée automatiquement (archive l&apos;ancienne, insère la nouvelle).
          </p>
        </div>
        <button
          type="button"
          className="btn-add"
          onClick={() => {
            setEditingId(null);
            setFormData(emptyForm);
            setShowForm(true);
          }}
        >
          <FaPlus /> Nouvelle règle
        </button>
      </div>

      <div className="search-bar">
        <FaSearch />
        <input
          type="text"
          placeholder="Rechercher une règle…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {showForm && (
        <div className="form-overlay">
          <div className="form-content regles-autorisation-form-panel">
            <h3>{editingId ? 'Modifier la règle' : 'Nouvelle règle'}</h3>
            <form className="form-content regles-autorisation-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Libellé *</label>
                <input
                  type="text"
                  value={formData.libelle}
                  onChange={(e) => setFormData({ ...formData, libelle: e.target.value })}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Priorité</label>
                  <input
                    type="number"
                    value={formData.priorite}
                    onChange={(e) => setFormData({ ...formData, priorite: e.target.value })}
                    title="Plus la valeur est élevée, plus la règle est évaluée en premier"
                  />
                </div>
                <div className="form-group">
                  <label>Active</label>
                  <select
                    value={formData.actif}
                    onChange={(e) => setFormData({ ...formData, actif: parseInt(e.target.value, 10) })}
                  >
                    <option value={1}>Oui</option>
                    <option value={0}>Non</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>État fiche existante</label>
                  <select
                    value={formData.id_etat_final}
                    onChange={(e) => setFormData({ ...formData, id_etat_final: e.target.value })}
                  >
                    <option value="">Tous les états</option>
                    {(etatsData || []).map((et) => (
                      <option key={et.id} value={et.id}>{et.titre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Date insertion — début</label>
                  <input
                    type="date"
                    value={formData.date_insert_debut}
                    onChange={(e) => setFormData({ ...formData, date_insert_debut: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Date insertion — fin</label>
                  <input
                    type="date"
                    value={formData.date_insert_fin}
                    onChange={(e) => setFormData({ ...formData, date_insert_fin: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Date appel — début</label>
                  <input
                    type="date"
                    value={formData.date_appel_debut}
                    onChange={(e) => setFormData({ ...formData, date_appel_debut: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Date appel — fin</label>
                  <input
                    type="date"
                    value={formData.date_appel_fin}
                    onChange={(e) => setFormData({ ...formData, date_appel_fin: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Centres (vide = tous les centres)</label>
                <div className="centres-checkbox-grid">
                  {(centresData || []).map((c) => (
                    <label key={c.id} className="centre-checkbox">
                      <input
                        type="checkbox"
                        checked={formData.centre_ids.includes(Number(c.id))}
                        onChange={() => toggleCentre(c.id)}
                      />
                      {c.titre}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    setFormData(emptyForm);
                  }}
                >
                  Annuler
                </button>
                <button type="submit" className="btn-save" disabled={createMutation.isLoading || updateMutation.isLoading}>
                  {editingId ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Priorité</th>
              <th>Libellé</th>
              <th>État</th>
              <th>Centres</th>
              <th>Date insertion</th>
              <th>Date appel</th>
              <th>Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center' }}>
                  Aucune règle. Exécutez le script SQL si la table n&apos;existe pas encore.
                </td>
              </tr>
            ) : (
              filteredData.map((rule) => (
                <tr key={rule.id}>
                  <td>{rule.priorite}</td>
                  <td><strong>{rule.libelle}</strong></td>
                  <td>{getEtatTitre(rule.id_etat_final)}</td>
                  <td>
                    {(rule.centres || []).length === 0
                      ? 'Tous'
                      : rule.centres.map((c) => c.centre_titre || c.id_centre).join(', ')}
                  </td>
                  <td>{formatRange(rule.date_insert_debut, rule.date_insert_fin)}</td>
                  <td>{formatRange(rule.date_appel_debut, rule.date_appel_fin)}</td>
                  <td>
                    {rule.actif ? (
                      <span className="badge badge-success"><FaCheckCircle /> Oui</span>
                    ) : (
                      <span className="badge badge-muted"><FaTimesCircle /> Non</span>
                    )}
                  </td>
                  <td>
                    <button type="button" className="btn-edit" onClick={() => handleEdit(rule)} title="Modifier">
                      <FaEdit />
                    </button>
                    <button
                      type="button"
                      className="btn-delete"
                      onClick={() => {
                        if (window.confirm(`Supprimer la règle « ${rule.libelle} » ?`)) {
                          deleteMutation.mutate(rule.id);
                        }
                      }}
                      title="Supprimer"
                    >
                      <FaTrash />
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

export default ReglesAutorisationTab;
