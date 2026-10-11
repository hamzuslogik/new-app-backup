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
    const [cols] = await c.query('DESCRIBE type_contrat');
    console.log('cols', cols.map((x) => x.Field).join(','));
    const [rows] = await c.query('SELECT * FROM type_contrat LIMIT 20');
    console.log('rows', rows);
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
