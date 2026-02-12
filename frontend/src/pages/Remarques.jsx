import React from 'react';
import { FaCommentDots } from 'react-icons/fa';
import RemarquesContent from '../components/RemarquesContent';
import './Remarques.css';

const Remarques = () => {
  return (
    <div className="page-remarques">
      <div className="page-header">
        <h1><FaCommentDots /> Remarques</h1>
      </div>
      <RemarquesContent />
    </div>
  );
};

export default Remarques;
