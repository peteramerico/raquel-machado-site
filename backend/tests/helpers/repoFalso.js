// Repositório em memória com a MESMA interface de src/repositorio.js.
// Os testes de rotas/middleware usam este; o SQL real é coberto por tests/repositorio.integracao.test.js.
function criarRepoFalso() {
  const usuarios = [];
  const config = new Map();
  let seq = 1;

  const copia = (u) => (u ? { ...u } : null);

  return {
    _usuarios: usuarios,

    async buscarUsuarioPorLogin(login) {
      return copia(usuarios.find((u) => u.login === login)) ?? null;
    },
    async buscarUsuarioPorId(id) {
      return copia(usuarios.find((u) => u.id === id)) ?? null;
    },
    async criarUsuario({ login, nome, papel, senhaHash, contato = null, criadoPor = null, precisaTrocarSenha = true }) {
      if (usuarios.some((u) => u.login === login)) {
        throw Object.assign(new Error('login duplicado'), { codigo: 'LOGIN_DUPLICADO' });
      }
      const id = seq++;
      usuarios.push({ id, login, nome, papel, senhaHash, contato, criadoPor, precisaTrocarSenha, ativo: true, sessaoVersao: 1, acessos: 0 });
      return id;
    },
    // Troca a senha e INCREMENTA a versão da sessão (derruba as sessões antigas). Devolve a nova versão.
    async atualizarSenha(id, senhaHash, precisaTrocarSenha) {
      const u = usuarios.find((x) => x.id === id);
      u.senhaHash = senhaHash;
      u.precisaTrocarSenha = precisaTrocarSenha;
      u.sessaoVersao += 1;
      return u.sessaoVersao;
    },
    async registrarAcesso(id) {
      usuarios.find((x) => x.id === id).acessos += 1;
    },
    async lerConfig(chave) {
      return config.has(chave) ? config.get(chave) : null;
    },
    async gravarConfig(chave, valor) {
      config.set(chave, String(valor));
    },
  };
}

// Cria um usuário de teste já com hash bcrypt (custo baixo) e devolve { id, login, senha }.
async function semear(repo, senhas, { login, nome = 'Pessoa Teste', papel = 'familia', senha = 'senha-de-teste-1', precisaTrocarSenha = false, ativo = true } = {}) {
  const id = await repo.criarUsuario({ login, nome, papel, senhaHash: await senhas.hash(senha), precisaTrocarSenha });
  if (!ativo) repo._usuarios.find((u) => u.id === id).ativo = false;
  return { id, login, senha };
}

module.exports = { criarRepoFalso, semear };
