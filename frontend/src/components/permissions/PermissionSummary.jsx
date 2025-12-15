import React, { useMemo } from 'react';
import { FaCheck, FaTimes, FaInfoCircle } from 'react-icons/fa';
import './PermissionSummary.css';

const PermissionSummary = ({ 
  currentPermissions, 
  originalPermissions, 
  permissionsList 
}) => {
  const summary = useMemo(() => {
    if (!permissionsList || !currentPermissions || !originalPermissions) {
      return null;
    }

    const changes = [];
    const added = [];
    const removed = [];
    const unchanged = [];

    permissionsList.forEach(perm => {
      const current = currentPermissions[perm.id] === true;
      const original = originalPermissions[perm.id] === true;

      if (current !== original) {
        changes.push({
          permission: perm,
          from: original ? 'Autorisé' : 'Refusé',
          to: current ? 'Autorisé' : 'Refusé'
        });
      } else if (current) {
        unchanged.push(perm);
      }

      if (current && !original) {
        added.push(perm);
      } else if (!current && original) {
        removed.push(perm);
      }
    });

    // Statistiques par catégorie
    const categoryStats = {};
    permissionsList.forEach(perm => {
      if (!categoryStats[perm.categorie]) {
        categoryStats[perm.categorie] = {
          total: 0,
          authorized: 0,
          denied: 0,
          changed: 0
        };
      }
      categoryStats[perm.categorie].total++;
      if (currentPermissions[perm.id] === true) {
        categoryStats[perm.categorie].authorized++;
      } else {
        categoryStats[perm.categorie].denied++;
      }
      if (currentPermissions[perm.id] !== originalPermissions[perm.id]) {
        categoryStats[perm.categorie].changed++;
      }
    });

    return {
      total: permissionsList.length,
      authorized: Object.values(currentPermissions).filter(p => p === true).length,
      denied: Object.values(currentPermissions).filter(p => p === false).length,
      changes: changes.length,
      added: added.length,
      removed: removed.length,
      unchanged: unchanged.length,
      changesList: changes,
      categoryStats
    };
  }, [currentPermissions, originalPermissions, permissionsList]);

  if (!summary) {
    return null;
  }

  return (
    <div className="permission-summary">
      <div className="summary-header">
        <FaInfoCircle />
        <h3>Résumé des modifications</h3>
      </div>

      <div className="summary-stats">
        <div className="stat-card stat-total">
          <div className="stat-value">{summary.total}</div>
          <div className="stat-label">Total</div>
        </div>
        <div className="stat-card stat-authorized">
          <div className="stat-value">{summary.authorized}</div>
          <div className="stat-label">Autorisés</div>
        </div>
        <div className="stat-card stat-denied">
          <div className="stat-value">{summary.denied}</div>
          <div className="stat-label">Refusés</div>
        </div>
        <div className="stat-card stat-changes">
          <div className="stat-value">{summary.changes}</div>
          <div className="stat-label">Modifications</div>
        </div>
      </div>

      {summary.changes > 0 && (
        <div className="summary-changes">
          <h4>Modifications détaillées ({summary.changes})</h4>
          <div className="changes-list">
            {summary.changesList.slice(0, 10).map((change, index) => (
              <div key={index} className="change-item">
                <span className="permission-name">{change.permission.nom}</span>
                <span className="change-arrow">→</span>
                <span className={`change-to ${change.to === 'Autorisé' ? 'authorized' : 'denied'}`}>
                  {change.to === 'Autorisé' ? <FaCheck /> : <FaTimes />}
                  {change.to}
                </span>
              </div>
            ))}
            {summary.changesList.length > 10 && (
              <div className="more-changes">
                + {summary.changesList.length - 10} autre(s) modification(s)
              </div>
            )}
          </div>
        </div>
      )}

      <div className="summary-categories">
        <h4>Par catégorie</h4>
        <div className="categories-list">
          {Object.entries(summary.categoryStats).map(([categorie, stats]) => (
            <div key={categorie} className="category-stat">
              <div className="category-name">{categorie}</div>
              <div className="category-details">
                <span className="detail-item">
                  <FaCheck className="icon-authorized" />
                  {stats.authorized}
                </span>
                <span className="detail-item">
                  <FaTimes className="icon-denied" />
                  {stats.denied}
                </span>
                {stats.changed > 0 && (
                  <span className="detail-item changed">
                    {stats.changed} modifié{stats.changed > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PermissionSummary;

