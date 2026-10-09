const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

async function main() {
  const sqlPath = path.join(__dirname, '..', '..', 'create_rdv_creneau_code_bypass.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });
  try {
    await conn.query(sql);
    const [tables] = await conn.query("SHOW TABLES LIKE 'rdv_creneau_code_bypass'");
    if (!tables.length) {
      throw new Error('Table rdv_creneau_code_bypass introuvable après CREATE');
    }
    const [cols] = await conn.query('DESCRIBE rdv_creneau_code_bypass');
    console.log('OK table rdv_creneau_code_bypass');
    console.log(cols.map((c) => c.Field).join(', '));
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('ERR', err.message);
  process.exit(1);
});
