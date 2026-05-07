import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { FaBell, FaTrash } from 'react-icons/fa';
import { toast } from 'react-toastify';
import api from '../config/api';

const SLOT_OPTIONS = [
  { value: '09:00:00', label: '9H' },
  { value: '11:00:00', label: '11H' },
  { value: '13:00:00', label: '13H' },
  { value: '16:00:00', label: '16H' },
  { value: '18:00:00', label: '18H' },
  { value: '19:30:00', label: '20H' },
];

const AlertePlanning = () => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    dep: '',
    slot_hour: '09:00:00',
    message: '',
  });

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

  const deleteMutation = useMutation(
    async (id) => {
      const res = await api.delete(`/planning-alerts/${id}`);
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('planning-alerts-list');
        toast.success('Alerte supprimée');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de la suppression');
      },
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.dep || !formData.slot_hour || !formData.message.trim()) {
      toast.warning('Département, créneau et message sont obligatoires');
      return;
    }
    saveMutation.mutate({
      dep: formData.dep,
      slot_hour: formData.slot_hour,
      message: formData.message.trim(),
    });
  };

  return (
    <div className="planning page-content">
      <div className="planning-header">
        <h1><FaBell /> Alerte Planning</h1>
      </div>

      <form onSubmit={handleSubmit} className="planning-controls" style={{ marginBottom: 16 }}>
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
        <div className="departement-selector" style={{ minWidth: 360 }}>
          <label>Message</label>
          <input
            type="text"
            value={formData.message}
            onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
            placeholder="Ex: !!9H:30"
          />
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
              <th>Créneau</th>
              <th>Message</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="4">Chargement...</td></tr>
            ) : (alertsData || []).length === 0 ? (
              <tr><td colSpan="4">Aucune alerte configurée</td></tr>
            ) : (
              (alertsData || []).map((a) => (
                <tr key={a.id}>
                  <td>{a.dep}</td>
                  <td>{a.slot_hour?.substring(0, 5)}</td>
                  <td>{a.message}</td>
                  <td>
                    <button
                      type="button"
                      className="nav-btn"
                      onClick={() => deleteMutation.mutate(a.id)}
                      disabled={deleteMutation.isLoading}
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

export default AlertePlanning;
