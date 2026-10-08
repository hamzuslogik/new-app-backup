import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaFileAlt, FaInfoCircle, FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import { isRdvDateBeforeToday } from '../utils/compteRenduEarlyVerification';
import '../pages/Dashboard.css';
import '../pages/FicheDetail.css';
import './CreateFicheModal.css';

/**
 * Modal de création de fiche — même shell visuel que le détail fiche (close=0),
 * sans onglets Modifica / Planning / SMS / PDF : uniquement l'onglet Fiches + Enregistrer.
 */
const CreateFicheModal = ({
  centres = [],
  agents = [],
  produits = [],
  professions = [],
  modeChauffage = [],
  typeContratData = [],
  partenaireMode = false,
  onClose,
  onSave,
  isLoading = false,
}) => {
  const { user } = useAuth();
  const isPartenaireCreate = Boolean(partenaireMode);
  const modalContentRef = useRef(null);

  useModalScrollLock(true);

  useEffect(() => {
    document.documentElement.classList.add('fiche-detail-modal-open');
    document.body.classList.add('fiche-detail-modal-open');
    return () => {
      document.documentElement.classList.remove('fiche-detail-modal-open');
      document.body.classList.remove('fiche-detail-modal-open');
    };
  }, []);

  // close=0 : pas de fermeture Escape (uniquement le bouton X / Annuler)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, []);

  useEffect(() => {
    modalContentRef.current?.focus?.();
  }, []);

  const nowLocal = (() => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();

  const defaultCentre =
    (centres?.length === 1 ? centres[0].id : null) || user?.centre || '';

  const [formData, setFormData] = useState({
    civ: 'MR',
    nom: '',
    prenom: '',
    tel: '',
    gsm1: '',
    gsm2: '',
    email: '',
    adresse: '',
    cp: '',
    ville: '',
    situation_conjugale: '',
    produit: '',
    id_centre: defaultCentre,
    id_agent: user?.id || '',
    id_etat_final: 1,
    id_confirmateur: '',
    id_confirmateur_2: '',
    id_confirmateur_3: '',
    id_commercial: '',
    id_commercial_2: '',
    profession_mr: '',
    profession_madame: '',
    type_contrat_mr: '',
    type_contrat_madame: '',
    age_mr: '',
    age_madame: '',
    revenu_foyer: '',
    credit_foyer: '',
    nb_enfants: '',
    proprietaire_maison: '',
    surface_habitable: '',
    surface_chauffee: '',
    annee_systeme_chauffage: '',
    mode_chauffage: '',
    complement_chauffage: '',
    consommation_chauffage: '',
    consommation_electricite: '',
    circuit_eau: '',
    nb_pieces: '',
    etude: 'NON',
    details_etude: '',
    etude_raison: '',
    date_appel: nowLocal,
    entretien: '',
    nb_pans: '',
    orientation_toiture: '',
    site_classe: '',
    zones_ombres: '',
    commentaire: '',
    date_rdv_time: '',
    date_rdv_time_hour: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const produitOptions =
    produits && produits.length > 0
      ? produits
      : [
          { id: 1, nom: 'PAC' },
          { id: 2, nom: 'PV' },
        ];
  const produitNomUpper = (
    produitOptions.find((p) => String(p.id) === String(formData.produit))?.nom || ''
  )
    .trim()
    .toUpperCase();
  const showPvFields = produitNomUpper === 'PV';
  const showPacFields = produitNomUpper === 'PAC';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.nom?.trim() || !formData.prenom?.trim() || !formData.tel?.trim()) {
      toast.error('Veuillez renseigner nom, prénom et téléphone.');
      return;
    }
    if (!formData.produit) {
      toast.error('Veuillez sélectionner un produit.');
      return;
    }

    const submitData = { ...formData };

    if (submitData.date_appel) {
      const d = new Date(submitData.date_appel);
      if (!Number.isNaN(d.getTime())) {
        submitData.date_appel = Math.floor(d.getTime() / 1000);
        const pad = (n) => String(n).padStart(2, '0');
        submitData.date_appel_time = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
      } else {
        delete submitData.date_appel;
      }
    } else {
      delete submitData.date_appel;
    }

    if (submitData.nb_pans !== '' && submitData.nb_pans != null) {
      const n = parseInt(String(submitData.nb_pans), 10);
      submitData.nb_pans = Number.isFinite(n) ? n : null;
    }

    if (!isPartenaireCreate) {
      if (submitData.date_rdv_time && submitData.date_rdv_time_hour) {
        submitData.date_rdv_time = `${submitData.date_rdv_time} ${submitData.date_rdv_time_hour}:00`;
      } else if (submitData.date_rdv_time) {
        submitData.date_rdv_time = `${submitData.date_rdv_time} 00:00:00`;
      }
      if (submitData.date_rdv_time && isRdvDateBeforeToday(submitData.date_rdv_time)) {
        toast.error("Impossible de créer un RDV à une date antérieure à aujourd'hui.");
        return;
      }
    } else {
      delete submitData.date_rdv_time;
      delete submitData.date_rdv_time_hour;
    }

    delete submitData.date_rdv_time_hour;
    delete submitData.email;

    if (submitData.produit !== '' && submitData.produit != null) {
      const pi = parseInt(String(submitData.produit), 10);
      submitData.produit = Number.isFinite(pi) ? pi : null;
    }

    if (isPartenaireCreate) {
      submitData.id_etat_final = 1;
      submitData.id_agent = user?.id || null;
      const centreId = parseInt(String(submitData.id_centre), 10);
      if (!Number.isFinite(centreId) || centreId <= 0) {
        toast.error('Veuillez sélectionner un centre');
        return;
      }
      submitData.id_centre = centreId;
      submitData.id_insert = user?.id || null;
      delete submitData.id_qualite;
      delete submitData.id_confirmateur;
      delete submitData.id_confirmateur_2;
      delete submitData.id_confirmateur_3;
      delete submitData.id_commercial;
      delete submitData.id_commercial_2;
      delete submitData.situation_conjugale;
      delete submitData.age_mr;
      delete submitData.age_madame;
      delete submitData.revenu_foyer;
      delete submitData.credit_foyer;
      delete submitData.nb_enfants;
    }

    Object.keys(submitData).forEach((key) => {
      if (submitData[key] === '') submitData[key] = null;
    });

    onSave(submitData);
  };

  const renderRow = (label, name, control, required = false) => (
    <tr key={name}>
      <td className="field-label">
        {label}
        {required ? ' *' : ''}
      </td>
      <td className="field-value">
        <div className="edit-controls">{control}</div>
      </td>
      <td className="field-actions" />
    </tr>
  );

  const input = (name, type = 'text', extra = {}) => (
    <input
      type={type}
      name={name}
      value={formData[name] ?? ''}
      onChange={handleChange}
      className="form-control"
      {...extra}
    />
  );

  const select = (name, options, placeholder = 'Sélectionner') => (
    <select name={name} value={formData[name] ?? ''} onChange={handleChange} className="form-control">
      <option value="">{placeholder}</option>
      {options}
    </select>
  );

  const textarea = (name, rows = 3) => (
    <textarea
      name={name}
      value={formData[name] ?? ''}
      onChange={handleChange}
      className="form-control"
      rows={rows}
    />
  );

  const modal = (
    <div className="fiche-detail-modal-overlay create-fiche-modal-overlay">
      <div
        ref={modalContentRef}
        className="fiche-detail-modal-content create-fiche-modal-content"
        tabIndex={-1}
        style={{
          border: '8px solid #3498db',
          outline: 'none',
          ['--etat-color']: '#3498db',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="fiche-detail-modal-close" onClick={onClose} aria-label="Fermer">
          <FaTimes />
        </button>
        <div className="fiche-detail-modal-zoom-inner">
          <div
            className="fiche-detail-modal-banner"
            style={{ height: '72px', minHeight: '72px', maxHeight: '72px', flex: '0 0 72px' }}
          >
            <img src="/logo/logo.png" alt="Logo" className="fiche-detail-modal-banner-logo" />
            <span className="fiche-detail-modal-banner-title">NOUVELLE FICHE</span>
          </div>

          <div className="fiche-detail create-fiche-modal-body">
            <div className="fiche-detail-header">
              <div className="fiche-detail-header-title">
                <div
                  className="fiche-type-badge"
                  style={{
                    backgroundColor:
                      formData.produit === 1 || formData.produit === '1' ? '#66D5D4' : '#818cf8',
                    color: formData.produit === 1 || formData.produit === '1' ? 'white' : 'black',
                  }}
                >
                  {produitNomUpper || '—'}
                </div>
                <h1>
                  <FaInfoCircle /> Nouvelle fiche
                </h1>
              </div>
            </div>

            <div className="fiche-tabs">
              <div className="fiche-tabs-items">
                <button type="button" className="fiche-tab active">
                  <FaFileAlt /> Fiches
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="create-fiche-modal-form">
              <div className="fiche-sections">
                <div className="fiche-section">
                  <h2 className="section-title">Données personnelles</h2>
                  <table className="fiche-details-table">
                    <tbody>
                      {renderRow(
                        'Civilité',
                        'civ',
                        <select name="civ" value={formData.civ} onChange={handleChange} className="form-control" required>
                          <option value="MR">MR</option>
                          <option value="MME">MME</option>
                        </select>,
                        true
                      )}
                      {renderRow('Nom', 'nom', input('nom', 'text', { required: true }), true)}
                      {renderRow('Prénom', 'prenom', input('prenom', 'text', { required: true }), true)}
                      {renderRow('Téléphone', 'tel', input('tel', 'tel', { required: true }), true)}
                      {renderRow('GSM1', 'gsm1', input('gsm1', 'tel'))}
                      {renderRow('GSM2', 'gsm2', input('gsm2', 'tel'))}
                      {renderRow('Email', 'email', input('email', 'email'))}
                      {renderRow('Adresse', 'adresse', textarea('adresse', 2))}
                      {renderRow('Code postal', 'cp', input('cp'))}
                      {renderRow('Ville', 'ville', input('ville'))}
                    </tbody>
                  </table>
                </div>

                <div className="fiche-section">
                  <h2 className="section-title">Détails de l&apos;étude</h2>
                  <table className="fiche-details-table">
                    <tbody>
                      {renderRow(
                        'Étude à faire pour',
                        'produit',
                        <select
                          name="produit"
                          value={formData.produit}
                          onChange={handleChange}
                          className="form-control"
                          required
                        >
                          <option value="">-- Sélectionner --</option>
                          {produitOptions.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nom || p.titre || `Produit ${p.id}`}
                            </option>
                          ))}
                        </select>,
                        true
                      )}
                      {renderRow('Commentaire', 'commentaire', textarea('commentaire'))}
                      {renderRow(
                        'A déjà fait une étude',
                        'etude',
                        <select name="etude" value={formData.etude} onChange={handleChange} className="form-control">
                          <option value="NON">NON</option>
                          <option value="OUI">OUI</option>
                        </select>
                      )}
                      {formData.etude === 'OUI' &&
                        renderRow('Détails étude', 'details_etude', textarea('details_etude'))}
                      {(showPacFields || !showPvFields) &&
                        renderRow(
                          'Mode de chauffage',
                          'mode_chauffage',
                          select(
                            'mode_chauffage',
                            modeChauffage.map((mode) => (
                              <option key={mode.id} value={mode.nom || mode.titre || ''}>
                                {mode.nom || mode.titre || mode.id}
                              </option>
                            ))
                          )
                        )}
                      {(showPacFields || !showPvFields) &&
                        renderRow(
                          'Année de système de chauffage',
                          'annee_systeme_chauffage',
                          input('annee_systeme_chauffage', 'text', {
                            placeholder: 'Ex: 2015, récent, avant 2010',
                          })
                        )}
                      {(showPacFields || !showPvFields) &&
                        renderRow('Consommation chauffage', 'consommation_chauffage', input('consommation_chauffage'))}
                      {(showPacFields || !showPvFields) &&
                        renderRow('Surface chauffée en M²', 'surface_chauffee', input('surface_chauffee'))}
                      {renderRow(
                        'Propriétaire de la maison',
                        'proprietaire_maison',
                        select('proprietaire_maison', [
                          <option key="MR" value="MR">
                            Mr
                          </option>,
                          <option key="MME" value="MME">
                            Mme
                          </option>,
                          <option key="LES DEUX" value="LES DEUX">
                            LES DEUX
                          </option>,
                        ])
                      )}
                      {(showPvFields || !showPacFields) &&
                        renderRow('Orientation de la toiture', 'orientation_toiture', input('orientation_toiture'))}
                      {(showPvFields || !showPacFields) &&
                        renderRow('Zones d\'ombres', 'zones_ombres', input('zones_ombres'))}
                      {(showPvFields || !showPacFields) &&
                        renderRow('Proche d\'un site classé', 'site_classe', input('site_classe'))}
                      {(showPvFields || !showPacFields) &&
                        renderRow('Nb pans', 'nb_pans', input('nb_pans', 'number', { min: 0 }))}
                      {!isPartenaireCreate && renderRow('Âge du MR', 'age_mr', input('age_mr', 'number', { min: 0 }))}
                      {!isPartenaireCreate &&
                        renderRow('Âge du Madame', 'age_madame', input('age_madame', 'number', { min: 0 }))}
                      {(showPvFields || !showPacFields) &&
                        renderRow(
                          'Consommation électricité',
                          'consommation_electricite',
                          input('consommation_electricite')
                        )}
                      {!isPartenaireCreate &&
                        renderRow('Revenu du foyer', 'revenu_foyer', input('revenu_foyer'))}
                      {!isPartenaireCreate &&
                        renderRow('Crédit du foyer', 'credit_foyer', input('credit_foyer'))}
                      {!isPartenaireCreate &&
                        renderRow(
                          'Situation Conjugale',
                          'situation_conjugale',
                          select('situation_conjugale', [
                            <option key="CELIBATAIRE" value="CELIBATAIRE">
                              Célibataire
                            </option>,
                            <option key="MARIE" value="MARIE">
                              Marié
                            </option>,
                            <option key="CONCUBINAGE" value="CONCUBINAGE">
                              Concubinage
                            </option>,
                            <option key="DIVORCE" value="DIVORCE">
                              Divorcé
                            </option>,
                            <option key="VEUF" value="VEUF/VEUVE">
                              Veuf/Veuve
                            </option>,
                            <option key="PAXE" value="PAXE">
                              Pacsé
                            </option>,
                          ])
                        )}
                      {!isPartenaireCreate &&
                        renderRow(
                          "Nombre d'enfants en Charges",
                          'nb_enfants',
                          input('nb_enfants', 'number', { min: 0 })
                        )}
                      {renderRow(
                        'Profession Du MR',
                        'profession_mr',
                        select(
                          'profession_mr',
                          professions.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nom}
                            </option>
                          ))
                        )
                      )}
                      {renderRow(
                        'Type de Contrat MR',
                        'type_contrat_mr',
                        select(
                          'type_contrat_mr',
                          typeContratData.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nom}
                            </option>
                          ))
                        )
                      )}
                      {renderRow(
                        'Profession Du Madame',
                        'profession_madame',
                        select(
                          'profession_madame',
                          professions.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nom}
                            </option>
                          ))
                        )
                      )}
                      {renderRow(
                        'Type de Contrat MME',
                        'type_contrat_madame',
                        select(
                          'type_contrat_madame',
                          typeContratData.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nom}
                            </option>
                          ))
                        )
                      )}
                      {renderRow(
                        "Date & Heure d'appel",
                        'date_appel',
                        input('date_appel', 'datetime-local', {
                          required: isPartenaireCreate,
                        }),
                        isPartenaireCreate
                      )}
                      {renderRow(
                        'Entretien en tunisie avec',
                        'entretien',
                        select('entretien', [
                          <option key="MR" value="MR">
                            Mr
                          </option>,
                          <option key="MME" value="MME">
                            Mme
                          </option>,
                          <option key="Couple" value="Couple">
                            Couple
                          </option>,
                        ])
                      )}
                      {[1, 2, 4, 7, 8, 11, 12, 13, 14].includes(Number(user?.fonction)) &&
                        renderRow(
                          'Agent',
                          'id_agent',
                          select(
                            'id_agent',
                            agents.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.pseudo || `ID ${a.id}`}
                              </option>
                            ))
                          )
                        )}
                      {renderRow(
                        'Centre',
                        'id_centre',
                        select(
                          'id_centre',
                          centres.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.titre || c.nom || c.id}
                            </option>
                          )),
                          '-- Sélectionner --'
                        ),
                        isPartenaireCreate
                      )}
                      {!isPartenaireCreate && (
                        <>
                          {renderRow('Date RDV', 'date_rdv_time', input('date_rdv_time', 'date'))}
                          {renderRow('Heure RDV', 'date_rdv_time_hour', input('date_rdv_time_hour', 'time'))}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="create-fiche-modal-actions">
                <button type="button" className="btn-cancel" onClick={onClose} disabled={isLoading}>
                  Annuler
                </button>
                <button type="submit" className="btn-save" disabled={isLoading}>
                  {isLoading ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default CreateFicheModal;
