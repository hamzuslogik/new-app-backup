export const REVENU_NON_PRIS_EN_COMPTE = 'revenu non pris en compte';

const TYPE_CONTRAT_NOMS_REVENU_AUTO = new Set([
  'cdd',
  'chomage',
  'interimaire',
  'intermittent de spectacle',
]);

function normalizeTypeContratNom(nom) {
  return String(nom || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function isTypeContratRevenuNonPrisEnCompte(typeContratId, typeContratList) {
  if (typeContratId == null || String(typeContratId).trim() === '') return false;
  const list = typeContratList || [];
  const found = list.find((t) => String(t.id) === String(typeContratId));
  if (!found?.nom) return false;
  return TYPE_CONTRAT_NOMS_REVENU_AUTO.has(normalizeTypeContratNom(found.nom));
}

export function shouldAutoSetRevenuNonPrisEnCompte(typeContratMrId, typeContratMmeId, typeContratList) {
  return (
    isTypeContratRevenuNonPrisEnCompte(typeContratMrId, typeContratList) ||
    isTypeContratRevenuNonPrisEnCompte(typeContratMmeId, typeContratList)
  );
}

export function resolveConfRevenuAfterTypeContratChange(
  prevRevenu,
  typeContratMrId,
  typeContratMmeId,
  typeContratList
) {
  if (shouldAutoSetRevenuNonPrisEnCompte(typeContratMrId, typeContratMmeId, typeContratList)) {
    return REVENU_NON_PRIS_EN_COMPTE;
  }
  if (prevRevenu === REVENU_NON_PRIS_EN_COMPTE) return '';
  return prevRevenu ?? '';
}
