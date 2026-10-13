import React from 'react';

/** Numéro de ligne affiché (tient compte de la pagination). */
export function getFicheRowNumber(rowIndex, page = 1, limit = null) {
  const p = Number(page) || 1;
  const l = Number(limit);
  const offset = l > 0 && l < 999999 && p > 1 ? (p - 1) * l : 0;
  return offset + rowIndex + 1;
}

/** En-tête colonne numérotation (#). */
export function FicheRowIndexHeader() {
  return (
    <th className="fiche-col-num" scope="col" title="N°">
      #
    </th>
  );
}

/** Cellule numérotation par ligne. */
export function FicheRowIndexCell({ number, label = 'N°' }) {
  return (
    <td className="fiche-col-num" data-label={`${label}:`}>
      {number}
    </td>
  );
}
