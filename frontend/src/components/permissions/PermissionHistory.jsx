import React from 'react';
import { useQuery } from 'react-query';
import api from '../../config/api';
import { FaHistory, FaCheck, FaTimes, FaUser } from 'react-icons/fa';
import LoadingSpinner from '../common/LoadingSpinner';
import { useModalScrollLock } from '../../hooks/useModalScrollLock';
import './PermissionHistory.css';

const PermissionHistory = ({ idFonction, onClose }) => {
  // Bloquer le scroll du body quand le modal est ouvert
  useModalScrollLock(true);
  const { data: history, isLoading } = useQuery(
    ['permission-history', idFonction],
    async () => {
      const res = await api.get(`/permissions/history/${idFonction}?limit=100`);
      return res.data.data || [];
    },
    { enabled: !!idFonction }
  );

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStateLabel = (state) => {
    if (state === null || state === undefined) return 'Non défini';
    return state === 1 ? 'Autorisé' : 'Refusé';
  };

  const getStateIcon = (state) => {
    if (state === null || state === undefined) return null;
    return state === 1 ? <FaCheck className="icon-authorized" /> : <FaTimes className="icon-denied" />;
  };

  if (isLoading) {
    return (
      <div className="permission-history-modal">
        <div className="history-modal-content">
          <LoadingSpinner text="Chargement de l'historique..." />
        </div>
      </div>
    );
  }

  return (
    <div className="permission-history-modal">
      <div className="history-modal-content">
        <div className="history-modal-header">
          <h2><FaHistory /> Historique des Modifications</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="history-content">
          {history && history.length > 0 ? (
            <div className="history-list">
              {history.map((item) => (
                <div key={item.id} className="history-item">
                  <div className="history-item-header">
                    <div className="history-permission-info">
                      <h4>{item.permission_nom}</h4>
                      <span className="permission-code">{item.permission_code}</span>
                      <span className="permission-category">{item.permission_categorie}</span>
                    </div>
                    <div className="history-date">
                      {formatDate(item.modified_at)}
                    </div>
                  </div>
                  
                  <div className="history-changes">
                    <div className="change-item">
                      <span className="change-label">Ancien état:</span>
                      <span className={`change-value ${item.ancien_etat === 1 ? 'authorized' : item.ancien_etat === 0 ? 'denied' : 'undefined'}`}>
                        {getStateIcon(item.ancien_etat)}
                        {getStateLabel(item.ancien_etat)}
                      </span>
                    </div>
                    <div className="change-arrow">→</div>
                    <div className="change-item">
                      <span className="change-label">Nouveau état:</span>
                      <span className={`change-value ${item.nouveau_etat === 1 ? 'authorized' : 'denied'}`}>
                        {getStateIcon(item.nouveau_etat)}
                        {getStateLabel(item.nouveau_etat)}
                      </span>
                    </div>
                  </div>

                  {item.modified_by_name && (
                    <div className="history-user">
                      <FaUser /> Modifié par: {item.modified_by_name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="no-history">
              <p>Aucune modification enregistrée pour cette fonction.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PermissionHistory;

