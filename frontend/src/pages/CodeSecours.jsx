import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import { FaKey, FaCopy, FaSync, FaShieldAlt } from 'react-icons/fa';
import api from '../config/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import './CodeSecours.css';

const CodeSecours = () => {
  const queryClient = useQueryClient();
  const [generatedCodes, setGeneratedCodes] = useState(null);
  const [confirmGenerate, setConfirmGenerate] = useState(false);

  const { data: status, isLoading } = useQuery(
    'codes-secours-status',
    async () => {
      const res = await api.get('/codes-secours/status');
      return res.data.data;
    }
  );

  const generateMutation = useMutation(
    async () => {
      const res = await api.post('/codes-secours/generate');
      return res.data;
    },
    {
      onSuccess: (data) => {
        setGeneratedCodes(data.data?.codes || []);
        setConfirmGenerate(false);
        queryClient.invalidateQueries('codes-secours-status');
        toast.success(data.message || 'Codes générés avec succès');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de la génération');
      }
    }
  );

  const handleCopyAll = async () => {
    if (!generatedCodes?.length) return;
    const text = generatedCodes.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Codes copiés dans le presse-papiers');
    } catch {
      toast.error('Impossible de copier les codes');
    }
  };

  const handleGenerate = () => {
    if (!confirmGenerate) {
      setConfirmGenerate(true);
      return;
    }
    generateMutation.mutate();
  };

  const formatDate = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString('fr-FR');
  };

  return (
    <div className="code-secours-page">
      <div className="code-secours-header">
        <div className="code-secours-title">
          <FaShieldAlt className="code-secours-icon" />
          <div>
            <h1>Codes de secours</h1>
            <p>Génération de codes à usage unique pour la connexion de secours</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="code-secours-stats">
          <div className="stat-card">
            <span className="stat-label">Codes disponibles</span>
            <span className="stat-value">{status?.disponibles ?? 0}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Codes utilisés</span>
            <span className="stat-value">{status?.utilises ?? 0}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Dernière génération</span>
            <span className="stat-value stat-value--date">
              {formatDate(status?.derniere_generation)}
            </span>
          </div>
        </div>
      )}

      <div className="code-secours-panel">
        <div className="code-secours-warning">
          <FaKey />
          <div>
            <strong>Important</strong>
            <p>
              Chaque génération crée 10 codes à 4 chiffres et remplace tous les codes précédents.
              Les codes en clair ne sont affichés qu&apos;une seule fois : copiez-les et conservez-les
              en lieu sûr.
            </p>
          </div>
        </div>

        <div className="code-secours-actions">
          {confirmGenerate && (
            <p className="code-secours-confirm">
              Cette action invalidera tous les codes existants. Confirmer ?
            </p>
          )}
          <button
            type="button"
            className="btn-generate"
            onClick={handleGenerate}
            disabled={generateMutation.isLoading}
          >
            <FaSync className={generateMutation.isLoading ? 'spin' : ''} />
            {confirmGenerate ? 'Confirmer la génération' : 'Générer 10 nouveaux codes'}
          </button>
          {confirmGenerate && (
            <button
              type="button"
              className="btn-cancel"
              onClick={() => setConfirmGenerate(false)}
              disabled={generateMutation.isLoading}
            >
              Annuler
            </button>
          )}
        </div>

        {generatedCodes?.length > 0 && (
          <div className="code-secours-result">
            <div className="code-secours-result-header">
              <h2>Codes générés — à conserver immédiatement</h2>
              <button type="button" className="btn-copy" onClick={handleCopyAll}>
                <FaCopy /> Copier tout
              </button>
            </div>
            <div className="code-secours-grid">
              {generatedCodes.map((code, index) => (
                <div key={`${code}-${index}`} className="code-item">
                  {code}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CodeSecours;
