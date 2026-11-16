const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { carregar } = require('./config');
const { criarSenhas } = require('./senhas');
const { criarSessao } = require('./sessao');
const { semCache } = require('./middleware/semCache');
const { origem } = require('./middleware/origem');
const { rotasAuth } = require('./rotas/auth');

const MIN15 = 15 * 60 * 1000;
const LIMITES_PADRAO = {
  ip: { windowMs: MIN15, limit: 30 }, // falhas de login por IP
  loginIp: { windowMs: MIN15, limit: 8 }, // falhas por (login + IP)
  trocarSenha: { windowMs: MIN15, limit: 10 }, // tentativas de trocar senha por usuário
};

// Fábrica do app: tudo que tem efeito colateral (banco, segredo, limites) entra por parâmetro,
// então os testes usam um repositório em memória e limites baixos.
// `server.js` monta a instância real.
function criarApp({ repo, config = carregar(), limites = {} } = {}) {
  if (!repo) throw new Error('criarApp: repo é obrigatório.');
  const lim = { ...LIMITES_PADRAO, ...limites };
  const senhas = criarSenhas({ cost: config.bcryptCost });
  const sessao = criarSessao(config);

  const app = express();
  app.set('trust proxy', 1); // nginx → container: req.ip = IP do cliente (nginx já aplica o realip do Cloudflare)
  app.set('etag', false);
  app.use(cors({ origin: process.env.FRONTEND_URL || 'https://raquelmachadoped.com.br', credentials: true }));

  app.use('/api', semCache());
  app.use(express.json({ limit: '20kb' }));
  app.use(cookieParser());
  app.use('/api', origem());

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/auth', rotasAuth({ repo, config, sessao, senhas, limites: lim }));

  // Incremento 1 (Task 5) acrescenta /api/familia; Incrementos 2 e 3, /api/painel e /api/admin.

  app.use('/api', (req, res) => res.status(404).json({ erro: 'Não encontrado.' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed' || err.type === 'encoding.unsupported' || err.status === 400) {
      return res.status(400).json({ erro: 'Requisição inválida.' });
    }
    if (err.type === 'entity.too.large') return res.status(413).json({ erro: 'Requisição grande demais.' });
    console.error('Erro não tratado:', err.message);
    res.status(500).json({ erro: 'Erro interno. Tente novamente em instantes.' });
  });

  return app;
}

module.exports = { criarApp };
