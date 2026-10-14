import React, { useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaChevronDown } from 'react-icons/fa';
import { showTrackingInSidebar } from '../utils/trackingAccess';
import {
  adminMenuUrls,
  isAdminMenuLinkActive,
  isAdminSession,
  isBackofficeOrRpSession,
} from '../utils/adminMenuUrls';
import useUserHomePage from '../hooks/useUserHomePage';
import './AdminTopNav.css';

/** Pages restantes sous OUTILS (hors menus dédiés). */
const EXTRA_PAGES = [
  { path: '/planning-commercial', label: 'Planning Commercial', permission: 'planning_commercial_view' },
  { path: '/planning-hebdo-ios', label: 'Planning Hebdo iOS', customCheck: (u) => Number(u?.fonction) === 1 },
  { path: '/assistance-ia', label: 'Assistance IA', permission: 'assistance_ia_view' },
  { path: '/phase3', label: 'Phase 3', permission: 'phase3_view' },
  { path: '/planning-dep', label: 'Planning Dép', permission: 'planning_dep_view' },
  { path: '/validation', label: 'Validation', permission: 'validation_view' },
  { path: '/users', label: 'Utilisateurs', permission: 'users_view' },
  { path: '/import-masse', label: 'Import en Masse', permission: 'import_masse_view' },
  { path: '/demandes-insertion', label: "Demandes d'Insertion", permission: 'demandes_insertion_view' },
  { path: '/notifications', label: 'Notifications' },
];

/** Qualification — session backoffice (et admin). */
const QUALIFICATION_PAGES = [
  { path: '/production-qualif', label: 'Production Qualif', permission: 'production_qualif_view' },
  { path: '/kpi-qualification', label: 'KPI Qualification', permission: 'kpi_qualification_view' },
  { path: '/suivi-agents-qualif', label: 'Suivi Agents Qualif', permission: 'suivi_agents_view' },
  { path: '/suivi-agents', label: 'Suivi des Agents', permission: 'suivi_agents_view' },
  { path: '/suivi-telepro', label: 'Suivi Télépro', permission: 'suivi_telepro_view' },
];

/** Statistiques (dropdown). */
const STATISTIQUES_PAGES = [
  { path: '/statistiques', label: 'Statistiques', permission: 'statistiques_view' },
  { path: '/statistiques-rdv', label: 'Statistiques RDV', permission: 'statistiques_rdv_view' },
  { path: '/statistiques-fiches', label: 'Statistiques Fiches', permission: 'statistiques_fiches_view' },
  { path: '/statistiques-v2', label: 'Statistiques V2', permission: 'statistiques_v2_view' },
  { path: '/kpis', label: 'KPIs', permission: 'kpis_view' },
  { path: '/stats-agents-qualite', label: 'Stats Agents Qualité', permission: 'stats_agents_qualite_view' },
  { path: '/stat-affiliation', label: 'STAT affiliation', customCheck: (u) => Number(u?.fonction) === 11 },
];

/** Qualité & Suivi — backoffice (tracking réservé backoffice). */
const QUALITE_SUIVI_PAGES = [
  { path: '/tracking', label: 'Tracking', customCheck: (u) => showTrackingInSidebar(u) },
  { path: '/bypass-creneau', label: 'Bypass créneau', customCheck: (u) => [1, 7, 11, 13].includes(Number(u?.fonction)) },
  { path: '/liste-completudes', label: 'Liste des complétudes', customCheck: (u) => [4, 11, 13, 14].includes(Number(u?.fonction)) },
  { path: '/controle-qualite', label: 'Contrôle Qualité', permission: 'controle_qualite_view' },
  { path: '/alertes', label: 'Alertes', customCheck: (u, hp) => hp('controle_qualite_view') || [2, 3, 12].includes(Number(u?.fonction)) },
  { path: '/remarques', label: 'Remarques', customCheck: (u, hp) => hp('controle_qualite_view') || [2, 12].includes(Number(u?.fonction)) },
];

/** Pages RP Confirmation uniquement (hors menus confirmation communs). */
const RP_AUTRES_PAGES = [
  { path: '/mes-rappels', label: 'Mes rappels', customCheck: (u) => Number(u?.fonction) === 13 },
  { path: '/mon-equipe', label: 'Utilisateurs', customCheck: (u) => Number(u?.fonction) === 13 },
  { path: '/liste-completudes', label: 'Liste des complétudes', customCheck: (u) => Number(u?.fonction) === 13 },
  { path: '/bypass-creneau', label: 'Bypass créneau', customCheck: (u) => Number(u?.fonction) === 13 },
  { path: '/messages', label: 'Messages', permission: 'messages_view', customCheck: (u) => Number(u?.fonction) === 13 },
  { path: '/signatures', label: 'Signatures', permission: 'signatures_view', customCheck: (u) => Number(u?.fonction) === 13 },
];

/** Autres — backoffice (hors pages déjà dans Qualification / Qualité & Suivi / Stats). */
const BACKOFFICE_AUTRES_PAGES = [
  { path: '/messages', label: 'Messages', permission: 'messages_view' },
  { path: '/signatures', label: 'Signatures', permission: 'signatures_view' },
];

function Dropdown({ label, children, open, onOpen, onClose }) {
  const childCount = React.Children.toArray(children).filter(Boolean).length;
  if (childCount === 0) return null;
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

function Flyout({ label, children, open, onOpen, onClose }) {
  const toggle = () => (open ? onClose() : onOpen());
  return (
    <div
      className={`admin-nav-flyout ${open ? 'open' : ''}`}
      onMouseEnter={onOpen}
    >
      <div
        className="admin-nav-link admin-nav-flyout-trigger"
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
      >
        <span>{label}</span>
        <FaChevronDown className={`admin-nav-caret ${open ? 'open' : ''}`} />
      </div>
      {open && <div className="admin-nav-flyout-menu">{children}</div>}
    </div>
  );
}

function NavPageLinks({ pages, classFor }) {
  return pages.map((p) => (
    <NavLink key={p.path} to={p.path} className={classFor(p.path)}>{p.label}</NavLink>
  ));
}

const AdminTopNav = () => {
  const { user, hasPermission } = useAuth();
  const location = useLocation();
  const homePage = useUserHomePage();
  const urls = useMemo(() => adminMenuUrls(), []);
  const [openMenu, setOpenMenu] = useState(null);
  const [openFlyout, setOpenFlyout] = useState(null);

  const fonction = Number(user?.fonction);
  const isAdmin = isAdminSession(user);
  const isBackoffice = fonction === 11;
  const isRpConfirmation = fonction === 13;
  /** Menus Qualification / Fiches / Qualité & Suivi étendus : admin + backoffice */
  const showQualifMenus = isAdmin || isBackoffice;

  const goHomePage = (e) => {
    if (homePage === '/dashboard' && location.pathname === '/dashboard' && !location.search) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('dashboard-reset-default'));
    }
  };

  const { data: departementsData = [] } = useQuery(
    'sidebar-admin-departements',
    async () => {
      try {
        const res = await api.get('/planning/departements');
        if (Array.isArray(res.data?.data) && res.data.data.length) return res.data.data;
      } catch (_) {
        /* fallback */
      }
      const resManagement = await api.get('/management/departements', { params: { actif_only: 1 } });
      return (resManagement.data?.data || []).map((d) => ({
        code: d.departement_code,
        nom: d.departement_nom_uppercase || d.departement_nom,
      }));
    },
    { enabled: !!user }
  );

  const { data: commerciauxData = [] } = useQuery(
    'sidebar-admin-commerciaux',
    async () => {
      const res = await api.get('/management/utilisateurs');
      return (res.data.data || [])
        .filter((u) => Number(u.fonction) === 5 && Number(u.etat) > 0)
        .sort((a, b) =>
          String(a.pseudo || a.nom || '').localeCompare(String(b.pseudo || b.nom || ''), 'fr')
        );
    },
    { enabled: !!user }
  );

  const filterNavPages = (items) =>
    items.filter((item) => {
      if (item.customCheck && !item.customCheck(user, hasPermission)) return false;
      if (item.permission && !hasPermission(item.permission)) return false;
      return true;
    });

  const qualificationPages = showQualifMenus ? filterNavPages(QUALIFICATION_PAGES) : [];
  // RP Confirmation : pas le détail des stats qualification / affiliation
  const statistiquesPages = filterNavPages(
    isRpConfirmation
      ? STATISTIQUES_PAGES.filter((p) => p.path === '/statistiques')
      : STATISTIQUES_PAGES
  );
  const qualiteSuiviPages = showQualifMenus ? filterNavPages(QUALITE_SUIVI_PAGES) : [];
  const showFichesMenu = showQualifMenus && hasPermission('fiches_view');
  const extraPages = filterNavPages(EXTRA_PAGES);
  const autresPages = isRpConfirmation
    ? filterNavPages(RP_AUTRES_PAGES)
    : isBackoffice
      ? filterNavPages(BACKOFFICE_AUTRES_PAGES)
      : [];

  const closeAll = () => {
    setOpenMenu(null);
    setOpenFlyout(null);
  };

  const itemClass = ({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`;
  const classFor = (to, extra = '') => {
    const extras = extra ? ` ${extra}` : '';
    if (String(to).includes('?')) {
      return () =>
        `admin-nav-link${extras}${isAdminMenuLinkActive(location, to) ? ' active' : ''}`;
    }
    return ({ isActive }) => `admin-nav-link${extras}${isActive ? ' active' : ''}`;
  };

  return (
    <nav className="admin-top-nav" onClick={(e) => {
      if (e.target.closest('a')) closeAll();
    }}>
      <NavLink to={urls.dashboard} end className={itemClass} onClick={goHomePage}>
        Tableau de bord
      </NavLink>

      <Dropdown
        label="PLANNINGS"
        open={openMenu === 'plannings'}
        onOpen={() => { setOpenMenu('plannings'); setOpenFlyout(null); }}
        onClose={closeAll}
      >
        <NavLink to={urls.planningHebdo} className={classFor(urls.planningHebdo)}>Planning hebdomadaire</NavLink>
        <NavLink to={urls.affectationDep} className={classFor(urls.affectationDep)}>Affectation par département</NavLink>
        <NavLink to={urls.affectation} className={classFor(urls.affectation)}>Affectation</NavLink>
        <NavLink to={urls.alertePlanning} className={classFor(urls.alertePlanning)}>Alerte planning</NavLink>
        <Flyout
          label="DEP"
          open={openFlyout === 'dep'}
          onOpen={() => setOpenFlyout('dep')}
          onClose={() => setOpenFlyout(null)}
        >
          {departementsData.map((dept) => {
            const code = dept.code || dept.departement_code;
            const to = urls.dep(code);
            return (
              <NavLink key={code} to={to} className={classFor(to, 'admin-nav-dep-link')}>
                {code}
              </NavLink>
            );
          })}
          {departementsData.length === 0 && <span className="admin-nav-empty">Aucun département</span>}
        </Flyout>
      </Dropdown>

      <Dropdown
        label="RDV"
        open={openMenu === 'rdv'}
        onOpen={() => { setOpenMenu('rdv'); setOpenFlyout(null); }}
        onClose={closeAll}
      >
        <NavLink to={urls.rdvPrisAujourdhui} className={classFor(urls.rdvPrisAujourdhui)}>Rdv pris aujourd&apos;hui</NavLink>
        <NavLink to={urls.rdvAffilie} className={classFor(urls.rdvAffilie)}>RDV affilié</NavLink>
        <NavLink to={urls.rdvNonAffilie} className={classFor(urls.rdvNonAffilie)}>RDV non affilié</NavLink>
        <NavLink to={urls.confirmesVeille} className={classFor(urls.confirmesVeille)}>Confirmés de la veille</NavLink>
        <NavLink to={urls.confirmesLendemain} className={classFor(urls.confirmesLendemain)}>Confirmés du lendemain</NavLink>
        <NavLink to={urls.rdvVue} className={classFor(urls.rdvVue)}>Vue rendez-vous</NavLink>
      </Dropdown>

      <Dropdown
        label="COMMERCIAUX"
        open={openMenu === 'commerciaux'}
        onOpen={() => { setOpenMenu('commerciaux'); setOpenFlyout(null); }}
        onClose={closeAll}
      >
        <NavLink to={urls.compteRendu} className={classFor(urls.compteRendu)}>Compte rendu</NavLink>
        <Flyout
          label="Commerciaux"
          open={openFlyout === 'commerciaux'}
          onOpen={() => setOpenFlyout('commerciaux')}
          onClose={() => setOpenFlyout(null)}
        >
          {commerciauxData.map((c) => (
            <NavLink key={c.id} to={urls.commercialRdvs(c.id)} className={classFor(urls.commercialRdvs(c.id))}>
              {c.pseudo || `${c.nom || ''} ${c.prenom || ''}`.trim() || `Commercial ${c.id}`}
            </NavLink>
          ))}
          {commerciauxData.length === 0 && <span className="admin-nav-empty">Aucun commercial</span>}
        </Flyout>
      </Dropdown>

      <Dropdown
        label="Signatures"
        open={openMenu === 'signatures'}
        onOpen={() => { setOpenMenu('signatures'); setOpenFlyout(null); }}
        onClose={closeAll}
      >
        <NavLink to={urls.signesSemaine} className={classFor(urls.signesSemaine)}>Signés de la semaine</NavLink>
        <NavLink to={urls.signesMois} className={classFor(urls.signesMois)}>Signés du mois</NavLink>
        <NavLink to={urls.cqSignatures} className={classFor(urls.cqSignatures)}>CQ signatures</NavLink>
      </Dropdown>

      <Dropdown
        label="VALIDATIONS"
        open={openMenu === 'validations'}
        onOpen={() => { setOpenMenu('validations'); setOpenFlyout(null); }}
        onClose={closeAll}
      >
        <NavLink to={urls.decalages} className={classFor(urls.decalages)}>Liste des décalages</NavLink>
        <NavLink to={urls.rdvJourNonValides} className={classFor(urls.rdvJourNonValides)}>RDV du jour non validés</NavLink>
        <NavLink to={urls.rdvJourValides} className={classFor(urls.rdvJourValides)}>RDV du jour validés</NavLink>
        <NavLink to={urls.rdvLendemainNonValides} className={classFor(urls.rdvLendemainNonValides)}>RDV du lendemain non validés</NavLink>
        <NavLink to={urls.rdvLendemainValides} className={classFor(urls.rdvLendemainValides)}>RDV du lendemain validés</NavLink>
      </Dropdown>

      {showFichesMenu ? (
        <Dropdown
          label="Fiches"
          open={openMenu === 'fiches'}
          onOpen={() => { setOpenMenu('fiches'); setOpenFlyout(null); }}
          onClose={closeAll}
        >
          <NavLink to="/fiches" className={classFor('/fiches')}>Fiches</NavLink>
        </Dropdown>
      ) : null}

      {qualificationPages.length > 0 ? (
        <Dropdown
          label="Qualification"
          open={openMenu === 'qualification'}
          onOpen={() => { setOpenMenu('qualification'); setOpenFlyout(null); }}
          onClose={closeAll}
        >
          <NavPageLinks pages={qualificationPages} classFor={classFor} />
        </Dropdown>
      ) : null}

      {qualiteSuiviPages.length > 0 ? (
        <Dropdown
          label="Qualité & Suivi"
          open={openMenu === 'qualite-suivi'}
          onOpen={() => { setOpenMenu('qualite-suivi'); setOpenFlyout(null); }}
          onClose={closeAll}
        >
          <NavPageLinks pages={qualiteSuiviPages} classFor={classFor} />
        </Dropdown>
      ) : null}

      {statistiquesPages.length > 0 ? (
        <Dropdown
          label="STATISTIQUES"
          open={openMenu === 'statistiques'}
          onOpen={() => { setOpenMenu('statistiques'); setOpenFlyout(null); }}
          onClose={closeAll}
        >
          <NavPageLinks pages={statistiquesPages} classFor={classFor} />
        </Dropdown>
      ) : (
        <NavLink to={urls.statistiques} className={classFor(urls.statistiques)}>STATISTIQUES</NavLink>
      )}

      <Dropdown
        label="OUTILS"
        open={openMenu === 'outils'}
        onOpen={() => { setOpenMenu('outils'); setOpenFlyout(null); }}
        onClose={closeAll}
      >
        {/* RP Confirmation : outils limités à sa session */}
        {!isRpConfirmation ? (
          <>
            <NavLink to={urls.gestion} className={classFor(urls.gestion)}>Gestion</NavLink>
            <NavLink to={urls.permissions} className={classFor(urls.permissions)}>Permissions</NavLink>
            <NavLink to={urls.systemMessages} className={classFor(urls.systemMessages)}>Messages système</NavLink>
          </>
        ) : null}
        <NavLink to={urls.monProfil} className={classFor(urls.monProfil)}>Mon profil</NavLink>
        <NavLink to={urls.envoyerMessage} className={classFor(urls.envoyerMessage)}>Envoyer un message</NavLink>
        {!isRpConfirmation ? (
          <NavPageLinks pages={extraPages} classFor={classFor} />
        ) : null}
      </Dropdown>

      {autresPages.length > 0 ? (
        <Dropdown
          label="Autres"
          open={openMenu === 'autres'}
          onOpen={() => { setOpenMenu('autres'); setOpenFlyout(null); }}
          onClose={closeAll}
        >
          <NavPageLinks pages={autresPages} classFor={classFor} />
        </Dropdown>
      ) : null}
    </nav>
  );
};

export default AdminTopNav;
