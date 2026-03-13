/**
 * Lit yj_utilisateur.csv, filtre les commerciaux (fonction=5 ou groupe=COMMERCIAL),
 * et génère les requêtes INSERT pour ceux qui n'existent pas dans utilisateurs.
 *
 * Usage: node insert_commerciaux_from_yj_csv.js [--run]
 *   --run : exécute les inserts (sinon affiche le SQL uniquement)
 */

const fs = require('fs');
const path = require('path');

// Charger .env si présent
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else if (fs.existsSync(path.join(__dirname, 'backend', '.env'))) {
  require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });
}

const mysql = require('mysql2/promise');

const CSV_PATH = path.join(__dirname, 'yj_utilisateur.csv');

// Parser CSV avec séparateur ; et champs entre guillemets
function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(/;(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((h) => h.replace(/^"|"$/g, '').trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(/;(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((v) => v.replace(/^"|"$/g, '').trim());
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

function escape(val) {
  if (val === null || val === undefined || val === '') return 'NULL';
  return "'" + String(val).replace(/'/g, "''").replace(/\\/g, '\\\\') + "'";
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error('Fichier non trouvé:', CSV_PATH);
    process.exit(1);
  }

  const content = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCSV(content);

  // Filtrer commerciaux : fonction=5 ou groupe=COMMERCIAL
  const commerciaux = rows.filter(
    (r) => String(r.fonction) === '5' || (r.groupe || '').toUpperCase() === 'COMMERCIAL'
  );

  if (commerciaux.length === 0) {
    console.log('Aucun commercial trouvé dans le CSV.');
    return;
  }

  const logins = commerciaux.map((r) => (r.login || '').trim()).filter(Boolean);
  if (logins.length === 0) {
    console.log('Aucun login trouvé pour les commerciaux.');
    return;
  }

  const runMode = process.argv.includes('--run');

  let existingLogins = new Set();
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'crm',
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    });
    const [found] = await conn.execute(
      'SELECT login FROM utilisateurs WHERE login IN (?)',
      [logins]
    );
    existingLogins = new Set(found.map((r) => r.login));
    await conn.end();
  } catch (err) {
    if (runMode) {
      console.error('Erreur DB:', err.message);
      process.exit(1);
    }
    console.warn('DB non accessible - tous les commerciaux du CSV seront inclus dans le SQL.');
  }

  const toInsert = commerciaux.filter((r) => {
    const login = (r.login || '').trim();
    return login && !existingLogins.has(login);
  });

  if (toInsert.length === 0) {
    console.log('Tous les commerciaux du CSV existent déjà dans utilisateurs.');
    if (runMode) return;
    const outPath = path.join(__dirname, 'insert_commerciaux_from_yj_csv.sql');
    fs.writeFileSync(outPath, '-- Aucun commercial à insérer (tous existent déjà)\nUSE `crm`;\n', 'utf8');
    console.log('Fichier SQL vide généré:', outPath);
    return;
  }

  const inserts = toInsert.map((r) => {
    const id = parseInt(r.id, 10) || 'NULL';
    const nom = escape(r.nom || '');
    const prenom = escape(r.prenom || '');
    const pseudo = escape((r.vrai_nom || r.login || '').trim() || r.login || '');
    const tel = escape(r.tel || '');
    const mail = escape(r.mail || '');
    const login = escape((r.login || '').trim());
    const mdp = escape(r.mdp || '');
    const etat = r.etat !== undefined && r.etat !== '' ? parseInt(r.etat, 10) : 1;
    const color = escape(r.color || '');
    const fonction = r.fonction !== undefined && r.fonction !== '' ? parseInt(r.fonction, 10) : 5;
    const chef_equipe = r.chef_equipe !== undefined && r.chef_equipe !== '' ? parseInt(r.chef_equipe, 10) : 0;
    const centre = r.centre !== undefined && r.centre !== '' ? parseInt(r.centre, 10) : 1;

    return `INSERT INTO utilisateurs (id, nom, prenom, pseudo, tel, mail, login, mdp, etat, color, fonction, chef_equipe, centre) VALUES (${id}, ${nom}, ${prenom}, ${pseudo}, ${tel}, ${mail}, ${login}, ${mdp}, ${etat}, ${color}, ${fonction}, ${chef_equipe}, ${centre})`;
  });

  const sql = `-- Insertion des commerciaux depuis yj_utilisateur.csv (ceux absents de utilisateurs)
-- Généré par insert_commerciaux_from_yj_csv.js
USE \`crm\`;

${inserts.join(';\n')};
`;

  if (runMode) {
    try {
      const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'crm',
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
      });
      for (const stmt of inserts) {
        await conn.execute(stmt);
      }
      await conn.end();
      console.log(`${toInsert.length} commercial(aux) inséré(s).`);
    } catch (err) {
      console.error('Erreur lors de l\'insertion:', err.message);
      process.exit(1);
    }
  } else {
    const outPath = path.join(__dirname, 'insert_commerciaux_from_yj_csv.sql');
    fs.writeFileSync(outPath, sql, 'utf8');
    console.log(`${toInsert.length} commercial(aux) à insérer.`);
    console.log('SQL généré:', outPath);
    console.log('\nPour exécuter directement: node insert_commerciaux_from_yj_csv.js --run');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
