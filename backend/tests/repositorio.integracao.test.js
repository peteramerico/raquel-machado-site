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
    expect(await repo.definirAtivo(id, false, { papel: 'familia' })).toEqual({ mudou: true, versao: sessaoVersao + 1 });
    expect((await repo.buscarUsuarioPorId(id)).ativo).toBe(false);
    expect(await repo.definirAtivo(id, false, { papel: 'familia' })).toEqual({ mudou: false, versao: sessaoVersao + 1 }); // sem mudança: versão intacta
    expect(await repo.definirAtivo(id, true, { papel: 'familia' })).toEqual({ mudou: true, versao: sessaoVersao + 2 });
    expect(await repo.definirAtivo(id, true, { papel: 'familia' })).toEqual({ mudou: false, versao: sessaoVersao + 2 });
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

  it('listarUsuarios: todos os papéis, admin → médica → família, sem hash', async () => {
    await pool.query("DELETE FROM usuarios WHERE papel IN ('admin','medica')");
    await repo.criarUsuario({ login: 'adm1', nome: 'Zélia Admin', papel: 'admin', senhaHash: 'h' });
    await repo.criarUsuario({ login: 'med1', nome: 'Ana Médica', papel: 'medica', senhaHash: 'h' });
    const { itens, truncada } = await repo.listarUsuarios();
    expect(truncada).toBe(false);
    const papeis = itens.map((i) => i.papel);
    expect(papeis[0]).toBe('admin');
    expect(papeis.indexOf('medica')).toBeLessThan(papeis.indexOf('familia'));
    expect(papeis.lastIndexOf('admin')).toBeLessThan(papeis.indexOf('medica'));
    expect(Object.keys(itens[0]).sort()).toEqual(['ativo', 'contato', 'criadoEm', 'id', 'login', 'nome', 'papel', 'precisaTrocarSenha', 'ultimoAcessoEm']);
    expect((await repo.listarUsuarios(2)).truncada).toBe(true);
  });

  it('trava do último admin (SQL real): único admin não desativa; com dois, um sai e o outro fica; inativo não conta', async () => {
    await pool.query("DELETE FROM usuarios WHERE papel = 'admin'");
    const a = await repo.criarUsuario({ login: 'trava_a', nome: 'A', papel: 'admin', senhaHash: 'h' });
    expect(await repo.definirAtivoComTrava(a, false)).toEqual({ ok: false, motivo: 'ultimo_admin' });
    expect((await repo.buscarUsuarioPorId(a)).ativo).toBe(true);

    const b = await repo.criarUsuario({ login: 'trava_b', nome: 'B', papel: 'admin', senhaHash: 'h' });
    const antes = (await repo.buscarUsuarioPorId(a)).sessaoVersao;
    expect(await repo.definirAtivoComTrava(a, false)).toEqual({ ok: true, mudou: true, versao: antes + 1 });
    expect(await repo.definirAtivoComTrava(b, false)).toEqual({ ok: false, motivo: 'ultimo_admin' });
    expect(await repo.definirAtivoComTrava(a, false)).toEqual({ ok: true, mudou: false }); // já inativo: nada a travar
    expect(await repo.definirAtivoComTrava(a, true)).toMatchObject({ ok: true, mudou: true });
    expect(await repo.definirAtivoComTrava(99999, false)).toEqual({ ok: false, motivo: 'nao_encontrada' });
    // não-admin não sofre a trava
    const fam = await repo.criarUsuario({ login: 'trava_f', nome: 'F', papel: 'familia', senhaHash: 'h' });
    expect(await repo.definirAtivoComTrava(fam, false)).toMatchObject({ ok: true, mudou: true });
  });

  it('trava sob CONCORRÊNCIA: uma transação segura o conjunto de admins; a desativação concorrente espera e re-lê', async () => {
    await pool.query("DELETE FROM usuarios WHERE papel = 'admin'");
    const a = await repo.criarUsuario({ login: 'conc_a', nome: 'A', papel: 'admin', senhaHash: 'h' });
    const b = await repo.criarUsuario({ login: 'conc_b', nome: 'B', papel: 'admin', senhaHash: 'h' });

    const barreira = await pool.getConnection();
    try {
      await barreira.beginTransaction();
      await barreira.query("SELECT id FROM usuarios WHERE papel = 'admin' AND ativo = 1 ORDER BY id FOR UPDATE"); // segura os dois admins

      let resolvida = false;
      const pendente = repo.definirAtivoComTrava(a, false).then((r) => { resolvida = true; return r; });
      await new Promise((r) => setTimeout(r, 400));
      expect(resolvida).toBe(false); // está BLOQUEADA esperando a barreira (serialização real)

      await barreira.query('UPDATE usuarios SET ativo = 0 WHERE id = ?', [b]); // "o outro" desativa B primeiro
      await barreira.commit();

      // ao liberar, a desativação pendente re-lê (leitura com lock): só A restou ativo → recusa
      expect(await pendente).toEqual({ ok: false, motivo: 'ultimo_admin' });
      expect((await repo.buscarUsuarioPorId(a)).ativo).toBe(true);
    } finally {
      barreira.release();
    }
  });

  it('definirAtivo (sem trava): só incrementa a versão quando o estado muda; não-encontrada/papel errado → null', async () => {
    const id = await repo.criarUsuario({ login: 'sem_mudanca', nome: 'S', papel: 'familia', senhaHash: 'h' });
    const v0 = (await repo.buscarUsuarioPorId(id)).sessaoVersao;
    expect(await repo.definirAtivo(id, true, { papel: 'familia' })).toEqual({ mudou: false, versao: v0 });
    expect((await repo.buscarUsuarioPorId(id)).sessaoVersao).toBe(v0);
    expect(await repo.definirAtivo(id, true, { papel: 'medica' })).toBeNull();
    expect(await repo.definirAtivo(99999, true)).toBeNull();
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
