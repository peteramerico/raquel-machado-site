const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const ALFABETO = 'abcdefghjkmnpqrstuvwxyz23456789'; // sem 0/o/1/l/i: evita ambiguidade ao ditar/ler
const MIN = 10;
const MAX_BYTES = 72; // o bcrypt ignora o que passa de 72 bytes

const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

function normalizarLogin(valor) {
  if (typeof valor !== 'string') return '';
  return semAcento(valor).trim().toLowerCase();
}

function senhaTemporaria() {
  let senha = '';
  for (let i = 0; i < 12; i++) senha += ALFABETO[crypto.randomInt(ALFABETO.length)];
  return senha;
}

// Devolve null se a senha é aceitável, ou a mensagem (em português) do motivo da recusa.
function validarNovaSenha(senha, { login = '', nome = '', senhaAtual = '' } = {}) {
  if (typeof senha !== 'string' || senha.trim() === '') return 'Informe a nova senha.';
  if (senha.length < MIN) return `A senha precisa ter pelo menos ${MIN} caracteres.`;
  if (Buffer.byteLength(senha, 'utf8') > MAX_BYTES) return `A senha pode ter no máximo ${MAX_BYTES} bytes (cerca de 70 caracteres).`;
  const s = senha.toLowerCase();
  const l = normalizarLogin(login);
  if (l.length >= 3 && semAcento(s).includes(l)) return 'A senha não pode conter o seu usuário.';
  if (nome && semAcento(s) === semAcento(String(nome).trim().toLowerCase())) return 'A senha não pode ser igual ao seu nome.';
  if (senhaAtual && senha === senhaAtual) return 'Escolha uma senha diferente da atual.';
  return null;
}

// bcrypt com custo configurável. `conferir` SEMPRE faz um compare — contra um hash fictício quando não há
// hash real (usuário inexistente) — para que o tempo de resposta não revele se o login existe.
function criarSenhas({ cost }) {
  let ficticio;
  const hashFicticio = () => (ficticio ??= bcrypt.hash('senha-ficticia-para-tempo-constante', cost));

  return {
    hash: (senha) => bcrypt.hash(senha, cost),
    async conferir(senha, hash) {
      const alvo = typeof hash === 'string' && hash ? hash : await hashFicticio();
      const confere = await bcrypt.compare(typeof senha === 'string' ? senha : '', alvo);
      return confere && alvo === hash;
    },
  };
}

module.exports = { criarSenhas, senhaTemporaria, validarNovaSenha, normalizarLogin };
