import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaSearch, FaChevronDown, FaChevronUp, FaCheckCircle, FaFilter, FaUserCheck, FaCheck, FaComment, FaTimes, FaSave, FaBan, FaBell, FaCommentDots } from 'react-icons/fa';
import { toast } from 'react-toastify';
import FicheDetailLink from '../components/FicheDetailLink';
import RemarquesContent from '../components/RemarquesContent';
import { getEtatsGroupedByPhase } from '../utils/etatsByPhase';
import SystemMessageBanner from '../components/SystemMessageBanner';
import './ControleQualite.css';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';

// ID de l'état KO et HC
const ETAT_KO_ID = 54;
const ETAT_HC_ID = 55;

const ControleQualite = () => {
  useForceDesktopViewport('controle-qualite-page');
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 50,
    id_agent: '',
    id_etat_final: '',
    date_debut: new Date().toISOString().split('T')[0], // Date du jour par défaut
    date_fin: new Date().toISOString().split('T')[0] // Date du jour par défaut
  });
  
  // État pour gérer l'édition du commentaire qualité
  const [editingComment, setEditingComment] = useState({ hash: null, value: '' });
  // Confirmateur à enregistrer dans l'historique (RE, RP Confirmation, admin, backoffice)
  const [histoConfirmateurId, setHistoConfirmateurId] = useState('');
  
  // État pour le modal KO
  const [koModal, setKoModal] = useState({
    isOpen: false,
    ficheHash: null,
    sousEtatId: '',
    commentaire: ''
  });
  
  // État pour le modal HC
  const [hcModal, setHcModal] = useState({
    isOpen: false,
    ficheHash: null,
    sousEtatId: '',
    commentaire: ''
  });

  // État pour le modal Alerte KO (type PERSO/TECHNIQUE + commentaire)
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    ficheHash: null,
    fiche: null,
    typeAlerte: 'PERSO',
    commentaire: '',
    nbAlertes: null
  });

  // Modal Remarques (envoyer / consulter les remarques qualité → agents qualification)
  const [remarquesModalOpen, setRemarquesModalOpen] = useState(false);
  const [remarquesFicheContext, setRemarquesFicheContext] = useState(null);

  // Récupérer les agents qualification
  const { data: agentsData } = useQuery('agents-qualif-list', async () => {
    const res = await api.get('/management/utilisateurs');
    return res.data.data?.filter(u => u.fonction === 3) || [];
  });

  // Récupérer les états du groupe 0 uniquement (sans "En-Attente") pour les filtres et la sélection
  const { data: etatsData } = useQuery('etats-groupe-0-sans-en-attente', async () => {
    const res = await api.get('/management/etats');
    // Filtrer uniquement les états du groupe 0, exclure "En-Attente" (ID 1 ou titre contenant "ATTENTE")
    return res.data.data?.filter(e => {
      const isGroupe0 = (e.groupe === '0' || e.groupe === 0);
      const isEnAttente = e.id === 1 || 
                         (e.titre && (e.titre.toUpperCase().includes('ATTENTE') || e.titre.toUpperCase() === 'EN-ATTENTE'));
      return isGroupe0 && !isEnAttente;
    }) || [];
  });

  // Récupérer tous les états pour vérifier si un état est groupe 0 ou non
  const { data: allEtatsData } = useQuery('all-etats', async () => {
    const res = await api.get('/management/etats');
    return res.data.data || [];
  });

  // Confirmateurs (pour RE/RP/admin/backoffice : choix du confirmateur à enregistrer dans l'historique)
  const { data: confirmateursData } = useQuery('confirmateurs-list', async () => {
    const res = await api.get('/management/utilisateurs');
    return res.data.data?.filter(u => u.fonction === 6 && (u.etat > 0 || u.etat == null)) || [];
  });
  const confirmateurs = confirmateursData || [];
  const showHistoConfirmateurDropdown = [1, 7, 13, 14].includes(Number(user?.fonction));

  // Récupérer les sous-états pour l'état KO (id 54)
  const { data: sousEtatsKoData } = useQuery('sous-etats-ko', async () => {
    const res = await api.get(`/management/sous-etat/${ETAT_KO_ID}`);
    return res.data.data || [];
  });

  // Récupérer les sous-états pour l'état HC (id 55)
  const { data: sousEtatsHcData } = useQuery('sous-etats-hc', async () => {
    const res = await api.get(`/management/sous-etat/${ETAT_HC_ID}`);
    return res.data.data || [];
  });

  // Nombre d'alertes KO pour la fiche du modal (quand le modal alerte est ouvert)
  const { data: alertesKoData } = useQuery(
    ['alertes-ko-count', alertModal.ficheHash],
    async () => {
      const res = await api.get(`/fiches/${alertModal.ficheHash}/alertes-ko`);
      return res.data;
    },
    { enabled: !!alertModal.ficheHash && alertModal.isOpen }
  );

  // Sous-états pour l'état sélectionné dans le modal alerte (états autres que KO/HC)
  // Récupérer les fiches avec rafraîchissement automatique toutes les 3 secondes
  const { data: fichesData, isLoading, error, refetch } = useQuery(
    ['controle-qualite', filters],
    async () => {
      try {
        const params = { ...filters };
        Object.keys(params).forEach(key => {
          if (params[key] === '' || params[key] === null) delete params[key];
        });
        const res = await api.get('/fiches/controle-qualite', { params });
        console.log('Réponse contrôle qualité:', res.data);
        // Vérifier la structure de la réponse
        if (res.data && res.data.success) {
          return res.data;
        } else {
          throw new Error(res.data?.message || 'Format de réponse inattendu');
        }
      } catch (error) {
        console.error('Erreur lors du chargement des fiches contrôle qualité:', error);
        console.error('Détails de l\'erreur:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
        throw error;
      }
    },
    {
      // Rafraîchissement automatique toutes les 3 secondes
      refetchInterval: 3000,
      // Rafraîchir quand la fenêtre redevient active
      refetchOnWindowFocus: true,
      // Rafraîchir quand la connexion est rétablie
      refetchOnReconnect: true,
      onError: (error) => {
        console.error('Erreur useQuery contrôle qualité:', error);
        const errorMessage = error.response?.data?.message || error.message || 'Erreur lors du chargement des fiches';
        toast.error(errorMessage);
      }
    }
  );

  // Mutation pour modifier rapidement l'état
  const updateEtatMutation = useMutation(
    async ({ hash, id_etat_final }) => {
      const res = await api.put(`/fiches/${hash}/etat-rapide`, { id_etat_final });
      return res.data;
    },
    {
      onSuccess: () => {
        // Invalider et rafraîchir immédiatement pour tous les utilisateurs
        queryClient.invalidateQueries(['controle-qualite']);
        refetch();
        toast.success('État mis à jour avec succès');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de la mise à jour de l\'état');
      }
    }
  );

  // Mutation pour valider une fiche (passer en En-Attente)
  const validateQualiteMutation = useMutation(
    async (hash) => {
      const res = await api.put(`/fiches/${hash}/valider-qualite`);
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['controle-qualite']);
        refetch();
        toast.success('Fiche validée et passée en état "En-Attente"');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de la validation');
      }
    }
  );

  // Mutation pour valider en KO : En-Attente + ko = 1 (fiche utilisée mais non comptabilisée pour l'agent)
  const validateQualiteKoMutation = useMutation(
    async ({ hash, id_sous_etat, commentaire_ko }) => {
      const res = await api.put(`/fiches/${hash}/valider-qualite-ko`, {
        id_sous_etat,
        commentaire_ko
      });
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['controle-qualite']);
        refetch();
        toast.success('Fiche validée (KO) : En-Attente, non comptabilisée pour l\'agent');
        // Fermer le modal
        setKoModal({ isOpen: false, ficheHash: null, sousEtatId: '', commentaire: '' });
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de la validation KO');
      }
    }
  );

  // Mutation pour valider en HC : état HC + sous-état sélectionné (fiche hors cible)
  const validateQualiteHcMutation = useMutation(
    async ({ hash, id_sous_etat, commentaire_hc }) => {
      const res = await api.put(`/fiches/${hash}/valider-qualite-hc`, {
        id_sous_etat,
        commentaire_hc
      });
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['controle-qualite']);
        refetch();
        toast.success('Fiche validée (HC) : état HC, hors cible');
        // Fermer le modal
        setHcModal({ isOpen: false, ficheHash: null, sousEtatId: '', commentaire: '' });
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de la validation HC');
      }
    }
  );

  // Mutation pour envoyer une alerte KO (type PERSO/TECHNIQUE + commentaire)
  const sendAlerteKoMutation = useMutation(
    async ({ hash, type_alerte, commentaire }) => {
      const res = await api.post(`/fiches/${hash}/alerte-ko`, {
        type_alerte: type_alerte || 'PERSO',
        commentaire: commentaire || null
      });
      return res.data;
    },
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries(['controle-qualite']);
        queryClient.invalidateQueries(['alertes-ko-count']);
        refetch();
        toast.success(data?.message || `Alerte ${data?.data?.num_alerte}/3 envoyée à l'agent`);
        closeAlertModal();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de l\'envoi de l\'alerte');
      }
    }
  );

  // Mutation pour mettre à jour le commentaire qualité
  const updateCommentaireQualiteMutation = useMutation(
    async ({ hash, commentaire_qualite }) => {
      const res = await api.patch(`/fiches/${hash}/field`, {
        field: 'commentaire_qualite',
        value: commentaire_qualite
      });
      return res.data;
    },
    {
      onSuccess: () => {
        // Invalider et rafraîchir immédiatement pour tous les utilisateurs
        queryClient.invalidateQueries(['controle-qualite']);
        refetch();
        toast.success('Commentaire qualité enregistré avec succès');
        setEditingComment({ hash: null, value: '' });
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de l\'enregistrement du commentaire');
      }
    }
  );

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleEtatChange = (hash, newEtatId) => {
    if (!newEtatId) return;
    updateEtatMutation.mutate({
      hash,
      id_etat_final: parseInt(newEtatId),
      histo_id_confirmateur: showHistoConfirmateurDropdown ? (histoConfirmateurId || undefined) : undefined
    });
  };

  // Quand on choisit KO ou HC dans la liste déroulante : ouvrir le modal au lieu de changer l'état directement
  const handleNouvelEtatSelect = (fiche, newEtatId) => {
    const id = newEtatId ? parseInt(newEtatId, 10) : null;
    if (id === ETAT_KO_ID) {
      openKoModal(fiche);
      return;
    }
    if (id === ETAT_HC_ID) {
      openHcModal(fiche);
      return;
    }
    handleEtatChange(fiche.hash, newEtatId);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEtatColor = (etat) => {
    return etat?.color || '#cccccc';
  };

  // Vérifier si un état est groupe 0
  const isEtatGroupe0 = (id_etat_final) => {
    if (!id_etat_final || !allEtatsData) return false;
    const etat = allEtatsData.find(e => e.id === id_etat_final);
    return etat && (etat.groupe === '0' || etat.groupe === 0);
  };

  // Obtenir le libellé à afficher pour l'état actuel
  // "Validée" / "Validée (KO)" uniquement si l'état n'est pas dans le groupe 0
  const getEtatActuelLabel = (fiche) => {
    if (isEtatGroupe0(fiche.id_etat_final)) {
      return fiche.etat_titre || '-';
    }
    if (fiche.ko === 1 || fiche.ko === '1') {
      return 'VALIDÉ (KO)';
    }
    return 'Validé';
  };

  // Obtenir la couleur pour l'état actuel
  const getEtatActuelColor = (fiche) => {
    if (isEtatGroupe0(fiche.id_etat_final)) {
      return getEtatColor(fiche);
    }
    if (fiche.ko === 1 || fiche.ko === '1') {
      return '#dc3545';
    }
    return '#28a745';
  };

  const handleEditComment = (hash, currentComment) => {
    setEditingComment({ hash, value: currentComment || '' });
  };

  const handleSaveComment = (hash) => {
    const commentValue = editingComment.hash === hash ? editingComment.value : '';
    if (commentValue !== undefined) {
      updateCommentaireQualiteMutation.mutate({
        hash,
        commentaire_qualite: commentValue
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingComment({ hash: null, value: '' });
  };

  // Gestion des raccourcis clavier pour sauvegarder rapidement
  const handleKeyDown = (e, hash) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSaveComment(hash);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingComment({ hash: null, value: '' });
    }
  };

  const fiches = fichesData?.data || [];
  const pagination = fichesData?.pagination || { page: 1, limit: 50, total: 0, pages: 1 };
  const agents = agentsData || [];
  const etats = etatsData || [];
  const allEtats = allEtatsData || [];
  const sousEtatsKo = sousEtatsKoData || [];
  const sousEtatsHc = sousEtatsHcData || [];
  const { phase0: etatsPhase0, phase1: etatsPhase1, phase2: etatsPhase2, phase3: etatsPhase3 } = getEtatsGroupedByPhase(allEtats);

  // IDs des états pour lesquels tout agent qualité peut modifier (Debrief, À vérifier)
  const etatsQualiteOuverts = React.useMemo(() => {
    if (!allEtats || !allEtats.length) return [];
    return allEtats
      .filter(e => {
        const t = (e.titre || '').toLowerCase();
        return t.includes('debrif') || t.includes('verifier');
      })
      .map(e => e.id);
  }, [allEtats]);

  // Fiche verrouillée si validée (état hors groupe 0) pour tout le monde, ou si assignée à un autre agent qualité et état hors Debrief/À vérifier
  const isFicheLockedForUser = (fiche) => {
    // Fiche validée (Validé, En-Attente, KO, HC, etc.) : verrouillée pour tout le monde
    if (!isEtatGroupe0(fiche.id_etat_final)) return true;
    // Sinon : verrouillée si assignée à un autre agent qualité et état hors Debrief/À vérifier
    if (!user?.id || !fiche?.id_qualite) return false;
    if (Number(fiche.id_qualite) === Number(user.id)) return false;
    if (etatsQualiteOuverts.includes(Number(fiche.id_etat_final))) return false;
    return true;
  };

  const getLockMessage = (fiche) =>
    !isEtatGroupe0(fiche?.id_etat_final)
      ? 'Cette fiche est validée et verrouillée pour tout le monde.'
      : 'Cette fiche est déjà assignée à un autre agent qualité. Seul l\'agent assigné peut la modifier, sauf si l\'état est "Debrief" ou "À vérifier".';

  // Fonctions pour gérer le modal KO
  const openKoModal = (fiche) => {
    setKoModal({
      isOpen: true,
      ficheHash: fiche.hash,
      sousEtatId: fiche.id_sous_etat ? String(fiche.id_sous_etat) : '',
      commentaire: fiche.commentaire_qualite || ''
    });
  };

  const closeKoModal = () => {
    setKoModal({ isOpen: false, ficheHash: null, sousEtatId: '', commentaire: '' });
  };

  const handleKoModalSubmit = () => {
    if (!koModal.sousEtatId) {
      toast.warning('Veuillez sélectionner un sous-état KO');
      return;
    }
    validateQualiteKoMutation.mutate({
      hash: koModal.ficheHash,
      id_sous_etat: parseInt(koModal.sousEtatId),
      commentaire_ko: koModal.commentaire
    });
  };

  // Fonctions pour gérer le modal HC
  const openHcModal = (fiche) => {
    setHcModal({
      isOpen: true,
      ficheHash: fiche.hash,
      sousEtatId: fiche.id_sous_etat ? String(fiche.id_sous_etat) : '',
      commentaire: fiche.commentaire_qualite || ''
    });
  };

  const closeHcModal = () => {
    setHcModal({ isOpen: false, ficheHash: null, sousEtatId: '', commentaire: '' });
  };

  const handleHcModalSubmit = () => {
    if (!hcModal.sousEtatId) {
      toast.warning('Veuillez sélectionner un sous-état HC');
      return;
    }
    validateQualiteHcMutation.mutate({
      hash: hcModal.ficheHash,
      id_sous_etat: parseInt(hcModal.sousEtatId),
      commentaire_hc: hcModal.commentaire
    });
  };

  // Modal Alerte KO : ouvrir / fermer / envoyer
  const openAlertModal = (fiche) => {
    setAlertModal({
      isOpen: true,
      ficheHash: fiche.hash,
      fiche,
      typeAlerte: 'PERSO',
      commentaire: '',
      nbAlertes: null
    });
  };

  const closeAlertModal = () => {
    setAlertModal({
      isOpen: false,
      ficheHash: null,
      fiche: null,
      typeAlerte: 'PERSO',
      commentaire: '',
      nbAlertes: null
    });
  };

  const handleAlertModalSubmit = () => {
    const nbAlertes = alertesKoData?.nb_alertes ?? 0;
    const typeAlerte = alertModal.typeAlerte || 'PERSO';
    const nbCeType = typeAlerte === 'PERSO'
      ? (alertesKoData?.nb_alertes_perso_agent_mois ?? 0)
      : (alertesKoData?.nb_alertes_technique_agent_mois ?? 0);
    if (nbCeType >= 3) {
      toast.warning(`Cet agent a déjà reçu 3 alertes ${typeAlerte} ce mois-ci. Limite atteinte (3 par type).`);
      return;
    }
    if (nbAlertes >= 3) {
      toast.warning('3 alertes ont déjà été envoyées pour cette fiche.');
      return;
    }
    sendAlerteKoMutation.mutate({
      hash: alertModal.ficheHash,
      type_alerte: typeAlerte,
      commentaire: alertModal.commentaire || null
    });
  };

  return (
    <div className="controle-qualite">
      <SystemMessageBanner />
      <div className="page-header">
        <h1><FaUserCheck /> Contrôle Qualité</h1>
        <div className="page-header-actions">
          <button
            type="button"
            className="btn-remarques-header"
            onClick={() => { setRemarquesFicheContext(null); setRemarquesModalOpen(true); }}
            title="Ouvrir les remarques (qualité → agents qualification)"
          >
            <FaCommentDots />
          </button>
          <button 
            className="filter-toggle-btn" 
            onClick={() => setShowFilters(!showFilters)}
          >
            <FaFilter /> {showFilters ? 'Masquer' : 'Afficher'} les filtres
          </button>
        </div>
      </div>

      {/* Modal Remarques */}
      {remarquesModalOpen && (
        <div className="modal-overlay" onClick={() => { setRemarquesModalOpen(false); setRemarquesFicheContext(null); }}>
          <div className="modal-content remarques-modal" onClick={(e) => e.stopPropagation()}>
            <RemarquesContent
              inModal
              onClose={() => { setRemarquesModalOpen(false); setRemarquesFicheContext(null); }}
              ficheContext={remarquesFicheContext}
            />
          </div>
        </div>
      )}

      {showFilters && (
        <div className="search-form">
          <div className="form-grid">
            <div className="form-group">
              <label>Agent</label>
              <select
                value={filters.id_agent}
                onChange={(e) => handleFilterChange('id_agent', e.target.value)}
              >
                <option value="">Tous les agents</option>
                {agents.map(agent => (
                  <option key={agent.id} value={agent.id}>
                    {agent.pseudo}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>État</label>
              <select
                value={filters.id_etat_final}
                onChange={(e) => handleFilterChange('id_etat_final', e.target.value)}
              >
                <option value="">Tous les états</option>
                {etatsPhase0.map(etat => (
                  <option key={etat.id} value={etat.id} style={{ backgroundColor: etat.color || '#cccccc' }}>
                    {etat.titre}
                  </option>
                ))}
              </select>
            </div>

            {showHistoConfirmateurDropdown && (
              <div className="form-group">
                <label>Confirmateur (historique)</label>
                <select
                  value={histoConfirmateurId}
                  onChange={(e) => setHistoConfirmateurId(e.target.value)}
                  title="Confirmateur enregistré dans l'historique lors du changement d'état"
                >
                  <option value="">Tout</option>
                  {confirmateurs.map(c => (
                    <option key={c.id} value={c.id}>{c.pseudo || `Utilisateur ${c.id}`}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label>Date début</label>
              <input
                type="date"
                value={filters.date_debut}
                onChange={(e) => handleFilterChange('date_debut', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Date fin</label>
              <input
                type="date"
                value={filters.date_fin}
                onChange={(e) => handleFilterChange('date_fin', e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      <div className="results-info">
        <p>
          Total: <strong>{pagination.total}</strong> fiches
          {pagination.pages > 1 && (
            <> | Page <strong>{pagination.page}</strong> sur <strong>{pagination.pages}</strong></>
          )}
        </p>
      </div>

      {isLoading ? (
        <div className="loading">Chargement des fiches...</div>
      ) : error ? (
        <div className="error">
          <p>Erreur lors du chargement des fiches</p>
          <p style={{ fontSize: '10.2px', color: '#666', marginTop: '10px' }}>
            {error.response?.data?.message || error.message || 'Erreur inconnue'}
          </p>
          {error.response?.data?.error && (
            <p style={{ fontSize: '9.4px', color: '#999', marginTop: '5px' }}>
              Détails: {error.response.data.error}
            </p>
          )}
          <button 
            onClick={() => refetch()} 
            style={{ marginTop: '15px', padding: '8px 16px', cursor: 'pointer' }}
          >
            Réessayer
          </button>
        </div>
      ) : fiches.length === 0 ? (
        <div className="no-results">Aucune fiche trouvée</div>
      ) : (
        <>
          <div className="fiches-table-container">
            <table className="fiches-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Prénom</th>
                  <th>Téléphone</th>
                  <th>CP</th>
                  <th>Ville</th>
                  <th>Agent</th>
                  <th>Date Insertion</th>
                  <th>État Actuel</th>
                  <th>Nouvel État</th>
                  <th>Commentaire agent</th>
                  <th>Commentaire Qualité</th>
                  <th>Utilisateur Qualité</th>
                  <th className="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {fiches.map((fiche) => (
                  <tr
                    key={fiche.hash}
                    className={isFicheLockedForUser(fiche) ? 'fiche-row-locked' : ''}
                  >
                    <td>{fiche.nom || '-'}</td>
                    <td>{fiche.prenom || '-'}</td>
                    <td>{fiche.tel || '-'}</td>
                    <td>{fiche.cp || '-'}</td>
                    <td>{fiche.ville || '-'}</td>
                    <td>{fiche.agent_pseudo || '-'}</td>
                    <td>{formatDate(fiche.date_insert_time)}</td>
                    <td>
                      <span 
                        className="etat-badge"
                        style={{ backgroundColor: getEtatActuelColor(fiche) }}
                      >
                        {getEtatActuelLabel(fiche)}
                      </span>
                    </td>
                    <td>
                      <select
                        value={isEtatGroupe0(fiche.id_etat_final) ? (fiche.id_etat_final || '') : ''}
                        onChange={(e) => handleNouvelEtatSelect(fiche, e.target.value)}
                        className="etat-select"
                        disabled={updateEtatMutation.isLoading || isFicheLockedForUser(fiche)}
                        title={isFicheLockedForUser(fiche) ? getLockMessage(fiche) : undefined}
                      >
                        <option value="">{isEtatGroupe0(fiche.id_etat_final) ? '-- Sélectionner --' : 'Validé'}</option>
                        {etatsPhase0.map(etat => (
                            <option key={etat.id} value={etat.id} style={{ backgroundColor: etat.color || '#cccccc' }}>
                              {etat.titre}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td className="comment-agent-cell">
                      <span className="comment-agent-text">{fiche.commentaire || '-'}</span>
                    </td>
                    <td>
                      <div className="comment-quick-edit-container">
                        <div className="comment-quick-actions">
                          {(() => {
                            const currentValue = editingComment.hash === fiche.hash ? editingComment.value : (fiche.commentaire_qualite || '');
                            const originalValue = fiche.commentaire_qualite || '';
                            const hasChanges = editingComment.hash === fiche.hash && currentValue !== originalValue;
                            
                            return hasChanges && !isFicheLockedForUser(fiche) && (
                              <>
                                <button
                                  className="btn-save-comment-quick"
                                  onClick={() => handleSaveComment(fiche.hash)}
                                  disabled={updateCommentaireQualiteMutation.isLoading}
                                  title="Enregistrer (Ctrl+Enter)"
                                >
                                  <FaSave />
                                </button>
                                <button
                                  className="btn-cancel-comment-quick"
                                  onClick={() => {
                                    setEditingComment({ hash: null, value: '' });
                                  }}
                                  disabled={updateCommentaireQualiteMutation.isLoading}
                                  title="Annuler (Echap)"
                                >
                                  <FaTimes />
                                </button>
                              </>
                            );
                          })()}
                        </div>
                        <textarea
                          value={editingComment.hash === fiche.hash ? editingComment.value : (fiche.commentaire_qualite || '')}
                          onChange={(e) => {
                            if (isFicheLockedForUser(fiche)) return;
                            if (editingComment.hash !== fiche.hash) {
                              setEditingComment({ hash: fiche.hash, value: e.target.value });
                            } else {
                              setEditingComment({ ...editingComment, value: e.target.value });
                            }
                          }}
                          onFocus={() => {
                            if (isFicheLockedForUser(fiche)) return;
                            if (editingComment.hash !== fiche.hash) {
                              setEditingComment({ hash: fiche.hash, value: fiche.commentaire_qualite || '' });
                            }
                          }}
                          onKeyDown={(e) => handleKeyDown(e, fiche.hash)}
                          className="comment-textarea-quick"
                          placeholder="Commentaire qualité... (Ctrl+Enter pour sauvegarder)"
                          rows={2}
                          readOnly={isFicheLockedForUser(fiche)}
                          title={isFicheLockedForUser(fiche) ? getLockMessage(fiche) : undefined}
                        />
                      </div>
                    </td>
                    <td>
                      {isFicheLockedForUser(fiche) && (
                        <span className="fiche-locked-badge" title={getLockMessage(fiche)}>Verrouillée</span>
                      )}
                      {fiche.qualite_assignee_pseudo ? (
                        <span className="qualite-user-name" title={`Utilisateur qualité assigné: ${fiche.qualite_assignee_pseudo}`}>
                          {fiche.qualite_assignee_pseudo}
                          {fiche.qualite_assignee_nom && fiche.qualite_assignee_prenom && (
                            <span className="qualite-user-full-name">
                              {' '}({fiche.qualite_assignee_prenom} {fiche.qualite_assignee_nom})
                            </span>
                          )}
                        </span>
                      ) : fiche.qualite_user_pseudo ? (
                        <span className="qualite-user-name" title={`Dernier modificateur: ${fiche.qualite_user_pseudo}`}>
                          {fiche.qualite_user_pseudo}
                          {fiche.qualite_user_nom && fiche.qualite_user_prenom && (
                            <span className="qualite-user-full-name">
                              {' '}({fiche.qualite_user_prenom} {fiche.qualite_user_nom})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="qualite-user-name no-user">-</span>
                      )}
                    </td>
                    <td className="actions-col">
                      <div className="action-buttons">
                        <button
                          className="btn-validate-icon"
                          onClick={() => validateQualiteMutation.mutate(fiche.hash)}
                          disabled={validateQualiteMutation.isLoading || isFicheLockedForUser(fiche)}
                          title={isFicheLockedForUser(fiche) ? getLockMessage(fiche) : "Valider et passer en En-Attente"}
                        >
                          <FaCheckCircle />
                        </button>
                        <button
                          className="btn-validate-ko"
                          onClick={() => openKoModal(fiche)}
                          disabled={validateQualiteKoMutation.isLoading || isFicheLockedForUser(fiche)}
                          title={isFicheLockedForUser(fiche) ? getLockMessage(fiche) : "Valider (KO) : En-Attente, fiche non comptabilisée pour l'agent"}
                        >
                          <FaBan /> KO
                        </button>
                        <button
                          className="btn-validate-hc"
                          onClick={() => openHcModal(fiche)}
                          disabled={validateQualiteHcMutation.isLoading || isFicheLockedForUser(fiche)}
                          title={isFicheLockedForUser(fiche) ? getLockMessage(fiche) : "Valider (HC) : état HC, fiche hors cible"}
                        >
                          HC
                        </button>
                        <button
                          type="button"
                          className="btn-alerte-ko"
                          onClick={() => openAlertModal(fiche)}
                          disabled={sendAlerteKoMutation.isLoading || (fiche.nb_alertes ?? 0) >= 1 || isFicheLockedForUser(fiche)}
                          title={isFicheLockedForUser(fiche) ? getLockMessage(fiche) : ((fiche.nb_alertes ?? 0) >= 1 ? 'Une alerte a déjà été envoyée pour cette fiche' : "Envoyer une alerte à l'agent qui a inséré la fiche (3 alertes avant KO)")}
                        >
                          <FaBell /> Alerte
                        </button>
                        <button
                          type="button"
                          className="btn-remarques-fiche"
                          onClick={() => { setRemarquesFicheContext(fiche); setRemarquesModalOpen(true); }}
                          title="Envoyer une remarque concernant cette fiche à l'agent qualification"
                        >
                          <FaCommentDots />
                        </button>
                        <FicheDetailLink 
                          ficheHash={fiche.hash}
                          className="btn-detail-icon"
                          title="Voir les détails"
                        >
                          <FaSearch />
                        </FicheDetailLink>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.pages > 1 && (
            <div className="pagination">
              <button
                onClick={() => handleFilterChange('page', pagination.page - 1)}
                disabled={pagination.page === 1}
              >
                Précédent
              </button>
              <span>
                Page {pagination.page} sur {pagination.pages}
              </span>
              <button
                onClick={() => handleFilterChange('page', pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
              >
                Suivant
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal KO */}
      {koModal.isOpen && (
        <div className="modal-overlay" onClick={closeKoModal}>
          <div className="modal-content ko-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><FaBan /> Validation KO</h3>
              <button className="modal-close-btn" onClick={closeKoModal}>
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Sous-état KO <span className="required">*</span></label>
                <select
                  value={koModal.sousEtatId}
                  onChange={(e) => setKoModal({ ...koModal, sousEtatId: e.target.value })}
                  className="ko-sous-etat-select"
                >
                  <option value="">-- Sélectionner un sous-état --</option>
                  {sousEtatsKo.map(se => (
                    <option key={se.id} value={se.id}>{se.titre}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Commentaire</label>
                <textarea
                  value={koModal.commentaire}
                  onChange={(e) => setKoModal({ ...koModal, commentaire: e.target.value })}
                  className="ko-commentaire-textarea"
                  placeholder="Commentaire sur la raison du KO..."
                  rows={4}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={closeKoModal}>
                Annuler
              </button>
              <button
                className="btn-confirm-ko"
                onClick={handleKoModalSubmit}
                disabled={validateQualiteKoMutation.isLoading || !koModal.sousEtatId}
              >
                {validateQualiteKoMutation.isLoading ? 'Validation...' : 'Valider KO'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal HC */}
      {hcModal.isOpen && (
        <div className="modal-overlay" onClick={closeHcModal}>
          <div className="modal-content hc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Validation HC (Hors Cible)</h3>
              <button className="modal-close-btn" onClick={closeHcModal}>
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Sous-état HC <span className="required">*</span></label>
                <select
                  value={hcModal.sousEtatId}
                  onChange={(e) => setHcModal({ ...hcModal, sousEtatId: e.target.value })}
                  className="hc-sous-etat-select"
                >
                  <option value="">-- Sélectionner un sous-état --</option>
                  {sousEtatsHc.map(se => (
                    <option key={se.id} value={se.id}>{se.titre}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Commentaire</label>
                <textarea
                  value={hcModal.commentaire}
                  onChange={(e) => setHcModal({ ...hcModal, commentaire: e.target.value })}
                  className="hc-commentaire-textarea"
                  placeholder="Commentaire sur la raison du HC..."
                  rows={4}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={closeHcModal}>
                Annuler
              </button>
              <button
                className="btn-confirm-hc"
                onClick={handleHcModalSubmit}
                disabled={validateQualiteHcMutation.isLoading || !hcModal.sousEtatId}
              >
                {validateQualiteHcMutation.isLoading ? 'Validation...' : 'Valider HC'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Alerte KO */}
      {alertModal.isOpen && alertModal.fiche && (
        <div className="modal-overlay" onClick={closeAlertModal}>
          <div className="modal-content alerte-ko-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><FaBell /> Envoyer une alerte à l'agent</h3>
              <button type="button" className="modal-close-btn" onClick={closeAlertModal}>
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <p className="alerte-ko-info">
                Alerte envoyée à l'agent qualification qui a inséré la fiche. Choisissez le type (PERSO ou TECHNIQUE) et un commentaire. Un agent peut recevoir jusqu'à 3 alertes PERSO et 3 alertes TECHNIQUE par mois. 3 alertes doivent être envoyées sur une fiche avant de pouvoir la passer en KO.
              </p>
              <div className="form-group">
                <label>Agent destinataire</label>
                <p className="modal-readonly-value">{alertModal.fiche.agent_pseudo || '-'}</p>
              </div>
              <div className="form-group">
                <label>Client</label>
                <p className="modal-readonly-value">
                  {alertModal.fiche.nom || '-'} {alertModal.fiche.prenom || ''} – {alertModal.fiche.tel || '-'}
                </p>
              </div>
              {alertesKoData != null && (
                <>
                  <p className="alerte-ko-count">
                    <strong>{alertesKoData.nb_alertes ?? 0}/3</strong> alertes pour cette fiche (avant passage KO)
                  </p>
                  <p className="alerte-ko-count">
                    <strong>{alertesKoData.nb_alertes_perso_agent_mois ?? 0}/3</strong> PERSO et <strong>{alertesKoData.nb_alertes_technique_agent_mois ?? 0}/3</strong> TECHNIQUE reçues par cet agent ce mois-ci (3 de chaque type autorisées)
                  </p>
                </>
              )}
              <div className="form-group">
                <label>Type d'alerte <span className="required">*</span></label>
                <select
                  value={alertModal.typeAlerte}
                  onChange={(e) => setAlertModal({ ...alertModal, typeAlerte: e.target.value })}
                  className="etat-select"
                >
                  <option value="PERSO">PERSO</option>
                  <option value="TECHNIQUE">TECHNIQUE</option>
                </select>
              </div>
              <div className="form-group">
                <label>Commentaire</label>
                <textarea
                  value={alertModal.commentaire}
                  onChange={(e) => setAlertModal({ ...alertModal, commentaire: e.target.value })}
                  className="commentaire-textarea"
                  placeholder="Message ou commentaire pour l'agent..."
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-cancel" onClick={closeAlertModal}>
                Annuler
              </button>
              <button
                type="button"
                className="btn-confirm-alerte"
                onClick={handleAlertModalSubmit}
                disabled={sendAlerteKoMutation.isLoading || (alertModal.typeAlerte === 'PERSO' ? (alertesKoData?.nb_alertes_perso_agent_mois ?? 0) : (alertesKoData?.nb_alertes_technique_agent_mois ?? 0)) >= 3 || (alertesKoData?.nb_alertes ?? 0) >= 3}
              >
                {sendAlerteKoMutation.isLoading ? 'Envoi...' : 'Envoyer l\'alerte'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ControleQualite;

