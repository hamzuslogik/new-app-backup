import React, { useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from 'react-query';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { FaChevronDown, FaChevronRight } from 'react-icons/fa';
import { showTrackingInSidebar } from '../utils/trackingAccess';
import { adminMenuUrls } from '../utils/adminMenuUrls';
import useUserHomePage from '../hooks/useUserHomePage';
import './AdminTopNav.css';

const EXTRA_PAGES = [
  { path: '/recherche-fiches', label: 'Recherche fiches', permission: 'dashboard_view' },
  { path: '/fiches', label: 'Fiches', permission: 'fiches_view' },
  { path: '/planning-commercial', label: 'Planning Commercial', permission: 'planning_commercial_view' },
  { path: '/planning-hebdo-ios', label: 'Planning Hebdo iOS', customCheck: (u) => Number(u?.fonction) === 1 },
  { path: '/statistiques-rdv', label: 'Statistiques RDV', permission: 'statistiques_rdv_view' },
  { path: '/statistiques-fiches', label: 'Statistiques Fiches', permission: 'statistiques_fiches_view' },
  { path: '/assistance-ia', label: 'Assistance IA', permission: 'assistance_ia_view' },
  { path: '/production-qualif', label: 'Production Qualif', permission: 'production_qualif_view' },
  { path: '/kpi-qualification', label: 'KPI Qualification', permission: 'kpi_qualification_view' },
  { path: '/kpis', label: 'KPIs', permission: 'kpis_view' },
  { path: '/statistiques-v2', label: 'Statistiques V2', permission: 'statistiques_v2_view' },
  { path: '/suivi-telepro', label: 'Suivi Télépro', permission: 'suivi_telepro_view' },
  { path: '/suivi-agents-qualif', label: 'Suivi Agents Qualif', permission: 'suivi_agents_view' },
  { path: '/suivi-agents', label: 'Suivi des Agents', permission: 'suivi_agents_view' },
  { path: '/controle-qualite', label: 'Contrôle Qualité', permission: 'controle_qualite_view' },
  { path: '/liste-completudes', label: 'Liste des complétudes', customCheck: (u) => [4, 11, 13, 14].includes(Number(u?.fonction)) },
  { path: '/alertes', label: 'Alertes', customCheck: (u, hp) => hp('controle_qualite_view') },
  { path: '/remarques', label: 'Remarques', customCheck: (u, hp) => hp('controle_qualite_view') },
  { path: '/stats-agents-qualite', label: 'Stats Agents Qualité', permission: 'stats_agents_qualite_view' },
  { path: '/tracking', label: 'Tracking', customCheck: (u) => showTrackingInSidebar(u) },
  { path: '/phase3', label: 'Phase 3', permission: 'phase3_view' },
  { path: '/planning-dep', label: 'Planning Dép', permission: 'planning_dep_view' },
  { path: '/validation', label: 'Validation', permission: 'validation_view' },
  { path: '/users', label: 'Utilisateurs', permission: 'users_view' },
  { path: '/import-masse', label: 'Import en Masse', permission: 'import_masse_view' },
  { path: '/demandes-insertion', label: "Demandes d'Insertion", permission: 'demandes_insertion_view' },
  { path: '/notifications', label: 'Notifications' },
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

function Flyout({ label, children, open, onOpen, onClose }) {
  return (
    <div
      className={`admin-nav-flyout ${open ? 'open' : ''}`}
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
    >
      <button type="button" className="admin-nav-flyout-trigger">
        <span>{label}</span>
        <FaChevronRight />
      </button>
      {open && <div className="admin-nav-flyout-menu">{children}</div>}
    </div>
  );
}

const AdminTopNav = () => {
  const { user, hasPermission } = useAuth();
  const location = useLocation();
  const homePage = useUserHomePage();
  const urls = useMemo(() => adminMenuUrls(), []);
  const [openMenu, setOpenMenu] = useState(null);
  const [openFlyout, setOpenFlyout] = useState(null);

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

  const extraPages = EXTRA_PAGES.filter((item) => {
    if (item.customCheck) return item.customCheck(user, hasPermission);
    if (item.permission) return hasPermission(item.permission);
    return true;
  });

  const closeAll = () => {
    setOpenMenu(null);
    setOpenFlyout(null);
  };

  const itemClass = ({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`;

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
        <NavLink to={urls.planningHebdo} className={itemClass}>Planning hebdomadaire</NavLink>
        <NavLink to={urls.affectationDep} className={itemClass}>Affectation par département</NavLink>
        <NavLink to={urls.affectation} className={itemClass}>Affectation</NavLink>
        <NavLink to={urls.alertePlanning} className={itemClass}>Alerte planning</NavLink>
        <Flyout
          label="DEP"
          open={openFlyout === 'dep'}
          onOpen={() => setOpenFlyout('dep')}
          onClose={() => setOpenFlyout(null)}
        >
          {departementsData.map((dept) => {
            const code = dept.code || dept.departement_code;
            const nom = dept.nom || dept.departement_nom || code;
            return (
              <NavLink key={code} to={urls.dep(code)} className={itemClass}>
                {code} — {nom}
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
        <NavLink to={urls.rdvPrisAujourdhui} className={itemClass}>Rdv pris aujourd&apos;hui</NavLink>
        <NavLink to={urls.rdvAffilie} className={itemClass}>RDV affilié</NavLink>
        <NavLink to={urls.rdvNonAffilie} className={itemClass}>RDV non affilié</NavLink>
        <NavLink to={urls.confirmesVeille} className={itemClass}>Confirmés de la veille</NavLink>
        <NavLink to={urls.confirmesLendemain} className={itemClass}>Confirmés du lendemain</NavLink>
        <NavLink to={urls.rdvVue} className={itemClass}>Vue rendez-vous</NavLink>
      </Dropdown>

      <Dropdown
        label="COMMERCIAUX"
        open={openMenu === 'commerciaux'}
        onOpen={() => { setOpenMenu('commerciaux'); setOpenFlyout(null); }}
        onClose={closeAll}
      >
        <NavLink to={urls.compteRendu} className={itemClass}>Compte rendu</NavLink>
        <Flyout
          label="Commerciaux"
          open={openFlyout === 'commerciaux'}
          onOpen={() => setOpenFlyout('commerciaux')}
          onClose={() => setOpenFlyout(null)}
        >
          {commerciauxData.map((c) => (
            <NavLink key={c.id} to={urls.commercialRdvs(c.id)} className={itemClass}>
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
        <NavLink to={urls.signesSemaine} className={itemClass}>Signés de la semaine</NavLink>
        <NavLink to={urls.signesMois} className={itemClass}>Signés du mois</NavLink>
        <NavLink to={urls.cqSignatures} className={itemClass}>CQ signatures</NavLink>
      </Dropdown>

      <Dropdown
        label="VALIDATIONS"
        open={openMenu === 'validations'}
        onOpen={() => { setOpenMenu('validations'); setOpenFlyout(null); }}
        onClose={closeAll}
      >
        <NavLink to={urls.decalages} className={itemClass}>Liste des décalages</NavLink>
        <NavLink to={urls.rdvJourNonValides} className={itemClass}>RDV du jour non validés</NavLink>
        <NavLink to={urls.rdvJourValides} className={itemClass}>RDV du jour validés</NavLink>
        <NavLink to={urls.rdvLendemainNonValides} className={itemClass}>RDV du lendemain non validés</NavLink>
        <NavLink to={urls.rdvLendemainValides} className={itemClass}>RDV du lendemain validés</NavLink>
      </Dropdown>

      <NavLink to={urls.statistiques} className={itemClass}>STATISTIQUES</NavLink>

      <Dropdown
        label="OUTILS"
        open={openMenu === 'outils'}
        onOpen={() => { setOpenMenu('outils'); setOpenFlyout(null); }}
        onClose={closeAll}
      >
        <NavLink to={urls.gestion} className={itemClass}>Gestion</NavLink>
        <NavLink to={urls.monProfil} className={itemClass}>Mon profil</NavLink>
        <NavLink to={urls.permissions} className={itemClass}>Permissions</NavLink>
        <NavLink to={urls.systemMessages} className={itemClass}>Messages système</NavLink>
        <NavLink to={urls.envoyerMessage} className={itemClass}>Envoyer un message</NavLink>
        {extraPages.map((p) => (
          <NavLink key={p.path} to={p.path} className={itemClass}>{p.label}</NavLink>
        ))}
      </Dropdown>
    </nav>
  );
};

export default AdminTopNav;
