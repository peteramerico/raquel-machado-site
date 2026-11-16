// CLI de contas. Uso (na VPS, dentro do container):
//   docker exec raquel-backend node src/bin/criar-usuario.js --papel admin --login peter --nome "Peter"
//   docker exec raquel-backend node src/bin/criar-usuario.js --papel familia --login maria --nome "Maria Souza" --contato 5584999990000
//   docker exec raquel-backend node src/bin/criar-usuario.js --redefinir --login maria
// A senha temporária (12 caracteres) é impressa UMA vez, na saída padrão; troca obrigatória no 1º acesso.
const { senhaTemporaria, normalizarLogin, criarSenhas } = require('../senhas');

const PAPEIS = ['familia', 'medica', 'admin'];
const LOGIN_OK = /^[a-z0-9._-]{3,40}$/;

function lerArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const nome = argv[i].slice(2);
    const proximo = argv[i + 1];
    if (proximo === undefined || proximo.startsWith('--')) args[nome] = true;
    else { args[nome] = proximo; i++; }
  }
  return args;
}

async function executar(argv, { repo, senhas, saida = console.log, erro = console.error }) {
  const args = lerArgs(argv);
  const login = normalizarLogin(typeof args.login === 'string' ? args.login : '');
  if (!LOGIN_OK.test(login)) {
    erro('Informe --login com 3 a 40 caracteres: letras, números, ponto, hífen ou sublinhado.');
    return 1;
  }

  if (args.redefinir) {
    const usuario = await repo.buscarUsuarioPorLogin(login);
    if (!usuario) { erro(`Usuário "${login}" não encontrado.`); return 1; }
    const temporaria = senhaTemporaria();
    await repo.atualizarSenha(usuario.id, await senhas.hash(temporaria), true);
    saida(`Senha de "${login}" redefinida (as sessões abertas foram encerradas).`);
    saida(`Senha temporária (mostrada uma única vez; troca obrigatória no próximo acesso): ${temporaria}`);
    return 0;
  }

  const papel = args.papel;
  const nome = typeof args.nome === 'string' ? args.nome.trim() : '';
  if (!PAPEIS.includes(papel)) { erro(`Informe --papel: ${PAPEIS.join(' | ')}.`); return 1; }
  if (nome.length < 2 || nome.length > 120) { erro('Informe --nome (2 a 120 caracteres).'); return 1; }
  const contato = typeof args.contato === 'string' && /^\d{8,15}$/.test(args.contato) ? args.contato : null;

  const temporaria = senhaTemporaria();
  try {
    await repo.criarUsuario({ login, nome, papel, senhaHash: await senhas.hash(temporaria), contato, precisaTrocarSenha: true });
  } catch (err) {
    if (err.codigo === 'LOGIN_DUPLICADO') { erro(`Já existe um usuário com o login "${login}".`); return 1; }
    throw err;
  }
  saida(`Conta criada: usuário "${login}" (${papel}).`);
  saida(`Senha temporária (mostrada uma única vez; troca obrigatória no 1º acesso): ${temporaria}`);
  return 0;
}

async function main() {
  require('dotenv').config();
  const { obterPool } = require('../db');
  const { criarRepositorio } = require('../repositorio');
  const { custoBcrypt } = require('../config');
  const pool = obterPool();
  try {
    const codigo = await executar(process.argv.slice(2), { repo: criarRepositorio(pool), senhas: criarSenhas({ cost: custoBcrypt(process.env) }) });
    process.exitCode = codigo;
  } catch (err) {
    console.error('Falha:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (require.main === module) main();

module.exports = { executar };
