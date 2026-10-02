import React from 'react';

/** En-tête colonne case à cocher (aucune action liée). */
export function FicheRowSelectHeader() {
  return (
    <th className="fiche-col-select" scope="col" aria-label="Sélection">
      <span className="fiche-col-select-spacer" aria-hidden="true" />
    </th>
  );
}

/** Cellule case à cocher par ligne — cochable uniquement, sans action métier. */
export function FicheRowSelectCell({ label = 'Sélectionner la ligne' }) {
  return (
    <td className="fiche-col-select" data-label="" onClick={(e) => e.stopPropagation()}>
      <input
        type="checkbox"
        className="fiche-row-select-checkbox"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
      />
    </td>
  );
}
