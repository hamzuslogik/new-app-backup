/**
 * Nettoyer le champ "Observation" de Controle Qualite :
 *   - supprime les lignes qui sont en fait "CQ ETAT: ...", "CQ DOSSIER: ..." ou
 *     "Controle qualite: ..." (qu'on essaie d'extraire l'observation embarquee si
 *     elle existe sur la meme ligne, ex. "CQ ETAT: ok | Observation: bla").
 *   - retire un eventuel prefixe "Observation:" en debut de ligne.
 *   - elimine les lignes vides resultantes.
 *
 * Renvoie une chaine vide si le contenu est vide / null.
 */
export function cleanObservationCQ(value) {
  if (value == null) return '';
  return String(value)
    .split(/\r?\n/)
    .map((line) => {
      const normalized = line
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      if (
        normalized.startsWith('cq etat') ||
        normalized.startsWith('cq dossier') ||
        normalized.startsWith('controle qualite')
      ) {
        const observationOnly = line.match(/observations?\s*:?\s*(.*)$/i)?.[1]?.trim();
        return observationOnly || '';
      }
      return line.replace(/^\s*observations?\s*:?\s*/i, '');
    })
    .filter((line) => String(line).trim() !== '')
    .join('\n')
    .trim();
}

export default cleanObservationCQ;
