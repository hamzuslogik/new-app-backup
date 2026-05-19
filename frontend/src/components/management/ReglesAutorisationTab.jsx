import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import api from '../../config/api';
import { FaEdit, FaTrash, FaPlus, FaSearch, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import LoadingSpinner from '../common/LoadingSpinner';
import useKeyboardShortcuts from '../../hooks/useKeyboardShortcuts';
import useLocalStorage from '../../hooks/useLocalStorage';
import './ManagementTab.css';

const OPERATEURS = [
  { value: '', label: '— (aucun)' },
  { value: '<', label: '<' },
  { value: '<=', label: '<=' },
  { value: '>', label: '>' },
  { value: '>=', label: '>=' },
];

const UNITES = [
  { value: '', label: '—' },
  { value: 'jour', label: 'Jours' },
  { value: 'mois', label: 'Mois' },
  { value: 'annee', label: 'Années' },
];

const UNITE_LABELS = { jour: 'jours', mois: 'mois', annee: 'années' };

const emptyDateCritere = { operateur: '', valeur: '', unite: '' };

const emptyForm = {
  libelle: '',
  actif: 1,
  id_etat_final: '',
  date_insert: { ...emptyDateCritere },
  date_appel: { ...emptyDateCritere },
  priorite: 0,
  centre_ids: [],
};

function formatDateCritere(rule, prefix) {
  const op = rule[`${prefix}_operateur`];
  const val = rule[`${prefix}_valeur`];
  const unite = rule[`${prefix}_unite`];
  if (!op || val == null || val === '' || !unite) return '—';
  const u = UNITE_LABELS[unite] || unite;
  return `${op} ${val} ${u}`;
}

function DateCritereRow({ label, hint, value, onChange }) {
  const set = (field, v) => onChange({ ...value, [field]: v });
  const hasCritere = value.operateur && value.valeur !== '' && value.unite;

  return (
    <div className="form-group date-critere-row">
      <label>{label}</label>
      {hint && <p className="date-critere-hint">{hint}</p>}
      <div className="date-critere-fields">
        <select
          value={value.operateur}
          onChange={(e) => set('operateur', e.target.value)}
          title="Opérateur"
        >
          {OPERATEURS.map((o) => (
            <option key={o.value || 'none'} value={o.value}>{o.label}</option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          step={1}
          placeholder="1, 2, 3…"
          value={value.valeur}
          onChange={(e) => set('valeur', e.target.value)}
          disabled={!value.operateur}
        />
        <select
          value={value.unite}
          onChange={(e) => set('unite', e.target.value)}
          disabled={!value.operateur}
          title="Unité"
        >
          {UNITES.map((u) => (
            <option key={u.value || 'none'} value={u.value}>{u.label}</option>
          ))}
        </select>
      </div>
      {hasCritere && (
        <span className="date-critere-preview">
          Ex. : fiche avec {label.toLowerCase()} il y a {value.operateur} {value.valeur}{' '}
          {UNITE_LABELS[value.unite] || value.unite}
        </span>
      )}
    </div>
  );
}

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

  const readDateCritereFromRule = (rule, prefix) => ({
    operateur: rule[`${prefix}_operateur`] || '',
    valeur: rule[`${prefix}_valeur`] != null ? String(rule[`${prefix}_valeur`]) : '',
    unite: rule[`${prefix}_unite`] || '',
  });

  const handleEdit = (rule) => {
    setEditingId(rule.id);
    setFormData({
      libelle: rule.libelle || '',
      actif: rule.actif ? 1 : 0,
      id_etat_final: rule.id_etat_final != null ? String(rule.id_etat_final) : '',
      date_insert: readDateCritereFromRule(rule, 'date_insert'),
      date_appel: readDateCritereFromRule(rule, 'date_appel'),
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

  const appendDateCritereToPayload = (payload, prefix, critere) => {
    if (critere.operateur && critere.valeur !== '' && critere.unite) {
      payload[`${prefix}_operateur`] = critere.operateur;
      payload[`${prefix}_valeur`] = parseInt(critere.valeur, 10);
      payload[`${prefix}_unite`] = critere.unite;
    } else {
      payload[`${prefix}_operateur`] = null;
      payload[`${prefix}_valeur`] = null;
      payload[`${prefix}_unite`] = null;
    }
  };

  const buildPayload = () => {
    const payload = {
      libelle: formData.libelle,
      actif: formData.actif ? 1 : 0,
      id_etat_final: formData.id_etat_final || null,
      priorite: parseInt(formData.priorite, 10) || 0,
      centre_ids: formData.centre_ids,
    };
    appendDateCritereToPayload(payload, 'date_insert', formData.date_insert);
    appendDateCritereToPayload(payload, 'date_appel', formData.date_appel);
    return payload;
  };

  const validateDateCriteres = () => {
    for (const [key, label] of [
      ['date_insert', 'Date insertion'],
      ['date_appel', 'Date appel'],
    ]) {
      const c = formData[key];
      const partial = !!(c.operateur || c.valeur !== '' || c.unite);
      const complete = !!(c.operateur && c.valeur !== '' && c.unite);
      if (partial && !complete) {
        toast.error(`${label} : renseignez opérateur, valeur et unité, ou laissez tout vide.`);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateDateCriteres()) return;
    const payload = buildPayload();
    if (editingId) {
      updateMutation.mutate({ id: editingId, payload });
    } else {
      createMutation.mutate(payload);
    }
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
            Lors d&apos;un doublon téléphone, si la fiche existante correspond (état, centre, âge des dates),
            la nouvelle fiche est acceptée automatiquement. Les dates se comparent à aujourd&apos;hui :
            ex. <strong>&lt; 3 mois</strong> = insérée ou appelée il y a moins de 3 mois.
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

              <DateCritereRow
                label="Date insertion"
                hint="Âge depuis date_insert_time de la fiche existante (par rapport à aujourd'hui)."
                value={formData.date_insert}
                onChange={(date_insert) => setFormData({ ...formData, date_insert })}
              />

              <DateCritereRow
                label="Date appel"
                hint="Âge depuis date_appel_time ou date_appel de la fiche existante."
                value={formData.date_appel}
                onChange={(date_appel) => setFormData({ ...formData, date_appel })}
              />

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
                  <td>{formatDateCritere(rule, 'date_insert')}</td>
                  <td>{formatDateCritere(rule, 'date_appel')}</td>
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
