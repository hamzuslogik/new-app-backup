import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaCheck, FaTimes, FaSave, FaLock, FaUnlock, FaShieldAlt, FaSearch, FaCopy, FaHistory, FaVial } from 'react-icons/fa';
import { toast } from 'react-toastify';
import PermissionTemplates from '../components/permissions/PermissionTemplates';
import PermissionHistory from '../components/permissions/PermissionHistory';
import PermissionSummary from '../components/permissions/PermissionSummary';
import PermissionTester from '../components/permissions/PermissionTester';
import { useModalScrollLock } from '../hooks/useModalScrollLock';
import './Permissions.css';

const Permissions = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedFonction, setSelectedFonction] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [originalPermissions, setOriginalPermissions] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showTester, setShowTester] = useState(false);
  
  // Bloquer le scroll du body quand un modal est ouvert
  useModalScrollLock(showTemplates || showHistory || showTester);

  // Récupérer les fonctions
  const { data: fonctionsData } = useQuery('fonctions', async () => {
    const res = await api.get('/management/fonctions');
    return res.data.data || [];
  });

  // Récupérer les permissions d'une fonction
  const { data: fonctionPermissionsData, isLoading } = useQuery(
    ['permissions', 'fonction', selectedFonction],
    async () => {
      if (!selectedFonction) return null;
      const res = await api.get(`/permissions/fonction/${selectedFonction}`);
      return res.data.data || [];
    },
    { enabled: !!selectedFonction }
  );

  // Initialiser les permissions quand elles sont chargées
  useEffect(() => {
    if (fonctionPermissionsData) {
      const permsMap = {};
      fonctionPermissionsData.forEach(perm => {
        permsMap[perm.id] = perm.autorise === 1;
      });
      setPermissions(permsMap);
      setOriginalPermissions({ ...permsMap }); // Sauvegarder l'état original
    }
  }, [fonctionPermissionsData]);

  // Mutation pour sauvegarder les permissions
  const saveMutation = useMutation(
    async (data) => {
      const res = await api.post(`/permissions/fonction/${selectedFonction}`, data);
      return res.data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['permissions', 'fonction', selectedFonction]);
        setOriginalPermissions({ ...permissions }); // Mettre à jour l'état original après sauvegarde
        setShowSummary(false);
        toast.success('Permissions mises à jour avec succès');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Erreur lors de la sauvegarde');
      }
    }
  );

  const handleTogglePermission = (permissionId) => {
    setPermissions(prev => ({
      ...prev,
      [permissionId]: !prev[permissionId]
    }));
  };

  const handleSave = () => {
    if (!selectedFonction) {
      toast.error('Veuillez sélectionner une fonction');
      return;
    }

    const permissionsArray = Object.entries(permissions).map(([id_permission, autorise]) => ({
      id_permission: parseInt(id_permission),
      autorise: autorise
    }));

    saveMutation.mutate({ permissions: permissionsArray });
  };

  const handleApplyTemplate = () => {
    queryClient.invalidateQueries(['permissions', 'fonction', selectedFonction]);
    setShowTemplates(false);
  };

  const handleSelectAll = (categorie) => {
    if (!fonctionPermissionsData) return;

    const newPermissions = { ...permissions };
    fonctionPermissionsData
      .filter(p => p.categorie === categorie)
      .forEach(p => {
        newPermissions[p.id] = true;
      });
    setPermissions(newPermissions);
  };

  const handleDeselectAll = (categorie) => {
    if (!fonctionPermissionsData) return;

    const newPermissions = { ...permissions };
    fonctionPermissionsData
      .filter(p => p.categorie === categorie)
      .forEach(p => {
        newPermissions[p.id] = false;
      });
    setPermissions(newPermissions);
  };

  const fonctions = fonctionsData || [];
  const permissionsList = fonctionPermissionsData || [];

  // Filtrer les permissions selon le terme de recherche
  const filteredPermissionsList = useMemo(() => {
    if (!searchTerm.trim()) return permissionsList;
    const term = searchTerm.toLowerCase();
    return permissionsList.filter(perm => 
      perm.nom?.toLowerCase().includes(term) ||
      perm.code?.toLowerCase().includes(term) ||
      perm.description?.toLowerCase().includes(term) ||
      perm.categorie?.toLowerCase().includes(term)
    );
  }, [permissionsList, searchTerm]);

  // Grouper les permissions par catégorie
  const permissionsByCategory = {};
  filteredPermissionsList.forEach(perm => {
    if (!permissionsByCategory[perm.categorie]) {
      permissionsByCategory[perm.categorie] = [];
    }
    permissionsByCategory[perm.categorie].push(perm);
  });

  // Liste de toutes les pages avec leur permission correspondante
  const pagesList = [
    { path: '/dashboard', name: 'Dashboard', permission: 'dashboard_view' },
    { path: '/recherche-fiches', name: 'Recherche Fiches', permission: 'dashboard_view' },
    { path: '/fiches', name: 'Fiches', permission: 'fiches_view' },
    { path: '/fiches/:id', name: 'Détail Fiche', permission: 'fiches_detail' },
    { path: '/planning', name: 'Planning', permission: 'planning_view' },
    { path: '/planning-dep', name: 'Planning Dép', permission: 'planning_view' },
    { path: '/planning-commercial', name: 'Planning Commercial', permission: 'planning_commercial_view' },
    { path: '/planning-hebdomadaire', name: 'Planning Hebdomadaire', permission: 'planning_view' },
    { path: '/affectation-dep', name: 'Affectation Dép', permission: 'affectation_view' },
    { path: '/statistiques', name: 'Statistiques', permission: 'statistiques_view' },
    { path: '/statistiques-rdv', name: 'Statistiques RDV', permission: 'statistiques_rdv_view' },
    { path: '/statistiques-fiches', name: 'Statistiques Fiches', permission: 'statistiques_fiches_view' },
    { path: '/assistance-ia', name: 'Assistance IA', permission: 'assistance_ia_view' },
    { path: '/affectation', name: 'Affectation', permission: 'affectation_view' },
    { path: '/suivi-telepro', name: 'Suivi Télépro', permission: 'suivi_telepro_view' },
    { path: '/suivi-agents-qualif', name: 'Suivi Agents Qualif', permission: 'suivi_agents_view' },
    { path: '/suivi-agents', name: 'Suivi Agents', permission: 'suivi_agents_view' },
    { path: '/production-qualif', name: 'Production Qualif', permission: 'production_qualif_view' },
    { path: '/kpi-qualification', name: 'KPI Qualification', permission: 'kpi_qualification_view' },
    { path: '/kpis', name: 'KPIs', permission: 'kpis_view' },
    { path: '/statistiques-v2', name: 'Statistiques V2', permission: 'statistiques_v2_view' },
    { path: '/controle-qualite', name: 'Contrôle Qualité', permission: 'controle_qualite_view' },
    { path: '/audit-rdv', name: 'Audit RDV', permission: 'controle_qualite_view', allowFunctions: [4, 13] },
    { path: '/compte-rendu', name: 'Compte Rendu', permission: 'compte_rendu_view' },
    { path: '/compte-rendu-pending', name: 'Compte Rendu Pending', permission: null, allowFunctions: [1, 2, 5, 7, 13] },
    { path: '/phase3', name: 'Phase 3', permission: 'phase3_view' },
    { path: '/permissions', name: 'Permissions', permission: 'config_permissions', excludeFunctions: [8] },
    { path: '/import-masse', name: 'Import Masse', permission: 'import_masse_view', excludeFunctions: [8] },
    { path: '/messages', name: 'Messages', permission: 'messages_view' },
    { path: '/users', name: 'Utilisateurs', permission: 'users_view' },
    { path: '/stats-agents-qualite', name: 'Stats Agents Qualité', permission: 'stats_agents_qualite_view' },
    { path: '/management', name: 'Management', permission: 'management_view', excludeFunctions: [8] },
    { path: '/decalages', name: 'Décalages', permission: 'decalage_view' },
    { path: '/validation', name: 'Validation', permission: 'validation_view' },
    { path: '/mes-rappels', name: 'Mes Rappels', permission: 'dashboard_view', allowFunctions: [6, 13, 14] },
    { path: '/rappels-bureau', name: 'Rappels Bureau', permission: null, allowFunctions: [13] },
    { path: '/demandes-insertion', name: 'Demandes Insertion', permission: 'demandes_insertion_view' },
    { path: '/notifications', name: 'Notifications', permission: null },
    { path: '/signatures', name: 'Signatures', permission: 'signatures_view' },
  ];

  // Fonction pour obtenir le statut de permission d'une page
  const getPagePermissionStatus = (page) => {
    if (!selectedFonction || !permissionsList.length) return null;
    
    // Si la page n'a pas de permission (allowFunctions uniquement)
    if (!page.permission) {
      return page.allowFunctions ? 'special' : 'no-permission';
    }
    
    // Chercher la permission dans la liste
    const perm = permissionsList.find(p => p.code === page.permission);
    if (!perm) {
      return 'missing'; // Permission n'existe pas dans la base de données
    }
    
    // Vérifier si autorisée
    return permissions[perm.id] === true ? 'authorized' : 'denied';
  };

  // Calculer les statistiques par catégorie
  const categoryStats = useMemo(() => {
    const stats = {};
    Object.keys(permissionsByCategory).forEach(categorie => {
      const perms = permissionsByCategory[categorie];
      const authorized = perms.filter(p => permissions[p.id] === true).length;
      const denied = perms.filter(p => permissions[p.id] === false).length;
      stats[categorie] = {
        total: perms.length,
        authorized,
        denied
      };
    });
    return stats;
  }, [permissionsByCategory, permissions]);

  return (
    <div className="permissions-page">
      <div className="permissions-header">
        <h1><FaShieldAlt /> Gestion des Permissions</h1>
        <p className="subtitle">Configurez les permissions pour chaque fonction</p>
      </div>

      <div className="permissions-content">
        <div className="fonction-selector">
          <label htmlFor="fonction-select">Sélectionner une fonction :</label>
          <select
            id="fonction-select"
            value={selectedFonction || ''}
            onChange={(e) => setSelectedFonction(e.target.value ? parseInt(e.target.value) : null)}
            className="form-select"
          >
            <option value="">-- Choisir une fonction --</option>
            {fonctions.map(fonction => (
              <option key={fonction.id} value={fonction.id}>
                {fonction.titre}
              </option>
            ))}
          </select>
        </div>

        {selectedFonction && (
          <>
            {isLoading ? (
              <div className="loading">Chargement des permissions...</div>
            ) : (
              <>
                {/* Barre de recherche */}
                <div className="permissions-search-bar">
                  <div className="search-input-wrapper">
                    <FaSearch className="search-icon" />
                    <input
                      type="text"
                      placeholder="Rechercher une permission par nom, code, description ou catégorie..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="search-input"
                    />
                  </div>
                  {searchTerm && (
                    <span className="search-results-count">
                      {filteredPermissionsList.length} permission(s) trouvée(s)
                    </span>
                  )}
                </div>

                <div className="permissions-actions">
                  <div className="actions-left">
                    <button
                      className="btn-secondary"
                      onClick={() => setShowTemplates(true)}
                      title="Gérer les templates de permissions"
                    >
                      <FaCopy /> Templates
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => setShowHistory(true)}
                      title="Voir l'historique des modifications"
                    >
                      <FaHistory /> Historique
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => setShowTester(true)}
                      title="Tester les permissions d'un utilisateur"
                    >
                      <FaVial /> Tester
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => setShowSummary(!showSummary)}
                      title="Voir le résumé des modifications"
                    >
                      Résumé
                    </button>
                  </div>
                  <button
                    className="btn-save"
                    onClick={handleSave}
                    disabled={saveMutation.isLoading}
                  >
                    <FaSave /> {saveMutation.isLoading ? 'Sauvegarde...' : 'Sauvegarder les permissions'}
                  </button>
                </div>

                {showSummary && (
                  <PermissionSummary
                    currentPermissions={permissions}
                    originalPermissions={originalPermissions}
                    permissionsList={filteredPermissionsList}
                  />
                )}

                <div className="permissions-list">
                  {Object.entries(permissionsByCategory).map(([categorie, perms]) => {
                    const stats = categoryStats[categorie] || { total: 0, authorized: 0, denied: 0 };
                    return (
                      <div key={categorie} className="permission-category">
                        <div className="category-header">
                          <div className="category-title-section">
                            <h3>{categorie.charAt(0).toUpperCase() + categorie.slice(1)}</h3>
                            <div className="category-stats">
                              <span className="stat-badge stat-authorized">
                                {stats.authorized} autorisé{stats.authorized > 1 ? 's' : ''}
                              </span>
                              <span className="stat-badge stat-denied">
                                {stats.denied} refusé{stats.denied > 1 ? 's' : ''}
                              </span>
                              <span className="stat-badge stat-total">
                                {stats.total} total
                              </span>
                            </div>
                          </div>
                          <div className="category-actions">
                            <button
                              className="btn-select-all"
                              onClick={() => handleSelectAll(categorie)}
                              title="Tout autoriser"
                            >
                              <FaUnlock /> Tout autoriser
                            </button>
                            <button
                              className="btn-deselect-all"
                              onClick={() => handleDeselectAll(categorie)}
                              title="Tout refuser"
                            >
                              <FaLock /> Tout refuser
                            </button>
                          </div>
                        </div>
                      <div className="permissions-grid">
                        {perms.map(perm => (
                          <div
                            key={perm.id}
                            className={`permission-item ${permissions[perm.id] ? 'authorized' : 'denied'}`}
                          >
                            <div className="permission-info">
                              <h4>{perm.nom}</h4>
                              {perm.description && (
                                <p className="permission-description">{perm.description}</p>
                              )}
                              <span className="permission-code">{perm.code}</span>
                            </div>
                            <div className="permission-toggle">
                              <button
                                className={`toggle-btn ${permissions[perm.id] ? 'active' : ''}`}
                                onClick={() => handleTogglePermission(perm.id)}
                                title={permissions[perm.id] ? 'Autorisé' : 'Refusé'}
                              >
                                {permissions[perm.id] ? (
                                  <>
                                    <FaCheck /> Autoriser
                                  </>
                                ) : (
                                  <>
                                    <FaTimes /> Refuser
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {!selectedFonction && (
          <div className="no-selection">
            <p>Veuillez sélectionner une fonction pour gérer ses permissions</p>
          </div>
        )}

        {/* Liste des pages avec leur statut de permission */}
        {selectedFonction && (
          <div className="pages-permissions-list">
            <h2>Liste des Pages et Permissions</h2>
            <p className="pages-description">
              Vue d'ensemble de toutes les pages de l'application avec leur permission correspondante et leur statut pour la fonction sélectionnée.
            </p>
            <div className="pages-table-wrapper">
              <table className="pages-table">
                <thead>
                  <tr>
                    <th>Page</th>
                    <th>Permission</th>
                    <th>Statut</th>
                    <th>Remarques</th>
                  </tr>
                </thead>
                <tbody>
                  {pagesList.map((page, index) => {
                    const status = getPagePermissionStatus(page);
                    const statusLabels = {
                      'authorized': { text: 'Autorisé', class: 'status-authorized' },
                      'denied': { text: 'Refusé', class: 'status-denied' },
                      'missing': { text: 'Permission manquante', class: 'status-missing' },
                      'special': { text: 'Accès spécial', class: 'status-special' },
                      'no-permission': { text: 'Sans permission', class: 'status-no-permission' },
                      null: { text: 'N/A', class: 'status-na' }
                    };
                    const statusInfo = statusLabels[status] || statusLabels.null;
                    
                    let remarks = [];
                    if (page.allowFunctions) {
                      remarks.push(`Accès pour fonctions: ${page.allowFunctions.join(', ')}`);
                    }
                    if (page.excludeFunctions) {
                      remarks.push(`Exclu pour fonctions: ${page.excludeFunctions.join(', ')}`);
                    }
                    if (!page.permission && !page.allowFunctions) {
                      remarks.push('Page publique');
                    }
                    
                    return (
                      <tr key={index}>
                        <td><strong>{page.name}</strong><br /><span className="page-path">{page.path}</span></td>
                        <td>{page.permission || '–'}</td>
                        <td>
                          <span className={`status-badge ${statusInfo.class}`}>
                            {statusInfo.text}
                          </span>
                        </td>
                        <td className="remarks-cell">
                          {remarks.length > 0 ? (
                            <ul className="remarks-list">
                              {remarks.map((remark, i) => (
                                <li key={i}>{remark}</li>
                              ))}
                            </ul>
                          ) : '–'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showTemplates && (
        <PermissionTemplates
          selectedFonction={selectedFonction}
          currentPermissions={permissions}
          onApplyTemplate={handleApplyTemplate}
          onClose={() => setShowTemplates(false)}
        />
      )}

      {showHistory && selectedFonction && (
        <PermissionHistory
          idFonction={selectedFonction}
          onClose={() => setShowHistory(false)}
        />
      )}

      {showTester && (
        <PermissionTester
          onClose={() => setShowTester(false)}
        />
      )}
    </div>
  );
};

export default Permissions;

