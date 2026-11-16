const crypto = require('crypto');

// Lê e valida a configuração a partir do ambiente. Em produção NÃO sobe sem um JWT_SECRET forte:
// gerar um segredo por boot derrubaria todas as sessões a cada restart do container, e o
// placeholder do .env.example ("trocar_por_...") assinaria sessões com um valor público.
// Rotacionar o JWT_SECRET invalida todas as sessões existentes (todo mundo precisa entrar de novo).
function carregar(env = process.env) {
  const producao = env.NODE_ENV === 'production';

  let jwtSecret = env.JWT_SECRET;
  const fraco = !jwtSecret || jwtSecret.length < 32 || /trocar/i.test(jwtSecret);
  if (fraco) {
    if (producao) {
      throw new Error('JWT_SECRET ausente ou fraco: defina no .env um segredo aleatório com 32+ caracteres (e sem "trocar").');
    }
    jwtSecret = crypto.randomBytes(32).toString('hex');
    console.warn('JWT_SECRET ausente/fraco — usando um segredo gerado nesta execução (só vale fora de produção).');
  }

  const custo = Number.parseInt(env.BCRYPT_COST, 10);
  const bcryptCost = Number.isFinite(custo) ? Math.min(15, Math.max(4, custo)) : 12;

  return {
    producao,
    jwtSecret,
    bcryptCost,
    cookieNome: 'rm_session',
    sessaoDias: 7,
  };
}

module.exports = { carregar };
