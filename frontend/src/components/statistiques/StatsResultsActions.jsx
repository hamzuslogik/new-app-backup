import React, { useEffect, useRef } from 'react';
import { FaFileCsv, FaFileExcel, FaFilePdf, FaPrint, FaColumns, FaEye, FaEyeSlash, FaExternalLinkAlt } from 'react-icons/fa';

export default function StatsResultsActions({
  contextMenu,
  onCloseContextMenu,
  onExport,
  onPrint,
  onOpenColumnFilter,
  onToggleViewFiches,
  viewFichesMode,
  columnFilterOpen,
  onCloseColumnFilter,
  toggleableColumns,
  columnPrefs,
  onColumnPrefsChange,
  children,
}) {
  const panelRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!contextMenu && !columnFilterOpen) return undefined;
    const onDoc = (e) => {
      if (menuRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
      onCloseContextMenu?.();
      onCloseColumnFilter?.();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        onCloseContextMenu?.();
        onCloseColumnFilter?.();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [contextMenu, columnFilterOpen, onCloseContextMenu, onCloseColumnFilter]);

  const setHidden = (id, hidden) => {
    onColumnPrefsChange({
      ...columnPrefs,
      hidden: { ...columnPrefs.hidden, [String(id)]: hidden },
    });
  };

  return (
    <>
      {children}

      {contextMenu && (
        <ul
          ref={menuRef}
          className="stats-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
        >
          <li role="none">
            <button
              type="button"
              role="menuitem"
              className={viewFichesMode ? 'stats-context-menu-active' : ''}
              onClick={onToggleViewFiches}
            >
              <FaExternalLinkAlt />
              {viewFichesMode ? 'Mode fiches actif (clic cellule)' : 'Voir les fiches'}
            </button>
          </li>
          <li className="stats-context-menu-sep" role="separator" />
          <li role="none">
            <button type="button" role="menuitem" onClick={() => onExport('csv')}>
              <FaFileCsv /> Exporter CSV
            </button>
          </li>
          <li role="none">
            <button type="button" role="menuitem" onClick={() => onExport('excel')}>
              <FaFileExcel /> Exporter Excel
            </button>
          </li>
          <li role="none">
            <button type="button" role="menuitem" onClick={() => onExport('pdf')}>
              <FaFilePdf /> Exporter PDF
            </button>
          </li>
          <li className="stats-context-menu-sep" role="separator" />
          <li role="none">
            <button type="button" role="menuitem" onClick={onPrint}>
              <FaPrint /> Imprimer
            </button>
          </li>
          <li className="stats-context-menu-sep" role="separator" />
          <li role="none">
            <button type="button" role="menuitem" onClick={onOpenColumnFilter}>
              <FaColumns /> Colonnes affichées…
            </button>
          </li>
        </ul>
      )}

      {columnFilterOpen && (
        <div className="stats-column-filter-overlay" onClick={onCloseColumnFilter}>
          <div
            ref={panelRef}
            className="stats-column-filter-panel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="stats-column-filter-title"
          >
            <h3 id="stats-column-filter-title">Colonnes affichées</h3>
            <label className="stats-column-filter-option stats-column-filter-global">
              <input
                type="checkbox"
                checked={columnPrefs.hideZeroColumns !== false}
                onChange={(e) =>
                  onColumnPrefsChange({
                    ...columnPrefs,
                    hideZeroColumns: e.target.checked,
                  })
                }
              />
              Masquer automatiquement les colonnes à 0
            </label>
            {toggleableColumns.length === 0 ? (
              <p className="stats-column-filter-empty">Aucune colonne configurable pour cette vue.</p>
            ) : (
              <ul className="stats-column-filter-list">
                {toggleableColumns.map((col) => {
                  const id = String(col.id);
                  const isHidden = columnPrefs.hidden?.[id] === true;
                  const isZero = col.allZeros;
                  const autoHidden = columnPrefs.hideZeroColumns !== false && isZero;
                  const visible = !isHidden && !autoHidden;
                  return (
                    <li key={id}>
                      <label className={autoHidden && !isHidden ? 'stats-column-filter-zero' : ''}>
                        <input
                          type="checkbox"
                          checked={!isHidden}
                          disabled={autoHidden && columnPrefs.hideZeroColumns !== false}
                          onChange={(e) => setHidden(id, !e.target.checked)}
                        />
                        {visible ? <FaEye className="stats-col-icon" /> : <FaEyeSlash className="stats-col-icon" />}
                        <span>{col.label}</span>
                        {isZero && (
                          <span className="stats-column-zero-badge">0</span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="stats-column-filter-actions">
              <button
                type="button"
                className="btn-stats-col-reset"
                onClick={() => onColumnPrefsChange({ hideZeroColumns: true, hidden: {} })}
              >
                Réinitialiser
              </button>
              <button type="button" className="btn-stats-col-close" onClick={onCloseColumnFilter}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
