import React, { useState, useMemo } from 'react';
import { useQuery } from 'react-query';
import api from '../../config/api';
import { FaSearch, FaTimes } from 'react-icons/fa';
import './GlobalSearch.css';

const GlobalSearch = ({ onSelect, activeTab }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Récupérer toutes les données de toutes les entités
  const { data: centres } = useQuery('centres', async () => {
    const response = await api.get('/management/centres');
    return response.data.data || [];
  }, { enabled: isOpen });

  const { data: utilisateurs } = useQuery('utilisateurs', async () => {
    const response = await api.get('/management/utilisateurs');
    return response.data.data || [];
  }, { enabled: isOpen });

  const { data: departements } = useQuery('departements', async () => {
    const response = await api.get('/management/departements');
    return response.data.data || [];
  }, { enabled: isOpen });

  const { data: produits } = useQuery('produits', async () => {
    const response = await api.get('/management/produits');
    return response.data.data || [];
  }, { enabled: isOpen });

  const { data: fonctions } = useQuery('fonctions', async () => {
    const response = await api.get('/management/fonctions');
    return response.data.data || [];
  }, { enabled: isOpen });

  const { data: etats } = useQuery('etats', async () => {
    const response = await api.get('/management/etats');
    return response.data.data || [];
  }, { enabled: isOpen });

  const { data: professions } = useQuery('professions', async () => {
    const response = await api.get('/management/professions');
    return response.data.data || [];
  }, { enabled: isOpen });

  const { data: typeContrat } = useQuery('type-contrat', async () => {
    const response = await api.get('/management/type-contrat');
    return response.data.data || [];
  }, { enabled: isOpen });

  const { data: modeChauffage } = useQuery('mode-chauffage', async () => {
    const response = await api.get('/management/mode-chauffage');
    return response.data.data || [];
  }, { enabled: isOpen });

  const { data: installateurs } = useQuery('installateurs', async () => {
    const response = await api.get('/management/installateurs');
    return response.data.data || [];
  }, { enabled: isOpen });

  // Recherche globale dans toutes les entités
  const searchResults = useMemo(() => {
    if (!searchTerm.trim() || !isOpen) return [];

    const term = searchTerm.toLowerCase();
    const results = [];

    // Centres
    centres?.forEach(item => {
      if (item.titre?.toLowerCase().includes(term) || item.id?.toString().includes(term)) {
        results.push({ type: 'centres', label: 'Centres', item, display: item.titre });
      }
    });

    // Utilisateurs
    utilisateurs?.forEach(item => {
      const searchable = `${item.nom || ''} ${item.prenom || ''} ${item.pseudo || ''} ${item.login || ''}`.toLowerCase();
      if (searchable.includes(term) || item.id?.toString().includes(term)) {
        results.push({ type: 'utilisateurs', label: 'Utilisateurs', item, display: `${item.pseudo} (${item.nom} ${item.prenom})` });
      }
    });

    // Départements
    departements?.forEach(item => {
      const searchable = `${item.departement_code || ''} ${item.departement_nom || ''}`.toLowerCase();
      if (searchable.includes(term) || item.id?.toString().includes(term)) {
        results.push({ type: 'departements', label: 'Départements', item, display: `${item.departement_code} - ${item.departement_nom}` });
      }
    });

    // Produits
    produits?.forEach(item => {
      if (item.nom?.toLowerCase().includes(term) || item.id?.toString().includes(term)) {
        results.push({ type: 'produits', label: 'Produits', item, display: item.nom });
      }
    });

    // Fonctions
    fonctions?.forEach(item => {
      if (item.titre?.toLowerCase().includes(term) || item.id?.toString().includes(term)) {
        results.push({ type: 'fonctions', label: 'Fonctions', item, display: item.titre });
      }
    });

    // États
    etats?.forEach(item => {
      if (item.titre?.toLowerCase().includes(term) || item.abbreviation?.toLowerCase().includes(term) || item.id?.toString().includes(term)) {
        results.push({ type: 'etats', label: 'États', item, display: item.titre });
      }
    });

    // Professions
    professions?.forEach(item => {
      if (item.nom?.toLowerCase().includes(term) || item.id?.toString().includes(term)) {
        results.push({ type: 'professions', label: 'Professions', item, display: item.nom });
      }
    });

    // Types de contrat
    typeContrat?.forEach(item => {
      if (item.nom?.toLowerCase().includes(term) || item.id?.toString().includes(term)) {
        results.push({ type: 'type-contrat', label: 'Types de contrat', item, display: item.nom });
      }
    });

    // Modes de chauffage
    modeChauffage?.forEach(item => {
      if (item.nom?.toLowerCase().includes(term) || item.id?.toString().includes(term)) {
        results.push({ type: 'mode-chauffage', label: 'Modes de chauffage', item, display: item.nom });
      }
    });

    // Installateurs
    installateurs?.forEach(item => {
      if (item.nom?.toLowerCase().includes(term) || item.id?.toString().includes(term)) {
        results.push({ type: 'installateurs', label: 'Installateurs', item, display: item.nom });
      }
    });

    return results.slice(0, 20); // Limiter à 20 résultats
  }, [searchTerm, isOpen, centres, utilisateurs, departements, produits, fonctions, etats, professions, typeContrat, modeChauffage, installateurs]);

  const handleSelect = (result) => {
    if (onSelect) {
      onSelect(result.type, result.item);
    }
    setSearchTerm('');
    setIsOpen(false);
  };

  return (
    <div className="global-search-container">
      <div className="global-search-input-wrapper">
        <FaSearch className="global-search-icon" />
        <input
          type="text"
          placeholder="Recherche globale (Ctrl+K)..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="global-search-input"
        />
        {searchTerm && (
          <button
            className="global-search-clear"
            onClick={() => {
              setSearchTerm('');
              setIsOpen(false);
            }}
          >
            <FaTimes />
          </button>
        )}
      </div>

      {isOpen && searchTerm && (
        <div className="global-search-results">
          {searchResults.length > 0 ? (
            <>
              <div className="global-search-header">
                <span>{searchResults.length} résultat(s) trouvé(s)</span>
              </div>
              <div className="global-search-list">
                {searchResults.map((result, index) => (
                  <div
                    key={`${result.type}-${result.item.id}-${index}`}
                    className="global-search-item"
                    onClick={() => handleSelect(result)}
                  >
                    <span className="global-search-type">{result.label}</span>
                    <span className="global-search-display">{result.display}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="global-search-empty">
              Aucun résultat trouvé pour "{searchTerm}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;

