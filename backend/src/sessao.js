const jwt = require('jsonwebtoken');

// Sessão = JWT HS256 em cookie httpOnly. O token carrega SÓ { sub: id, v: sessao_versao }:
// papel/ativo/precisa_trocar_senha são sempre relidos do banco a cada requisição (ver middleware/sessao.js),
// e trocar a senha / desativar a conta incrementa sessao_versao, derrubando os tokens antigos.
function criarSessao(config) {
  const cookieOpcoes = {
    httpOnly: true,
    secure: config.producao,
    sameSite: 'lax',
    path: '/',
    maxAge: config.sessaoDias * 24 * 60 * 60 * 1000,
  };

  function assinar(usuario) {
    return jwt.sign({ sub: String(usuario.id), v: usuario.sessaoVersao }, config.jwtSecret, {
      algorithm: 'HS256',
      expiresIn: `${config.sessaoDias}d`,
    });
  }

  function verificar(token) {
    if (typeof token !== 'string' || !token) return null;
    try {
      const p = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
      const id = Number(p.sub);
      if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(p.v)) return null;
      return { id, v: p.v };
    } catch {
      return null;
    }
  }

  return {
    cookieOpcoes,
    assinar,
    verificar,
    definirCookie: (res, usuario) => res.cookie(config.cookieNome, assinar(usuario), cookieOpcoes),
    limparCookie: (res) => res.clearCookie(config.cookieNome, { ...cookieOpcoes, maxAge: undefined }),
  };
}

module.exports = { criarSessao };
