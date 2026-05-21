import React from 'react';

/** Icône tracking (loupe + graphique) — inline, pas de chargement fichier externe. */
const TrackingButtonIcon = ({ size = 22, className = '' }) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 64 64"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
  >
    <rect x="6" y="10" width="38" height="26" rx="4" fill="#e8edf3" />
    <rect x="12" y="26" width="5" height="8" fill="#94a3b8" />
    <rect x="20" y="22" width="5" height="12" fill="#94a3b8" />
    <rect x="28" y="18" width="5" height="16" fill="#94a3b8" />
    <path
      d="M10 34 L20 24 L28 28 L36 16"
      fill="none"
      stroke="#2563eb"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="10" cy="34" r="2.5" fill="#2563eb" />
    <circle cx="20" cy="24" r="2.5" fill="#2563eb" />
    <circle cx="28" cy="28" r="2.5" fill="#2563eb" />
    <circle cx="36" cy="16" r="2.5" fill="#2563eb" />
    <circle
      cx="14"
      cy="18"
      r="7"
      fill="none"
      stroke="#f97316"
      strokeWidth="4"
      strokeDasharray="14 30"
      transform="rotate(-20 14 18)"
    />
    <circle cx="44" cy="40" r="11" fill="#fff" stroke="#64748b" strokeWidth="2.5" />
    <line x1="52" y1="48" x2="58" y2="56" stroke="#f97316" strokeWidth="4" strokeLinecap="round" />
    <circle cx="50" cy="16" r="5" fill="#22c55e" />
  </svg>
);

export default TrackingButtonIcon;
