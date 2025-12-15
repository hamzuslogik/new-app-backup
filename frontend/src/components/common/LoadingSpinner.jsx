import React from 'react';
import './LoadingSpinner.css';

const LoadingSpinner = ({ size = 'medium', text = 'Chargement...' }) => {
  return (
    <div className={`loading-spinner-container ${size}`}>
      <div className="spinner"></div>
      {text && <p className="loading-text">{text}</p>}
    </div>
  );
};

export default LoadingSpinner;

