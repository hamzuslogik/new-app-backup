import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { FaBell, FaEdit, FaPlus, FaTimes, FaTrash } from 'react-icons/fa';
import { toast } from 'react-toastify';
import api from '../config/api';
import {
  enumeratePlanningWeekKeys,
  labelForPlanningWeekKey,
  utcPlanningWeekNumber,
} from '../utils/planningWeekKeys';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';
import './AlertePlanning.css';

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

const EMPTY_FORM = {
  id: null,
  dep: '',
  day_name: 'lundi',
  slot_hour: '09:00:00',
  message: '',
  visible_functions: [],
  weeks_all: true,
  selected_week_keys: [],
};

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

function parseFunctionIds(raw) {
  return String(raw || '')
    .split(',')
    .map((v) => parseInt(v, 10))
    .filter((n) => Number.isFinite(n));
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
  <div className="alerte-planning-field alerte-planning-field-full">
    <label>Semaines d’affichage</label>
    <div className="alerte-weeks-block">
      <label className="alerte-vis-option">
        <input
          type="checkbox"
          checked={weeks_all}
          onChange={(e) => onWeeksAllChange(e.target.checked)}
        />
        Toutes les semaines (toujours visible)
      </label>
      {!weeks_all && (
        <>
          <div className="alerte-weeks-toolbar">
            <button type="button" className="alerte-planning-btn alerte-planning-btn-ghost" onClick={selectAll}>
              Tout sélectionner
            </button>
            <button type="button" className="alerte-planning-btn alerte-planning-btn-ghost" onClick={clearAll}>
              Tout désélectionner
            </button>
          </div>
          <div className="alerte-weeks-list">
            {weekPickerKeys.map((key) => (
              <label key={key} className="alerte-weeks-option">
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
  useForceDesktopViewport('alerte-planning-page');
  const queryClient = useQueryClient();
  const baseWeekPickerKeys = useMemo(() => {
    const now = new Date();
    const refYear = now.getFullYear();
    const refWeek = utcPlanningWeekNumber(now);
    return enumeratePlanningWeekKeys(refYear, refWeek, 6, 30);
  }, []);

  const [modalForm, setModalForm] = useState(null);

  const weekPickerKeys = useMemo(() => {
    const s = new Set(baseWeekPickerKeys);
    (modalForm?.selected_week_keys || []).forEach((k) => s.add(k));
    return [...s].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [baseWeekPickerKeys, modalForm?.selected_week_keys]);

  const { data: departementsData } = useQuery('planning-alerts-departements', async () => {
    const res = await api.get('/planning/departements');
    return res.data?.data || [];
  });

  const { data: alertsData, isLoading } = useQuery('planning-alerts-list', async () => {
    const res = await api.get('/planning-alerts', { params: { active_only: 0 } });
    return res.data?.data || [];
  });

  const closeModal = () => setModalForm(null);

  const saveMutation = useMutation(
    async (payload) => {
      const res = await api.post('/planning-alerts', payload);
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('planning-alerts-list');
        toast.success('Alerte planning enregistrée');
        closeModal();
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
        closeModal();
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
        setModalForm((prev) => (prev?.id === id ? null : prev));
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

  const handleModalSubmit = (e) => {
    e.preventDefault();
    if (!modalForm) return;
    if (!modalForm.dep || !modalForm.day_name || !modalForm.slot_hour || !modalForm.message.trim() || modalForm.visible_functions.length === 0) {
      toast.warning('Département, jour, créneau, message et visibilité sont obligatoires');
      return;
    }
    if (!validateWeeks(modalForm)) return;
    const payload = buildPayloadCore(modalForm);
    if (modalForm.id) {
      updateMutation.mutate({ id: modalForm.id, payload });
    } else {
      saveMutation.mutate(payload);
    }
  };

  const toggleVisibilityFunction = (fonctionId) => {
    setModalForm((prev) => {
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

  const formatWeekVisibilityLabel = (raw) => {
    const v = String(raw ?? '*').trim();
    if (!v || v === '*') return 'Toutes les semaines';
    const parts = v.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length <= 3) {
      return parts.map((k) => labelForPlanningWeekKey(k)).join(' · ');
    }
    return `${parts.length} semaine(s) : ${parts.slice(0, 2).map((k) => labelForPlanningWeekKey(k)).join(' · ')}…`;
  };

  const formatWeekVisibilityTitle = (raw) => {
    const v = String(raw ?? '*').trim();
    if (!v || v === '*') return 'Toutes les semaines';
    return v.split(',').map((s) => s.trim()).filter(Boolean).map((k) => labelForPlanningWeekKey(k)).join('\n');
  };

  const toggleWeekKey = (key) => {
    setModalForm((prev) => {
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

  const isSaving = saveMutation.isLoading || updateMutation.isLoading;
  const isEdit = Boolean(modalForm?.id);

  return (
    <div className="alerte-planning-page">
      <div className="alerte-planning-header">
        <h1><FaBell /> Alerte Planning</h1>
        <button
          type="button"
          className="alerte-planning-btn alerte-planning-btn-primary"
          onClick={() => setModalForm({ ...EMPTY_FORM })}
        >
          <FaPlus /> Ajouter une alerte
        </button>
      </div>

      <div className="alerte-planning-table-wrap">
        <table className="alerte-planning-table">
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
              <tr><td className="alerte-planning-empty" colSpan="7">Chargement...</td></tr>
            ) : (alertsData || []).length === 0 ? (
              <tr><td className="alerte-planning-empty" colSpan="7">Aucune alerte configurée</td></tr>
            ) : (
              (alertsData || []).map((a) => {
                const visIds = parseFunctionIds(a.visible_functions);
                return (
                  <tr key={a.id}>
                    <td>{a.dep}</td>
                    <td>{DAY_OPTIONS.find((d) => d.value === a.day_name)?.label || a.day_name || '-'}</td>
                    <td>{SLOT_OPTIONS.find((s) => s.value === a.slot_hour)?.label || a.slot_hour?.substring(0, 5)}</td>
                    <td className="alerte-planning-message">{a.message}</td>
                    <td className="alerte-planning-weeks" title={formatWeekVisibilityTitle(a.week_visibility)}>
                      {formatWeekVisibilityLabel(a.week_visibility)}
                    </td>
                    <td>
                      <div className="alerte-vis-badges">
                        {visIds.length === 0 ? (
                          <span>-</span>
                        ) : (
                          visIds.map((id) => (
                            <span key={id} className="alerte-vis-badge">
                              {FUNCTION_OPTIONS.find((f) => f.value === id)?.label || `Fonction ${id}`}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="alerte-planning-actions">
                        <button
                          type="button"
                          className="alerte-planning-btn alerte-planning-btn-icon"
                          onClick={() => setModalForm(alertRowToEditState(a))}
                          title="Modifier"
                        >
                          <FaEdit />
                        </button>
                        <button
                          type="button"
                          className="alerte-planning-btn alerte-planning-btn-icon alerte-planning-btn-danger"
                          onClick={() => deleteMutation.mutate(a.id)}
                          disabled={deleteMutation.isLoading}
                          title="Supprimer"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {modalForm && (
        <div
          className="alerte-planning-overlay"
          role="presentation"
          onClick={closeModal}
        >
          <div
            className="alerte-planning-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="alerte-planning-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="alerte-planning-modal-header">
              <h2 id="alerte-planning-modal-title">
                {isEdit ? `Modifier l’alerte #${modalForm.id}` : 'Nouvelle alerte planning'}
              </h2>
              <button type="button" className="alerte-planning-modal-close" aria-label="Fermer" onClick={closeModal}>
                <FaTimes />
              </button>
            </div>
            <form className="alerte-planning-form" onSubmit={handleModalSubmit}>
              <div className="alerte-planning-form-grid">
                <div className="alerte-planning-field">
                  <label>Département</label>
                  <select
                    value={modalForm.dep}
                    onChange={(e) => setModalForm((prev) => ({ ...prev, dep: e.target.value }))}
                  >
                    <option value="">Sélectionner</option>
                    {(departementsData || []).map((d) => {
                      const code = d.code || d.departement_code || '';
                      const nom = d.nom || d.departement_nom_uppercase || d.departement_nom || '';
                      return <option key={code} value={code}>{code} - {nom}</option>;
                    })}
                  </select>
                </div>
                <div className="alerte-planning-field">
                  <label>Jour</label>
                  <select
                    value={modalForm.day_name}
                    onChange={(e) => setModalForm((prev) => ({ ...prev, day_name: e.target.value }))}
                  >
                    {DAY_OPTIONS.map((day) => (
                      <option key={day.value} value={day.value}>{day.label}</option>
                    ))}
                  </select>
                </div>
                <div className="alerte-planning-field">
                  <label>Créneau</label>
                  <select
                    value={modalForm.slot_hour}
                    onChange={(e) => setModalForm((prev) => ({ ...prev, slot_hour: e.target.value }))}
                  >
                    {SLOT_OPTIONS.map((slot) => (
                      <option key={slot.value} value={slot.value}>{slot.label}</option>
                    ))}
                  </select>
                </div>
                <div className="alerte-planning-field alerte-planning-field-full">
                  <label>Message</label>
                  <input
                    type="text"
                    value={modalForm.message}
                    onChange={(e) => setModalForm((prev) => ({ ...prev, message: e.target.value }))}
                    placeholder="Ex: !!9H:30"
                  />
                </div>
                <div className="alerte-planning-field alerte-planning-field-full">
                  <label>Visibilité (fonctions)</label>
                  <div className="alerte-vis-grid">
                    {FUNCTION_OPTIONS.map((opt) => (
                      <label key={opt.value} className="alerte-vis-option">
                        <input
                          type="checkbox"
                          checked={modalForm.visible_functions.includes(opt.value)}
                          onChange={() => toggleVisibilityFunction(opt.value)}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
                <WeekPickerBlock
                  weeks_all={modalForm.weeks_all}
                  selected_week_keys={modalForm.selected_week_keys}
                  weekPickerKeys={weekPickerKeys}
                  onWeeksAllChange={(checked) =>
                    setModalForm((prev) => ({
                      ...prev,
                      weeks_all: checked,
                      selected_week_keys: checked ? [] : prev.selected_week_keys,
                    }))
                  }
                  toggleWeekKey={toggleWeekKey}
                  selectAll={() => setModalForm((prev) => ({ ...prev, selected_week_keys: [...weekPickerKeys] }))}
                  clearAll={() => setModalForm((prev) => ({ ...prev, selected_week_keys: [] }))}
                />
              </div>
              <div className="alerte-planning-modal-footer">
                <button type="button" className="alerte-planning-btn alerte-planning-btn-secondary" onClick={closeModal}>
                  Annuler
                </button>
                <button type="submit" className="alerte-planning-btn alerte-planning-btn-primary" disabled={isSaving}>
                  {isSaving ? 'Enregistrement…' : (isEdit ? 'Enregistrer' : 'Ajouter')}
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
