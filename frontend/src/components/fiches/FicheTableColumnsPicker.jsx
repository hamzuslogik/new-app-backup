import React, { useEffect, useRef, useState } from 'react';
import { FaColumns } from 'react-icons/fa';
import {
  FICHE_TABLE_COLUMN_DEFS,
  getFicheTableColumnsPref,
  setFicheTableColumnsPref,
} from '../../utils/adminMenuUrls';

/**
 * Bouton « Colonnes » : sélectionner les colonnes visibles du tableau fiches.
 * @param {'badge'|'standard'} layout
 * @param {{ cq?: boolean, decalage?: boolean }} availableGroups
 * @param {(map: Record<string, boolean>) => void} onChange
 */
export default function FicheTableColumnsPicker({
  layout = 'badge',
  availableGroups = {},
  visibility,
  onChange,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const defs = (FICHE_TABLE_COLUMN_DEFS[layout] || FICHE_TABLE_COLUMN_DEFS.badge).filter((col) => {
    if (col.group === 'cq' && !availableGroups.cq) return false;
    if (col.group === 'decalage' && !availableGroups.decalage) return false;
    return true;
  });

  const map = visibility || getFicheTableColumnsPref();

  const toggle = (key, locked) => {
    if (locked) return;
    const next = { ...map, [key]: map[key] === false };
    onChange?.(next);
    setFicheTableColumnsPref(next);
  };

  const showAll = () => {
    const next = { ...map };
    defs.forEach((col) => {
      next[col.key] = true;
    });
    onChange?.(next);
    setFicheTableColumnsPref(next);
  };

  return (
    <div className="fiche-columns-picker" ref={rootRef}>
      <button
        type="button"
        className="btn-fiche-columns"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        title="Choisir les colonnes à afficher"
      >
        <FaColumns aria-hidden />
        <span>Colonnes</span>
      </button>
      {open ? (
        <div className="fiche-columns-picker-panel" role="menu">
          <div className="fiche-columns-picker-panel__head">
            <strong>Colonnes visibles</strong>
            <button type="button" className="fiche-columns-picker-reset" onClick={showAll}>
              Tout afficher
            </button>
          </div>
          <ul className="fiche-columns-picker-list">
            {defs.map((col) => {
              const checked = map[col.key] !== false;
              return (
                <li key={col.key}>
                  <label className={col.locked ? 'is-locked' : undefined}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!!col.locked}
                      onChange={() => toggle(col.key, col.locked)}
                    />
                    <span>{col.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** Helper : colonne visible ? (Nom toujours visible si locked) */
export function isFicheColumnVisible(visibilityMap, key) {
  if (!visibilityMap) return true;
  return visibilityMap[key] !== false;
}
