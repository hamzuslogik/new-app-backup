/**
 * Regroupe les états par phase (0, 1, 2, 3) selon l'ordre en base (groupe puis ordre).
 * Utilisé pour les selects et affichages où les états doivent être présentés
 * en Phase 0, Phase 1, Phase 2, Phase 3 avec l'ordre de la BDD et la couleur en arrière-plan.
 */

const normGroupe = (g) => {
  if (g === '0' || g === 0) return 0;
  const n = parseInt(g, 10);
  return Number.isFinite(n) ? n : -1;
};

const sortByOrdre = (a, b) => (a.ordre ?? a.id ?? 0) - (b.ordre ?? b.id ?? 0);

/**
 * Retourne les états regroupés par phase (0, 1, 2, 3), chaque phase triée selon le champ `ordre` de la base.
 * @param {Array<{id, groupe, ordre?, color?, titre?}>} etats - Liste des états (ex: /management/etats)
 * @returns {{ phase0: Array, phase1: Array, phase2: Array, phase3: Array }}
 */
export function getEtatsGroupedByPhase(etats) {
  if (!etats || !Array.isArray(etats)) {
    return { phase0: [], phase1: [], phase2: [], phase3: [] };
  }
  const byPhase = { 0: [], 1: [], 2: [], 3: [] };
  etats.forEach((e) => {
    const g = normGroupe(e.groupe);
    if (g >= 0 && g <= 3) {
      byPhase[g].push(e);
    } else {
      // États sans groupe 0-3 (ex. NRP, RAPPEL BUREAU) : affichés en Phase 1 pour rester accessibles dans la liste déroulante
      byPhase[1].push(e);
    }
  });
  return {
    phase0: [...byPhase[0]].sort(sortByOrdre),
    phase1: [...byPhase[1]].sort(sortByOrdre),
    phase2: [...byPhase[2]].sort(sortByOrdre),
    phase3: [...byPhase[3]].sort(sortByOrdre),
  };
}
