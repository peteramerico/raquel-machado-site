const crypto = require('crypto');

// Custo do bcrypt: 12 por padrão; BCRYPT_COST ajusta (4–15). Os testes usam 4.
function custoBcrypt(env = process.env) {
  const custo = Number.parseInt(env.BCRYPT_COST, 10);
  return Number.isFinite(custo) ? Math.min(15, Math.max(4, custo)) : 12;
}

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

  return {
    producao,
    jwtSecret,
    bcryptCost: custoBcrypt(env),
    cookieNome: 'rm_session',
    sessaoDias: 7,
  };
}

module.exports = { carregar, custoBcrypt };
