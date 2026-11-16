const request = require('supertest');
const { criarApp } = require('../src/app');
const { carregar } = require('../src/config');
const { criarSenhas } = require('../src/senhas');
const { criarRepoFalso, semear } = require('./helpers/repoFalso');

const config = carregar({ JWT_SECRET: 'a'.repeat(48), BCRYPT_COST: '4' });
const senhas = criarSenhas({ cost: 4 });

// Limites baixos para provar o rate limit sem 40 requisições por teste.
const LIMITES = { ip: { windowMs: 60000, limit: 6 }, loginIp: { windowMs: 60000, limit: 3 }, trocarSenha: { windowMs: 60000, limit: 3 } };

async function cenario(limites = LIMITES) {
  const repo = criarRepoFalso();
  const app = criarApp({ repo, config, limites });
  return { repo, app };
}

const cookieDaResposta = (res) => (res.headers['set-cookie'] || []).find((c) => c.startsWith('rm_session='));
const valorDoCookie = (res) => cookieDaResposta(res)?.split(';')[0];

describe('POST /api/auth/login', () => {
  it('sucesso: cookie httpOnly, corpo sem senha nem hash, registra o acesso', async () => {
    const { app, repo } = await cenario();
    const u = await semear(repo, senhas, { login: 'raquel', nome: 'Raquel', papel: 'medica' });
    const res = await request(app).post('/api/auth/login').send({ login: 'raquel', senha: u.senha, area: 'painel' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ nome: 'Raquel', papel: 'medica', precisaTrocarSenha: false });
    expect(JSON.stringify(res.body)).not.toMatch(/hash|senha-de-teste/i);
    const c = cookieDaResposta(res);
    expect(c).toMatch(/HttpOnly/i);
    expect(c).toMatch(/SameSite=Lax/i);
    expect(c).toMatch(/Path=\//);
    expect(repo._usuarios[0].acessos).toBe(1);
  });

  it('o login é normalizado (maiúsculas, espaços, acento)', async () => {
    const { app, repo } = await cenario();
    const u = await semear(repo, senhas, { login: 'joao', papel: 'familia' });
    const res = await request(app).post('/api/auth/login').send({ login: '  JOÃO ', senha: u.senha, area: 'familia' });
    expect(res.status).toBe(200);
  });

  it('senha errada → 401 genérico', async () => {
    const { app, repo } = await cenario();
    await semear(repo, senhas, { login: 'ana' });
    const res = await request(app).post('/api/auth/login').send({ login: 'ana', senha: 'errada', area: 'familia' });
    expect(res.status).toBe(401);
    expect(res.body.erro).toBe('Usuário ou senha incorretos.');
    expect(cookieDaResposta(res)).toBeUndefined();
  });

  it('login inexistente → MESMA resposta e o bcrypt ainda é executado (tempo constante)', async () => {
    const { app } = await cenario();
    const bcrypt = require('bcryptjs');
    const espiao = jest.spyOn(bcrypt, 'compare');
    const res = await request(app).post('/api/auth/login').send({ login: 'fantasma', senha: 'qualquer', area: 'familia' });
    expect(res.status).toBe(401);
    expect(res.body.erro).toBe('Usuário ou senha incorretos.');
    expect(espiao).toHaveBeenCalledTimes(1);
    espiao.mockRestore();
  });

  it('usuário inativo, mesmo com a senha certa → 401 genérico', async () => {
    const { app, repo } = await cenario();
    const u = await semear(repo, senhas, { login: 'ana', ativo: false });
    const res = await request(app).post('/api/auth/login').send({ login: 'ana', senha: u.senha, area: 'familia' });
    expect(res.status).toBe(401);
    expect(res.body.erro).toBe('Usuário ou senha incorretos.');
  });

  it('área inalcançável (família entrando no painel) → 403 só com a senha certa, sem cookie', async () => {
    const { app, repo } = await cenario();
    const u = await semear(repo, senhas, { login: 'ana', papel: 'familia' });
    const certa = await request(app).post('/api/auth/login').send({ login: 'ana', senha: u.senha, area: 'painel' });
    expect(certa.status).toBe(403);
    expect(certa.body.codigo).toBe('area_errada');
    expect(cookieDaResposta(certa)).toBeUndefined();
    const errada = await request(app).post('/api/auth/login').send({ login: 'ana', senha: 'x', area: 'painel' });
    expect(errada.status).toBe(401); // senha errada nunca vira 403
  });

  it('hierarquia: médica entra na área da família; admin entra em todas', async () => {
    const { app, repo } = await cenario();
    const m = await semear(repo, senhas, { login: 'raquel', papel: 'medica' });
    const a = await semear(repo, senhas, { login: 'peter', papel: 'admin' });
    expect((await request(app).post('/api/auth/login').send({ login: 'raquel', senha: m.senha, area: 'familia' })).status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ login: 'raquel', senha: m.senha, area: 'admin' })).status).toBe(403);
    for (const area of ['familia', 'painel', 'admin']) {
      expect((await request(app).post('/api/auth/login').send({ login: 'peter', senha: a.senha, area })).status).toBe(200);
    }
  });

  it('corpo inválido: campos faltando, tipos errados, área desconhecida → 400', async () => {
    const { app } = await cenario();
    const corpos = [{}, { login: 'a' }, { login: 'a', senha: 'b' }, { login: 'a', senha: 'b', area: 'xyz' }, { login: {}, senha: 'b', area: 'familia' }, { login: 'a', senha: ['b'], area: 'familia' }];
    for (const [i, corpo] of corpos.entries()) {
      // um IP por requisição: o rate limit (que conta 400 como falha) não pode interferir neste teste
      const res = await request(app).post('/api/auth/login').set('X-Forwarded-For', `198.51.100.${i + 1}`).send(corpo);
      expect(res.status).toBe(400);
    }
  });

  it('JSON malformado → 400 em JSON (nunca HTML)', async () => {
    const { app } = await cenario();
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{ não é json');
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.erro).toBeTruthy();
  });

  it('GET /api/auth/login não existe (só POST)', async () => {
    const { app } = await cenario();
    expect((await request(app).get('/api/auth/login')).status).toBe(404);
  });

  it('Origin de outro site → 403', async () => {
    const { app, repo } = await cenario();
    const u = await semear(repo, senhas, { login: 'ana' });
    const res = await request(app).post('/api/auth/login').set('Host', 'raquelmachadoped.com.br').set('Origin', 'https://evil.com').send({ login: 'ana', senha: u.senha, area: 'familia' });
    expect(res.status).toBe(403);
  });
});

describe('rate limit do login', () => {
  it('8 falhas… (aqui 3) do mesmo login+IP → 429; o mesmo login vindo de OUTRO IP não é bloqueado', async () => {
    const { app, repo } = await cenario();
    const u = await semear(repo, senhas, { login: 'vitima-ficticia', papel: 'familia' });
    const falhar = (ip) => request(app).post('/api/auth/login').set('X-Forwarded-For', ip).send({ login: 'vitima-ficticia', senha: 'errada', area: 'familia' });
    for (let i = 0; i < 3; i++) expect((await falhar('203.0.113.9')).status).toBe(401);
    const bloqueado = await falhar('203.0.113.9');
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.body.erro).toMatch(/tentativas/i);
    // quem é o dono da conta, de outro IP, continua entrando:
    const dono = await request(app).post('/api/auth/login').set('X-Forwarded-For', '198.51.100.7').send({ login: 'vitima-ficticia', senha: u.senha, area: 'familia' });
    expect(dono.status).toBe(200);
  });

  it('o limite por IP vale entre logins diferentes', async () => {
    const { app } = await cenario();
    const falhar = (login) => request(app).post('/api/auth/login').set('X-Forwarded-For', '203.0.113.50').send({ login, senha: 'x', area: 'familia' });
    const statuses = [];
    for (let i = 0; i < 8; i++) statuses.push((await falhar(`alvo${i}`)).status);
    expect(statuses.slice(0, 6).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(6).every((s) => s === 429)).toBe(true);
  });

  it('logins que dão certo não contam para o limite', async () => {
    const { app, repo } = await cenario();
    const u = await semear(repo, senhas, { login: 'ana' });
    for (let i = 0; i < 10; i++) {
      expect((await request(app).post('/api/auth/login').send({ login: 'ana', senha: u.senha, area: 'familia' })).status).toBe(200);
    }
  });
});

describe('GET /api/auth/me e POST /api/auth/logout', () => {
  it('/me sem cookie → 401; com cookie → dados do usuário (sem hash)', async () => {
    const { app, repo } = await cenario();
    const u = await semear(repo, senhas, { login: 'ana', nome: 'Ana', papel: 'familia' });
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    const login = await request(app).post('/api/auth/login').send({ login: 'ana', senha: u.senha, area: 'familia' });
    const me = await request(app).get('/api/auth/me').set('Cookie', valorDoCookie(login));
    expect(me.status).toBe(200);
    expect(me.body).toEqual({ nome: 'Ana', login: 'ana', papel: 'familia', precisaTrocarSenha: false });
  });

  it('/me funciona mesmo com senha temporária pendente (a tela de troca precisa dele)', async () => {
    const { app, repo } = await cenario();
    const u = await semear(repo, senhas, { login: 'ana', precisaTrocarSenha: true });
    const login = await request(app).post('/api/auth/login').send({ login: 'ana', senha: u.senha, area: 'familia' });
    expect(login.body.precisaTrocarSenha).toBe(true);
    const me = await request(app).get('/api/auth/me').set('Cookie', valorDoCookie(login));
    expect(me.status).toBe(200);
    expect(me.body.precisaTrocarSenha).toBe(true);
  });

  it('logout limpa o cookie', async () => {
    const { app } = await cenario();
    const res = await request(app).post('/api/auth/logout').send({});
    expect(res.status).toBe(200);
    expect(cookieDaResposta(res)).toMatch(/rm_session=;/);
  });
});

describe('POST /api/auth/trocar-senha', () => {
  async function logado(app, repo, opcoes = {}) {
    const u = await semear(repo, senhas, { login: 'ana', nome: 'Ana Souza', precisaTrocarSenha: true, ...opcoes });
    const login = await request(app).post('/api/auth/login').send({ login: u.login, senha: u.senha, area: 'familia' });
    return { u, cookie: valorDoCookie(login) };
  }

  it('sem sessão → 401', async () => {
    const { app } = await cenario();
    expect((await request(app).post('/api/auth/trocar-senha').send({ senhaAtual: 'a', novaSenha: 'b' })).status).toBe(401);
  });

  it('senha atual errada → 401 e nada muda', async () => {
    const { app, repo } = await cenario();
    const { cookie } = await logado(app, repo);
    const res = await request(app).post('/api/auth/trocar-senha').set('Cookie', cookie).send({ senhaAtual: 'errada', novaSenha: 'uma frase bem longa 2026' });
    expect(res.status).toBe(401);
    expect(repo._usuarios[0].precisaTrocarSenha).toBe(true);
  });

  it('nova senha fora da política → 400 com o motivo', async () => {
    const { app, repo } = await cenario();
    const { u, cookie } = await logado(app, repo);
    for (const [nova, motivo] of [['curta', /10/], ['ana-ana-ana-ana', /usuário/i], [u.senha, /diferente/i]]) {
      const res = await request(app).post('/api/auth/trocar-senha').set('Cookie', cookie).send({ senhaAtual: u.senha, novaSenha: nova });
      expect(res.status).toBe(400);
      expect(res.body.erro).toMatch(motivo);
    }
  });

  it('sucesso: zera a pendência, emite novo cookie, o antigo deixa de valer e a nova senha entra', async () => {
    const { app, repo } = await cenario();
    const { u, cookie: antigo } = await logado(app, repo);
    const res = await request(app).post('/api/auth/trocar-senha').set('Cookie', antigo).send({ senhaAtual: u.senha, novaSenha: 'minha frase nova 2026' });
    expect(res.status).toBe(200);
    expect(repo._usuarios[0].precisaTrocarSenha).toBe(false);
    const novo = valorDoCookie(res);
    expect(novo).toBeTruthy();
    expect(novo).not.toBe(antigo);

    expect((await request(app).get('/api/auth/me').set('Cookie', antigo)).status).toBe(401); // sessão antiga caiu
    expect((await request(app).get('/api/auth/me').set('Cookie', novo)).status).toBe(200);

    const velha = await request(app).post('/api/auth/login').send({ login: 'ana', senha: u.senha, area: 'familia' });
    expect(velha.status).toBe(401);
    const nova = await request(app).post('/api/auth/login').send({ login: 'ana', senha: 'minha frase nova 2026', area: 'familia' });
    expect(nova.status).toBe(200);
    expect(nova.body.precisaTrocarSenha).toBe(false);
  });

  it('rate limit: tentativas erradas seguidas → 429 (a rota é um oráculo da senha atual)', async () => {
    const { app, repo } = await cenario();
    const { cookie } = await logado(app, repo);
    const tentar = () => request(app).post('/api/auth/trocar-senha').set('Cookie', cookie).send({ senhaAtual: 'x', novaSenha: 'uma frase bem longa 2026' });
    for (let i = 0; i < 3; i++) expect((await tentar()).status).toBe(401);
    expect((await tentar()).status).toBe(429);
  });
});

describe('cabeçalhos e erros da API', () => {
  it('toda resposta de /api sai com no-store e Vary: Cookie, sem ETag', async () => {
    const { app } = await cenario();
    const res = await request(app).get('/api/auth/me');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers.vary).toMatch(/Cookie/);
    expect(res.headers.etag).toBeUndefined();
  });

  it('erro interno vira 500 em JSON sem vazar detalhes', async () => {
    const repo = criarRepoFalso();
    repo.buscarUsuarioPorLogin = async () => { throw new Error('senha do banco: segredo123'); };
    const app = criarApp({ repo, config, limites: LIMITES });
    const silencio = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).post('/api/auth/login').send({ login: 'a', senha: 'b', area: 'familia' });
    silencio.mockRestore();
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/segredo123/);
  });
});
