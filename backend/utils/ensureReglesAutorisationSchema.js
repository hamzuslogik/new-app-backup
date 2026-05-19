const { query } = require('../config/database');

let schemaReady = false;
let schemaCheckPromise = null;

const RELATIVE_COLUMNS = [
  { name: 'date_insert_operateur', def: "varchar(4) DEFAULT NULL COMMENT '< > <= >='" },
  { name: 'date_insert_valeur', def: 'int(11) DEFAULT NULL' },
  { name: 'date_insert_unite', def: "varchar(10) DEFAULT NULL COMMENT 'jour, mois, annee'" },
  { name: 'date_appel_operateur', def: 'varchar(4) DEFAULT NULL' },
  { name: 'date_appel_valeur', def: 'int(11) DEFAULT NULL' },
  { name: 'date_appel_unite', def: 'varchar(10) DEFAULT NULL' },
];

/**
 * Ajoute les colonnes critères relatifs si la table existe mais avec l'ancien schéma (date_*_debut/fin).
 */
async function ensureReglesAutorisationSchema() {
  if (schemaReady) return true;
  if (schemaCheckPromise) return schemaCheckPromise;

  schemaCheckPromise = (async () => {
    try {
      const cols = await query('SHOW COLUMNS FROM regles_autorisation');
      const names = new Set((cols || []).map((c) => c.Field));

      if (names.size === 0) {
        return false;
      }

      const missing = RELATIVE_COLUMNS.filter((c) => !names.has(c.name));
      if (missing.length === 0) {
        schemaReady = true;
        return true;
      }

      for (const col of missing) {
        await query(
          `ALTER TABLE regles_autorisation ADD COLUMN \`${col.name}\` ${col.def}`
        );
        console.log(`[regles_autorisation] Colonne ajoutée : ${col.name}`);
      }

      schemaReady = true;
      return true;
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') {
        console.warn(
          '[regles_autorisation] Table absente — exécutez backend/scripts/create-regles-autorisation-table.sql'
        );
        return false;
      }
      if (err.code === 'ER_DUP_FIELDNAME') {
        schemaReady = true;
        return true;
      }
      console.error('[regles_autorisation] Migration schéma échouée:', err.message);
      throw err;
    } finally {
      schemaCheckPromise = null;
    }
  })();

  return schemaCheckPromise;
}

module.exports = { ensureReglesAutorisationSchema };
