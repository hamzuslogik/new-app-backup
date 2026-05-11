import React from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import useUserHomePage from '../hooks/useUserHomePage';
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
  FaSearch,
  FaSignature,
  FaRobot,
  FaBullhorn,
  FaUser,
} from 'react-icons/fa';
import './Sidebar.css';

const Sidebar = ({ collapsed }) => {
  const { user, hasPermission } = useAuth();
  const location = useLocation();
  const fonctionId = user?.fonction;
  const homePage = useUserHomePage();

  /** Sur /dashboard sans query : éviter no-op du Link et rétablir la liste du jour (événement écouté par Dashboard.jsx). */
  const goHomePage = (e) => {
    // Conserver le comportement « reset » uniquement si la page d'accueil est /dashboard
    if (homePage === '/dashboard' && location.pathname === '/dashboard' && !location.search) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('dashboard-reset-default'));
    }
  };

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

  // Nombre de messages non lus (pour le cercle rouge sur le lien Messages)
  const { data: messagesUnread } = useQuery(
    'messages-unread-count',
    async () => {
      const res = await api.get('/messages/unread-count');
      return res.data?.count ?? 0;
    },
    { enabled: !!user && hasPermission('messages_view'), refetchInterval: 5000 }
  );
  const messagesUnreadCount = messagesUnread ?? 0;

  const menuItems = [
    {
      path: '/dashboard',
      label: 'Tableau de bord',
      icon: FaHome,
      permission: 'dashboard_view',
      visible: true, // Toujours visible, mais vérifié par permission
    },
    {
      path: '/recherche-fiches',
      label: 'Recherche fiches',
      icon: FaSearch,
      permission: 'dashboard_view',
      visible: true,
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
      visible: false,
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
      path: '/rdv-vue',
      label: 'Vue Rendez-vous',
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
      path: '/assistance-ia',
      label: 'Assistance IA',
      icon: FaRobot,
      permission: 'assistance_ia_view',
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
      path: '/kpis',
      label: 'KPIs',
      icon: FaChartLine,
      permission: 'kpis_view',
      visible: true,
    },
    {
      path: '/statistiques-v2',
      label: 'Statistiques V2',
      icon: FaChartBar,
      permission: 'statistiques_v2_view',
      visible: true,
    },
    {
      path: '/signatures',
      label: 'Signatures',
      icon: FaSignature,
      permission: 'signatures_view',
      visible: true,
    },
    {
      path: '/cq-signatures',
      label: 'CQ Signatures',
      icon: FaSignature,
      permission: null,
      visible: true,
      customCheck: (item, user) => [1, 11].includes(Number(user?.fonction)),
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
      path: '/alertes',
      label: 'Alertes',
      icon: FaBell,
      permission: null,
      visible: true,
      customCheck: (item, user, hasPermission) =>
        [3, 2, 12].includes(Number(user?.fonction)) || (user?.fonction && hasPermission('controle_qualite_view')),
    },
    {
      path: '/remarques',
      label: 'Remarques',
      icon: FaComments,
      permission: null,
      visible: true,
      customCheck: (item, user, hasPermission) =>
        [2, 12].includes(Number(user?.fonction)) || (user?.fonction && hasPermission('controle_qualite_view')),
    },
    {
      path: '/mes-indicateurs',
      label: 'Mes indicateurs',
      icon: FaChartLine,
      permission: null,
      visible: true,
      customCheck: (item, user) => Number(user?.fonction) === 3,
    },
    {
      path: '/audit-rdv',
      label: 'Audit Rendez-vous',
      icon: FaCalendarAlt,
      permission: null,
      visible: false,
      customCheck: (item, user) => [4, 13].includes(Number(user?.fonction)),
    },
    {
      path: '/stats-agents-qualite',
      label: 'Stats Agents Qualité',
      icon: FaChartBar,
      permission: 'stats_agents_qualite_view',
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
      permission: 'planning_dep_view',
      visible: true,
    },
    {
      path: '/alerte-planning',
      label: 'Alerte Planning',
      icon: FaBell,
      permission: null,
      visible: true,
      customCheck: (item, user) => [1, 2, 7, 11, 13, 14].includes(Number(user?.fonction)),
    },
    {
      path: '/validation',
      label: 'Validation',
      icon: FaCheck,
      permission: 'validation_view',
      visible: true,
    },
    {
      path: '/mes-rappels',
      label: 'Mes rappels',
      icon: FaClock,
      permission: 'dashboard_view',
      visible: true,
      customCheck: (item, user) => [6, 13, 14].includes(Number(user?.fonction)),
    },
    {
      path: '/mon-equipe',
      label: 'Utilisateurs',
      icon: FaUsers,
      permission: null,
      visible: true,
      customCheck: (item, user) => [2, 14].includes(Number(user?.fonction)),
    },
    {
      path: '/rappels-bureau',
      label: 'Rappels Bureau',
      icon: FaCalendarAlt,
      permission: null,
      visible: false,
      customCheck: (item, user) => Number(user?.fonction) === 13,
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
      // Visible pour Admin (1, 7) et Backoffice (11) ; Superviseur qualification (2) uniquement si permission accordée
      customCheck: (item, user, hasPermission) => {
        if ([1, 7, 11].includes(user?.fonction)) return true;
        return hasPermission(item.permission);
      },
    },
    {
      path: '/system-messages',
      label: 'Messages Système',
      icon: FaBullhorn,
      permission: 'management_view',
      visible: true,
      customCheck: (item, user, hasPermission) => {
        if ([1, 7, 11].includes(user?.fonction)) return true;
        return hasPermission(item.permission);
      },
    },
    {
      path: '/permissions',
      label: 'Permissions',
      icon: FaShieldAlt,
      permission: 'config_permissions',
      visible: true,
      customCheck: (item, user, hasPermission) => {
        if ([1, 7, 11].includes(user?.fonction)) return true;
        return hasPermission(item.permission);
      },
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
    {
      path: '/mon-profil',
      label: 'Mon profil',
      icon: FaUser,
      permission: null,
      visible: true,
      // Commercial (5), RE qualification, RP qualification, qualité qualification, qualité confirmation, confirmateur, RE confirmation, RP confirmation, backoffice, ADMINISTRATEUR, partenaire
      customCheck: (item, user) => [1, 2, 5, 6, 7, 8, 9, 11, 12, 13, 14].includes(Number(user?.fonction)),
    },
  ];

  // Debug: vérifier l'état de la sidebar
  React.useEffect(() => {
    console.log('Sidebar rendered with collapsed:', collapsed);
  }, [collapsed]);

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <Link to={homePage} className="sidebar-logo-container" onClick={goHomePage}>
        {collapsed ? (
          <img src="/logo/logo.png" alt="JWS Group" className="sidebar-logo-icon" />
        ) : (
          <img src="/logo/logo.png" alt="JWS Group" className="sidebar-logo" />
        )}
      </Link>
      <nav className="sidebar-nav">
        <ul className="sidebar-menu">
          {menuItems
            .filter((item) => {
              // Respecter en priorité le flag visible
              if (item.visible === false) {
                return false;
              }
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
              const showMessagesDot = item.path === '/messages' && messagesUnreadCount > 0;
              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    onClick={item.path === '/dashboard' ? goHomePage : undefined}
                    className={({ isActive }) =>
                      `sidebar-link ${isActive ? 'active' : ''}`
                    }
                  >
                    {showMessagesDot && <span className="sidebar-link-dot" aria-hidden />}
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

