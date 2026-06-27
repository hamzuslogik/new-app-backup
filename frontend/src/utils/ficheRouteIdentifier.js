/**
 * @see backend/utils/ficheRouteIdentifier.js
 */
export function parseFicheRouteIdentifier(raw) {
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

export function mergeFicheRouteQueries(embeddedQuery, search) {
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

export function buildCanonicalFichePath(identifier, searchParams) {
  const id = encodeURIComponent(String(identifier));
  const qs = searchParams.toString();
  return qs ? `/fiches/${id}?${qs}` : `/fiches/${id}`;
}
