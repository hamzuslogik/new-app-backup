/**
 * Aligné sur l’étoile « R2 placé » (Planning) : 2e commercial affecté.
 * S’applique à une fiche ou à une entrée de planning (champ id_commercial_2).
 */
export function ficheHasR2Placed(obj) {
  if (!obj) return false;
  return obj.id_commercial_2 != null && Number(obj.id_commercial_2) > 0;
}
