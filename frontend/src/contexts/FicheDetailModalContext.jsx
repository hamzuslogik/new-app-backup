import React, { createContext, useContext, useState } from 'react';
import FicheDetailModal from '../components/FicheDetailModal';

const FicheDetailModalContext = createContext(null);

export const FicheDetailModalProvider = ({ children }) => {
  const [selectedFicheHash, setSelectedFicheHash] = useState(null);

  const openFicheDetail = (ficheHash) => {
    setSelectedFicheHash(ficheHash);
  };

  const closeFicheDetail = () => {
    setSelectedFicheHash(null);
  };

  return (
    <FicheDetailModalContext.Provider value={{ openFicheDetail, closeFicheDetail }}>
      {children}
      {selectedFicheHash && (
        <FicheDetailModal
          ficheHash={selectedFicheHash}
          onClose={closeFicheDetail}
        />
      )}
    </FicheDetailModalContext.Provider>
  );
};

export const useFicheDetailModal = () => {
  const context = useContext(FicheDetailModalContext);
  if (!context) {
    throw new Error('useFicheDetailModal must be used within a FicheDetailModalProvider');
  }
  return context;
};

