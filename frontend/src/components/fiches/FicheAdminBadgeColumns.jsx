import React from 'react';
import { FaSearch, FaFilePdf, FaCheck, FaUser } from 'react-icons/fa';

/** Couleurs états (alignées BDD / update_etats_colors) */
export const FICHE_BADGE_COLORS = {
  sig: '#FF3380',
  has: '#FE83FE',
  r2: '#ffa500',
  rf: '#ff0000',
  an: '#ff0000',
  cs: '#60a5fa',
};

/**
 * En-têtes Validé → PROD (ordre session admin).
 */
export function FicheAdminBadgeHeaders({
  getSortIcon,
  onSortValide,
  onSortProduit,
  valideSortLabel = 'Validé',
  produitSortLabel = 'Produit',
  isColVisible = () => true,
  /** true = uniquement SIG/CS/R2/HAS/RF (sans Validé/ACTION/PDF/PROD) */
  badgesOnly = false,
}) {
  return (
    <>
      {!badgesOnly && isColVisible('valide') ? (
        <th
          onClick={onSortValide}
          className={`fiche-col-badge fiche-col-valide${onSortValide ? ' sortable-header' : ''}`}
          title="Validé"
        >
          <FaCheck aria-hidden /> {getSortIcon ? getSortIcon(valideSortLabel) : null}
        </th>
      ) : null}
      {!badgesOnly && isColVisible('action') ? (
        <th className="actions-header"><span>ACTION</span></th>
      ) : null}
      {isColVisible('sig') ? <th className="fiche-col-badge fiche-col-sig">SIG</th> : null}
      {isColVisible('cs') ? <th className="fiche-col-badge fiche-col-cs">CS</th> : null}
      {isColVisible('r2') ? <th className="fiche-col-badge fiche-col-r2">R2</th> : null}
      {isColVisible('has') ? <th className="fiche-col-badge fiche-col-has">HAS</th> : null}
      {isColVisible('rf') ? <th className="fiche-col-badge fiche-col-rf">RF</th> : null}
      {!badgesOnly && isColVisible('pdf') ? <th className="fiche-col-badge fiche-col-pdf">PDF</th> : null}
      {!badgesOnly && isColVisible('prod') ? (
        <th
          onClick={onSortProduit}
          className={`fiche-col-badge fiche-col-prod${onSortProduit ? ' sortable-header' : ''}`}
        >
          PROD {getSortIcon ? getSortIcon(produitSortLabel) : null}
        </th>
      ) : null}
    </>
  );
}

export function FicheAdminValideCell({ valider, confRdvAvec, hidden = false }) {
  if (hidden) return null;
  return (
    <td data-label="Validé:" className="fiche-col-badge fiche-col-valide" style={{ textAlign: 'center' }}>
      {valider > 0 ? (
        <FaCheck
          style={{ color: '#000000', fontSize: '15.3px' }}
          title={`Validée${confRdvAvec ? ` avec ${confRdvAvec}` : ''}`}
        />
      ) : null}
    </td>
  );
}

export function FicheAdminActionCell({
  onDetail,
  isLastViewed = false,
  detailTitle = 'Voir les détails',
  DetailButtonTag = 'button',
  detailButtonProps = {},
  extras = null,
  showDetail = true,
  hidden = false,
}) {
  if (hidden) return null;
  const inner = (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <FaSearch style={{ color: '#ffffff', fontSize: '11.9px' }} />
      {isLastViewed ? (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '28px',
            height: '28px',
            border: '3px solid #9e9e9e',
            borderRadius: '1px',
            backgroundColor: 'transparent',
            boxSizing: 'border-box',
            pointerEvents: 'none',
          }}
        />
      ) : null}
    </span>
  );

  return (
    <td data-label="">
      <div className="dashboard-actions-cell fiche-admin-action-cell">
        {extras}
        {showDetail ? (
          DetailButtonTag === 'button' ? (
            <button
              type="button"
              onClick={onDetail}
              className="btn-detail"
              title={detailTitle}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              {...detailButtonProps}
            >
              {inner}
            </button>
          ) : (
            <DetailButtonTag
              onClick={onDetail}
              className="btn-detail"
              title={detailTitle}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              {...detailButtonProps}
            >
              {inner}
            </DetailButtonTag>
          )
        ) : null}
      </div>
    </td>
  );
}

/**
 * Cellules SIG → PROD (Validé + ACTION à part).
 */
export function FicheAdminIndicatorCells({
  indicators,
  produitName,
  produitColor,
  onPdf,
  showPdf = true,
  isColVisible = () => true,
  /** true = uniquement SIG/CS/R2/HAS/RF (sans PDF/PROD) */
  badgesOnly = false,
}) {
  return (
    <>
      {isColVisible('sig') ? (
        <td data-label="SIG:" className="fiche-col-badge fiche-col-sig">
          {indicators?.sg ? (
            <span className="indicator sg" title="Signé">SIG</span>
          ) : null}
        </td>
      ) : null}
      {isColVisible('cs') ? (
        <td data-label="CS:" className="fiche-col-badge fiche-col-cs">
          {indicators?.cs ? (
            <span className="indicator cs" title="RDV seul">
              <FaUser aria-hidden />
            </span>
          ) : null}
        </td>
      ) : null}
      {isColVisible('r2') ? (
        <td data-label="R2:" className="fiche-col-badge fiche-col-r2">
          {indicators?.r2 ? (
            <span className="indicator r2" title="R2 placé (commercial secondaire)">R2</span>
          ) : null}
        </td>
      ) : null}
      {isColVisible('has') ? (
        <td data-label="HAS:" className="fiche-col-badge fiche-col-has">
          {indicators?.has ? (
            <span className="indicator has" title="Honoré à suivre">HAS</span>
          ) : null}
        </td>
      ) : null}
      {isColVisible('rf') ? (
        <td data-label="RF:" className="fiche-col-badge fiche-col-rf">
          <div className="fiche-rf-ann-wrap">
            {indicators?.rf ? (
              <span className="indicator rf" title="Refus">RF</span>
            ) : null}
            {indicators?.an ? (
              <span className="indicator an" title="Annulation">ANN</span>
            ) : null}
          </div>
        </td>
      ) : null}
      {!badgesOnly && isColVisible('pdf') ? (
        <td data-label="PDF:" className="fiche-col-badge fiche-col-pdf">
          {showPdf && onPdf ? (
            <button
              type="button"
              className="fiche-badge-pdf"
              title="Générer le PDF"
              onClick={(e) => {
                e.stopPropagation();
                onPdf();
              }}
            >
              <FaFilePdf aria-hidden />
            </button>
          ) : null}
        </td>
      ) : null}
      {!badgesOnly && isColVisible('prod') ? (
        <td data-label="PROD:" className="fiche-col-badge fiche-col-prod">
          {produitName ? (
            <span
              className="produit-indicator"
              style={{ backgroundColor: produitColor, color: '#ffffff' }}
              title={produitName}
            >
              {produitName}
            </span>
          ) : null}
        </td>
      ) : null}
    </>
  );
}
