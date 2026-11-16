const express = require('express');
const rateLimit = require('express-rate-limit');
const { sessao: mwSessao, exigirPapel } = require('../middleware/sessao');
const { senhaTemporaria } = require('../senhas');
const { gerarLogin } = require('../login');
const { parseValor, lerValorConsulta } = require('../valor');
const { normalizarContato } = require('../contato');

const ID = /^[1-9]\d{0,9}$/; // inteiro positivo de até 10 dígitos, sem zero à esquerda/notação científica/hex
const MSG_NAO_ENCONTRADA = { erro: 'Conta não encontrada.' };
const TENTATIVAS_LOGIN = 5;

// Área médica: a médica (e o admin, pela hierarquia) gerencia SÓ contas de família e o valor da consulta.
// Todo UPDATE leva { papel: 'familia' } — a guarda vive no SQL, não numa leitura anterior.
function rotasPainel({ repo, config, sessao, senhas, limites }) {
  const router = express.Router();
  router.use(mwSessao({ repo, sessao, config }), exigirPapel('medica'));

  // Limitador PRÓPRIO de geração de senha: conta sucessos também (o do login só conta falhas), por usuário logado.
  const limiteGeracao = rateLimit({
    windowMs: limites.geracaoSenha.windowMs,
    limit: limites.geracaoSenha.limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => `u${req.usuario.id}`,
    message: { erro: 'Muitos acessos gerados em pouco tempo. Aguarde um pouco e tente de novo.' },
  });

  function lerId(req, res) {
    if (!ID.test(String(req.params.id))) {
      res.status(400).json({ erro: 'Identificador inválido.' });
      return null;
    }
    return Number(req.params.id);
  }

  router.get('/familias', async (req, res, next) => {
    try {
      res.json(await repo.listarFamilias());
    } catch (err) {
      next(err);
    }
  });

  router.post('/familias', limiteGeracao, async (req, res, next) => {
    try {
      const { nome, contato } = req.body ?? {}; // só estes dois campos são lidos (nada de mass assignment)
      const nomeLimpo = typeof nome === 'string' ? nome.trim() : '';
      if (nomeLimpo.length < 2 || nomeLimpo.length > 120) {
        return res.status(400).json({ erro: 'Informe o nome da família (2 a 120 caracteres).' });
      }
      const c = normalizarContato(contato);
      if (!c.ok) {
        return res.status(400).json({ erro: 'WhatsApp inválido. Use DDD + número, por exemplo (84) 99999-0000.' });
      }

      const temporaria = senhaTemporaria();
      const senhaHash = await senhas.hash(temporaria);
      const colididos = new Set(); // logins que o banco já recusou nesta requisição (corrida)
      const existe = async (l) => colididos.has(l) || Boolean(await repo.buscarUsuarioPorLogin(l));

      for (let i = 0; i < TENTATIVAS_LOGIN; i++) {
        const login = await gerarLogin(nomeLimpo, existe);
        try {
          const id = await repo.criarUsuario({
            login, nome: nomeLimpo, papel: 'familia', senhaHash, contato: c.valor, criadoPor: req.usuario.id, precisaTrocarSenha: true,
          });
          return res.status(201).json({ id, login, nome: nomeLimpo, senhaTemporaria: temporaria });
        } catch (err) {
          if (err.codigo !== 'LOGIN_DUPLICADO') throw err;
          colididos.add(login);
        }
      }
      res.status(503).json({ erro: 'Não foi possível criar o acesso agora. Tente de novo.' });
    } catch (err) {
      next(err);
    }
  });

  router.post('/familias/:id/redefinir', limiteGeracao, async (req, res, next) => {
    try {
      const id = lerId(req, res);
      if (id === null) return;
      const alvo = await repo.buscarUsuarioPorId(id);
      if (!alvo || alvo.papel !== 'familia') return res.status(404).json(MSG_NAO_ENCONTRADA); // inexistente = outro papel
      if (!alvo.ativo) return res.status(409).json({ erro: 'Esta conta está desativada. Reative-a antes de gerar uma nova senha.' });

      const temporaria = senhaTemporaria();
      const versao = await repo.atualizarSenha(id, await senhas.hash(temporaria), true, { papel: 'familia' });
      if (versao === null) return res.status(404).json(MSG_NAO_ENCONTRADA);
      res.json({ login: alvo.login, senhaTemporaria: temporaria });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/familias/:id', async (req, res, next) => {
    try {
      const id = lerId(req, res);
      if (id === null) return;
      const ativo = req.body?.ativo;
      if (typeof ativo !== 'boolean') return res.status(400).json({ erro: 'Informe "ativo" como verdadeiro ou falso.' });

      const versao = await repo.definirAtivo(id, ativo, { papel: 'familia' });
      if (versao === null) return res.status(404).json(MSG_NAO_ENCONTRADA);
      res.json({ id, ativo });
    } catch (err) {
      next(err);
    }
  });

  router.get('/config', async (req, res, next) => {
    try {
      res.json({ valorConsulta: await lerValorConsulta(repo) });
    } catch (err) {
      next(err);
    }
  });

  router.put('/config', async (req, res, next) => {
    try {
      const p = parseValor(req.body?.valorConsulta);
      if (!p.ok) {
        return res.status(400).json({ erro: 'Informe um valor entre 1,00 e 100.000,00, com até 2 casas decimais.' });
      }
      await repo.gravarConfig('valor_consulta', p.texto, req.usuario.id);
      res.json({ valorConsulta: p.valor });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { rotasPainel };
