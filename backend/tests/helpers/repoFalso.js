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
      usuarios.push({ id, login, nome, papel, senhaHash, contato, criadoPor, precisaTrocarSenha, ativo: true, sessaoVersao: 1, acessos: 0, criadoEm: new Date(), ultimoAcessoEm: null });
      return id;
    },
    // Troca a senha e INCREMENTA a versão da sessão (derruba as sessões antigas). Devolve a nova versão,
    // ou null se a conta não existe / não tem o `papel` pedido (mesma semântica do SQL real).
    async atualizarSenha(id, senhaHash, precisaTrocarSenha, { papel } = {}) {
      const u = usuarios.find((x) => x.id === id && (!papel || x.papel === papel));
      if (!u) return null;
      u.senhaHash = senhaHash;
      u.precisaTrocarSenha = precisaTrocarSenha;
      u.sessaoVersao += 1;
      return u.sessaoVersao;
    },
    async definirAtivo(id, ativo, { papel } = {}) {
      const u = usuarios.find((x) => x.id === id && (!papel || x.papel === papel));
      if (!u) return null;
      u.ativo = ativo;
      u.sessaoVersao += 1;
      return u.sessaoVersao;
    },
    async listarFamilias(limite = 500) {
      const todas = usuarios
        .filter((u) => u.papel === 'familia')
        .sort((a, b) => a.nome.localeCompare(b.nome) || a.id - b.id);
      return {
        truncada: todas.length > limite,
        itens: todas.slice(0, limite).map((u) => ({
          id: u.id, login: u.login, nome: u.nome, contato: u.contato, ativo: u.ativo,
          precisaTrocarSenha: u.precisaTrocarSenha, ultimoAcessoEm: u.ultimoAcessoEm, criadoEm: u.criadoEm,
        })),
      };
    },
    async registrarAcesso(id) {
      const u = usuarios.find((x) => x.id === id);
      u.acessos += 1;
      u.ultimoAcessoEm = new Date();
    },
    async lerConfig(chave) {
      return config.has(chave) ? config.get(chave) : null;
    },
    async gravarConfig(chave, valor, porId = null) {
      config.set(chave, String(valor));
      config.set(`${chave}__por`, porId);
    },
    lerAtualizadoPor(chave) {
      return config.get(`${chave}__por`) ?? null;
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
