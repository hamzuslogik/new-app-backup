import React from 'react';
import { NavLink } from 'react-router-dom';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import {
  FaHome,
  FaFileAlt,
  FaCalendarAlt,
  FaChartBar,
  FaUserCheck,
  FaChartLine,
  FaComments,
  FaUsers,
  FaCog,
  FaClipboardList,
  FaLayerGroup,
  FaShieldAlt,
  FaFileUpload,
  FaUserTie,
  FaClock,
  FaCheck,
  FaExclamationTriangle,
  FaBell,
} from 'react-icons/fa';
import './Sidebar.css';

const Sidebar = ({ collapsed }) => {
  const { user, hasPermission } = useAuth();
  const fonctionId = user?.fonction;

  // Vérifier si l'utilisateur est un RE Qualification (a des agents sous sa responsabilité)
  const { data: agentsSousResponsabilite } = useQuery(
    'agents-sous-responsabilite-sidebar',
    async () => {
      const res = await api.get('/management/utilisateurs');
      const agents = res.data.data?.filter(u => u.chef_equipe === user?.id && u.fonction === 3) || [];
      return agents;
    },
    { enabled: !!user }
  );

  const isREQualif = agentsSousResponsabilite && agentsSousResponsabilite.length > 0;

  const menuItems = [
    {
      path: '/dashboard',
      label: 'Tableau de bord',
      icon: FaHome,
      permission: 'dashboard_view',
      visible: true, // Toujours visible, mais vérifié par permission
    },
    {
      path: '/fiches',
      label: 'Fiches',
      icon: FaFileAlt,
      permission: 'fiches_view',
      visible: true,
    },
    {
      path: '/planning',
      label: 'Planning',
      icon: FaCalendarAlt,
      permission: 'planning_view',
      visible: true,
    },
    {
      path: '/planning-commercial',
      label: 'Planning Commercial',
      icon: FaUserTie,
      permission: 'planning_commercial_view',
      visible: true,
    },
    {
      path: '/planning-hebdomadaire',
      label: 'Planning Hebdomadaire',
      icon: FaCalendarAlt,
      permission: 'planning_view',
      visible: true,
    },
    {
      path: '/affectation-dep',
      label: 'Affectation par Département',
      icon: FaUserCheck,
      permission: 'affectation_view',
      visible: true,
    },
    {
      path: '/statistiques',
      label: 'Statistiques',
      icon: FaChartBar,
      permission: 'statistiques_view',
      visible: true,
    },
    {
      path: '/statistiques-rdv',
      label: 'Statistiques RDV',
      icon: FaCalendarAlt,
      permission: 'statistiques_rdv_view',
      visible: true,
    },
    {
      path: '/statistiques-fiches',
      label: 'Statistiques Fiches',
      icon: FaChartBar,
      permission: 'statistiques_fiches_view',
      visible: true,
    },
    {
      path: '/production-qualif',
      label: 'Production Qualif',
      icon: FaChartBar,
      permission: 'production_qualif_view',
      visible: true,
      // Visible pour RP Qualification (fonction 12)
      customCheck: (item, user, hasPermission) => {
        // Si RP Qualification (fonction 12), toujours visible
        if (user?.fonction === 12) return true;
        // Sinon, vérifier la permission
        return hasPermission(item.permission);
      },
    },
    {
      path: '/kpi-qualification',
      label: 'KPI Qualification',
      icon: FaChartLine,
      permission: 'kpi_qualification_view',
      visible: true,
    },
    {
      path: '/affectation',
      label: 'Affectation',
      icon: FaUserCheck,
      permission: 'affectation_view',
      visible: true,
    },
    {
      path: '/suivi-telepro',
      label: 'Suivi Télépro',
      icon: FaChartLine,
      permission: 'suivi_telepro_view',
      visible: true,
    },
    {
      path: '/suivi-agents-qualif',
      label: 'Suivi Agents Qualif',
      icon: FaUserTie,
      permission: 'suivi_agents_view',
      visible: true,
      // Logique personnalisée : visible pour RE Qualification même sans permission suivi_agents_view
      customCheck: (item, user, hasPermission, isREQualif) => {
        // Si RE Qualification, toujours visible
        if (isREQualif) return true;
        // Sinon, vérifier la permission
        return hasPermission(item.permission);
      },
    },
    {
      path: '/suivi-agents',
      label: 'Suivi des Agents',
      icon: FaUsers,
      permission: 'suivi_agents_view',
      visible: true,
    },
    {
      path: '/controle-qualite',
      label: 'Contrôle Qualité',
      icon: FaUserCheck,
      permission: 'controle_qualite_view',
      visible: true,
    },
    {
      path: '/compte-rendu',
      label: 'Compte Rendu',
      icon: FaClipboardList,
      permission: 'compte_rendu_view',
      visible: true,
    },
    {
      path: '/phase3',
      label: 'Phase 3',
      icon: FaLayerGroup,
      permission: 'phase3_view',
      visible: true,
    },
    {
      path: '/messages',
      label: 'Messages',
      icon: FaComments,
      permission: 'messages_view',
      visible: true,
    },
    {
      path: '/decalages',
      label: 'Décalages',
      icon: FaClock,
      permission: 'decalage_view',
      visible: true,
    },
    {
      path: '/planning-dep',
      label: 'Planning Dép',
      icon: FaCalendarAlt,
      permission: 'planning_view',
      visible: true,
      // Visible pour Confirmateurs (fonction 6), RE Confirmation (fonction 14) et autres utilisateurs avec permission
      customCheck: (item, user, hasPermission) => {
        // Si Confirmateur (fonction 6) ou RE Confirmation (fonction 14), toujours visible
        if (user?.fonction === 6 || user?.fonction === 14) return true;
        // Sinon, vérifier la permission
        return hasPermission(item.permission);
      },
    },
    {
      path: '/validation',
      label: 'Validation',
      icon: FaCheck,
      permission: 'validation_view',
      visible: true,
    },
    {
      path: '/users',
      label: 'Utilisateurs',
      icon: FaUsers,
      permission: 'users_view',
      visible: true,
    },
    {
      path: '/management',
      label: 'Gestion',
      icon: FaCog,
      permission: 'management_view',
      visible: true,
    },
    {
      path: '/permissions',
      label: 'Permissions',
      icon: FaShieldAlt,
      permission: 'config_permissions',
      visible: true,
    },
    {
      path: '/import-masse',
      label: 'Import en Masse',
      icon: FaFileUpload,
      permission: 'import_masse_view',
      visible: true,
    },
    {
      path: '/demandes-insertion',
      label: 'Demandes d\'Insertion',
      icon: FaExclamationTriangle,
      permission: 'demandes_insertion_view',
      visible: true,
    },
    {
      path: '/notifications',
      label: 'Notifications',
      icon: FaBell,
      permission: null,
      visible: true,
      // Visible pour tous les utilisateurs
      customCheck: (item, user) => {
        return true; // Tous les utilisateurs peuvent voir leurs notifications
      },
    },
  ];

  // Debug: vérifier l'état de la sidebar
  React.useEffect(() => {
    console.log('Sidebar rendered with collapsed:', collapsed);
  }, [collapsed]);

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-logo-container">
        {collapsed ? (
          <img src="/logo/logo.png" alt="JWS Group" className="sidebar-logo-icon" />
        ) : (
          <img src="/logo/logo.png" alt="JWS Group" className="sidebar-logo" />
        )}
      </div>
      <nav className="sidebar-nav">
        <ul className="sidebar-menu">
          {menuItems
            .filter((item) => {
              // Si l'item a une fonction de vérification personnalisée, l'utiliser
              if (item.customCheck) {
                return item.customCheck(item, user, hasPermission, isREQualif);
              }
              // Si l'item a une permission, vérifier la permission
              if (item.permission) {
                return hasPermission(item.permission);
              }
              // Sinon, utiliser la propriété visible
              return item.visible;
            })
            .map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      `sidebar-link ${isActive ? 'active' : ''}`
                    }
                  >
                    <Icon className="sidebar-icon" />
                    {!collapsed && <span>{item.label}</span>}
                  </NavLink>
                </li>
              );
            })}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;

