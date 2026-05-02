/**
 * Normalise groupes_messages_autorises (JSON) depuis la table fonctions.
 * Ancien format : [1, 2, 5] → toute la fonction cible.
 * Nouveau format : [{ fonction: 5, all: true }, { fonction: 6, all: false, userIds: [1,2] }]
 */

function normalizeMessageRules(raw) {
  if (raw == null || raw === '') return [];
  let parsed = raw;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  const out = [];
  for (const item of parsed) {
    if (typeof item === 'number' && Number.isFinite(item)) {
      out.push({ fonction: item, all: true });
      continue;
    }
    if (typeof item === 'string' && /^\d+$/.test(item.trim())) {
      out.push({ fonction: parseInt(item, 10), all: true });
      continue;
    }
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const fid = Number(item.fonction ?? item.fonction_id);
      if (!Number.isFinite(fid)) continue;

      const explicitAll =
        item.all === true || item.mode === 'all' || item.toute_fonction === true;
      const explicitUsers =
        item.mode === 'users' ||
        Array.isArray(item.users) ||
        Array.isArray(item.userIds) ||
        Array.isArray(item.ids);

      const uidArr = item.users ?? item.userIds ?? item.ids;
      if (explicitUsers && Array.isArray(uidArr) && uidArr.length > 0) {
        const userIds = [
          ...new Set(uidArr.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))
        ];
        if (userIds.length > 0) {
          out.push({ fonction: fid, all: false, userIds });
          continue;
        }
      }
      if (explicitAll || !explicitUsers) {
        out.push({ fonction: fid, all: true });
      }
    }
  }
  return out;
}

function destinationMatchesRules(rules, destUser) {
  const df = Number(destUser.fonction);
  const du = Number(destUser.id);
  for (const r of rules) {
    if (Number(r.fonction) !== df) continue;
    if (r.all) return true;
    if (Array.isArray(r.userIds) && r.userIds.includes(du)) return true;
  }
  return false;
}

/**
 * Fragments SQL pour utilisateurs atteints par les règles « sortantes » (expéditeur → cible).
 * Retourne { sql: '( ... )', params: [] } ou null si aucune cible.
 */
function buildOutboundWhereClause(rules) {
  const parts = [];
  const params = [];
  for (const r of rules) {
    if (r.all) {
      parts.push('u.fonction = ?');
      params.push(r.fonction);
    } else if (Array.isArray(r.userIds) && r.userIds.length > 0) {
      const ph = r.userIds.map(() => '?').join(',');
      parts.push(`(u.fonction = ? AND u.id IN (${ph}))`);
      params.push(r.fonction, ...r.userIds);
    }
  }
  if (parts.length === 0) return null;
  return { sql: `(${parts.join(' OR ')})`, params };
}

/**
 * IDs de fonctions « sources » tel qu'une règle de cette fonction cible currentFonctionId
 * (toute la fonction ou l'utilisateur currentUserId).
 */
function collectIncomingSourceFonctionIds(allFonctionRows, currentFonctionId, currentUserId) {
  const ids = new Set();
  const cf = Number(currentFonctionId);
  const cu = Number(currentUserId);
  for (const row of allFonctionRows) {
    const rules = normalizeMessageRules(row.groupes_messages_autorises);
    for (const r of rules) {
      if (Number(r.fonction) !== cf) continue;
      if (r.all || (Array.isArray(r.userIds) && r.userIds.includes(cu))) {
        ids.add(Number(row.id));
        break;
      }
    }
  }
  return [...ids];
}

function serializeRulesForDb(rules) {
  if (!Array.isArray(rules) || rules.length === 0) return null;
  const payload = [];
  for (const r of rules) {
    const fid = Number(r.fonction);
    if (!Number.isFinite(fid)) continue;
    if (r.all === true) {
      payload.push({ fonction: fid, all: true });
    } else {
      const userIds = [...new Set((r.userIds || []).map(Number).filter((n) => n > 0))];
      if (userIds.length === 0) continue;
      payload.push({ fonction: fid, all: false, userIds });
    }
  }
  return payload.length > 0 ? payload : null;
}

module.exports = {
  normalizeMessageRules,
  destinationMatchesRules,
  buildOutboundWhereClause,
  collectIncomingSourceFonctionIds,
  serializeRulesForDb
};
