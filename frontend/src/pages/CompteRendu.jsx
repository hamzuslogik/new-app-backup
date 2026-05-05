import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaEdit, FaEye, FaClipboardList, FaCheck, FaTimes, FaClock, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { toast } from 'react-toastify';
import FicheDetailLink from '../components/FicheDetailLink';
import EditCompteRenduModal from '../components/EditCompteRenduModal';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import './CompteRendu.css';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';
import { isCompteRenduSignerEtat } from '../utils/compteRenduSigner';
import { getDateRappelAffichage } from '../utils/compteRenduDateRappel';

const getTodayISO = () => new Date().toISOString().split('T')[0];

const CompteRendu = () => {
  useForceDesktopViewport('compterendu-page');
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedStatutPending, setSelectedStatutPending] = useState(user.fonction === 5 ? 'pending' : 'all');
  const [filterDate, setFilterDate] = useState(getTodayISO);
  const [filterCommercial, setFilterCommercial] = useState('');
  const [commentaireAdmin, setCommentaireAdmin] = useState('');
  const [selectedCompteRendu, setSelectedCompteRendu] = useState(null);
  const [editingCompteRendu, setEditingCompteRendu] = useState(null);
  
  // Bloquer le scroll du body quand un modal est ouvert
  useModalScrollLock(!!selectedCompteRendu || !!editingCompteRendu);

  // Récupérer les données de référence
  const { data: confirmateursData } = useQuery('confirmateurs', async () => {
    const res = await api.get('/management/utilisateurs');
    return res.data.data?.filter(u => u.fonction === 6) || [];
  });

  const { data: commerciauxData } = useQuery('commerciaux', async () => {
    const res = await api.get('/management/utilisateurs');
    return res.data.data?.filter(u => u.fonction === 5) || [];
  });

  const { data: centresData } = useQuery('centres', async () => {
    const res = await api.get('/management/centres');
    return res.data.data || [];
  });
  const { data: installateursData } = useQuery('installateurs', async () => {
    const res = await api.get('/management/installateurs');
    return res.data.data || [];
  });

  const { data: etatsData } = useQuery('etats', async () => {
    const res = await api.get('/management/etats');
    return res.data.data || [];
  });

  // Récupérer les comptes rendus en attente
  const { data: comptesRendusPendingData, isLoading: isLoadingPending } = useQuery(
    ['compte-rendu-pending', selectedStatutPending, filterDate, filterCommercial],
    async () => {
      const params = { date: filterDate };
      if (selectedStatutPending !== 'all') params.statut = selectedStatutPending;
      if (filterCommercial) params.id_commercial = filterCommercial;
      const res = await api.get('/compte-rendu', { params });
      return res.data.data || [];
    }
  );

  // Mutation pour approuver un compte rendu pending
  const approveMutation = useMutation(
    async ({ id, commentaire }) => {
      const res = await api.post(`/compte-rendu/${id}/approve`, { commentaire_admin: commentaire });
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('compte-rendu-pending');
        queryClient.invalidateQueries('fiches');
        toast.success('Compte rendu approuvé avec succès');
        setSelectedCompteRendu(null);
        setCommentaireAdmin('');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de l\'approbation');
      }
    }
  );

  // Mutation pour rejeter un compte rendu pending
  const rejectMutation = useMutation(
    async ({ id, commentaire }) => {
      const res = await api.post(`/compte-rendu/${id}/reject`, { commentaire_admin: commentaire });
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('compte-rendu-pending');
        toast.success('Compte rendu rejeté');
        setSelectedCompteRendu(null);
        setCommentaireAdmin('');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors du rejet');
      }
    }
  );

  // Mutation pour modifier un compte rendu pending
  const updatePendingMutation = useMutation(
    async ({ id, data }) => {
      const res = await api.put(`/compte-rendu/${id}`, data);
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('compte-rendu-pending');
        toast.success('Compte rendu modifié avec succès');
        setEditingCompteRendu(null);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de la modification');
      }
    }
  );

  const handleApprove = (cr) => {
    approveMutation.mutate({ id: cr.id, commentaire: commentaireAdmin });
  };

  const handleReject = (cr) => {
    if (window.confirm('Êtes-vous sûr de vouloir rejeter ce compte rendu ?')) {
      rejectMutation.mutate({ id: cr.id, commentaire: commentaireAdmin });
    }
  };

  const getStatutIcon = (statut) => {
    switch (statut) {
      case 'pending':
        return <FaClock className="statut-icon pending" />;
      case 'approved':
        return <FaCheckCircle className="statut-icon approved" />;
      case 'rejected':
        return <FaTimesCircle className="statut-icon rejected" />;
      default:
        return null;
    }
  };

  const getStatutLabel = (statut) => {
    switch (statut) {
      case 'pending':
        return 'En attente';
      case 'approved':
        return 'Approuvé';
      case 'rejected':
        return 'Rejeté';
      default:
        return statut;
    }
  };

  const confirmateurs = confirmateursData || [];
  const commerciaux = commerciauxData || [];
  const centres = centresData || [];
  const installateurs = installateursData || [];
  const etats = etatsData || [];

  const compteRendusPending = comptesRendusPendingData || [];
  const isAdmin = [1, 2, 7].includes(Number(user.fonction));
  const isBackoffice = Number(user.fonction) === 11; // Backoffice = fonction 11
  const isRPConfirmation = Number(user.fonction) === 13; // RP Confirmation = fonction 13
  const canApprove = isAdmin || isBackoffice || isRPConfirmation; // Admins, backoffice et RP Confirmation peuvent approuver / modifier

  const getCardColorByEtat = (cr) => {
    const etat = etats.find((e) => Number(e.id) === Number(cr.id_etat_final));
    if (etat?.color) return etat.color;

    // Fallback sur la couleur du statut CR si aucun état final n'est défini.
    if (cr.statut === 'approved') return '#28a745';
    if (cr.statut === 'rejected') return '#dc3545';
    return '#ffc107';
  };

  const getEtatColorById = (idEtat) => {
    const etat = etats.find((e) => Number(e.id) === Number(idEtat));
    return etat?.color || '#6c757d';
  };

  const hexToRgba = (hex, alpha = 1) => {
    if (!hex || typeof hex !== 'string') return `rgba(255, 193, 7, ${alpha})`;
    const clean = hex.replace('#', '');
    const valid = clean.length === 3 || clean.length === 6;
    if (!valid) return `rgba(255, 193, 7, ${alpha})`;

    const normalized = clean.length === 3
      ? clean.split('').map((c) => c + c).join('')
      : clean;

    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const parseMods = (mods) => {
    if (!mods) return {};
    if (typeof mods === 'string') {
      try { return JSON.parse(mods) || {}; } catch { return {}; }
    }
    return typeof mods === 'object' ? mods : {};
  };

  const getInstallateurName = (value) => {
    if (value == null || value === '') return '';
    const found = installateurs.find((i) => String(i.id) === String(value));
    return found?.nom || String(value);
  };

  const formatDisplayValue = (key, value) => {
    if (value == null || value === '') return '';
    if (key === 'ph3_installateur') return getInstallateurName(value);
    if (['ph3_prix', 'credit_immobilier', 'credit_autre', 'valeur_mensualite', 'ph3_mensualite'].includes(key)) {
      return `${value} €`;
    }
    return String(value);
  };

  const buildCompteRenduDetails = (cr) => {
    if (!isCompteRenduSignerEtat(cr)) {
      return [];
    }
    const mods = parseMods(cr.modifications);
    const picked = (topKey, modKey = topKey) => {
      const topVal = cr[topKey];
      if (topVal != null && String(topVal) !== '') return topVal;
      return mods[modKey];
    };
    const details = [
      { label: 'Pseudo', key: 'pseudo', value: picked('pseudo') },
      { label: 'PAC', key: 'ph3_pac', value: picked('ph3_pac') },
      { label: 'Financement', key: 'ph3_attente', value: picked('ph3_attente') },
      { label: 'Prix', key: 'ph3_prix', value: picked('ph3_prix') },
      { label: 'Crédit immobilier', key: 'credit_immobilier', value: picked('credit_immobilier') },
      { label: 'Autre crédit', key: 'credit_autre', value: picked('credit_autre') },
      { label: 'Puissance', key: 'ph3_puissance', value: picked('ph3_puissance') },
      { label: 'Ballon', key: 'ph3_ballon', value: picked('ph3_ballon') },
      { label: 'Installateur', key: 'ph3_installateur', value: picked('ph3_installateur') },
      { label: 'Consommation annuelle ancien système', key: 'conf_consommations', value: picked('conf_consommations') },
      {
        label: 'Partie à financer du client',
        key: 'valeur_mensualite',
        value:
          picked('valeur_mensualite') ??
          (mods.valeur_mensualite != null && String(mods.valeur_mensualite) !== '' ? mods.valeur_mensualite : null)
      },
      { label: 'Bonus annoncé', key: 'ph3_bonus_30', value: picked('ph3_bonus_30') },
      { label: 'Mensualité du crédit', key: 'ph3_mensualite', value: picked('ph3_mensualite') },
      { label: 'Nombre de mois du crédit', key: 'nbr_annee_finance', value: picked('nbr_annee_finance') },
      { label: 'Alimentation', key: 'ph3_alimentation', value: picked('ph3_alimentation') },
      { label: 'Type', key: 'ph3_type', value: picked('ph3_type') },
      { label: 'Date signature', key: 'date_sign_time', value: picked('date_sign_time') }
    ];
    return details
      .filter((d) => d.value != null && String(d.value) !== '')
      .map((d) => ({ ...d, display: formatDisplayValue(d.key, d.value) }));
  };

  return (
    <div className="compte-rendu-page">
      <div className="page-header">
        <h1><FaClipboardList /> Comptes Rendus</h1>
      </div>

      {/* Section Comptes Rendus Pending */}
      <div className="results-section">
          <div className="pending-header">
            <div className="compte-rendu-filters">
              <div className="filter-group">
                <label htmlFor="filter-date">Date :</label>
                <input
                  id="filter-date"
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="filter-input"
                />
              </div>
              {canApprove && (
                <div className="filter-group">
                  <label htmlFor="filter-commercial">Commercial :</label>
                  <select
                    id="filter-commercial"
                    value={filterCommercial}
                    onChange={(e) => setFilterCommercial(e.target.value)}
                    className="filter-select"
                  >
                    <option value="">Tous</option>
                    {commerciaux.map((c) => (
                      <option key={c.id} value={c.id}>{c.nom} {c.prenom}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {canApprove && (
              <div className="statut-filters">
                <button
                  className={`statut-filter ${selectedStatutPending === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedStatutPending('all')}
                >
                  Tous
                </button>
                <button
                  className={`statut-filter ${selectedStatutPending === 'pending' ? 'active' : ''}`}
                  onClick={() => setSelectedStatutPending('pending')}
                >
                  <FaClock /> En attente
                </button>
                <button
                  className={`statut-filter ${selectedStatutPending === 'approved' ? 'active' : ''}`}
                  onClick={() => setSelectedStatutPending('approved')}
                >
                  <FaCheckCircle /> Approuvés
                </button>
                <button
                  className={`statut-filter ${selectedStatutPending === 'rejected' ? 'active' : ''}`}
                  onClick={() => setSelectedStatutPending('rejected')}
                >
                  <FaTimesCircle /> Rejetés
                </button>
              </div>
            )}
          </div>

          {isLoadingPending ? (
            <div className="loading">Chargement...</div>
          ) : compteRendusPending.length > 0 ? (
            <div className="compte-rendu-list">
              {compteRendusPending.map((cr) => (
                <div
                  key={cr.id}
                  className={`compte-rendu-card statut-${cr.statut}`}
                  style={{
                    border: `1px solid ${getCardColorByEtat(cr)}`,
                    borderLeft: `4px solid ${getCardColorByEtat(cr)}`,
                    background: hexToRgba(getCardColorByEtat(cr), 0.08)
                  }}
                >
                  <div className="cr-header">
                    <div className="cr-info">
                      <div className="cr-title">
                        {getStatutIcon(cr.statut)}
                        <h3>
                          {cr.fiche_nom} {cr.fiche_prenom}
                        </h3>
                        <span className={`statut-badge statut-${cr.statut}`}>{getStatutLabel(cr.statut)}</span>
                      </div>
                      <div className="cr-meta">
                        <span>Tél: {cr.fiche_tel}</span>
                        {isCompteRenduSignerEtat(cr) && (
                          <span>Pseudo: {cr.pseudo || '-'}</span>
                        )}
                        <span>Confirmateur: {cr.confirmateur_pseudo || '-'}</span>
                        <span>Commercial: {cr.commercial_pseudo}</span>
                        <span>Créé le: {new Date(cr.date_creation).toLocaleString('fr-FR')}</span>
                        {cr.date_approbation && (
                          <span>
                            {cr.statut === 'approved' ? 'Approuvé' : 'Rejeté'} le: {new Date(cr.date_approbation).toLocaleString('fr-FR')}
                            {cr.approbateur_pseudo && ` par ${cr.approbateur_pseudo}`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="cr-actions">
                      <FicheDetailLink ficheHash={cr.fiche_hash} ficheId={cr.id_fiche} className="btn-icon" title="Voir fiche">
                        <FaEye />
                      </FicheDetailLink>
                      {canApprove && (
                        <>
                          <button
                            className="btn-icon btn-edit"
                            onClick={() => setEditingCompteRendu(cr)}
                            title="Modifier"
                            disabled={cr.statut === 'approved'}
                          >
                            <FaEdit />
                          </button>
                          {cr.statut === 'pending' && (
                            <>
                              <button
                                className="btn-icon btn-success"
                                onClick={() => {
                                  setSelectedCompteRendu(cr);
                                  setCommentaireAdmin('');
                                }}
                                title="Approuver"
                              >
                                <FaCheck />
                              </button>
                              <button
                                className="btn-icon btn-danger"
                                onClick={() => {
                                  setSelectedCompteRendu(cr);
                                  setCommentaireAdmin('');
                                }}
                                title="Rejeter"
                              >
                                <FaTimes />
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="cr-content">
                    {(cr.id_etat_final || cr.id_sous_etat) && (
                      <div className="cr-field">
                        <strong>État:</strong>
                        <div className="cr-text">
                          {cr.etat_titre && (
                            <span
                              style={{
                                display: 'inline-block',
                                marginLeft: 8,
                                padding: '2px 10px',
                                borderRadius: 999,
                                border: `1px solid ${getEtatColorById(cr.id_etat_final)}`,
                                background: hexToRgba(getEtatColorById(cr.id_etat_final), 0.16),
                                color: '#1f2937',
                                fontWeight: 600
                              }}
                            >
                              {cr.etat_titre}
                            </span>
                          )}
                          {cr.sous_etat_titre && (
                            <span
                              style={{
                                display: 'inline-block',
                                marginLeft: 8,
                                padding: '2px 10px',
                                borderRadius: 999,
                                border: `1px solid ${getEtatColorById(cr.id_etat_final)}`,
                                background: hexToRgba(getEtatColorById(cr.id_etat_final), 0.08),
                                color: '#374151'
                              }}
                            >
                              {cr.sous_etat_titre}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {(() => {
                      const dr = getDateRappelAffichage(cr);
                      if (!dr) return null;
                      return (
                        <div className="cr-field">
                          <strong>{dr.label}:</strong>
                          <div className="cr-text">{dr.text}</div>
                        </div>
                      );
                    })()}

                    {buildCompteRenduDetails(cr).length > 0 && (
                      <div className="cr-field">
                        <strong>Détails compte rendu:</strong>
                        <div className="modifications-list">
                          {buildCompteRenduDetails(cr).map((item) => (
                            <div key={item.key} className="modification-item">
                              <span className="modification-key">{item.label}:</span>
                              <span className="modification-value">{item.display}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {cr.commentaire && (
                      <div className="cr-field">
                        <strong>Commentaire commercial:</strong>
                        <div className="cr-text">{cr.commentaire}</div>
                      </div>
                    )}

                    {cr.commentaire_admin && (
                      <div className="cr-field">
                        <strong>Commentaire admin:</strong>
                        <div className="cr-text">{cr.commentaire_admin}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-data">Aucun compte rendu trouvé</div>
          )}
      </div>

      {/* Modal d'approbation/rejet */}
      {selectedCompteRendu && canApprove && selectedCompteRendu.statut === 'pending' && (
        <div className="modal-overlay" onClick={() => setSelectedCompteRendu(null)}>
          <div className="modal-content approve-compte-rendu-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {selectedCompteRendu.fiche_nom} {selectedCompteRendu.fiche_prenom}
              </h2>
              <button className="btn-close" onClick={() => setSelectedCompteRendu(null)}>
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <div className="action-buttons">
                <button
                  className="btn btn-success"
                  onClick={() => handleApprove(selectedCompteRendu)}
                  disabled={approveMutation.isLoading}
                >
                  <FaCheck /> Approuver
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => handleReject(selectedCompteRendu)}
                  disabled={rejectMutation.isLoading}
                >
                  <FaTimes /> Rejeter
                </button>
              </div>
              <div className="commentaire-section">
                <label>Commentaire (optionnel):</label>
                <textarea
                  value={commentaireAdmin}
                  onChange={(e) => setCommentaireAdmin(e.target.value)}
                  placeholder="Ajouter un commentaire..."
                  rows={4}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de modification */}
      {editingCompteRendu && canApprove && (
        <EditCompteRenduModal
          compteRendu={editingCompteRendu}
          etats={etats}
          onClose={() => setEditingCompteRendu(null)}
          onSave={(data) => {
            updatePendingMutation.mutate({ id: editingCompteRendu.id, data });
          }}
          isLoading={updatePendingMutation.isLoading}
          readOnly={editingCompteRendu.statut === 'approved'}
        />
      )}
    </div>
  );
};

export default CompteRendu;

