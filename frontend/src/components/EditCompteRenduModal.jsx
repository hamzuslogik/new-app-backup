import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import api from '../config/api';
import { FaTimes } from 'react-icons/fa';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import './EditCompteRenduModal.css';

const EditCompteRenduModal = ({ compteRendu, etats, onClose, onSave, isLoading }) => {
  // Bloquer le scroll du body quand le modal est ouvert
  useModalScrollLock(true);
  const [formData, setFormData] = useState({
    id_etat_final: compteRendu.id_etat_final || '',
    id_sous_etat: compteRendu.id_sous_etat || '',
    commentaire: compteRendu.commentaire || '',
    // Phase 3
    ph3_installateur: compteRendu.ph3_installateur || '',
    ph3_pac: compteRendu.ph3_pac || '',
    ph3_puissance: compteRendu.ph3_puissance || '',
    ph3_puissance_pv: compteRendu.ph3_puissance_pv || '',
    ph3_rr_model: compteRendu.ph3_rr_model || '',
    ph3_ballon: compteRendu.ph3_ballon || '',
    ph3_marque_ballon: compteRendu.ph3_marque_ballon || '',
    ph3_alimentation: compteRendu.ph3_alimentation || '',
    ph3_type: compteRendu.ph3_type || '',
    ph3_prix: compteRendu.ph3_prix || '',
    ph3_bonus_30: compteRendu.ph3_bonus_30 || '',
    ph3_mensualite: compteRendu.ph3_mensualite || '',
    ph3_attente: compteRendu.ph3_attente || '',
    nbr_annee_finance: compteRendu.nbr_annee_finance || '',
    credit_immobilier: compteRendu.credit_immobilier || '',
    credit_autre: compteRendu.credit_autre || ''
  });

  const [modifications, setModifications] = useState(compteRendu.modifications || {});

  const etatsAvecSousEtats = [2, 8, 13, 16, 19, 44, 45];
  const { data: sousEtatsData = [] } = useQuery(
    ['sous-etat', formData.id_etat_final],
    async () => {
      if (!formData.id_etat_final || !etatsAvecSousEtats.includes(parseInt(formData.id_etat_final))) {
        return [];
      }
      try {
        const res = await api.get(`/management/sous-etat/${formData.id_etat_final}`);
        return res.data.data || [];
      } catch (error) {
        return [];
      }
    },
    { enabled: !!formData.id_etat_final && etatsAvecSousEtats.includes(parseInt(formData.id_etat_final)) }
  );

  const { data: installateursData = [] } = useQuery('installateurs', async () => {
    try {
      const res = await api.get('/management/installateurs');
      return res.data.data || [];
    } catch (error) {
      return [];
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      id_etat_final: formData.id_etat_final || null,
      id_sous_etat: formData.id_sous_etat || null,
      commentaire: formData.commentaire || null,
      modifications: modifications,
      ph3_installateur: formData.ph3_installateur || null,
      ph3_pac: formData.ph3_pac || null,
      ph3_puissance: formData.ph3_puissance || null,
      ph3_puissance_pv: formData.ph3_puissance_pv || null,
      ph3_rr_model: formData.ph3_rr_model || null,
      ph3_ballon: formData.ph3_ballon || null,
      ph3_marque_ballon: formData.ph3_marque_ballon || null,
      ph3_alimentation: formData.ph3_alimentation || null,
      ph3_type: formData.ph3_type || null,
      ph3_prix: formData.ph3_prix ? parseFloat(formData.ph3_prix) : null,
      ph3_bonus_30: formData.ph3_bonus_30 ? parseFloat(formData.ph3_bonus_30) : null,
      ph3_mensualite: formData.ph3_mensualite ? parseFloat(formData.ph3_mensualite) : null,
      ph3_attente: formData.ph3_attente || null,
      nbr_annee_finance: formData.nbr_annee_finance ? parseInt(formData.nbr_annee_finance) : null,
      credit_immobilier: formData.credit_immobilier || null,
      credit_autre: formData.credit_autre || null
    };
    onSave(data);
  };

  const handleModificationChange = (key, value) => {
    setModifications(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleRemoveModification = (key) => {
    const newModifications = { ...modifications };
    delete newModifications[key];
    setModifications(newModifications);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Modifier le compte rendu</h2>
          <button className="btn-close" onClick={onClose}>
            <FaTimes />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>État:</label>
            <select
              value={formData.id_etat_final}
              onChange={(e) => {
                setFormData({ ...formData, id_etat_final: e.target.value, id_sous_etat: '' });
              }}
            >
              <option value="">Sélectionner un état</option>
              {etats.map(etat => (
                <option key={etat.id} value={etat.id}>{etat.titre}</option>
              ))}
            </select>
          </div>

          {formData.id_etat_final && etatsAvecSousEtats.includes(parseInt(formData.id_etat_final)) && (
            <div className="form-group">
              <label>Sous-état:</label>
              <select
                value={formData.id_sous_etat}
                onChange={(e) => setFormData({ ...formData, id_sous_etat: e.target.value })}
              >
                <option value="">Sélectionner un sous-état</option>
                {sousEtatsData.map(sousEtat => (
                  <option key={sousEtat.id} value={sousEtat.id}>{sousEtat.titre}</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label>Commentaire:</label>
            <textarea
              value={formData.commentaire}
              onChange={(e) => setFormData({ ...formData, commentaire: e.target.value })}
              rows={4}
            />
          </div>

          <div className="form-section">
            <h3>Informations de vente (Phase 3)</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Installateur:</label>
                <select
                  value={formData.ph3_installateur}
                  onChange={(e) => setFormData({ ...formData, ph3_installateur: e.target.value })}
                >
                  <option value="">Sélectionner</option>
                  {installateursData.map(inst => (
                    <option key={inst.id} value={inst.id}>{inst.nom}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>PAC:</label>
                <input
                  type="text"
                  value={formData.ph3_pac}
                  onChange={(e) => setFormData({ ...formData, ph3_pac: e.target.value })}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Puissance:</label>
                <input
                  type="text"
                  value={formData.ph3_puissance}
                  onChange={(e) => setFormData({ ...formData, ph3_puissance: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Puissance PV:</label>
                <input
                  type="text"
                  value={formData.ph3_puissance_pv}
                  onChange={(e) => setFormData({ ...formData, ph3_puissance_pv: e.target.value })}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Prix (€):</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.ph3_prix}
                  onChange={(e) => setFormData({ ...formData, ph3_prix: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Mensualité (€):</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.ph3_mensualite}
                  onChange={(e) => setFormData({ ...formData, ph3_mensualite: e.target.value })}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Bonus 30% (€):</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.ph3_bonus_30}
                  onChange={(e) => setFormData({ ...formData, ph3_bonus_30: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Années financement:</label>
                <input
                  type="number"
                  value={formData.nbr_annee_finance}
                  onChange={(e) => setFormData({ ...formData, nbr_annee_finance: e.target.value })}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Crédit immobilier:</label>
                <input
                  type="text"
                  value={formData.credit_immobilier}
                  onChange={(e) => setFormData({ ...formData, credit_immobilier: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Autre crédit:</label>
                <input
                  type="text"
                  value={formData.credit_autre}
                  onChange={(e) => setFormData({ ...formData, credit_autre: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Modifications proposées</h3>
            {Object.keys(modifications).length > 0 ? (
              <div className="modifications-list">
                {Object.entries(modifications).map(([key, value]) => (
                  <div key={key} className="modification-item">
                    <span className="modification-key">{key}:</span>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => handleModificationChange(key, e.target.value)}
                      className="modification-input"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveModification(key)}
                      className="btn-remove"
                    >
                      <FaTimes />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p>Aucune modification</p>
            )}
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isLoading}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              {isLoading ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditCompteRenduModal;

