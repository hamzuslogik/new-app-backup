/**
 * Extrait l'ID numérique de fiche depuis le hash renvoyé par l'API (même format que
 * encodeFicheId côté backend : préfixe HMAC 16 car. + id en base64 URL-safe).
 * Utilisé quand GET /fiches masque id mais expose hash.
 */
export function decodeFicheIdFromHash(hash) {
  if (!hash || typeof hash !== 'string' || hash.length < 17) return null;
  const encodedId = hash.substring(16);
  let base64 = encodedId.replace(/-/g, '+').replace(/_/g, '/');
  const paddingNeeded = (4 - (base64.length % 4)) % 4;
  base64 += '='.repeat(paddingNeeded);
  try {
    const decoded = atob(base64);
    const idNum = parseInt(decoded, 10);
    if (!Number.isFinite(idNum) || idNum <= 0) return null;
    return idNum;
  } catch {
    return null;
  }
}
