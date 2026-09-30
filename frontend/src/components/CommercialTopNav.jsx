import React, { useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from 'react-query';
import { FaChevronDown } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import useUserHomePage from '../hooks/useUserHomePage';
import { isAdminMenuLinkActive } from '../utils/adminMenuUrls';
import './AdminTopNav.css';

/** Liens principaux affichés en barre (ordre commercial). */
const PRIMARY_PATHS = [
  '/planning-commercial',
  '/compte-rendu',
  '/decalages',
  '/messages',
  '/notifications',
];

const MENU_ITEMS = [
  { path: '/planning-commercial', label: 'Planning Commercial', permission: 'planning_commercial_view' },
  { path: '/compte-rendu', label: 'Compte rendu', permission: 'compte_rendu_view' },
  { path: '/decalages', label: 'Décalages', permission: 'decalage_view' },
  { path: '/messages', label: 'Messages', permission: 'messages_view' },
  { path: '/notifications', label: 'Notifications' },
  { path: '/dashboard', label: 'Tableau de bord', permission: 'dashboard_view' },
  { path: '/fiches', label: 'Fiches', permission: 'fiches_view' },
  { path: '/rdv-vue', label: 'Vue Rendez-vous', permission: 'planning_view' },
  { path: '/statistiques', label: 'Statistiques', permission: 'statistiques_view' },
];

function Dropdown({ label, children, open, onOpen, onClose }) {
  return (
    <div
      className={`admin-nav-item ${open ? 'open' : ''}`}
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
    >
      <button type="button" className="admin-nav-trigger" aria-expanded={open}>
        {label}
        <FaChevronDown className="admin-nav-caret" />
      </button>
      {open && <div className="admin-nav-dropdown">{children}</div>}
    </div>
  );
}

const CommercialTopNav = () => {
  const { user, hasPermission } = useAuth();
  const location = useLocation();
  const homePage = useUserHomePage();
  const [openMenu, setOpenMenu] = useState(null);

  const { data: messagesUnread } = useQuery(
    'messages-unread-count',
    async () => {
      const res = await api.get('/messages/unread-count');
      return res.data?.count ?? 0;
    },
    { enabled: !!user && hasPermission('messages_view'), refetchInterval: 5000 }
  );
  const messagesUnreadCount = messagesUnread ?? 0;

  const visibleItems = useMemo(
    () =>
      MENU_ITEMS.filter((item) => {
        if (item.permission) return hasPermission(item.permission);
        return true;
      }),
    [hasPermission]
  );

  const primaryItems = visibleItems.filter((item) => PRIMARY_PATHS.includes(item.path));
  const outilsItems = visibleItems.filter((item) => !PRIMARY_PATHS.includes(item.path));

  const closeAll = () => setOpenMenu(null);

  const classFor = (to) => {
    if (String(to).includes('?')) {
      return () =>
        `admin-nav-link${isAdminMenuLinkActive(location, to) ? ' active' : ''}`;
    }
    return ({ isActive }) => `admin-nav-link${isActive ? ' active' : ''}`;
  };

  const goHomePage = (e) => {
    if (homePage === location.pathname && !location.search) {
      e.preventDefault();
    }
  };

  return (
    <nav
      className="admin-top-nav"
      onClick={(e) => {
        if (e.target.closest('a')) closeAll();
      }}
    >
      {primaryItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === homePage}
          className={classFor(item.path)}
          onClick={item.path === homePage ? goHomePage : undefined}
        >
          {item.label}
          {item.path === '/messages' && messagesUnreadCount > 0 ? (
            <span className="admin-nav-badge">{messagesUnreadCount > 99 ? '99+' : messagesUnreadCount}</span>
          ) : null}
        </NavLink>
      ))}

      {outilsItems.length > 0 && (
        <Dropdown
          label="OUTILS"
          open={openMenu === 'outils'}
          onOpen={() => setOpenMenu('outils')}
          onClose={closeAll}
        >
          {outilsItems.map((item) => (
            <NavLink key={item.path} to={item.path} className={classFor(item.path)}>
              {item.label}
            </NavLink>
          ))}
        </Dropdown>
      )}
    </nav>
  );
};

export default CommercialTopNav;
