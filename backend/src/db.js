const mysql = require('mysql2/promise');

// Pool da aplicação, criado só no primeiro uso (importar o app nos testes não abre conexão nenhuma).
// NÃO habilita multipleStatements: isso fica restrito ao pool das migrations (seed.js).
let pool;

function obterPool() {
  pool ??= mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
  });
  return pool;
}

module.exports = { obterPool };
