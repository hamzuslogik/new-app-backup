const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

async function main() {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  try {
    const [cols] = await c.query('DESCRIBE sous_etat');
    console.log('cols', cols.map((x) => x.Field).join(','));
    const [cnt] = await c.query('SELECT COUNT(*) AS c FROM sous_etat');
    console.log('total sous_etat', cnt[0].c);
    const [byEtat] = await c.query(
      'SELECT id_etat, COUNT(*) AS c FROM sous_etat GROUP BY id_etat ORDER BY c DESC LIMIT 20'
    );
    console.log('by etat', byEtat);
    const [hcLike] = await c.query(
      `SELECT se.id, se.id_etat, se.titre, e.titre AS etat
       FROM sous_etat se
       LEFT JOIN etats e ON e.id = se.id_etat
       WHERE e.titre LIKE '%HC%' OR se.titre LIKE '%HC%'
       LIMIT 50`
    );
    console.log('hc like', hcLike);
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
