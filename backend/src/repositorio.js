// ÚNICO lugar com SQL da aplicação. Só consultas parametrizadas. A interface é espelhada
// em memória por tests/helpers/repoFalso.js (testes de rotas) e validada contra MySQL real
// por tests/repositorio.integracao.test.js.
const COLUNAS = 'id, login, nome, papel, senha_hash, precisa_trocar_senha, ativo, sessao_versao, contato';

function paraUsuario(r) {
  if (!r) return null;
  return {
    id: r.id,
    login: r.login,
    nome: r.nome,
    papel: r.papel,
    senhaHash: r.senha_hash,
    precisaTrocarSenha: Boolean(r.precisa_trocar_senha),
    ativo: Boolean(r.ativo),
    sessaoVersao: r.sessao_versao,
    contato: r.contato,
  };
}

function criarRepositorio(pool) {
  return {
    async buscarUsuarioPorLogin(login) {
      const [rows] = await pool.query(`SELECT ${COLUNAS} FROM usuarios WHERE login = ?`, [login]);
      return paraUsuario(rows[0]);
    },

    async buscarUsuarioPorId(id) {
      const [rows] = await pool.query(`SELECT ${COLUNAS} FROM usuarios WHERE id = ?`, [id]);
      return paraUsuario(rows[0]);
    },

    async criarUsuario({ login, nome, papel, senhaHash, contato = null, criadoPor = null, precisaTrocarSenha = true }) {
      try {
        const [res] = await pool.query(
          `INSERT INTO usuarios (login, nome, papel, senha_hash, precisa_trocar_senha, contato, criado_por)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [login, nome, papel, senhaHash, precisaTrocarSenha ? 1 : 0, contato, criadoPor]
        );
        return res.insertId;
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') throw Object.assign(new Error('login duplicado'), { codigo: 'LOGIN_DUPLICADO' });
        throw err;
      }
    },

    // Troca a senha e INCREMENTA sessao_versao (derruba as sessões antigas). Devolve a nova versão.
    // LAST_INSERT_ID(expr) devolve o valor calculado em result.insertId numa única instrução (sem corrida).
    async atualizarSenha(id, senhaHash, precisaTrocarSenha) {
      const [res] = await pool.query(
        `UPDATE usuarios
            SET senha_hash = ?, precisa_trocar_senha = ?, sessao_versao = LAST_INSERT_ID(sessao_versao + 1)
          WHERE id = ?`,
        [senhaHash, precisaTrocarSenha ? 1 : 0, id]
      );
      return res.insertId;
    },

    async registrarAcesso(id) {
      await pool.query('UPDATE usuarios SET ultimo_acesso_em = NOW() WHERE id = ?', [id]);
    },

    async lerConfig(chave) {
      const [rows] = await pool.query('SELECT valor FROM configuracoes WHERE chave = ?', [chave]);
      return rows[0] ? rows[0].valor : null;
    },

    async gravarConfig(chave, valor, porId = null) {
      await pool.query(
        `INSERT INTO configuracoes (chave, valor, atualizado_por) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE valor = VALUES(valor), atualizado_por = VALUES(atualizado_por)`,
        [chave, String(valor), porId]
      );
    },
  };
}

module.exports = { criarRepositorio };
