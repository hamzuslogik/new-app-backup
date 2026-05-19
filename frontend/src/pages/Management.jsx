import React, { useState, useEffect } from 'react';
import { FaBuilding, FaUsers, FaMapMarkerAlt, FaBox, FaUserTie, FaFlag, FaBriefcase, FaFileContract, FaCog, FaFire, FaTools, FaList, FaSms, FaProjectDiagram, FaEnvelope, FaMoneyBillWave, FaFileExport, FaPhone, FaLock, FaShieldAlt } from 'react-icons/fa';
import ReglesAutorisationTab from '../components/management/ReglesAutorisationTab';
import CentresTab from '../components/management/CentresTab';
import FinancementTab from '../components/management/FinancementTab';
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
import FournisseursSMSTab from '../components/management/FournisseursSMSTab';
import SMSCategoriesTab from '../components/management/SMSCategoriesTab';
import WorkflowsTab from '../components/management/WorkflowsTab';
import FichesExtractionTab from '../components/management/FichesExtractionTab';
import FichesHashFromTelTab from '../components/management/FichesHashFromTelTab';
import GlobalSettingsTab from '../components/management/GlobalSettingsTab';
import ConnexionsEchoueesTab from '../components/management/ConnexionsEchoueesTab';
import GlobalSearch from '../components/management/GlobalSearch';
import './Management.css';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';

const Management = () => {
  useForceDesktopViewport('management-page-forced');
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
    { id: 'connexions-echouees', label: 'Connexions échouées', icon: FaLock },
    { id: 'departements', label: 'Départements', icon: FaMapMarkerAlt },
    { id: 'produits', label: 'Produits', icon: FaBox },
    { id: 'fonctions', label: 'Fonctions', icon: FaUserTie },
    { id: 'etats', label: 'États', icon: FaFlag },
    { id: 'sous-etat', label: 'Sous-états', icon: FaList },
    { id: 'professions', label: 'Professions', icon: FaBriefcase },
    { id: 'type-contrat', label: 'Types de contrat', icon: FaFileContract },
    { id: 'financement', label: 'Financement', icon: FaMoneyBillWave },
    { id: 'mode-chauffage', label: 'Modes de chauffage', icon: FaFire },
    { id: 'installateurs', label: 'Installateurs', icon: FaTools },
    { id: 'fournisseurs-sms', label: 'Fournisseurs SMS', icon: FaSms },
    { id: 'sms-categories', label: 'Catégories SMS', icon: FaEnvelope },
    { id: 'regles-autorisation', label: 'Règles autorisation', icon: FaShieldAlt },
    { id: 'workflows', label: 'Workflows', icon: FaProjectDiagram },
    { id: 'fiches-extraction', label: 'Extraction fiches', icon: FaFileExport },
    { id: 'fiches-hash-tel', label: 'Hash depuis tel', icon: FaPhone },
    { id: 'global-settings', label: 'Parametres globaux', icon: FaCog },
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
      case 'connexions-echouees':
        return <ConnexionsEchoueesTab />;
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
      case 'financement':
        return <FinancementTab />;
      case 'mode-chauffage':
        return <ModeChauffageTab />;
      case 'installateurs':
        return <InstallateursTab />;
      case 'fournisseurs-sms':
        return <FournisseursSMSTab />;
      case 'sms-categories':
        return <SMSCategoriesTab />;
      case 'regles-autorisation':
        return <ReglesAutorisationTab />;
      case 'workflows':
        return <WorkflowsTab />;
      case 'fiches-extraction':
        return <FichesExtractionTab />;
      case 'fiches-hash-tel':
        return <FichesHashFromTelTab />;
      case 'global-settings':
        return <GlobalSettingsTab />;
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
