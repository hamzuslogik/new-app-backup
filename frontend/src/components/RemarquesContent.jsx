import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaCommentDots, FaTimes, FaPaperPlane } from 'react-icons/fa';
import { toast } from 'react-toastify';
import './RemarquesContent.css';

const NATURES_OPTIONS = [
  'Discours non conforme',
  'Traitement',
  'Fausse information',
  'Coordonnées',
  'Autres'
];

/** Formulaire d'envoi de remarque (modal Contrôle qualité uniquement). La consultation se fait sur /remarques. */
const RemarquesContent = ({ onClose, ficheContext = null }) => {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const fonction = Number(user?.fonction);
  const isAdmin = [1, 7].includes(fonction);
  const canSend = hasPermission('controle_qualite_view') || isAdmin;

  const initialDestinataire = ficheContext?.id_agent ? String(ficheContext.id_agent) : '';
  const initialFicheId = ficheContext?.id ?? null;

  const [form, setForm] = useState({
    nature_remarque: '',
    id_destinataire: initialDestinataire,
    commentaire: '',
    id_fiche: initialFicheId
  });

  useEffect(() => {
    if (ficheContext) {
      setForm((prev) => ({
        ...prev,
        id_destinataire: ficheContext.id_agent ? String(ficheContext.id_agent) : prev.id_destinataire,
        id_fiche: ficheContext.id ?? null
      }));
    }
  }, [ficheContext]);

  const { data: agentsData } = useQuery(
    'remarques-agents-send-list',
    async () => {
      // for_send=1 : tous les agents qualification actifs (pas seulement ceux déjà alertés)
      const res = await api.get('/remarques/agents', { params: { for_send: 1 } });
      return res.data.data || [];
    },
    { enabled: canSend, staleTime: 60000 }
  );

  const sendMutation = useMutation(
    async (body) => {
      const res = await api.post('/remarques', body);
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['remarques']);
        toast.success('Remarque envoyée.');
        setForm((prev) => ({ ...prev, nature_remarque: '', commentaire: '' }));
        if (onClose) onClose();
      },
      onError: (err) => toast.error(err.response?.data?.message || err.message)
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.nature_remarque || !form.id_destinataire) {
      toast.warning('Veuillez sélectionner la nature et le destinataire.');
      return;
    }
    const body = {
      nature_remarque: form.nature_remarque,
      commentaire: form.commentaire || null,
      id_destinataire: parseInt(form.id_destinataire, 10)
    };
    if (form.id_fiche) body.id_fiche = form.id_fiche;
    sendMutation.mutate(body);
  };

  const agents = agentsData || [];

  return (
    <div className="remarques-content remarques-content--modal">
      {onClose && (
        <div className="remarques-modal-header">
          <h3><FaCommentDots /> Remarques</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}><FaTimes /></button>
        </div>
      )}

      {ficheContext && (
        <div className="remarques-fiche-context">
          <strong>Concernant la fiche :</strong> {ficheContext.nom || '-'} {ficheContext.prenom || ''} – {ficheContext.tel || '-'}
          {ficheContext.agent_pseudo && (
            <span className="remarques-fiche-agent"> (Agent : {ficheContext.agent_pseudo})</span>
          )}
        </div>
      )}

      {canSend ? (
        <form className="remarques-form" onSubmit={handleSubmit}>
          <div className="remarques-form-grid">
            <div className="form-group">
              <label>Nature de la remarque <span className="required">*</span></label>
              <select
                value={form.nature_remarque}
                onChange={(e) => setForm((f) => ({ ...f, nature_remarque: e.target.value }))}
                required
              >
                <option value="">-- Sélectionner --</option>
                {NATURES_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Destinataire (agent qualification) <span className="required">*</span></label>
              <select
                value={form.id_destinataire}
                onChange={(e) => setForm((f) => ({ ...f, id_destinataire: e.target.value }))}
                required
              >
                <option value="">-- Sélectionner --</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.pseudo}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Commentaire</label>
            <textarea
              value={form.commentaire}
              onChange={(e) => setForm((f) => ({ ...f, commentaire: e.target.value }))}
              rows={3}
              placeholder="Commentaire ou détail de la remarque..."
            />
          </div>
          <button type="submit" className="btn-send-remarque" disabled={sendMutation.isLoading}>
            <FaPaperPlane /> {sendMutation.isLoading ? 'Envoi...' : 'Envoyer la remarque'}
          </button>
          <p className="remarques-modal-hint">
            Pour consulter les remarques de votre équipe, utilisez la page <strong>Remarques</strong> du menu.
          </p>
        </form>
      ) : (
        <p className="remarques-modal-hint">Vous n&apos;avez pas les droits pour envoyer des remarques.</p>
      )}
    </div>
  );
};

export default RemarquesContent;
