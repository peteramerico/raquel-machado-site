const express = require('express');
const rateLimit = require('express-rate-limit');
const { sessao: mwSessao, exigirPapel } = require('../middleware/sessao');
const { senhaTemporaria, normalizarLogin } = require('../senhas');

const ID = /^[1-9]\d{0,9}$/;
const LOGIN_OK = /^[a-z0-9._-]{3,40}$/; // mesmo formato da CLI
const PAPEIS_EQUIPE = ['medica', 'admin']; // famílias são criadas na área médica
const MSG_NAO_ENCONTRADA = { erro: 'Conta não encontrada.' };

// Administrador: gerencia as contas de qualquer papel. Papel é IMUTÁVEL (sem promover/rebaixar: quem precisa de outro
// papel ganha uma conta nova). Nunca fica sem admin ativo e nunca se tranca para fora (ver PATCH).
function rotasAdmin({ repo, config, sessao, senhas, limites }) {
  const router = express.Router();
  router.use(mwSessao({ repo, sessao, config }), exigirPapel('admin'));

  // Instância PRÓPRIA (cada rateLimit tem seu store), conta sucessos, por usuário logado.
  const limiteGeracao = rateLimit({
    windowMs: limites.geracaoSenha.windowMs,
    limit: limites.geracaoSenha.limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => `a${req.usuario.id}`,
    message: { erro: 'Muitos acessos gerados em pouco tempo. Aguarde um pouco e tente de novo.' },
  });

  function lerId(req, res) {
    if (!ID.test(String(req.params.id))) {
      res.status(400).json({ erro: 'Identificador inválido.' });
      return null;
    }
    return Number(req.params.id);
  }

  router.get('/usuarios', async (req, res, next) => {
    try {
      const { itens, truncada } = await repo.listarUsuarios();
      res.json({ truncada, itens: itens.map((i) => ({ ...i, voce: i.id === req.usuario.id })) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/usuarios', limiteGeracao, async (req, res, next) => {
    try {
      const { nome, login, papel } = req.body ?? {}; // só estes três campos são lidos
      const nomeLimpo = typeof nome === 'string' ? nome.trim() : '';
      if (nomeLimpo.length < 2 || nomeLimpo.length > 120) {
        return res.status(400).json({ erro: 'Informe o nome (2 a 120 caracteres).' });
      }
      const loginLimpo = normalizarLogin(typeof login === 'string' ? login : '');
      if (!LOGIN_OK.test(loginLimpo)) {
        return res.status(400).json({ erro: 'O usuário deve ter 3 a 40 caracteres: letras, números, ponto, hífen ou sublinhado.' });
      }
      if (typeof papel !== 'string' || !PAPEIS_EQUIPE.includes(papel)) {
        return res.status(400).json({ erro: 'Escolha o tipo de conta: médica ou administrador.' });
      }

      const temporaria = senhaTemporaria();
      try {
        const id = await repo.criarUsuario({
          login: loginLimpo, nome: nomeLimpo, papel, senhaHash: await senhas.hash(temporaria), criadoPor: req.usuario.id, precisaTrocarSenha: true,
        });
        return res.status(201).json({ id, login: loginLimpo, nome: nomeLimpo, papel, senhaTemporaria: temporaria });
      } catch (err) {
        if (err.codigo === 'LOGIN_DUPLICADO') return res.status(409).json({ erro: 'Já existe uma conta com este usuário.' });
        throw err;
      }
    } catch (err) {
      next(err);
    }
  });

  router.post('/usuarios/:id/redefinir', limiteGeracao, async (req, res, next) => {
    try {
      const id = lerId(req, res);
      if (id === null) return;
      // redefinir a própria senha derrubaria a própria sessão: para isso existe "Trocar senha"
      if (id === req.usuario.id) return res.status(400).json({ erro: 'Para trocar a sua própria senha, use "Trocar senha".' });
      const alvo = await repo.buscarUsuarioPorId(id);
      if (!alvo) return res.status(404).json(MSG_NAO_ENCONTRADA);
      if (!alvo.ativo) return res.status(409).json({ erro: 'Esta conta está desativada. Reative-a antes de gerar uma nova senha.' });

      const temporaria = senhaTemporaria();
      const versao = await repo.atualizarSenha(id, await senhas.hash(temporaria), true);
      if (versao === null) return res.status(404).json(MSG_NAO_ENCONTRADA);
      res.json({ login: alvo.login, senhaTemporaria: temporaria });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/usuarios/:id', async (req, res, next) => {
    try {
      const id = lerId(req, res);
      if (id === null) return;
      const ativo = req.body?.ativo;
      if (typeof ativo !== 'boolean') return res.status(400).json({ erro: 'Informe "ativo" como verdadeiro ou falso.' });
      // nada de mexer no próprio estado (autolockout), nem para "reativar" (derrubaria a sessão)
      if (id === req.usuario.id) return res.status(409).json({ erro: 'Você não pode alterar o estado da sua própria conta.' });

      let r;
      try {
        r = await repo.definirAtivoComTrava(id, ativo);
      } catch (err) {
        if (err.errno === 1213) return res.status(503).json({ erro: 'O sistema estava ocupado. Tente de novo.' }); // deadlock (defensivo)
        throw err;
      }
      if (!r.ok) {
        if (r.motivo === 'ultimo_admin') return res.status(409).json({ erro: 'Mantenha ao menos um administrador ativo.' });
        if (r.motivo === 'ocupado') return res.status(503).json({ erro: 'O sistema estava ocupado. Tente de novo.' });
        return res.status(404).json(MSG_NAO_ENCONTRADA);
      }
      res.json({ id, ativo });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { rotasAdmin };
