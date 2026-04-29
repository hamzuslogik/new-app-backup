import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from 'react-query';
import api from '../config/api';
import { FaTimes } from 'react-icons/fa';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import { getEtatsGroupedByPhase } from '../utils/etatsByPhase';
import './EditCompteRenduModal.css';

const parseModifications = (mods) => {
  if (!mods) return {};
  if (typeof mods === 'string') {
    try { return JSON.parse(mods) || {}; } catch { return {}; }
  }
  return mods && typeof mods === 'object' ? mods : {};
};

const EditCompteRenduModal = ({ compteRendu, etats, onClose, onSave, isLoading, readOnly = false }) => {
  useModalScrollLock(true);
  const initialMods = useMemo(() => parseModifications(compteRendu.modifications), [compteRendu.modifications]);
  const dateSignStr = initialMods.date_sign_time || compteRendu.date_sign_time || '';
  const [dateSignDate, dateSignTime] = (() => {
    if (!dateSignStr) return ['', ''];
    const m = String(dateSignStr).match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})(?::\d{2})?/);
    return m ? [m[1], m[2].substring(0, 5)] : ['', ''];
  })();
  const confRdvTime = initialMods.conf_rdv_time || '';
  const confRdvTimeShort = confRdvTime && /^\d{2}:\d{2}/.test(confRdvTime) ? confRdvTime.substring(0, 5) : confRdvTime;
  const dateRdvTimeStr = initialMods.date_rdv_time || '';
  const [dateRappelDate, dateRappelTime] = (() => {
    if (!dateRdvTimeStr) return ['', '09:00'];
    const m = String(dateRdvTimeStr).match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})(?::\d{2})?/);
    return m ? [m[1], m[2].substring(0, 5)] : ['', '09:00'];
  })();
  const addWorkingDays = (date, days) => {
    const result = new Date(date);
    let added = 0;
    while (added < days) {
      result.setDate(result.getDate() + 1);
      const dow = result.getDay();
      if (dow !== 0 && dow !== 6) added++;
    }
    return result;
  };
  const defaultDateRappel = (() => {
    const d = addWorkingDays(new Date(), 2);
    return [d.toISOString().split('T')[0], '09:00'];
  })();

  const [formData, setFormData] = useState({
    id_etat_final: compteRendu.id_etat_final || '',
    id_sous_etat: compteRendu.id_sous_etat || '',
    commentaire: compteRendu.commentaire || '',
    // État 8 - Annuler à reprogrammer
    conf_rdv_date: initialMods.conf_rdv_date || '',
    conf_rdv_time: confRdvTimeShort || '',
    conf_rdv_avec: initialMods.conf_rdv_avec || '',
    // État 13, 44, 45 - Signer
    produit: initialMods.produit || compteRendu.produit || '',
    date_sign_date: dateSignDate,
    date_sign_time: dateSignTime,
    id_commercial: initialMods.id_commercial || '',
    id_commercial_2: initialMods.id_commercial_2 || '',
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
    credit_autre: compteRendu.credit_autre || '',
    date_rappel_date: compteRendu.id_etat_final === 9 ? (dateRappelDate || defaultDateRappel[0]) : '',
    date_rappel_time: compteRendu.id_etat_final === 9 ? (dateRappelTime || defaultDateRappel[1]) : '09:00'
  });

  const [otherModifications, setOtherModifications] = useState(() => {
    const mods = parseModifications(compteRendu.modifications);
    const structuredKeys = ['conf_rdv_date', 'conf_rdv_time', 'conf_rdv_avec', 'produit', 'date_sign_time', 'id_commercial', 'id_commercial_2', 'date_rdv_time'];
    const other = {};
    Object.entries(mods).forEach(([k, v]) => {
      if (!structuredKeys.includes(k) && v != null) other[k] = v;
    });
    return other;
  });

  const { phase0: etatsPhase0, phase1: etatsPhase1, phase2: etatsPhase2, phase3: etatsPhase3 } = getEtatsGroupedByPhase(etats || []);

  const etatsAvecListeSousEtats = [2, 8, 11, 12, 13, 16, 19, 44, 45];
  const { data: sousEtatsData = [] } = useQuery(
    ['sous-etat', formData.id_etat_final],
    async () => {
      if (!formData.id_etat_final || !etatsAvecListeSousEtats.includes(parseInt(formData.id_etat_final, 10))) {
        return [];
      }
      try {
        const res = await api.get(`/management/sous-etat/${formData.id_etat_final}`);
        return res.data.data || [];
      } catch (error) {
        return [];
      }
    },
    { enabled: !!formData.id_etat_final && etatsAvecListeSousEtats.includes(parseInt(formData.id_etat_final, 10)) }
  );

  const { data: installateursData = [] } = useQuery('installateurs', async () => {
    try {
      const res = await api.get('/management/installateurs');
      return res.data.data || [];
    } catch (error) {
      return [];
    }
  });

  const { data: produitsData = [] } = useQuery('produits', async () => {
    try {
      const res = await api.get('/management/produits');
      return res.data?.data || res.data || [];
    } catch (error) {
      return [];
    }
  });

  const { data: commerciauxData = [] } = useQuery('commerciaux', async () => {
    try {
      const res = await api.get('/management/utilisateurs');
      return (res.data?.data || res.data || []).filter(u => u.fonction === 5) || [];
    } catch (error) {
      return [];
    }
  });

  const idEtat = parseInt(formData.id_etat_final, 10);
  const isEtatSigner = [13, 44, 45].includes(idEtat);
  const isEtatAnnulerRepro = idEtat === 8;
  const isEtatHonoreSuivre = idEtat === 9;
  const isEtatCommentaireSeul = [9, 12, 23, 34, 35].includes(idEtat);
  const isEtat11ou12 = idEtat === 11 || idEtat === 12;

  const handleSubmit = (e) => {
    e.preventDefault();
    const mods = { ...otherModifications };
    if (isEtatAnnulerRepro) {
      if (formData.conf_rdv_date) mods.conf_rdv_date = formData.conf_rdv_date;
      if (formData.conf_rdv_time) mods.conf_rdv_time = formData.conf_rdv_time;
      if (formData.conf_rdv_avec) mods.conf_rdv_avec = formData.conf_rdv_avec;
    } else if (isEtatHonoreSuivre) {
      if (formData.date_rappel_date) {
        mods.date_rdv_time = `${formData.date_rappel_date} ${formData.date_rappel_time || '09:00'}:00`;
      }
    } else if (isEtatSigner) {
      if (formData.produit) mods.produit = parseInt(formData.produit, 10);
      if (formData.id_commercial) mods.id_commercial = parseInt(formData.id_commercial, 10);
      if (formData.id_commercial_2) mods.id_commercial_2 = parseInt(formData.id_commercial_2, 10);
      if (formData.date_sign_date && formData.date_sign_time) {
        mods.date_sign_time = `${formData.date_sign_date} ${formData.date_sign_time}:00`;
      }
    }

    const data = {
      id_etat_final: formData.id_etat_final || null,
      id_sous_etat: formData.id_sous_etat || null,
      commentaire:
        isEtat11ou12 && !(formData.id_sous_etat && String(formData.id_sous_etat).trim() !== '')
          ? null
          : formData.commentaire || null,
      modifications: mods,
      ph3_installateur: isEtatSigner ? (formData.ph3_installateur || null) : null,
      ph3_pac: isEtatSigner ? (formData.ph3_pac || null) : null,
      ph3_puissance: isEtatSigner ? (formData.ph3_puissance || null) : null,
      ph3_puissance_pv: isEtatSigner ? (formData.ph3_puissance_pv || null) : null,
      ph3_rr_model: isEtatSigner ? (formData.ph3_rr_model || null) : null,
      ph3_ballon: isEtatSigner ? (formData.ph3_ballon || null) : null,
      ph3_marque_ballon: isEtatSigner ? (formData.ph3_marque_ballon || null) : null,
      ph3_alimentation: isEtatSigner ? (formData.ph3_alimentation || null) : null,
      ph3_type: isEtatSigner ? (formData.ph3_type || null) : null,
      ph3_prix: isEtatSigner && formData.ph3_prix ? parseFloat(formData.ph3_prix) : null,
      ph3_bonus_30: isEtatSigner && formData.ph3_bonus_30 ? parseFloat(formData.ph3_bonus_30) : null,
      ph3_mensualite: isEtatSigner && formData.ph3_mensualite ? parseFloat(formData.ph3_mensualite) : null,
      ph3_attente: isEtatSigner ? (formData.ph3_attente || null) : null,
      nbr_annee_finance: isEtatSigner && formData.nbr_annee_finance ? parseInt(formData.nbr_annee_finance, 10) : null,
      credit_immobilier: isEtatSigner ? (formData.credit_immobilier || null) : null,
      credit_autre: isEtatSigner ? (formData.credit_autre || null) : null
    };
    onSave(data);
  };

  const handleOtherModificationChange = (key, value) => {
    setOtherModifications(prev => ({ ...prev, [key]: value }));
  };
  const handleRemoveOtherModification = (key) => {
    setOtherModifications(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const modalContent = (
    <div className="edit-compte-rendu-modal-overlay modal-overlay" onClick={onClose}>
      <div className="modal-content large edit-compte-rendu-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{readOnly ? 'Voir le compte rendu' : 'Modifier le compte rendu'}</h2>
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
                const val = e.target.value;
                const updates = { ...formData, id_etat_final: val, id_sous_etat: '' };
                if (val === '9') {
                  updates.date_rappel_date = formData.date_rappel_date || defaultDateRappel[0];
                  updates.date_rappel_time = formData.date_rappel_time || '09:00';
                } else {
                  updates.date_rappel_date = '';
                  updates.date_rappel_time = '09:00';
                }
                setFormData(updates);
              }}
              disabled={readOnly}
            >
              <option value="">Sélectionner un état</option>
              {etatsPhase0.length > 0 && (
                <optgroup label="PHASE 0">
                  {etatsPhase0.map(etat => (
                    <option key={etat.id} value={etat.id} style={{ backgroundColor: etat.color || '#cccccc' }}>{etat.titre}</option>
                  ))}
                </optgroup>
              )}
              {etatsPhase1.length > 0 && (
                <optgroup label="PHASE 1">
                  {etatsPhase1.map(etat => (
                    <option key={etat.id} value={etat.id} style={{ backgroundColor: etat.color || '#cccccc' }}>{etat.titre}</option>
                  ))}
                </optgroup>
              )}
              {etatsPhase2.length > 0 && (
                <optgroup label="PHASE 2">
                  {etatsPhase2.map(etat => (
                    <option key={etat.id} value={etat.id} style={{ backgroundColor: etat.color || '#cccccc' }}>{etat.titre}</option>
                  ))}
                </optgroup>
              )}
              {etatsPhase3.length > 0 && (
                <optgroup label="PHASE 3">
                  {etatsPhase3.map(etat => (
                    <option key={etat.id} value={etat.id} style={{ backgroundColor: etat.color || '#cccccc' }}>{etat.titre}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {formData.id_etat_final && etatsAvecListeSousEtats.includes(parseInt(formData.id_etat_final, 10)) && (
            <div className="form-group">
              <label>{isEtat11ou12 ? 'Sous-état (facultatif) :' : 'Sous-état :'}</label>
              <select
                value={formData.id_sous_etat}
                onChange={(e) => setFormData({ ...formData, id_sous_etat: e.target.value })}
                disabled={readOnly}
              >
                <option value="">{isEtat11ou12 ? '—' : 'Sélectionner un sous-état'}</option>
                {sousEtatsData.map(sousEtat => (
                  <option key={sousEtat.id} value={sousEtat.id}>{sousEtat.titre}</option>
                ))}
              </select>
            </div>
          )}

          {(!isEtatSigner && (!isEtat11ou12 || (formData.id_sous_etat && String(formData.id_sous_etat).trim() !== ''))) && (
            <div className="form-group">
              <label>Commentaire{isEtat11ou12 ? ' (facultatif) :' : ' :'}</label>
              <textarea
                value={formData.commentaire}
                onChange={(e) => setFormData({ ...formData, commentaire: e.target.value })}
                rows={4}
                disabled={readOnly}
              />
            </div>
          )}

          {/* État 9 - Honoré à suivre : Date rappel (J+2 par défaut, modifiable) */}
          {isEtatHonoreSuivre && (
            <div className="form-section">
              <h3>Honoré à suivre</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Date rappel (modifiable) :</label>
                  <input
                    type="date"
                    value={formData.date_rappel_date}
                    onChange={(e) => setFormData({ ...formData, date_rappel_date: e.target.value })}
                    disabled={readOnly}
                  />
                </div>
                <div className="form-group">
                  <label>Heure :</label>
                  <input
                    type="time"
                    value={formData.date_rappel_time}
                    onChange={(e) => setFormData({ ...formData, date_rappel_time: e.target.value })}
                    disabled={readOnly}
                  />
                </div>
              </div>
            </div>
          )}

          {/* État 8 - Annuler à reprogrammer : sous-état, appel avec, date/heure rappel */}
          {isEtatAnnulerRepro && (
            <div className="form-section">
              <h3>Reprogrammer</h3>
              <div className="form-group">
                <label>Appel Avec:</label>
                <select
                  value={formData.conf_rdv_avec}
                  onChange={(e) => setFormData({ ...formData, conf_rdv_avec: e.target.value })}
                  disabled={readOnly}
                >
                  <option value="">Sélectionner</option>
                  <option value="MR">MR</option>
                  <option value="MME">MME</option>
                  <option value="AUTRE">AUTRE</option>
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>A rappeler le:</label>
                  <input
                    type="date"
                    value={formData.conf_rdv_date}
                    onChange={(e) => setFormData({ ...formData, conf_rdv_date: e.target.value })}
                    disabled={readOnly}
                  />
                </div>
                <div className="form-group">
                  <label>Heure:</label>
                  <input
                    type="time"
                    value={formData.conf_rdv_time}
                    onChange={(e) => setFormData({ ...formData, conf_rdv_time: e.target.value })}
                    disabled={readOnly}
                  />
                </div>
              </div>
            </div>
          )}

          {/* État 13, 44, 45 - Signer */}
          {isEtatSigner && (
            <>
              <div className="form-section">
                <h3>Détails compte rendu</h3>
                <div className="form-group">
                  <label>Pseudo :</label>
                  <input
                    type="text"
                    value={otherModifications.pseudo || ''}
                    onChange={(e) => handleOtherModificationChange('pseudo', e.target.value)}
                    disabled={readOnly}
                  />
                </div>
                <div className="form-group">
                  <label>PAC :</label>
                  <select
                    value={formData.ph3_pac}
                    onChange={(e) => setFormData({ ...formData, ph3_pac: e.target.value })}
                    disabled={readOnly}
                  >
                    <option value="">Sélectionner</option>
                    <option value="reau">R/EAU</option>
                    <option value="rr">R/R</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Financement :</label>
                  <input
                    type="text"
                    value={formData.ph3_attente}
                    onChange={(e) => setFormData({ ...formData, ph3_attente: e.target.value })}
                    disabled={readOnly}
                  />
                </div>
                <div className="form-group">
                  <label>Prix :</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.ph3_prix}
                    onChange={(e) => setFormData({ ...formData, ph3_prix: e.target.value })}
                    disabled={readOnly}
                  />
                </div>
                <div className="form-group">
                  <label>Crédit immobilier :</label>
                  <input
                    type="text"
                    value={formData.credit_immobilier}
                    onChange={(e) => setFormData({ ...formData, credit_immobilier: e.target.value })}
                    disabled={readOnly}
                  />
                </div>
                <div className="form-group">
                  <label>Autre crédit :</label>
                  <input
                    type="text"
                    value={formData.credit_autre}
                    onChange={(e) => setFormData({ ...formData, credit_autre: e.target.value })}
                    disabled={readOnly}
                  />
                </div>
                <div className="form-group">
                  <label>Puissance :</label>
                  <input
                    type="text"
                    value={formData.ph3_puissance}
                    onChange={(e) => setFormData({ ...formData, ph3_puissance: e.target.value })}
                    disabled={readOnly}
                  />
                </div>
                <div className="form-group">
                  <label>Ballon :</label>
                  <input
                    type="text"
                    value={formData.ph3_ballon}
                    onChange={(e) => setFormData({ ...formData, ph3_ballon: e.target.value })}
                    disabled={readOnly}
                  />
                </div>
                <div className="form-group">
                  <label>Installateur :</label>
                  <select
                    value={formData.ph3_installateur}
                    onChange={(e) => setFormData({ ...formData, ph3_installateur: e.target.value })}
                    disabled={readOnly}
                  >
                    <option value="">Sélectionner</option>
                    {installateursData.map(inst => (
                      <option key={inst.id} value={inst.id}>{inst.nom}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Consommation annuelle ancien système :</label>
                  <input
                    type="number"
                    step="0.01"
                    value={otherModifications.conf_consommations || ''}
                    onChange={(e) => handleOtherModificationChange('conf_consommations', e.target.value)}
                    disabled={readOnly}
                  />
                </div>
                <div className="form-group">
                  <label>Partie à financer du client :</label>
                  <input
                    type="number"
                    step="0.01"
                    value={otherModifications.valeur_mensualite || ''}
                    onChange={(e) => handleOtherModificationChange('valeur_mensualite', e.target.value)}
                    disabled={readOnly}
                  />
                </div>
                <div className="form-group">
                  <label>Bonus annoncé :</label>
                  <select
                    value={formData.ph3_bonus_30}
                    onChange={(e) => setFormData({ ...formData, ph3_bonus_30: e.target.value })}
                    disabled={readOnly}
                  >
                    <option value="">Sélectionner</option>
                    <option value="15">15</option>
                    <option value="30">30</option>
                    <option value="SANS">SANS</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Mensualité du crédit :</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.ph3_mensualite}
                    onChange={(e) => setFormData({ ...formData, ph3_mensualite: e.target.value })}
                    disabled={readOnly}
                  />
                </div>
                <div className="form-group">
                  <label>Nombre de mois du crédit :</label>
                  <input
                    type="number"
                    value={formData.nbr_annee_finance}
                    onChange={(e) => setFormData({ ...formData, nbr_annee_finance: e.target.value })}
                    disabled={readOnly}
                  />
                </div>
                <div className="form-group">
                  <label>Alimentation :</label>
                  <input
                    type="text"
                    value={formData.ph3_alimentation}
                    onChange={(e) => setFormData({ ...formData, ph3_alimentation: e.target.value })}
                    disabled={readOnly}
                  />
                </div>
                <div className="form-group">
                  <label>Type :</label>
                  <select
                    value={formData.ph3_type}
                    onChange={(e) => setFormData({ ...formData, ph3_type: e.target.value })}
                    disabled={readOnly}
                  >
                    <option value="">Sélectionner</option>
                    <option value="Bizonne">Bizonne</option>
                    <option value="Basse">Basse</option>
                    <option value="Haute">Haute</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Signature pour :</label>
                  <select
                    value={formData.produit}
                    onChange={(e) => setFormData({ ...formData, produit: e.target.value })}
                    disabled={readOnly}
                  >
                    <option value="">Sélectionner</option>
                    {(produitsData || []).map(prod => (
                      <option key={prod.id} value={prod.id}>{prod.nom}</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Date signature :</label>
                    <input
                      type="date"
                      value={formData.date_sign_date}
                      onChange={(e) => setFormData({ ...formData, date_sign_date: e.target.value })}
                      disabled={readOnly}
                    />
                  </div>
                  <div className="form-group">
                    <label>Heure:</label>
                    <input
                      type="time"
                      value={formData.date_sign_time}
                      onChange={(e) => setFormData({ ...formData, date_sign_time: e.target.value })}
                      disabled={readOnly}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Compte rendu :</label>
                  <textarea
                    value={formData.commentaire}
                    onChange={(e) => setFormData({ ...formData, commentaire: e.target.value })}
                    rows={4}
                    disabled={readOnly}
                  />
                </div>
              </div>
            </>
          )}

          {/* Autres modifications (champs non structurés) */}
          {Object.keys(otherModifications).length > 0 && (
            <div className="form-section">
              <h3>Autres modifications</h3>
              <div className="modifications-list">
                {Object.entries(otherModifications).map(([key, value]) => (
                  <div key={key} className="modification-item">
                    <span className="modification-key">{key}:</span>
                    <input
                      type="text"
                      value={typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      onChange={(e) => handleOtherModificationChange(key, e.target.value)}
                      className="modification-input"
                      disabled={readOnly}
                    />
                    {!readOnly && (
                      <button type="button" onClick={() => handleRemoveOtherModification(key)} className="btn-remove">
                        <FaTimes />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isLoading}>
              {readOnly ? 'Fermer' : 'Annuler'}
            </button>
            {!readOnly && (
              <button type="submit" className="btn btn-primary" disabled={isLoading}>
                {isLoading ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default EditCompteRenduModal;

