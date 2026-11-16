// Integração do SQL real. Só roda com um MySQL de teste:
//   TEST_DB_HOST=127.0.0.1 TEST_DB_PORT=3319 TEST_DB_USER=root TEST_DB_PASSWORD= TEST_DB_NAME=raquel_teste npx jest repositorio.integracao
// (o banco precisa existir e será LIMPO). Fora do CI e do hook da VPS, que não têm MySQL.
const path = require('path');
const mysql = require('mysql2/promise');
const { migrar } = require('../src/migrar');
const { criarRepositorio } = require('../src/repositorio');

const habilitado = Boolean(process.env.TEST_DB_HOST);
const descrever = habilitado ? describe : describe.skip;

descrever('repositório (MySQL real)', () => {
  let pool;
  let repo;

  beforeAll(async () => {
    const base = {
      host: process.env.TEST_DB_HOST,
      port: Number(process.env.TEST_DB_PORT || 3306),
      user: process.env.TEST_DB_USER || 'root',
      password: process.env.TEST_DB_PASSWORD || undefined,
      database: process.env.TEST_DB_NAME || 'raquel_teste',
    };
    const admin = mysql.createPool({ ...base, multipleStatements: true });
    await admin.query('DROP TABLE IF EXISTS usuarios, configuracoes, schema_migracoes, posts, admin_users');
    await migrar(admin, path.join(__dirname, '..', 'migrations'));
    await admin.end();
    pool = mysql.createPool(base);
    repo = criarRepositorio(pool);
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  it('as migrations 001–003 criam usuarios e configuracoes e semeiam o valor da consulta', async () => {
    expect(await repo.lerConfig('valor_consulta')).toBe('400');
  });

  it('cria e busca usuário por login e por id (campos mapeados, booleanos de verdade)', async () => {
    const id = await repo.criarUsuario({ login: 'ana', nome: 'Ana Souza', papel: 'familia', senhaHash: '$2a$04$hash', contato: '5584999990000', criadoPor: null });
    const u = await repo.buscarUsuarioPorLogin('ana');
    expect(u).toMatchObject({ id, login: 'ana', nome: 'Ana Souza', papel: 'familia', senhaHash: '$2a$04$hash', precisaTrocarSenha: true, ativo: true, sessaoVersao: 1, contato: '5584999990000' });
    expect(await repo.buscarUsuarioPorId(id)).toEqual(u);
    expect(await repo.buscarUsuarioPorLogin('inexistente')).toBeNull();
    expect(await repo.buscarUsuarioPorId(99999)).toBeNull();
  });

  it('login duplicado → erro LOGIN_DUPLICADO (também ignorando maiúsculas)', async () => {
    await expect(repo.criarUsuario({ login: 'ana', nome: 'Outra', papel: 'familia', senhaHash: 'x' })).rejects.toMatchObject({ codigo: 'LOGIN_DUPLICADO' });
    await expect(repo.criarUsuario({ login: 'ANA', nome: 'Outra', papel: 'familia', senhaHash: 'x' })).rejects.toMatchObject({ codigo: 'LOGIN_DUPLICADO' });
  });

  it('papel fora do ENUM é recusado pelo banco', async () => {
    await expect(repo.criarUsuario({ login: 'zeca', nome: 'Z', papel: 'superuser', senhaHash: 'x' })).rejects.toBeTruthy();
  });

  it('atualizarSenha troca o hash, limpa a pendência e incrementa a versão (duas trocas seguidas = +2)', async () => {
    const { id } = await repo.buscarUsuarioPorLogin('ana');
    const v2 = await repo.atualizarSenha(id, '$2a$04$novo', false);
    const v3 = await repo.atualizarSenha(id, '$2a$04$novo2', false);
    expect([v2, v3]).toEqual([2, 3]);
    const u = await repo.buscarUsuarioPorId(id);
    expect(u).toMatchObject({ senhaHash: '$2a$04$novo2', precisaTrocarSenha: false, sessaoVersao: 3 });
  });

  it('registrarAcesso grava o último acesso', async () => {
    const { id } = await repo.buscarUsuarioPorLogin('ana');
    await repo.registrarAcesso(id);
    const [rows] = await pool.query('SELECT ultimo_acesso_em FROM usuarios WHERE id = ?', [id]);
    expect(rows[0].ultimo_acesso_em).toBeInstanceOf(Date);
  });

  it('configurações: lê, grava (upsert) e devolve null para chave inexistente', async () => {
    expect(await repo.lerConfig('nao_existe')).toBeNull();
    await repo.gravarConfig('valor_consulta', 450, null);
    expect(await repo.lerConfig('valor_consulta')).toBe('450');
    await repo.gravarConfig('outra', 'x', null);
    expect(await repo.lerConfig('outra')).toBe('x');
  });

  it('listarFamilias: só papel familia, por nome, sem hash, com limite e aviso de truncamento', async () => {
    await repo.criarUsuario({ login: 'zeca', nome: 'Zeca Lima', papel: 'familia', senhaHash: 'h' });
    await repo.criarUsuario({ login: 'bia', nome: 'Bia Costa', papel: 'familia', senhaHash: 'h' });
    await repo.criarUsuario({ login: 'dra', nome: 'Dra Teste', papel: 'medica', senhaHash: 'h' });
    const { itens, truncada } = await repo.listarFamilias();
    expect(itens.map((i) => i.login)).toEqual(['ana', 'bia', 'zeca']); // ordenado por nome; sem a médica
    expect(truncada).toBe(false);
    expect(Object.keys(itens[0]).sort()).toEqual(['ativo', 'contato', 'criadoEm', 'id', 'login', 'nome', 'precisaTrocarSenha', 'ultimoAcessoEm']);
    const curta = await repo.listarFamilias(2);
    expect(curta.itens).toHaveLength(2);
    expect(curta.truncada).toBe(true);
  });

  it('definirAtivo derruba a sessão (versão +1) e respeita a guarda de papel', async () => {
    const { id, sessaoVersao } = await repo.buscarUsuarioPorLogin('bia');
    const v = await repo.definirAtivo(id, false, { papel: 'familia' });
    expect(v).toBe(sessaoVersao + 1);
    expect((await repo.buscarUsuarioPorId(id)).ativo).toBe(false);
    expect(await repo.definirAtivo(id, true, { papel: 'familia' })).toBe(sessaoVersao + 2);
    // papel errado: nenhuma linha casa → null e NADA muda
    const dra = await repo.buscarUsuarioPorLogin('dra');
    expect(await repo.definirAtivo(dra.id, false, { papel: 'familia' })).toBeNull();
    expect((await repo.buscarUsuarioPorId(dra.id)).ativo).toBe(true);
    expect(await repo.definirAtivo(99999, false, { papel: 'familia' })).toBeNull();
  });

  it('atualizarSenha com guarda de papel: não toca conta de outro papel', async () => {
    const dra = await repo.buscarUsuarioPorLogin('dra');
    expect(await repo.atualizarSenha(dra.id, 'hack', true, { papel: 'familia' })).toBeNull();
    expect((await repo.buscarUsuarioPorId(dra.id)).senhaHash).toBe('h');
    const bia = await repo.buscarUsuarioPorLogin('bia');
    expect(await repo.atualizarSenha(bia.id, 'novo', true, { papel: 'familia' })).toBe(bia.sessaoVersao + 1);
  });

  it('criarUsuario guarda criado_por e buscarUsuario devolve criadoPor', async () => {
    const ana = await repo.buscarUsuarioPorLogin('ana');
    const id = await repo.criarUsuario({ login: 'carla', nome: 'Carla', papel: 'familia', senhaHash: 'h', criadoPor: ana.id });
    expect((await repo.buscarUsuarioPorId(id)).criadoPor).toBe(ana.id);
  });

  it('o runner é idempotente: rodar de novo não aplica nada e não mexe nos dados', async () => {
    const admin = mysql.createPool({
      host: process.env.TEST_DB_HOST, port: Number(process.env.TEST_DB_PORT || 3306),
      user: process.env.TEST_DB_USER || 'root', password: process.env.TEST_DB_PASSWORD || undefined,
      database: process.env.TEST_DB_NAME || 'raquel_teste', multipleStatements: true,
    });
    expect(await migrar(admin, path.join(__dirname, '..', 'migrations'))).toEqual([]);
    await admin.end();
    expect(await repo.lerConfig('valor_consulta')).toBe('450'); // INSERT IGNORE não sobrescreve
  });
});
