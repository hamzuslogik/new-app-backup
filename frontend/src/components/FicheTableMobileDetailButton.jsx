import React from 'react';
import { FaSearch } from 'react-icons/fa';

export default function FicheTableMobileDetailButton({ show, onClick, isLastViewed, iconSize = '11.9px' }) {
  if (!show) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="btn-detail btn-detail--mobile-lead"
      title="Voir la fiche"
      aria-label="Voir la fiche"
    >
      <span className="btn-detail--mobile-lead-inner">
        <FaSearch style={{ color: '#ffffff', fontSize: iconSize }} />
        {isLastViewed && <span className="btn-detail-last-viewed-ring" aria-hidden="true" />}
      </span>
    </button>
  );
}
