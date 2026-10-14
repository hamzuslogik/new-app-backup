import React, { useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import { FaSignature, FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import FicheDetailLink from '../components/FicheDetailLink';
import {
  FicheAdminBadgeHeaders,
  FicheAdminValideCell,
  FicheAdminActionCell,
  FicheAdminIndicatorCells,
} from '../components/fiches/FicheAdminBadgeColumns';
import {
  FicheRowIndexHeader,
  FicheRowIndexCell,
  getFicheRowNumber,
} from '../components/fiches/FicheRowIndexColumn';
import { getFicheRowByEtatClassName } from '../utils/etatColorContrast';
import { getEtatDisplayWithSousEtat, getEtatTableAbbr } from '../utils/etatSignerComplet';
import { abbreviateCentreName } from '../utils/tableAbbreviations';
import { formatRdvDateTime } from '../utils/formatRdvDateTime';
import { generateFicheClientPdf } from '../utils/generateFicheClientPdf';
import {
  getFicheTableIndicators,
  ficheHasVisibleDecalageRequest,
  getDecalageDisplayInfo,
} from '../utils/ficheTableIndicators';
import { formatFicheCommercialDisplay } from '../utils/ficheCommercialDisplay';
import { getTodayLocal } from '../utils/dateUtils';
import { usesAdminFicheLayout, isHonoreASuivreBadgeSession } from '../utils/adminMenuUrls';
import useForceDesktopViewport from '../hooks/useForceDesktopViewport';
import '../styles/fiches-table.css';
import './Fiches.css';
import './SignaturesAujourdhui.css';

function getProduitName(produitId) {
  return produitId === 1 ? 'PAC' : produitId === 2 ? 'PV' : '';
}

function getProduitColor(produitId) {
  return produitId === 1 ? '#66D5D4' : produitId === 2 ? '#818cf8' : '#cccccc';
}

function formatConfirmateurs(fiche) {
  const parts = [
    fiche.confirmateur_pseudo || fiche.confirmateur_nom,
    fiche.confirmateur_2_pseudo,
    fiche.confirmateur_3_pseudo,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' | ') : '';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(typeof dateStr === 'string' ? dateStr.replace(' ', 'T') : dateStr);
  if (Number.isNaN(date.getTime())) return String(dateStr);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const SIGNATURE_FILTERS = {
  fiche_search: 1,
  id_etat_final: 't_s',
  date_champ: 'date_sign_time',
  time_debut: '00:00:00',
  time_fin: '23:59:59',
  sgn_include_pending: 1,
  page: 1,
  limit: 9999,
  sort_by: 'date_sign_time',
  sort_dir: 'desc',
};

const SignaturesAujourdhui = () => {
  useForceDesktopViewport('signatures-aujourdhui-page');
  const { user } = useAuth();
  const isAdminFicheLayout = usesAdminFicheLayout(user);
  const showHasBadge = isHonoreASuivreBadgeSession(user);
  const today = getTodayLocal();
  const [sortConfig, setSortConfig] = useState({
    key: 'date_sign_time',
    direction: 'desc',
  });

  const queryFilters = useMemo(
    () => ({
      ...SIGNATURE_FILTERS,
      date_debut: today,
      date_fin: today,
    }),
    [today]
  );

  const { data: etatsData } = useQuery('etats', async () => {
    const res = await api.get('/management/etats');
    return res.data.data || [];
  });

  const { data: centresData } = useQuery('centres', async () => {
    const res = await api.get('/management/centres');
    return res.data.data || [];
  });

  const { data: fichesData, isLoading, isFetching } = useQuery(
    ['signatures-aujourdhui', queryFilters],
    async () => {
      const res = await api.get('/fiches', { params: queryFilters });
      return res.data?.data || [];
    },
    { keepPreviousData: true }
  );

  const showDecalageCol = useMemo(() => {
    if (!Array.isArray(fichesData)) return false;
    return fichesData.some((f) => ficheHasVisibleDecalageRequest(f));
  }, [fichesData]);

  const handleSort = (key) => {
    if (!key) return;
    setSortConfig((prev) => {
      if (prev.key === key && prev.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const renderSortIcon = (key) => {
    if (!key || sortConfig.key !== key) {
      return <FaSort className="sort-icon" />;
    }
    return sortConfig.direction === 'asc' ? (
      <FaSortUp className="sort-icon sort-active" />
    ) : (
      <FaSortDown className="sort-icon sort-active" />
    );
  };

  const getSortValue = (fiche, key) => {
    if (key === 'commercial') {
      return formatFicheCommercialDisplay(fiche, () => '', queryFilters).toLowerCase();
    }
    if (key === 'confirmateur') return formatConfirmateurs(fiche).toLowerCase();
    if (key === 'centre') return String(fiche.centre_nom || '').toLowerCase();
    if (key === 'etat') {
      return String(getEtatDisplayWithSousEtat(fiche, etatsData || []) || '').toLowerCase();
    }
    if (key === 'produit') {
      return String(getProduitName(fiche.produit) || fiche.produit_nom || '').toLowerCase();
    }
    if (key === 'valider') return Number(fiche.valider) || 0;
    if (key === 'tel') return String(fiche.tel || fiche.gsm1 || '').toLowerCase();
    if (key === 'cp') return String(fiche.cp || '').toLowerCase();
    if (key === 'nom') return String(fiche.nom || '').toLowerCase();
    if (key === 'prenom') return String(fiche.prenom || '').toLowerCase();
    if (key === 'date_rdv_time' || key === 'date_insert_time' || key === 'date_sign_time') {
      const t = new Date(String(fiche[key] || '').replace(' ', 'T') || 0).getTime();
      return Number.isFinite(t) ? t : 0;
    }
    const value = fiche[key];
    if (value == null) return '';
    return String(value).toLowerCase();
  };

  const sortedFiches = useMemo(() => {
    const list = Array.isArray(fichesData) ? [...fichesData] : [];
    if (!sortConfig.key) return list;
    list.sort((a, b) => {
      const aValue = getSortValue(a, sortConfig.key);
      const bValue = getSortValue(b, sortConfig.key);
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      const cmp = String(aValue ?? '').localeCompare(String(bValue ?? ''), 'fr', {
        numeric: true,
        sensitivity: 'base',
      });
      return sortConfig.direction === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [fichesData, sortConfig, etatsData, queryFilters]);

  const renderSortableTh = (label, key, className = '') => (
    <th
      className={`sortable-header${className ? ` ${className}` : ''}`}
      onClick={() => handleSort(key)}
      title={`Trier par ${label}`}
    >
      <span className="header-label-wrap">
        {label}
        {renderSortIcon(key)}
      </span>
    </th>
  );

  const getEtatColor = (fiche) => {
    if (fiche?.etat_color) return fiche.etat_color;
    const etat = (etatsData || []).find(
      (e) => e.id === fiche?.id_etat_final || e.id === Number(fiche?.id_etat_final)
    );
    return etat?.color || '#cccccc';
  };

  const getCentreName = (idCentre) => {
    const c = (centresData || []).find((x) => Number(x.id) === Number(idCentre));
    return c?.nom || c?.centre_nom || '';
  };

  const handleGeneratePdf = async (hash) => {
    if (!hash) return;
    try {
      const [ficheRes, profRes, tcRes] = await Promise.all([
        api.get(`/fiches/${encodeURIComponent(hash)}`),
        api.get('/management/professions'),
        api.get('/management/type-contrat'),
      ]);
      const full = ficheRes.data?.data;
      if (!full) throw new Error('Fiche introuvable');
      generateFicheClientPdf(full, {
        professions: profRes.data?.data || [],
        typeContrat: tcRes.data?.data || [],
        centres: centresData || [],
      });
    } catch (err) {
      console.error(err);
      window.alert(err.response?.data?.message || err.message || 'Impossible de générer le PDF');
    }
  };

  const todayLabel = useMemo(() => {
    const d = new Date(`${today}T12:00:00`);
    return d.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }, [today]);

  return (
    <div className="signatures-aujourdhui-page fiches-page">
      <div className="signatures-aujourdhui-header">
        <h1 className="page-title">
          <FaSignature aria-hidden />
          Signatures d&apos;aujourd&apos;hui
        </h1>
        <p className="signatures-aujourdhui-subtitle">
          {todayLabel}
          {' — '}
          {isLoading ? 'Chargement…' : `${sortedFiches.length} fiche(s)`}
          {' '}
          (approuvées et comptes rendus Signer en attente)
        </p>
      </div>

      {isLoading && !fichesData ? (
        <div className="loading">Chargement des signatures…</div>
      ) : sortedFiches.length === 0 ? (
        <div className="no-results">
          <p>Aucune signature aujourd&apos;hui.</p>
        </div>
      ) : (
        <div className={`fiches-table-container${isFetching ? ' loading' : ''}`}>
          <table className={`fiches-table${isAdminFicheLayout ? ' fiches-table--admin-layout' : ''}`}>
            <thead>
              <tr>
                <FicheRowIndexHeader />
                {renderSortableTh('Nom', 'nom', 'fiche-col-nom')}
                {renderSortableTh('Prénom', 'prenom', 'fiche-col-prenom')}
                {renderSortableTh('Téléphone', 'tel')}
                {renderSortableTh('CP', 'cp')}
                {isAdminFicheLayout ? (
                  <>
                    {renderSortableTh('Date RDV', 'date_rdv_time', 'fiche-col-date')}
                    {renderSortableTh('Commercial', 'commercial')}
                    <FicheAdminBadgeHeaders
                      onSortValide={() => handleSort('valider')}
                      onSortProduit={() => handleSort('produit')}
                      getSortIcon={(label) =>
                        renderSortIcon(
                          label === 'Validé' ? 'valider' : label === 'Produit' ? 'produit' : label
                        )
                      }
                    />
                    {renderSortableTh('Centre', 'centre')}
                    {renderSortableTh('Date Insertion', 'date_insert_time', 'fiche-col-date')}
                    {renderSortableTh('Conf', 'confirmateur')}
                    {renderSortableTh('État Final', 'etat')}
                    {showDecalageCol ? <th className="dashboard-decalage-col">Décalage</th> : null}
                  </>
                ) : (
                  <>
                    {renderSortableTh('Date Insertion', 'date_insert_time', 'fiche-col-date')}
                    {renderSortableTh('Date RDV', 'date_rdv_time', 'fiche-col-date')}
                    {renderSortableTh('État Final', 'etat')}
                    {renderSortableTh('Confirmateur', 'confirmateur')}
                    {renderSortableTh('Commercial', 'commercial')}
                    {renderSortableTh('Centre', 'centre')}
                    {renderSortableTh('Produit', 'produit')}
                    {renderSortableTh('Validé', 'valider')}
                    <th>Actions</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {sortedFiches.map((fiche, rowIndex) => {
                const etatColor = getEtatColor(fiche);
                const produitColor = getProduitColor(fiche.produit);
                const indicators =
                  isAdminFicheLayout || showHasBadge
                    ? getFicheTableIndicators(fiche.id_etat_histo, fiche, etatsData || [])
                    : null;
                const decalageInfo = showDecalageCol ? getDecalageDisplayInfo(fiche) : null;
                const showCrPrefix =
                  fiche.signature_cr_pending === true ||
                  fiche.current_state_from_compte_rendu === true;
                const centreName = fiche.centre_nom || getCentreName(fiche.id_centre);

                return (
                  <tr
                    key={fiche.hash || fiche.id}
                    className={getFicheRowByEtatClassName(etatColor)}
                    style={{ backgroundColor: etatColor }}
                    title={
                      fiche.signature_cr_pending === true
                        ? 'Compte rendu Signer en attente d’approbation'
                        : undefined
                    }
                  >
                    <FicheRowIndexCell number={getFicheRowNumber(rowIndex)} />
                    <td data-label="Nom:" className="fiche-col-nom">{fiche.nom || ''}</td>
                    <td data-label="Prénom:" className="fiche-col-prenom">{fiche.prenom || ''}</td>
                    <td data-label="Téléphone:">{fiche.tel || fiche.gsm1 || ''}</td>
                    <td data-label="CP:">{fiche.cp || ''}</td>
                    {isAdminFicheLayout ? (
                      <>
                        <td data-label="Date RDV:" className="fiche-col-date">
                          {formatRdvDateTime(fiche.date_rdv_time)}
                        </td>
                        <td data-label="Commercial:">
                          {formatFicheCommercialDisplay(fiche, () => '', queryFilters)}
                        </td>
                        <FicheAdminValideCell valider={fiche.valider} confRdvAvec={fiche.conf_rdv_avec} />
                        <FicheAdminActionCell
                          DetailButtonTag={FicheDetailLink}
                          detailButtonProps={{ ficheHash: fiche.hash, ficheId: fiche.id }}
                        />
                        <FicheAdminIndicatorCells
                          indicators={indicators}
                          produitName={getProduitName(fiche.produit) || fiche.produit_nom}
                          produitColor={produitColor}
                          onPdf={() => handleGeneratePdf(fiche.hash)}
                        />
                        <td
                          data-label="Centre:"
                          className="fiche-col-centre"
                          title={centreName || undefined}
                        >
                          {abbreviateCentreName(centreName || '')}
                        </td>
                        <td data-label="Date Insertion:" className="fiche-col-date">
                          {formatDate(fiche.date_insert_time)}
                        </td>
                        <td data-label="Conf:">{formatConfirmateurs(fiche)}</td>
                        <td data-label="État:" className="etat-col-cell fiche-col-etat">
                          <span
                            className="etat-text"
                            title={getEtatDisplayWithSousEtat(fiche, etatsData || []) || undefined}
                          >
                            {showCrPrefix ? <span className="etat-text-cr">&lt;CR&gt;</span> : null}
                            {getEtatTableAbbr(fiche, etatsData || [])}
                          </span>
                        </td>
                        {showDecalageCol ? (
                          <td data-label="Décalage:" className="dashboard-decalage-cell">
                            {decalageInfo ? (
                              <span className={`dashboard-decalage-mention is-${decalageInfo.status}`}>
                                {decalageInfo.text}
                              </span>
                            ) : null}
                          </td>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <td data-label="Date Insertion:" className="fiche-col-date">
                          {formatDate(fiche.date_insert_time)}
                        </td>
                        <td data-label="Date RDV:" className="fiche-col-date">
                          {formatRdvDateTime(fiche.date_rdv_time)}
                        </td>
                        <td data-label="État:" className="etat-col-cell fiche-col-etat">
                          <span className="etat-text">
                            {showCrPrefix ? <span className="etat-text-cr">&lt;CR&gt;</span> : null}
                            {getEtatTableAbbr(fiche, etatsData || [])}
                          </span>
                        </td>
                        <td data-label="Confirmateur:">{formatConfirmateurs(fiche)}</td>
                        <td data-label="Commercial:">
                          {formatFicheCommercialDisplay(fiche, () => '', queryFilters)}
                        </td>
                        <td
                          data-label="Centre:"
                          className="fiche-col-centre"
                          title={centreName || undefined}
                        >
                          {abbreviateCentreName(centreName || '')}
                        </td>
                        <td data-label="Produit:">
                          <span
                            className="produit-indicator"
                            style={{ backgroundColor: produitColor, color: '#ffffff' }}
                          >
                            {getProduitName(fiche.produit) || fiche.produit_nom || ''}
                          </span>
                        </td>
                        <td data-label="Validé:" style={{ textAlign: 'center' }}>
                          {Number(fiche.valider) > 0 ? '✔' : ''}
                        </td>
                        <td data-label="">
                          <FicheDetailLink
                            ficheHash={fiche.hash}
                            ficheId={fiche.id}
                            className="btn-detail"
                            title="Voir les détails"
                          />
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SignaturesAujourdhui;
