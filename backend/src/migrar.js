const fs = require('fs');
const path = require('path');

const PADRAO = /^\d{3}_.+\.sql$/;
const LOCK = 'raquel_migrar';

// Aplica as migrations de `dir` (NNN_nome.sql) que ainda não constam em schema_migracoes,
// em ordem de nome. Substitui o "initdb só roda em volume vazio" + ALTERs soltos no seed.
//
// Regras para escrever uma migration:
//  - idempotente (IF EXISTS / IF NOT EXISTS): DDL no MySQL faz commit implícito, então uma
//    migration que falha no meio pode ter aplicado parte e será reexecutada inteira no próximo boot;
//  - nunca editar uma migration já aplicada em produção — criar a próxima.
//
// `pool` precisa permitir múltiplas instruções por query (multipleStatements) — o seed.js
// cria um pool dedicado para isso; o pool da aplicação (db.js) NÃO habilita.
async function migrar(pool, dir) {
  const conn = await pool.getConnection();
  try {
    const [[lock]] = await conn.query('SELECT GET_LOCK(?, 30) AS ok', [LOCK]);
    if (lock.ok !== 1) {
      throw new Error('Não foi possível obter o lock de migração (outra instância está migrando?).');
    }

    await conn.query(
      `CREATE TABLE IF NOT EXISTS schema_migracoes (
         nome VARCHAR(255) NOT NULL PRIMARY KEY,
         aplicada_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    );
    const [feitas] = await conn.query('SELECT nome FROM schema_migracoes');
    const jaFeitas = new Set(feitas.map((r) => r.nome));

    const arquivos = fs.readdirSync(dir).filter((f) => PADRAO.test(f)).sort();
    const aplicadas = [];
    for (const arquivo of arquivos) {
      if (jaFeitas.has(arquivo)) continue;
      const sql = fs.readFileSync(path.join(dir, arquivo), 'utf8');
      await conn.query(sql);
      await conn.query('INSERT INTO schema_migracoes (nome) VALUES (?)', [arquivo]);
      aplicadas.push(arquivo);
    }
    return aplicadas;
  } finally {
    try {
      await conn.query('SELECT RELEASE_LOCK(?)', [LOCK]);
    } catch {
      /* conexão já caiu: o lock some junto com ela */
    }
    conn.release();
  }
}

module.exports = { migrar };
