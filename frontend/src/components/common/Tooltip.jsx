import React, { useState } from 'react';
import './Tooltip.css';

const Tooltip = ({ text, children, position = 'top' }) => {
  const [show, setShow] = useState(false);

  if (!text) return children;

  return (
    <div 
      className="tooltip-wrapper"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show && (
        <div className={`tooltip tooltip-${position}`}>
          {text}
        </div>
      )}
    </div>
  );
};

export default Tooltip;

