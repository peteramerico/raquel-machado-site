// ÚNICO lugar com SQL da aplicação. Só consultas parametrizadas. A interface é espelhada
// em memória por tests/helpers/repoFalso.js (testes de rotas) e validada contra MySQL real
// por tests/repositorio.integracao.test.js.
const COLUNAS = 'id, login, nome, papel, senha_hash, precisa_trocar_senha, ativo, sessao_versao, contato, criado_por';

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
    criadoPor: r.criado_por,
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
    // Com { papel }, o UPDATE só casa se a conta tem esse papel (a médica só mexe em famílias): devolve null se
    // nenhuma linha casar — sem ler-e-depois-escrever.
    async atualizarSenha(id, senhaHash, precisaTrocarSenha, { papel } = {}) {
      const params = [senhaHash, precisaTrocarSenha ? 1 : 0, id];
      if (papel) params.push(papel);
      const [res] = await pool.query(
        `UPDATE usuarios
            SET senha_hash = ?, precisa_trocar_senha = ?, sessao_versao = LAST_INSERT_ID(sessao_versao + 1)
          WHERE id = ?${papel ? ' AND papel = ?' : ''}`,
        params
      );
      return res.affectedRows === 0 ? null : res.insertId;
    },

    // Ativa/desativa. SÓ muda (e só então incrementa sessao_versao, derrubando a sessão) se o estado realmente
    // mudar: reativar conta já ativa não desloga ninguém. Com { papel }, a guarda vive no UPDATE.
    // Devolve null (não encontrada / outro papel) ou { mudou, versao }.
    async definirAtivo(id, ativo, { papel } = {}) {
      const alvo = ativo ? 1 : 0;
      const filtro = [id];
      if (papel) filtro.push(papel);
      const base = `WHERE id = ?${papel ? ' AND papel = ?' : ''}`;
      const [res] = await pool.query(
        `UPDATE usuarios SET ativo = ?, sessao_versao = LAST_INSERT_ID(sessao_versao + 1) ${base} AND ativo <> ?`,
        [alvo, ...filtro, alvo]
      );
      if (res.affectedRows === 1) return { mudou: true, versao: res.insertId };
      const [rows] = await pool.query(`SELECT sessao_versao FROM usuarios ${base}`, filtro);
      return rows[0] ? { mudou: false, versao: rows[0].sessao_versao } : null;
    },

    // Desativação para a área do administrador, com a TRAVA DO ÚLTIMO ADMIN (defesa em profundidade: por HTTP ela só
    // dispara numa corrida). Serializa por um MUTEX NOMEADO (GET_LOCK), não por `SELECT … FOR UPDATE`: no índice
    // (papel, ativo) o FOR UPDATE pega gap locks e duas desativações simultâneas dão DEADLOCK (provado no teste de
    // integração). Com o mutex, quem chega depois espera e então lê o estado já gravado pelo primeiro.
    // Devolve { ok:true, mudou, versao? } ou { ok:false, motivo:'nao_encontrada'|'ultimo_admin'|'ocupado' }.
    async definirAtivoComTrava(id, ativo) {
      const conn = await pool.getConnection();
      let travou = false;
      try {
        const [[g]] = await conn.query("SELECT GET_LOCK('raquel_admins', 10) AS ok");
        if (g.ok !== 1) return { ok: false, motivo: 'ocupado' };
        travou = true;

        const [alvos] = await conn.query('SELECT id, papel, ativo FROM usuarios WHERE id = ?', [id]);
        const alvo = alvos[0];
        if (!alvo) return { ok: false, motivo: 'nao_encontrada' };
        if (Boolean(alvo.ativo) === ativo) return { ok: true, mudou: false };
        if (!ativo && alvo.papel === 'admin') {
          const [[c]] = await conn.query("SELECT COUNT(*) AS n FROM usuarios WHERE papel = 'admin' AND ativo = 1");
          if (c.n <= 1) return { ok: false, motivo: 'ultimo_admin' };
        }
        const [res] = await conn.query(
          'UPDATE usuarios SET ativo = ?, sessao_versao = LAST_INSERT_ID(sessao_versao + 1) WHERE id = ?',
          [ativo ? 1 : 0, id]
        );
        return { ok: true, mudou: true, versao: res.insertId };
      } finally {
        // o lock é da CONEXÃO: precisa ser solto antes de devolvê-la ao pool
        if (travou) {
          try { await conn.query("SELECT RELEASE_LOCK('raquel_admins')"); } catch { /* conexão caiu: o lock some com ela */ }
        }
        conn.release();
      }
    },

    // Todas as contas para o administrador (sem hash): admin, médica, família; depois por nome.
    // (ENUM ordena pelo índice: familia < medica < admin, então DESC.)
    async listarUsuarios(limite = 500) {
      const [rows] = await pool.query(
        `SELECT id, login, nome, papel, contato, ativo, precisa_trocar_senha, ultimo_acesso_em, criado_em
           FROM usuarios ORDER BY papel DESC, nome, id LIMIT ?`,
        [limite + 1]
      );
      return {
        truncada: rows.length > limite,
        itens: rows.slice(0, limite).map((r) => ({
          id: r.id,
          login: r.login,
          nome: r.nome,
          papel: r.papel,
          contato: r.contato,
          ativo: Boolean(r.ativo),
          precisaTrocarSenha: Boolean(r.precisa_trocar_senha),
          ultimoAcessoEm: r.ultimo_acesso_em,
          criadoEm: r.criado_em,
        })),
      };
    },

    // Contas de família para a área médica (sem hash). Devolve até `limite` e diz se havia mais.
    async listarFamilias(limite = 500) {
      const [rows] = await pool.query(
        `SELECT id, login, nome, contato, ativo, precisa_trocar_senha, ultimo_acesso_em, criado_em
           FROM usuarios WHERE papel = 'familia' ORDER BY nome, id LIMIT ?`,
        [limite + 1]
      );
      return {
        truncada: rows.length > limite,
        itens: rows.slice(0, limite).map((r) => ({
          id: r.id,
          login: r.login,
          nome: r.nome,
          contato: r.contato,
          ativo: Boolean(r.ativo),
          precisaTrocarSenha: Boolean(r.precisa_trocar_senha),
          ultimoAcessoEm: r.ultimo_acesso_em,
          criadoEm: r.criado_em,
        })),
      };
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
