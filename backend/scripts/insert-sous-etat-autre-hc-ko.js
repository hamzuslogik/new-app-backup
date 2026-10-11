/**
 * HC = état 55 → sous_etat (dont AUTRE).
 * KO = champ ko 0/1 → motifs statiques (constants/koMotifs.js), pas sous_etat.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  try {
    const [existingHc] = await conn.query(
      'SELECT id FROM sous_etat WHERE id_etat = 55 AND UPPER(titre) = ? LIMIT 1',
      ['AUTRE']
    );
    if (existingHc.length) {
      console.log(`HC AUTRE déjà présent (id=${existingHc[0].id})`);
    } else {
      const [result] = await conn.query(
        'INSERT INTO sous_etat (id_etat, titre) VALUES (55, ?)',
        ['AUTRE']
      );
      console.log(`HC AUTRE inséré (id=${result.insertId})`);
    }

    // Nettoyage éventuel : ne pas garder AUTRE sous l'état KO legacy (54)
    const [del] = await conn.query(
      "DELETE FROM sous_etat WHERE id_etat = 54 AND UPPER(titre) = 'AUTRE'"
    );
    if (del.affectedRows) {
      console.log(`Sous-état KO AUTRE legacy supprimé (${del.affectedRows})`);
    }

    const [rows] = await conn.query(
      "SELECT id, id_etat, titre FROM sous_etat WHERE id_etat = 55 AND UPPER(titre) = 'AUTRE'"
    );
    console.log(rows);
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
