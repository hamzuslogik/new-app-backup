/**
 * Certaines intégrations externes (Vicidial, etc.) produisent
 * /fiches/0612345678&overlay=1&close=0 au lieu de ?overlay=1&close=0.
 * Sépare l'identifiant fiche (hash ou téléphone) des paramètres collés au path.
 *
 * @param {string} raw
 * @returns {{ identifier: string, embeddedQuery: string|null }}
 */
function parseFicheRouteIdentifier(raw) {
  if (raw == null || raw === '') {
    return { identifier: '', embeddedQuery: null };
  }

  let s = decodeURIComponent(String(raw).trim());
  let embeddedQuery = null;

  const ampIdx = s.indexOf('&');
  const qIdx = s.indexOf('?');
  let cutIdx = -1;
  if (ampIdx >= 0 && qIdx >= 0) {
    cutIdx = Math.min(ampIdx, qIdx);
  } else if (ampIdx >= 0) {
    cutIdx = ampIdx;
  } else if (qIdx >= 0) {
    cutIdx = qIdx;
  }

  if (cutIdx >= 0) {
    embeddedQuery = s.slice(cutIdx + 1).replace(/^[?&]+/, '');
    s = s.slice(0, cutIdx);
  }

  return {
    identifier: s.trim(),
    embeddedQuery: embeddedQuery && embeddedQuery.length > 0 ? embeddedQuery : null
  };
}

/**
 * Fusionne une query embarquée dans le path avec la query HTTP (?…).
 * @param {string|null|undefined} embeddedQuery
 * @param {string} search - location.search ou req.url query part
 */
function mergeFicheRouteQueries(embeddedQuery, search) {
  const params = new URLSearchParams(
    search && String(search).startsWith('?') ? String(search).slice(1) : String(search || '')
  );
  if (embeddedQuery) {
    const embedded = new URLSearchParams(embeddedQuery);
    embedded.forEach((value, key) => {
      if (!params.has(key)) {
        params.set(key, value);
      }
    });
  }
  return params;
}

module.exports = {
  parseFicheRouteIdentifier,
  mergeFicheRouteQueries
};
