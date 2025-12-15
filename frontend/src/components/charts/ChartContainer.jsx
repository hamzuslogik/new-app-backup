import React from 'react';
import './ChartContainer.css';

const ChartContainer = ({ title, children, className = '' }) => {
  return (
    <div className={`chart-container ${className}`}>
      {title && <h3 className="chart-title">{title}</h3>}
      <div className="chart-content">
        {children}
      </div>
    </div>
  );
};

export default ChartContainer;

