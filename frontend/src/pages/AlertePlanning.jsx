import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { FaBell, FaEdit, FaTimes, FaTrash } from 'react-icons/fa';
import { toast } from 'react-toastify';
import api from '../config/api';
import {
  enumeratePlanningWeekKeys,
  labelForPlanningWeekKey,
  utcPlanningWeekNumber,
} from '../utils/planningWeekKeys';

const SLOT_OPTIONS = [
  { value: '09:00:00', label: '9H' },
  { value: '11:00:00', label: '11H' },
  { value: '13:00:00', label: '13H' },
  { value: '16:00:00', label: '16H' },
  { value: '18:00:00', label: '18H' },
  { value: '19:30:00', label: '20H' },
];
const DAY_OPTIONS = [
  { value: 'lundi', label: 'Lundi' },
  { value: 'mardi', label: 'Mardi' },
  { value: 'mercredi', label: 'Mercredi' },
  { value: 'jeudi', label: 'Jeudi' },
  { value: 'vendredi', label: 'Vendredi' },
];
const FUNCTION_OPTIONS = [
  { value: 1, label: 'Administrateur' },
  { value: 2, label: 'RE Qualification' },
  { value: 3, label: 'Agent Qualification' },
  { value: 5, label: 'Commercial' },
  { value: 6, label: 'Confirmateur' },
  { value: 7, label: 'Resp. ADV' },
  { value: 8, label: 'Qualité Qualification' },
  { value: 11, label: 'Backoffice' },
  { value: 12, label: 'RP Qualification' },
  { value: 13, label: 'RP Confirmation' },
  { value: 14, label: 'RE Confirmation' },
];

function alertRowToEditState(a) {
  const v = String(a.week_visibility ?? '*').trim();
  const weeks_all = !v || v === '*';
  const selected_week_keys = weeks_all ? [] : v.split(',').map((s) => s.trim()).filter(Boolean);
  const vf = String(a.visible_functions || '')
    .split(',')
    .map((x) => parseInt(x.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return {
    id: a.id,
    dep: a.dep || '',
    day_name: a.day_name || 'lundi',
    slot_hour: a.slot_hour || '09:00:00',
    message: a.message || '',
    visible_functions: vf,
    weeks_all,
    selected_week_keys,
  };
}

const WeekPickerBlock = ({
  weeks_all,
  selected_week_keys,
  weekPickerKeys,
  onWeeksAllChange,
  toggleWeekKey,
  selectAll,
  clearAll,
}) => (
  <div className="departement-selector" style={{ minWidth: 280, maxWidth: 440 }}>
    <label>Semaines d’affichage</label>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="checkbox"
          checked={weeks_all}
          onChange={(e) => onWeeksAllChange(e.target.checked)}
        />
        Toutes les semaines (toujours visible)
      </label>
      {!weeks_all && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="nav-btn" style={{ fontSize: 12, padding: '4px 10px' }} onClick={selectAll}>
              Tout sélectionner
            </button>
            <button type="button" className="nav-btn" style={{ fontSize: 12, padding: '4px 10px' }} onClick={clearAll}>
              Tout désélectionner
            </button>
          </div>
          <div
            style={{
              maxHeight: 220,
              overflowY: 'auto',
              border: '1px solid #cfd8dc',
              borderRadius: 6,
              padding: 8,
              background: '#fafafa',
            }}
          >
            {weekPickerKeys.map((key) => (
              <label
                key={key}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, marginBottom: 6, cursor: 'pointer' }}
              >
                <input type="checkbox" checked={selected_week_keys.includes(key)} onChange={() => toggleWeekKey(key)} />
                <span>{labelForPlanningWeekKey(key)}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  </div>
);

const AlertePlanning = () => {
  const queryClient = useQueryClient();
  const baseWeekPickerKeys = useMemo(() => {
    const now = new Date();
    const refYear = now.getFullYear();
    const refWeek = utcPlanningWeekNumber(now);
    return enumeratePlanningWeekKeys(refYear, refWeek, 6, 30);
  }, []);

  const [formData, setFormData] = useState({
    dep: '',
    day_name: 'lundi',
    slot_hour: '09:00:00',
    message: '',
    visible_functions: [],
    weeks_all: true,
    selected_week_keys: [],
  });

  const [editForm, setEditForm] = useState(null);

  const editWeekPickerKeys = useMemo(() => {
    const s = new Set(baseWeekPickerKeys);
    (editForm?.selected_week_keys || []).forEach((k) => s.add(k));
    return [...s].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [baseWeekPickerKeys, editForm?.selected_week_keys]);

  const { data: departementsData } = useQuery('planning-alerts-departements', async () => {
    const res = await api.get('/planning/departements');
    return res.data?.data || [];
  });

  const { data: alertsData, isLoading } = useQuery('planning-alerts-list', async () => {
    const res = await api.get('/planning-alerts', { params: { active_only: 0 } });
    return res.data?.data || [];
  });

  const saveMutation = useMutation(
    async (payload) => {
      const res = await api.post('/planning-alerts', payload);
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('planning-alerts-list');
        toast.success('Alerte planning enregistrée');
        setFormData((prev) => ({ ...prev, message: '' }));
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de l\'enregistrement');
      },
    }
  );

  const updateMutation = useMutation(
    async ({ id, payload }) => {
      const res = await api.put(`/planning-alerts/${id}`, payload);
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('planning-alerts-list');
        toast.success('Alerte mise à jour');
        setEditForm(null);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de la mise à jour');
      },
    }
  );

  const deleteMutation = useMutation(
    async (id) => {
      const res = await api.delete(`/planning-alerts/${id}`);
      return res.data;
    },
    {
      onSuccess: (_, id) => {
        queryClient.invalidateQueries('planning-alerts-list');
        toast.success('Alerte supprimée');
        setEditForm((prev) => (prev?.id === id ? null : prev));
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de la suppression');
      },
    }
  );

  const buildPayloadCore = (data) => ({
    dep: data.dep,
    day_name: data.day_name,
    slot_hour: data.slot_hour,
    message: data.message.trim(),
    visible_functions: data.visible_functions,
    weeks_all: data.weeks_all,
    week_keys: data.weeks_all ? [] : data.selected_week_keys,
  });

  const validateWeeks = (data) => {
    if (!data.weeks_all && (!data.selected_week_keys || data.selected_week_keys.length === 0)) {
      toast.warning('Cochez « Toutes les semaines » ou sélectionnez au moins une semaine');
      return false;
    }
    return true;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.dep || !formData.day_name || !formData.slot_hour || !formData.message.trim() || formData.visible_functions.length === 0) {
      toast.warning('Département, jour, créneau, message et visibilité sont obligatoires');
      return;
    }
    if (!validateWeeks(formData)) return;
    saveMutation.mutate(buildPayloadCore(formData));
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editForm) return;
    if (!editForm.dep || !editForm.day_name || !editForm.slot_hour || !editForm.message.trim() || editForm.visible_functions.length === 0) {
      toast.warning('Tous les champs obligatoires ne sont pas remplis');
      return;
    }
    if (!validateWeeks(editForm)) return;
    updateMutation.mutate({ id: editForm.id, payload: buildPayloadCore(editForm) });
  };

  const toggleVisibilityFunction = (fonctionId) => {
    setFormData((prev) => {
      const exists = prev.visible_functions.includes(fonctionId);
      return {
        ...prev,
        visible_functions: exists
          ? prev.visible_functions.filter((id) => id !== fonctionId)
          : [...prev.visible_functions, fonctionId],
      };
    });
  };

  const toggleEditVisibilityFunction = (fonctionId) => {
    setEditForm((prev) => {
      if (!prev) return prev;
      const exists = prev.visible_functions.includes(fonctionId);
      return {
        ...prev,
        visible_functions: exists
          ? prev.visible_functions.filter((id) => id !== fonctionId)
          : [...prev.visible_functions, fonctionId],
      };
    });
  };

  const formatVisibilityLabel = (raw) => {
    const ids = String(raw || '')
      .split(',')
      .map((v) => parseInt(v, 10))
      .filter((n) => Number.isFinite(n));
    if (ids.length === 0) return '-';
    return ids
      .map((id) => FUNCTION_OPTIONS.find((f) => f.value === id)?.label || `Fonction ${id}`)
      .join(', ');
  };

  const formatWeekVisibilityLabel = (raw) => {
    const v = String(raw ?? '*').trim();
    if (!v || v === '*') return 'Toutes les semaines';
    const parts = v.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length <= 3) {
      return parts.map((k) => labelForPlanningWeekKey(k)).join(' · ');
    }
    return `${parts.length} semaine(s) : ${parts.slice(0, 2).map((k) => labelForPlanningWeekKey(k)).join(' · ')}…`;
  };

  const toggleWeekKeyForm = (key) => {
    setFormData((prev) => {
      const has = prev.selected_week_keys.includes(key);
      return {
        ...prev,
        selected_week_keys: has
          ? prev.selected_week_keys.filter((k) => k !== key)
          : [...prev.selected_week_keys, key],
      };
    });
  };

  const toggleWeekKeyEdit = (key) => {
    setEditForm((prev) => {
      if (!prev) return prev;
      const has = prev.selected_week_keys.includes(key);
      return {
        ...prev,
        selected_week_keys: has
          ? prev.selected_week_keys.filter((k) => k !== key)
          : [...prev.selected_week_keys, key],
      };
    });
  };

  return (
    <div className="planning page-content">
      <div className="planning-header">
        <h1><FaBell /> Alerte Planning</h1>
      </div>

      <form onSubmit={handleSubmit} className="planning-controls" style={{ marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>
        <div className="departement-selector">
          <label>Département</label>
          <select
            value={formData.dep}
            onChange={(e) => setFormData((prev) => ({ ...prev, dep: e.target.value }))}
          >
            <option value="">Sélectionner</option>
            {(departementsData || []).map((d) => {
              const code = d.code || d.departement_code || '';
              const nom = d.nom || d.departement_nom_uppercase || d.departement_nom || '';
              return <option key={code} value={code}>{code} - {nom}</option>;
            })}
          </select>
        </div>
        <div className="departement-selector">
          <label>Jour</label>
          <select
            value={formData.day_name}
            onChange={(e) => setFormData((prev) => ({ ...prev, day_name: e.target.value }))}
          >
            {DAY_OPTIONS.map((day) => (
              <option key={day.value} value={day.value}>{day.label}</option>
            ))}
          </select>
        </div>
        <div className="departement-selector">
          <label>Créneau</label>
          <select
            value={formData.slot_hour}
            onChange={(e) => setFormData((prev) => ({ ...prev, slot_hour: e.target.value }))}
          >
            {SLOT_OPTIONS.map((slot) => (
              <option key={slot.value} value={slot.value}>{slot.label}</option>
            ))}
          </select>
        </div>
        <div className="departement-selector" style={{ minWidth: 280 }}>
          <label>Message</label>
          <input
            type="text"
            value={formData.message}
            onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
            placeholder="Ex: !!9H:30"
          />
        </div>
        <WeekPickerBlock
          weeks_all={formData.weeks_all}
          selected_week_keys={formData.selected_week_keys}
          weekPickerKeys={baseWeekPickerKeys}
          onWeeksAllChange={(checked) =>
            setFormData((prev) => ({
              ...prev,
              weeks_all: checked,
              selected_week_keys: checked ? [] : prev.selected_week_keys,
            }))
          }
          toggleWeekKey={toggleWeekKeyForm}
          selectAll={() => setFormData((prev) => ({ ...prev, selected_week_keys: [...baseWeekPickerKeys] }))}
          clearAll={() => setFormData((prev) => ({ ...prev, selected_week_keys: [] }))}
        />
        <div className="departement-selector" style={{ minWidth: 320 }}>
          <label>Visibilité (fonctions)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxWidth: 400 }}>
            {FUNCTION_OPTIONS.map((opt) => (
              <label key={opt.value} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="checkbox"
                  checked={formData.visible_functions.includes(opt.value)}
                  onChange={() => toggleVisibilityFunction(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
        <button type="submit" className="nav-btn" disabled={saveMutation.isLoading}>
          {saveMutation.isLoading ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </form>

      <div className="planning-table-container">
        <table className="planning-table">
          <thead>
            <tr>
              <th>Département</th>
              <th>Jour</th>
              <th>Créneau</th>
              <th>Message</th>
              <th>Semaines</th>
              <th>Visibilité</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="7">Chargement...</td></tr>
            ) : (alertsData || []).length === 0 ? (
              <tr><td colSpan="7">Aucune alerte configurée</td></tr>
            ) : (
              (alertsData || []).map((a) => (
                <tr key={a.id}>
                  <td>{a.dep}</td>
                  <td>{DAY_OPTIONS.find((d) => d.value === a.day_name)?.label || a.day_name || '-'}</td>
                  <td>{a.slot_hour?.substring(0, 5)}</td>
                  <td>{a.message}</td>
                  <td style={{ maxWidth: 280, fontSize: 12, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                    {formatWeekVisibilityLabel(a.week_visibility)}
                  </td>
                  <td>{formatVisibilityLabel(a.visible_functions)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="nav-btn"
                        onClick={() => setEditForm(alertRowToEditState(a))}
                        title="Modifier"
                      >
                        <FaEdit />
                      </button>
                      <button
                        type="button"
                        className="nav-btn"
                        onClick={() => deleteMutation.mutate(a.id)}
                        disabled={deleteMutation.isLoading}
                        title="Supprimer"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editForm && (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.5)',
            zIndex: 4000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setEditForm(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="alerte-planning-edit-title"
            style={{
              background: '#fff',
              borderRadius: 10,
              maxWidth: 640,
              width: '100%',
              maxHeight: '92vh',
              overflow: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,.18)',
              padding: 22,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 id="alerte-planning-edit-title" style={{ margin: 0, fontSize: 18, color: '#1a2529' }}>
                Modifier l’alerte #{editForm.id}
              </h2>
              <button type="button" className="nav-btn" aria-label="Fermer" onClick={() => setEditForm(null)}>
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="departement-selector">
                <label>Département</label>
                <select
                  value={editForm.dep}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, dep: e.target.value }))}
                >
                  <option value="">Sélectionner</option>
                  {(departementsData || []).map((d) => {
                    const code = d.code || d.departement_code || '';
                    const nom = d.nom || d.departement_nom_uppercase || d.departement_nom || '';
                    return <option key={code} value={code}>{code} - {nom}</option>;
                  })}
                </select>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <div className="departement-selector">
                  <label>Jour</label>
                  <select
                    value={editForm.day_name}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, day_name: e.target.value }))}
                  >
                    {DAY_OPTIONS.map((day) => (
                      <option key={day.value} value={day.value}>{day.label}</option>
                    ))}
                  </select>
                </div>
                <div className="departement-selector">
                  <label>Créneau</label>
                  <select
                    value={editForm.slot_hour}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, slot_hour: e.target.value }))}
                  >
                    {SLOT_OPTIONS.map((slot) => (
                      <option key={slot.value} value={slot.value}>{slot.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="departement-selector">
                <label>Message</label>
                <input
                  type="text"
                  value={editForm.message}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, message: e.target.value }))}
                />
              </div>
              <WeekPickerBlock
                weeks_all={editForm.weeks_all}
                selected_week_keys={editForm.selected_week_keys}
                weekPickerKeys={editWeekPickerKeys}
                onWeeksAllChange={(checked) =>
                  setEditForm((prev) => ({
                    ...prev,
                    weeks_all: checked,
                    selected_week_keys: checked ? [] : prev.selected_week_keys,
                  }))
                }
                toggleWeekKey={toggleWeekKeyEdit}
                selectAll={() =>
                  setEditForm((prev) => ({ ...prev, selected_week_keys: [...editWeekPickerKeys] }))
                }
                clearAll={() => setEditForm((prev) => ({ ...prev, selected_week_keys: [] }))}
              />
              <div className="departement-selector">
                <label>Visibilité (fonctions)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {FUNCTION_OPTIONS.map((opt) => (
                    <label key={opt.value} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input
                        type="checkbox"
                        checked={editForm.visible_functions.includes(opt.value)}
                        onChange={() => toggleEditVisibilityFunction(opt.value)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" className="nav-btn" onClick={() => setEditForm(null)}>
                  Annuler
                </button>
                <button type="submit" className="nav-btn" disabled={updateMutation.isLoading}>
                  {updateMutation.isLoading ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertePlanning;
