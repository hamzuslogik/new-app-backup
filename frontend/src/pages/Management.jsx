import React, { useState, useEffect } from 'react';
import { FaBuilding, FaUsers, FaMapMarkerAlt, FaBox, FaUserTie, FaFlag, FaBriefcase, FaFileContract, FaCog, FaFire, FaTools, FaList } from 'react-icons/fa';
import CentresTab from '../components/management/CentresTab';
import UtilisateursTab from '../components/management/UtilisateursTab';
import DepartementsTab from '../components/management/DepartementsTab';
import ProduitsTab from '../components/management/ProduitsTab';
import FonctionsTab from '../components/management/FonctionsTab';
import EtatsTab from '../components/management/EtatsTab';
import ProfessionsTab from '../components/management/ProfessionsTab';
import TypeContratTab from '../components/management/TypeContratTab';
import ModeChauffageTab from '../components/management/ModeChauffageTab';
import InstallateursTab from '../components/management/InstallateursTab';
import SousEtatTab from '../components/management/SousEtatTab';
import GlobalSearch from '../components/management/GlobalSearch';
import './Management.css';

const Management = () => {
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('management_active_tab');
    return saved || 'centres';
  });

  // Sauvegarder l'onglet actif dans localStorage
  useEffect(() => {
    localStorage.setItem('management_active_tab', activeTab);
  }, [activeTab]);

  // Raccourcis clavier supprimés - seuls ESC et Ctrl+S sont conservés dans les composants individuels

  const tabs = [
    { id: 'centres', label: 'Centres', icon: FaBuilding },
    { id: 'utilisateurs', label: 'Utilisateurs', icon: FaUsers },
    { id: 'departements', label: 'Départements', icon: FaMapMarkerAlt },
    { id: 'produits', label: 'Produits', icon: FaBox },
    { id: 'fonctions', label: 'Fonctions', icon: FaUserTie },
    { id: 'etats', label: 'États', icon: FaFlag },
    { id: 'sous-etat', label: 'Sous-états', icon: FaList },
    { id: 'professions', label: 'Professions', icon: FaBriefcase },
    { id: 'type-contrat', label: 'Types de contrat', icon: FaFileContract },
    { id: 'mode-chauffage', label: 'Modes de chauffage', icon: FaFire },
    { id: 'installateurs', label: 'Installateurs', icon: FaTools },
  ];

  const handleGlobalSearchSelect = (type, item) => {
    setActiveTab(type);
    // Optionnel : déclencher l'édition de l'élément sélectionné
    // Cela nécessiterait de passer une fonction de callback aux onglets
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'centres':
        return <CentresTab />;
      case 'utilisateurs':
        return <UtilisateursTab />;
      case 'departements':
        return <DepartementsTab />;
      case 'produits':
        return <ProduitsTab />;
      case 'fonctions':
        return <FonctionsTab />;
      case 'etats':
        return <EtatsTab />;
      case 'sous-etat':
        return <SousEtatTab />;
      case 'professions':
        return <ProfessionsTab />;
      case 'type-contrat':
        return <TypeContratTab />;
      case 'mode-chauffage':
        return <ModeChauffageTab />;
      case 'installateurs':
        return <InstallateursTab />;
      default:
        return <CentresTab />;
    }
  };

  return (
    <div className="management-page">
      <div className="management-header">
        <h1><FaCog /> Configuration</h1>
        <p>Gérez les paramètres et les entités de référence du système</p>
      </div>

      <GlobalSearch onSelect={handleGlobalSearchSelect} activeTab={activeTab} />

      <div className="management-tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon className="tab-icon" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="management-content">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default Management;
