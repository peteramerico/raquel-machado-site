const express = require('express');
const rateLimit = require('express-rate-limit');
const { sessao: mwSessao, alcanca } = require('../middleware/sessao');
const { normalizarLogin, validarNovaSenha } = require('../senhas');

const { ipKeyGenerator } = rateLimit;

// area (o que a tela de login pede) → papel mínimo necessário.
const AREA_PAPEL = { familia: 'familia', painel: 'medica', admin: 'admin' };
const MSG_LOGIN = 'Usuário ou senha incorretos.';

const texto = (v) => typeof v === 'string';

function criarLimitador({ windowMs, limit }, keyGenerator) {
  return rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests: true, // só as falhas contam: quem acerta a senha nunca é travado
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator,
    message: { erro: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' },
  });
}

function rotasAuth({ repo, config, sessao, senhas, limites }) {
  const router = express.Router();
  const dep = { repo, sessao, config };

  // Por IP (qualquer login) e por login+IP (a chave inclui o IP: atacante não trava a conta real de outra pessoa).
  const limiteIp = criarLimitador(limites.ip, (req) => ipKeyGenerator(req.ip));
  const limiteLoginIp = criarLimitador(limites.loginIp, (req) => `${normalizarLogin(req.body?.login)}|${ipKeyGenerator(req.ip)}`);
  const limiteTrocar = criarLimitador(limites.trocarSenha, (req) => `u${req.usuario.id}`);

  router.post('/login', limiteIp, limiteLoginIp, async (req, res, next) => {
    try {
      const { login, senha, area } = req.body ?? {};
      if (!texto(login) || !texto(senha) || !AREA_PAPEL[area]) {
        return res.status(400).json({ erro: 'Informe usuário, senha e a área de acesso.' });
      }

      const usuario = await repo.buscarUsuarioPorLogin(normalizarLogin(login));
      // sempre confere (contra hash fictício se o login não existe): o tempo não revela se a conta existe
      const confere = await senhas.conferir(senha, usuario?.senhaHash);
      if (!usuario || !usuario.ativo || !confere) {
        return res.status(401).json({ erro: MSG_LOGIN });
      }
      // senha correta, mas a conta não pertence a esta área (ex.: família no painel)
      if (!alcanca(usuario.papel, AREA_PAPEL[area])) {
        return res.status(403).json({ erro: 'Este acesso pertence a outra área do site.', codigo: 'area_errada' });
      }

      sessao.definirCookie(res, usuario);
      repo.registrarAcesso(usuario.id).catch((e) => console.error('Falha ao registrar acesso:', e.message));
      res.json({ nome: usuario.nome, papel: usuario.papel, precisaTrocarSenha: usuario.precisaTrocarSenha });
    } catch (err) {
      next(err);
    }
  });

  router.post('/logout', (req, res) => {
    sessao.limparCookie(res);
    res.json({ ok: true });
  });

  router.get('/me', mwSessao(dep, { permitirTrocaPendente: true }), (req, res) => {
    const { nome, login, papel, precisaTrocarSenha } = req.usuario;
    res.json({ nome, login, papel, precisaTrocarSenha });
  });

  router.post('/trocar-senha', mwSessao(dep, { permitirTrocaPendente: true }), limiteTrocar, async (req, res, next) => {
    try {
      const { senhaAtual, novaSenha } = req.body ?? {};
      if (!texto(senhaAtual) || !texto(novaSenha)) {
        return res.status(400).json({ erro: 'Informe a senha atual e a nova senha.' });
      }
      const usuario = await repo.buscarUsuarioPorId(req.usuario.id);
      if (!(await senhas.conferir(senhaAtual, usuario.senhaHash))) {
        return res.status(401).json({ erro: 'Senha atual incorreta.' });
      }
      const motivo = validarNovaSenha(novaSenha, { login: usuario.login, nome: usuario.nome, senhaAtual });
      if (motivo) return res.status(400).json({ erro: motivo });

      // incrementa a versão da sessão: todos os cookies antigos (inclusive o desta requisição) caem
      const versao = await repo.atualizarSenha(usuario.id, await senhas.hash(novaSenha), false);
      sessao.definirCookie(res, { id: usuario.id, sessaoVersao: versao });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { rotasAuth, AREA_PAPEL };
