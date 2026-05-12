import React from 'react';
import { useFicheDetailModal } from '../contexts/FicheDetailModalContext';
import { FaSearch } from 'react-icons/fa';

const FicheDetailLink = ({ ficheHash, ficheId, className = 'btn-detail', children, ...props }) => {
  const { openFicheDetail, lastViewedFicheHash } = useFicheDetailModal();

  // Utiliser hash si disponible, sinon utiliser id
  const hash = ficheHash || ficheId;
  const isLastViewed =
    lastViewedFicheHash != null &&
    hash != null &&
    String(lastViewedFicheHash) === String(hash);

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (hash) {
      openFicheDetail(hash);
    }
  };

  // Extraire les props qui ne doivent pas être passées à l'élément DOM
  const { target, ...restProps } = props;

  // Si c'est un className de bouton avec icône, utiliser le style du bouton
  if (className && (className.includes('btn-detail') || className.includes('btn-detail-link') || className.includes('btn-icon'))) {
    const iconContent = children || <FaSearch style={{ color: '#ffffff', fontSize: '13.6px' }} />;
    return (
      <button
        type="button"
        className={className}
        onClick={handleClick}
        title={restProps.title || "Voir les détails"}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          cursor: 'pointer',
          ...restProps.style 
        }}
        {...restProps}
      >
        <span
          style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {iconContent}
          {isLastViewed && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '28px',
                height: '28px',
                border: '3px solid #9e9e9e',
                borderRadius: '1px',
                backgroundColor: 'transparent',
                boxSizing: 'border-box',
                pointerEvents: 'none',
              }}
            />
          )}
        </span>
      </button>
    );
  }

  // Pour les liens textuels (btn-link, rdv-link, etc.), utiliser un anchor stylé comme un lien
  return (
    <a
      href={`/fiches/${hash}`}
      className={className}
      onClick={handleClick}
      {...restProps}
    >
      {children || 'Détails'}
    </a>
  );
};

export default FicheDetailLink;

