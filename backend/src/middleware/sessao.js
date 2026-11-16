// Hierarquia: admin ⊇ medica ⊇ familia (papel maior acessa as áreas menores).
const ORDEM = { familia: 1, medica: 2, admin: 3 };

function alcanca(papel, minimo) {
  return (ORDEM[papel] || 0) >= (ORDEM[minimo] || Infinity);
}

// Exige sessão válida. Relê o usuário no banco a cada requisição (ativo, papel, versão da sessão) e
// barra com 403 `trocar_senha` enquanto houver senha temporária pendente — em QUALQUER rota que use este
// middleware, inclusive as futuras de /painel e /admin. Só /me, /logout e /trocar-senha passam
// `permitirTrocaPendente: true`.
function sessao({ repo, sessao: s, config }, { permitirTrocaPendente = false } = {}) {
  return async (req, res, next) => {
    try {
      const dados = s.verificar(req.cookies?.[config.cookieNome]);
      if (!dados) return res.status(401).json({ erro: 'Não autenticado.' });

      const u = await repo.buscarUsuarioPorId(dados.id);
      if (!u || !u.ativo || u.sessaoVersao !== dados.v) {
        return res.status(401).json({ erro: 'Sessão inválida ou expirada.' });
      }

      req.usuario = {
        id: u.id,
        login: u.login,
        nome: u.nome,
        papel: u.papel,
        precisaTrocarSenha: Boolean(u.precisaTrocarSenha),
        sessaoVersao: u.sessaoVersao,
      };

      if (req.usuario.precisaTrocarSenha && !permitirTrocaPendente) {
        return res.status(403).json({ erro: 'Troque a senha temporária para continuar.', codigo: 'trocar_senha' });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

function exigirPapel(minimo) {
  return (req, res, next) => {
    if (alcanca(req.usuario?.papel, minimo)) return next();
    res.status(403).json({ erro: 'Sem permissão para esta área.', codigo: 'sem_permissao' });
  };
}

module.exports = { sessao, exigirPapel, alcanca };
