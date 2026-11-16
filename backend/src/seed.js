// Roda em todo boot do container (antes do server.js): aplica as migrations pendentes.
// Falhou = sai com código 1 e o container não sobe (falha alta, nunca silenciosa).
require('dotenv').config();
const path = require('path');
const mysql = require('mysql2/promise');
const { migrar } = require('./migrar');

async function main() {
  // Pool dedicado com multipleStatements só para as migrations; o pool da aplicação (src/db.js) não habilita.
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
    connectionLimit: 2,
    charset: 'utf8mb4',
  });
  try {
    const aplicadas = await migrar(pool, path.join(__dirname, '..', 'migrations'));
    console.log(aplicadas.length ? `Migrations aplicadas: ${aplicadas.join(', ')}` : 'Banco em dia: nenhuma migration pendente.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Falha ao migrar o banco:', err);
  process.exit(1);
});
