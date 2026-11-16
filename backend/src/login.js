const { normalizarLogin } = require('./senhas');

// Logins que nunca saem "puros" de um nome de família (evita confusão com contas de equipe/rotas do site).
const RESERVADOS = new Set(['admin', 'administrador', 'root', 'painel', 'api', 'suporte', 'sistema', 'raquel', 'peter', 'familia', 'medica', 'medico']);
const BASE_MAX = 30; // o login tem VARCHAR(40); sobram 10 para o sufixo

// 1º nome, sem acento, só [a-z0-9]. Curto (< 3) ganha "fam"; vazio vira "familia".
function loginBase(nome) {
  const primeiro = String(nome ?? '').trim().split(/\s+/)[0] || '';
  let base = normalizarLogin(primeiro).replace(/[^a-z0-9]/g, '');
  if (base === '') base = 'familia';
  else if (base.length < 3) base += 'fam';
  return base.slice(0, BASE_MAX);
}

// `existe(login)` é assíncrono e devolve true se o login já está em uso. Sequência: base, base2…base99,
// depois sufixos aleatórios de 3 dígitos. A UNIQUE do banco continua sendo a palavra final (a rota tenta de novo).
async function gerarLogin(nome, existe) {
  const base = loginBase(nome);
  const candidatos = [base, ...Array.from({ length: 98 }, (_, i) => `${base}${i + 2}`)];
  for (const c of candidatos) {
    if (c === base && RESERVADOS.has(c)) continue;
    if (!(await existe(c))) return c;
  }
  for (let i = 0; i < 20; i++) {
    const c = `${base}${String(Math.floor(Math.random() * 900) + 100)}`;
    if (!(await existe(c))) return c;
  }
  throw new Error('Não foi possível gerar um login livre para este nome.');
}

module.exports = { loginBase, gerarLogin, RESERVADOS };
