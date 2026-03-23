import React, { createContext, useContext, useState } from 'react';
import FicheDetailModal from '../components/FicheDetailModal';

const FicheDetailModalContext = createContext(null);

export const FicheDetailModalProvider = ({ children }) => {
  const [selectedFicheHash, setSelectedFicheHash] = useState(null);
  const [modalOptions, setModalOptions] = useState({});

  const openFicheDetail = (ficheHash, options = {}) => {
    setSelectedFicheHash(ficheHash);
    setModalOptions(options);
  };

  const closeFicheDetail = () => {
    setSelectedFicheHash(null);
    setModalOptions({});
  };

  return (
    <FicheDetailModalContext.Provider value={{ openFicheDetail, closeFicheDetail }}>
      {children}
      {selectedFicheHash && (
        <FicheDetailModal
          ficheHash={selectedFicheHash}
          onClose={closeFicheDetail}
          options={modalOptions}
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

