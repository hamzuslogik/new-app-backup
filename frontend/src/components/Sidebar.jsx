import React, { useMemo, useState } from 'react';
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
  FaRoute,
  FaSearch,
  FaSignature,
  FaRobot,
  FaBullhorn,
  FaUser,
  FaListAlt,
  FaClipboardCheck,
  FaChevronDown,
  FaChevronRight,
  FaTools,
  FaPaperPlane,
} from 'react-icons/fa';
import { showTrackingInSidebar } from '../utils/trackingAccess';
import { adminMenuUrls, isAdminMenuLinkActive } from '../utils/adminMenuUrls';
import './Sidebar.css';

const isAdminSession = (user) => [1, 7].includes(Number(user?.fonction));

const Sidebar = ({ collapsed }) => {
  const { user, hasPermission } = useAuth();
  const location = useLocation();
  const fonctionId = user?.fonction;
  const homePage = useUserHomePage();
  const urls = useMemo(() => adminMenuUrls(), []);
  const [openGroups, setOpenGroups] = useState({
    plannings: true,
    dep: false,
    rdv: false,
    commerciaux: true,
    commerciauxList: false,
    signatures: true,
    validations: true,
    outils: false,
  });

  const toggleGroup = (key) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  /** Sur /dashboard sans query : éviter no-op du Link et rétablir la liste du jour. */
  const goHomePage = (e) => {
    if (homePage === '/dashboard' && location.pathname === '/dashboard' && !location.search) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('dashboard-reset-default'));
    }
  };

  const { data: agentsSousResponsabilite } = useQuery(
    'agents-sous-responsabilite-sidebar',
    async () => {
      const res = await api.get('/management/utilisateurs');
      return res.data.data?.filter((u) => u.chef_equipe === user?.id && u.fonction === 3) || [];
    },
    { enabled: !!user }
  );
  const isREQualif = agentsSousResponsabilite && agentsSousResponsabilite.length > 0;

  const { data: messagesUnread } = useQuery(
    'messages-unread-count',
    async () => {
      const res = await api.get('/messages/unread-count');
      return res.data?.count ?? 0;
    },
    { enabled: !!user && hasPermission('messages_view'), refetchInterval: 5000 }
  );
  const messagesUnreadCount = messagesUnread ?? 0;

  const { data: departementsData = [] } = useQuery(
    'sidebar-admin-departements',
    async () => {
      try {
        const res = await api.get('/planning/departements');
        if (Array.isArray(res.data?.data) && res.data.data.length) return res.data.data;
      } catch (_) {
        /* fallback management */
      }
      const resManagement = await api.get('/management/departements', { params: { actif_only: 1 } });
      return (resManagement.data?.data || []).map((d) => ({
        code: d.departement_code,
        nom: d.departement_nom_uppercase || d.departement_nom,
      }));
    },
    { enabled: !!user && isAdminSession(user) }
  );

  const { data: commerciauxData = [] } = useQuery(
    'sidebar-admin-commerciaux',
    async () => {
      const res = await api.get('/management/utilisateurs');
      return (res.data.data || [])
        .filter((u) => Number(u.fonction) === 5 && Number(u.etat) > 0)
        .sort((a, b) => String(a.pseudo || a.nom || '').localeCompare(String(b.pseudo || b.nom || ''), 'fr'));
    },
    { enabled: !!user && isAdminSession(user) }
  );

  const flatMenuItems = [
    {
      path: '/dashboard',
      label: 'Tableau de bord',
      icon: FaHome,
      permission: 'dashboard_view',
      visible: true,
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
      path: '/planning-hebdo-ios',
      label: 'Planning Hebdo iOS',
      icon: FaCalendarAlt,
      permission: null,
      visible: true,
      customCheck: (_item, u) => Number(u?.fonction) === 1,
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
      customCheck: (item, u, hp) => (u?.fonction === 12 ? true : hp(item.permission)),
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
      customCheck: (item, u) => [1, 11].includes(Number(u?.fonction)),
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
      customCheck: (item, u, hp, re) => (re ? true : hp(item.permission)),
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
      path: '/liste-completudes',
      label: 'Liste des complétudes',
      icon: FaListAlt,
      permission: null,
      visible: true,
      customCheck: (item, u) => [4, 11, 13, 14].includes(Number(u?.fonction)),
    },
    {
      path: '/alertes',
      label: 'Alertes',
      icon: FaBell,
      permission: null,
      visible: true,
      customCheck: (item, u, hp) =>
        [3, 2, 12].includes(Number(u?.fonction)) || (u?.fonction && hp('controle_qualite_view')),
    },
    {
      path: '/remarques',
      label: 'Remarques',
      icon: FaComments,
      permission: null,
      visible: true,
      customCheck: (item, u, hp) =>
        [2, 12].includes(Number(u?.fonction)) || (u?.fonction && hp('controle_qualite_view')),
    },
    {
      path: '/mes-indicateurs',
      label: 'Mes indicateurs',
      icon: FaChartLine,
      permission: null,
      visible: true,
      customCheck: (item, u) => Number(u?.fonction) === 3,
    },
    {
      path: '/audit-rdv',
      label: 'Audit Rendez-vous',
      icon: FaCalendarAlt,
      permission: null,
      visible: false,
      customCheck: (item, u) => [4, 13].includes(Number(u?.fonction)),
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
      path: '/tracking',
      label: 'Tracking',
      icon: FaRoute,
      permission: null,
      visible: true,
      customCheck: (_item, u) => showTrackingInSidebar(u),
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
      customCheck: (item, u, _hp, re) => {
        const f = Number(u?.fonction);
        if (f === 2 || re) return false;
        return [1, 7, 11, 13, 14].includes(f);
      },
    },
    {
      path: '/validation',
      label: Number(fonctionId) === 4 ? 'Audit RDVs' : 'Validation',
      icon: Number(fonctionId) === 4 ? FaClipboardCheck : FaCheck,
      permission: 'validation_view',
      visible: true,
    },
    {
      path: '/mes-rappels',
      label: 'Mes rappels',
      icon: FaClock,
      permission: 'dashboard_view',
      visible: true,
      customCheck: (item, u) => [6, 13, 14].includes(Number(u?.fonction)),
    },
    {
      path: '/mon-equipe',
      label: 'Utilisateurs',
      icon: FaUsers,
      permission: null,
      visible: true,
      customCheck: (item, u) => [2, 14].includes(Number(u?.fonction)),
    },
    {
      path: '/rappels-bureau',
      label: 'Rappels Bureau',
      icon: FaCalendarAlt,
      permission: null,
      visible: false,
      customCheck: (item, u) => Number(u?.fonction) === 13,
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
      customCheck: (item, u, hp) => ([1, 7, 11].includes(u?.fonction) ? true : hp(item.permission)),
    },
    {
      path: '/system-messages',
      label: 'Messages Système',
      icon: FaBullhorn,
      permission: 'management_view',
      visible: true,
      customCheck: (item, u, hp) => ([1, 7, 11].includes(u?.fonction) ? true : hp(item.permission)),
    },
    {
      path: '/permissions',
      label: 'Permissions',
      icon: FaShieldAlt,
      permission: 'config_permissions',
      visible: true,
      customCheck: (item, u, hp) => ([1, 7, 11].includes(u?.fonction) ? true : hp(item.permission)),
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
      label: "Demandes d'Insertion",
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
      customCheck: () => true,
    },
    {
      path: '/mon-profil',
      label: 'Mon profil',
      icon: FaUser,
      permission: null,
      visible: true,
      customCheck: (item, u) => [1, 2, 6, 7, 8, 9, 11, 12, 13, 14].includes(Number(u?.fonction)),
    },
  ];

  const isItemVisible = (item) => {
    if (item.visible === false) return false;
    if (item.customCheck) return item.customCheck(item, user, hasPermission, isREQualif);
    if (item.permission) return hasPermission(item.permission);
    return item.visible;
  };

  const adminMentionedPaths = new Set([
    '/dashboard',
    '/planning-hebdomadaire',
    '/affectation-dep',
    '/affectation',
    '/alerte-planning',
    '/rdv-vue',
    '/compte-rendu',
    '/signatures',
    '/cq-signatures',
    '/decalages',
    '/statistiques',
    '/management',
    '/mon-profil',
    '/permissions',
    '/system-messages',
    '/messages',
  ]);

  const autresOutils = flatMenuItems.filter(
    (item) => isItemVisible(item) && !adminMentionedPaths.has(item.path)
  );

  const linkClass = ({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`;
  const nestedLinkClass = ({ isActive }) => `sidebar-link sidebar-link-nested ${isActive ? 'active' : ''}`;
  const deepLinkClass = ({ isActive }) => `sidebar-link sidebar-link-deep ${isActive ? 'active' : ''}`;
  const classFor = (to, variant = 'nested') => {
    const base =
      variant === 'deep' ? 'sidebar-link sidebar-link-deep' : 'sidebar-link sidebar-link-nested';
    if (String(to).includes('?')) {
      return () => `${base}${isAdminMenuLinkActive(location, to) ? ' active' : ''}`;
    }
    return variant === 'deep' ? deepLinkClass : nestedLinkClass;
  };

  const renderGroupHeader = (key, label, Icon) => (
    <button type="button" className="sidebar-group-toggle" onClick={() => toggleGroup(key)}>
      <Icon className="sidebar-icon" />
      {!collapsed && (
        <>
          <span className="sidebar-group-label">{label}</span>
          {openGroups[key] ? <FaChevronDown className="sidebar-chevron" /> : <FaChevronRight className="sidebar-chevron" />}
        </>
      )}
    </button>
  );

  const renderAdminMenu = () => (
    <ul className="sidebar-menu sidebar-menu-admin">
      <li>
        <NavLink to={urls.dashboard} onClick={goHomePage} className={linkClass} end>
          <FaHome className="sidebar-icon" />
          {!collapsed && <span>DASHBOARD</span>}
        </NavLink>
      </li>

      <li className="sidebar-group">
        {renderGroupHeader('plannings', 'PLANNINGS', FaCalendarAlt)}
        {(openGroups.plannings || collapsed) && !collapsed && (
          <ul className="sidebar-submenu">
            <li>
              <NavLink to={urls.planningHebdo} className={nestedLinkClass}>
                <span>Planning hebdomadaire</span>
              </NavLink>
            </li>
            <li>
              <NavLink to={urls.affectationDep} className={nestedLinkClass}>
                <span>Affectation par département</span>
              </NavLink>
            </li>
            <li>
              <NavLink to={urls.affectation} className={nestedLinkClass}>
                <span>Affectation</span>
              </NavLink>
            </li>
            <li>
              <NavLink to={urls.alertePlanning} className={nestedLinkClass}>
                <span>Alerte planning</span>
              </NavLink>
            </li>

            <li className="sidebar-group sidebar-group-nested">
              <button type="button" className="sidebar-group-toggle nested" onClick={() => toggleGroup('dep')}>
                <span className="sidebar-group-label">DEP</span>
                {openGroups.dep ? <FaChevronDown className="sidebar-chevron" /> : <FaChevronRight className="sidebar-chevron" />}
              </button>
              {openGroups.dep && (
                <ul className="sidebar-submenu sidebar-submenu-deep">
                  {departementsData.map((dept) => {
                    const code = dept.code || dept.departement_code;
                    return (
                      <li key={code}>
                        <NavLink to={urls.dep(code)} className={classFor(urls.dep(code), 'deep')}>
                          <span>{code}</span>
                        </NavLink>
                      </li>
                    );
                  })}
                  {departementsData.length === 0 && (
                    <li className="sidebar-empty">Aucun département</li>
                  )}
                </ul>
              )}
            </li>

            <li className="sidebar-group sidebar-group-nested">
              <button type="button" className="sidebar-group-toggle nested" onClick={() => toggleGroup('rdv')}>
                <span className="sidebar-group-label">RDV</span>
                {openGroups.rdv ? <FaChevronDown className="sidebar-chevron" /> : <FaChevronRight className="sidebar-chevron" />}
              </button>
              {openGroups.rdv && (
                <ul className="sidebar-submenu sidebar-submenu-deep">
                  <li>
                    <NavLink to={urls.rdvPrisAujourdhui} className={classFor(urls.rdvPrisAujourdhui, 'deep')}>
                      <span>Rdv pris aujourd&apos;hui</span>
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to={urls.rdvAffilie} className={classFor(urls.rdvAffilie, 'deep')}>
                      <span>RDV affilié</span>
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to={urls.rdvNonAffilie} className={classFor(urls.rdvNonAffilie, 'deep')}>
                      <span>RDV non affilié</span>
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to={urls.confirmesVeille} className={classFor(urls.confirmesVeille, 'deep')}>
                      <span>Confirmés de la veille</span>
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to={urls.confirmesLendemain} className={classFor(urls.confirmesLendemain, 'deep')}>
                      <span>Confirmés du lendemain</span>
                    </NavLink>
                  </li>
                  <li>
                    <NavLink to={urls.rdvVue} className={classFor(urls.rdvVue, 'deep')}>
                      <span>Vue rendez-vous</span>
                    </NavLink>
                  </li>
                </ul>
              )}
            </li>
          </ul>
        )}
      </li>

      <li className="sidebar-group">
        {renderGroupHeader('commerciaux', 'COMMERCIAUX', FaUserTie)}
        {openGroups.commerciaux && !collapsed && (
          <ul className="sidebar-submenu">
            <li>
              <NavLink to={urls.compteRendu} className={nestedLinkClass}>
                <span>Compte rendu</span>
              </NavLink>
            </li>
            <li className="sidebar-group sidebar-group-nested">
              <button
                type="button"
                className="sidebar-group-toggle nested"
                onClick={() => toggleGroup('commerciauxList')}
              >
                <span className="sidebar-group-label">Commerciaux</span>
                {openGroups.commerciauxList ? (
                  <FaChevronDown className="sidebar-chevron" />
                ) : (
                  <FaChevronRight className="sidebar-chevron" />
                )}
              </button>
              {openGroups.commerciauxList && (
                <ul className="sidebar-submenu sidebar-submenu-deep">
                  {commerciauxData.map((c) => (
                    <li key={c.id}>
                      <NavLink to={urls.commercialRdvs(c.id)} className={classFor(urls.commercialRdvs(c.id), 'deep')}>
                        <span>{c.pseudo || `${c.nom || ''} ${c.prenom || ''}`.trim() || `Commercial ${c.id}`}</span>
                      </NavLink>
                    </li>
                  ))}
                  {commerciauxData.length === 0 && (
                    <li className="sidebar-empty">Aucun commercial</li>
                  )}
                </ul>
              )}
            </li>
          </ul>
        )}
      </li>

      <li className="sidebar-group">
        {renderGroupHeader('signatures', 'SIGNATURES', FaSignature)}
        {openGroups.signatures && !collapsed && (
          <ul className="sidebar-submenu">
            <li>
              <NavLink to={urls.signesSemaine} className={classFor(urls.signesSemaine)}>
                <span>Signés de la semaine</span>
              </NavLink>
            </li>
            <li>
              <NavLink to={urls.signesMois} className={classFor(urls.signesMois)}>
                <span>Signés du mois</span>
              </NavLink>
            </li>
            <li>
              <NavLink to={urls.cqSignatures} className={nestedLinkClass}>
                <span>CQ signatures</span>
              </NavLink>
            </li>
          </ul>
        )}
      </li>

      <li className="sidebar-group">
        {renderGroupHeader('validations', 'VALIDATIONS', FaCheck)}
        {openGroups.validations && !collapsed && (
          <ul className="sidebar-submenu">
            <li>
              <NavLink to={urls.decalages} className={nestedLinkClass}>
                <span>Liste des décalages</span>
              </NavLink>
            </li>
            <li>
              <NavLink to={urls.rdvJourNonValides} className={classFor(urls.rdvJourNonValides)}>
                <span>RDV du jour non validés</span>
              </NavLink>
            </li>
            <li>
              <NavLink to={urls.rdvJourValides} className={classFor(urls.rdvJourValides)}>
                <span>RDV du jour validés</span>
              </NavLink>
            </li>
            <li>
              <NavLink to={urls.rdvLendemainNonValides} className={classFor(urls.rdvLendemainNonValides)}>
                <span>RDV du lendemain non validés</span>
              </NavLink>
            </li>
            <li>
              <NavLink to={urls.rdvLendemainValides} className={classFor(urls.rdvLendemainValides)}>
                <span>RDV du lendemain validés</span>
              </NavLink>
            </li>
          </ul>
        )}
      </li>

      <li>
        <NavLink to={urls.statistiques} className={linkClass}>
          <FaChartBar className="sidebar-icon" />
          {!collapsed && <span>STATISTIQUES</span>}
        </NavLink>
      </li>

      <li className="sidebar-group">
        {renderGroupHeader('outils', 'OUTILS', FaTools)}
        {openGroups.outils && !collapsed && (
          <ul className="sidebar-submenu">
            <li>
              <NavLink to={urls.gestion} className={nestedLinkClass}>
                <span>Gestion</span>
              </NavLink>
            </li>
            <li>
              <NavLink to={urls.monProfil} className={nestedLinkClass}>
                <span>Mon profil</span>
              </NavLink>
            </li>
            <li>
              <NavLink to={urls.permissions} className={nestedLinkClass}>
                <span>Permissions</span>
              </NavLink>
            </li>
            <li>
              <NavLink to={urls.systemMessages} className={nestedLinkClass}>
                <span>Messages système</span>
              </NavLink>
            </li>
            <li>
              <NavLink to={urls.envoyerMessage} className={nestedLinkClass}>
                {messagesUnreadCount > 0 && <span className="sidebar-link-dot" aria-hidden />}
                <FaPaperPlane className="sidebar-icon-inline" />
                <span>Envoyer un message</span>
              </NavLink>
            </li>
            {autresOutils.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    onClick={item.path === '/dashboard' ? goHomePage : undefined}
                    className={nestedLinkClass}
                  >
                    <Icon className="sidebar-icon-inline" />
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        )}
      </li>
    </ul>
  );

  const renderFlatMenu = () => (
    <ul className="sidebar-menu">
      {flatMenuItems.filter(isItemVisible).map((item) => {
        const Icon = item.icon;
        const showMessagesDot = item.path === '/messages' && messagesUnreadCount > 0;
        return (
          <li key={item.path}>
            <NavLink
              to={item.path}
              onClick={item.path === '/dashboard' ? goHomePage : undefined}
              className={linkClass}
            >
              {showMessagesDot && <span className="sidebar-link-dot" aria-hidden />}
              <Icon className="sidebar-icon" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          </li>
        );
      })}
    </ul>
  );

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${isAdminSession(user) ? 'sidebar-admin' : ''}`}>
      <Link to={homePage} className="sidebar-logo-container" onClick={goHomePage}>
        {collapsed ? (
          <img src="/logo/logo.png" alt="JWS Group" className="sidebar-logo-icon" />
        ) : (
          <img src="/logo/logo.png" alt="JWS Group" className="sidebar-logo" />
        )}
      </Link>
      <nav className="sidebar-nav">
        {isAdminSession(user) ? renderAdminMenu() : renderFlatMenu()}
      </nav>
    </aside>
  );
};

export default Sidebar;
