const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const { carregar } = require('../src/config');
const { criarSessao } = require('../src/sessao');
const { criarSenhas } = require('../src/senhas');
const { sessao: mwSessao, exigirPapel, alcanca } = require('../src/middleware/sessao');
const { origem } = require('../src/middleware/origem');
const { semCache } = require('../src/middleware/semCache');
const { criarRepoFalso, semear } = require('./helpers/repoFalso');

const config = carregar({ JWT_SECRET: 'm'.repeat(48), BCRYPT_COST: '4' });
const senhas = criarSenhas({ cost: 4 });

function montar(repo) {
  const s = criarSessao(config);
  const app = express();
  app.set('etag', false); // criarApp faz o mesmo
  app.use(express.json());
  app.use(cookieParser());
  app.use(semCache());
  const dep = { repo, sessao: s, config };
  app.get('/livre', (req, res) => res.json({ ok: true }));
  app.get('/familia', mwSessao(dep), exigirPapel('familia'), (req, res) => res.json({ eu: req.usuario.login, papel: req.usuario.papel }));
  app.get('/painel', mwSessao(dep), exigirPapel('medica'), (req, res) => res.json({ ok: true }));
  app.get('/admin', mwSessao(dep), exigirPapel('admin'), (req, res) => res.json({ ok: true }));
  app.get('/me', mwSessao(dep, { permitirTrocaPendente: true }), (req, res) => res.json({ eu: req.usuario.login }));
  app.post('/muda', origem(), (req, res) => res.json({ ok: true }));
  app.get('/limpa', origem(), (req, res) => res.json({ ok: true }));
  return { app, s };
}

const cookieDe = (s, usuario) => `${config.cookieNome}=${s.assinar(usuario)}`;

describe('alcanca (hierarquia admin ⊇ medica ⊇ familia)', () => {
  it('tabela completa', () => {
    expect(alcanca('familia', 'familia')).toBe(true);
    expect(alcanca('familia', 'medica')).toBe(false);
    expect(alcanca('medica', 'familia')).toBe(true);
    expect(alcanca('medica', 'admin')).toBe(false);
    expect(alcanca('admin', 'familia')).toBe(true);
    expect(alcanca('admin', 'medica')).toBe(true);
    expect(alcanca('qualquer-coisa', 'familia')).toBe(false);
    expect(alcanca(undefined, 'familia')).toBe(false);
  });
});

describe('middleware de sessão e papel', () => {
  it('sem cookie → 401', async () => {
    const { app } = montar(criarRepoFalso());
    const res = await request(app).get('/familia');
    expect(res.status).toBe(401);
  });

  it('cookie válido de família → 200 em /familia, 403 em /painel e /admin', async () => {
    const repo = criarRepoFalso();
    const u = await semear(repo, senhas, { login: 'ana', papel: 'familia' });
    const { app, s } = montar(repo);
    const c = cookieDe(s, { id: u.id, sessaoVersao: 1 });
    expect((await request(app).get('/familia').set('Cookie', c)).body).toEqual({ eu: 'ana', papel: 'familia' });
    expect((await request(app).get('/painel').set('Cookie', c)).status).toBe(403);
    expect((await request(app).get('/admin').set('Cookie', c)).status).toBe(403);
  });

  it('médica acessa família e painel, não admin; admin acessa tudo', async () => {
    const repo = criarRepoFalso();
    const m = await semear(repo, senhas, { login: 'raquel', papel: 'medica' });
    const a = await semear(repo, senhas, { login: 'peter', papel: 'admin' });
    const { app, s } = montar(repo);
    const cm = cookieDe(s, { id: m.id, sessaoVersao: 1 });
    const ca = cookieDe(s, { id: a.id, sessaoVersao: 1 });
    expect((await request(app).get('/familia').set('Cookie', cm)).status).toBe(200);
    expect((await request(app).get('/painel').set('Cookie', cm)).status).toBe(200);
    expect((await request(app).get('/admin').set('Cookie', cm)).status).toBe(403);
    expect((await request(app).get('/admin').set('Cookie', ca)).status).toBe(200);
  });

  it('o papel vem do BANCO: token de usuário "familia" não vira admin', async () => {
    const repo = criarRepoFalso();
    const u = await semear(repo, senhas, { login: 'ana', papel: 'familia' });
    const { app, s } = montar(repo);
    // mesmo que alguém forje "papel" no token, ele é ignorado
    const c = cookieDe(s, { id: u.id, sessaoVersao: 1, papel: 'admin' });
    expect((await request(app).get('/admin').set('Cookie', c)).status).toBe(403);
  });

  it('versão de sessão diferente (senha trocada) → 401', async () => {
    const repo = criarRepoFalso();
    const u = await semear(repo, senhas, { login: 'ana' });
    const { app, s } = montar(repo);
    const antigo = cookieDe(s, { id: u.id, sessaoVersao: 1 });
    expect((await request(app).get('/familia').set('Cookie', antigo)).status).toBe(200);
    await repo.atualizarSenha(u.id, await senhas.hash('outra senha 123'), false); // v → 2
    expect((await request(app).get('/familia').set('Cookie', antigo)).status).toBe(401);
    expect((await request(app).get('/familia').set('Cookie', cookieDe(s, { id: u.id, sessaoVersao: 2 }))).status).toBe(200);
  });

  it('usuário inativo ou inexistente → 401', async () => {
    const repo = criarRepoFalso();
    const u = await semear(repo, senhas, { login: 'ana', ativo: false });
    const { app, s } = montar(repo);
    expect((await request(app).get('/familia').set('Cookie', cookieDe(s, { id: u.id, sessaoVersao: 1 }))).status).toBe(401);
    expect((await request(app).get('/familia').set('Cookie', cookieDe(s, { id: 999, sessaoVersao: 1 }))).status).toBe(401);
  });

  it('senha temporária pendente → 403 {codigo: trocar_senha} em qualquer rota, exceto as liberadas', async () => {
    const repo = criarRepoFalso();
    const u = await semear(repo, senhas, { login: 'ana', precisaTrocarSenha: true });
    const { app, s } = montar(repo);
    const c = cookieDe(s, { id: u.id, sessaoVersao: 1 });
    const bloqueada = await request(app).get('/familia').set('Cookie', c);
    expect(bloqueada.status).toBe(403);
    expect(bloqueada.body.codigo).toBe('trocar_senha');
    expect((await request(app).get('/painel').set('Cookie', c)).body.codigo).toBe('trocar_senha');
    expect((await request(app).get('/me').set('Cookie', c)).status).toBe(200); // liberada
  });
});

describe('middleware de origem (CSRF)', () => {
  const { app } = montar(criarRepoFalso());

  it('POST com Origin de outro site → 403', async () => {
    const res = await request(app).post('/muda').set('Host', 'raquelmachadoped.com.br').set('Origin', 'https://evil.com').send({});
    expect(res.status).toBe(403);
  });
  it('POST com Origin do mesmo host → ok (com e sem porta)', async () => {
    expect((await request(app).post('/muda').set('Host', 'raquelmachadoped.com.br').set('Origin', 'https://raquelmachadoped.com.br').send({})).status).toBe(200);
    expect((await request(app).post('/muda').set('Host', 'localhost:5199').set('Origin', 'http://localhost:5199').send({})).status).toBe(200);
  });
  it('POST sem Origin → ok (ferramentas/curl; o cookie SameSite=Lax já cobre o navegador)', async () => {
    expect((await request(app).post('/muda').send({})).status).toBe(200);
  });
  it('Origin malformado → 403', async () => {
    expect((await request(app).post('/muda').set('Origin', 'não é url').send({})).status).toBe(403);
  });
  it('GET nunca é barrado pelo Origin', async () => {
    expect((await request(app).get('/limpa').set('Host', 'raquelmachadoped.com.br').set('Origin', 'https://evil.com')).status).toBe(200);
  });
});

describe('semCache', () => {
  it('respostas saem com no-store, Vary: Cookie e sem ETag', async () => {
    const { app } = montar(criarRepoFalso());
    const res = await request(app).get('/livre');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers.vary).toMatch(/Cookie/);
    expect(res.headers.etag).toBeUndefined();
  });
});
