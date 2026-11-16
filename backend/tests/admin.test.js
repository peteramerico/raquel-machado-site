const request = require('supertest');
const { criarApp } = require('../src/app');
const { carregar } = require('../src/config');
const { criarSenhas } = require('../src/senhas');
const { criarRepoFalso, semear } = require('./helpers/repoFalso');

const config = carregar({ JWT_SECRET: 'a'.repeat(48), BCRYPT_COST: '4' });
const senhas = criarSenhas({ cost: 4 });
const SENHA_TEMP = /^[abcdefghjkmnpqrstuvwxyz23456789]{12}$/;

async function cenario(limites = { geracaoSenha: { windowMs: 60000, limit: 100 } }) {
  const repo = criarRepoFalso();
  const app = criarApp({ repo, config, limites });
  const admin = await semear(repo, senhas, { login: 'peter', nome: 'Peter', papel: 'admin' });
  const admin2 = await semear(repo, senhas, { login: 'segundo', nome: 'Segundo Admin', papel: 'admin' });
  const medica = await semear(repo, senhas, { login: 'raquel', nome: 'Raquel', papel: 'medica' });
  const fam = await semear(repo, senhas, { login: 'ana', nome: 'Ana Souza', papel: 'familia' });
  return { repo, app, admin, admin2, medica, fam };
}

async function entrar(app, u, area = 'admin') {
  const res = await request(app).post('/api/auth/login').send({ login: u.login, senha: u.senha, area });
  return (res.headers['set-cookie'] || [])[0]?.split(';')[0];
}

const criar = (app, cookie, corpo) => request(app).post('/api/admin/usuarios').set('Cookie', cookie).send(corpo);
const patch = (app, cookie, id, corpo) => request(app).patch(`/api/admin/usuarios/${id}`).set('Cookie', cookie).send(corpo);
const redefinir = (app, cookie, id) => request(app).post(`/api/admin/usuarios/${id}/redefinir`).set('Cookie', cookie).send({});

describe('autorização do /api/admin', () => {
  const rotas = [
    ['get', '/api/admin/usuarios'],
    ['post', '/api/admin/usuarios'],
    ['post', '/api/admin/usuarios/1/redefinir'],
    ['patch', '/api/admin/usuarios/1'],
  ];

  it.each(rotas)('%s %s: sem sessão → 401', async (m, p) => {
    const { app } = await cenario();
    expect((await request(app)[m](p).send({})).status).toBe(401);
  });

  it.each(rotas)('%s %s: família e MÉDICA → 403', async (m, p) => {
    const { app, fam, medica } = await cenario();
    for (const [u, area] of [[fam, 'familia'], [medica, 'painel']]) {
      const cookie = await entrar(app, u, area);
      expect((await request(app)[m](p).set('Cookie', cookie).send({})).status).toBe(403);
    }
  });

  it('admin acessa; senha temporária pendente → 403 trocar_senha', async () => {
    const { app, admin, repo } = await cenario();
    expect((await request(app).get('/api/admin/usuarios').set('Cookie', await entrar(app, admin))).status).toBe(200);
    const novo = await semear(repo, senhas, { login: 'novo', papel: 'admin', precisaTrocarSenha: true });
    const res = await request(app).get('/api/admin/usuarios').set('Cookie', await entrar(app, novo));
    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe('trocar_senha');
  });
});

describe('GET /api/admin/usuarios', () => {
  it('lista todas as contas (admin, médica, família), sem hash, marcando só a própria', async () => {
    const { app, admin } = await cenario();
    const res = await request(app).get('/api/admin/usuarios').set('Cookie', await entrar(app, admin));
    expect(res.status).toBe(200);
    expect(res.body.itens.map((i) => i.papel)).toEqual(['admin', 'admin', 'medica', 'familia']);
    expect(res.body.itens.filter((i) => i.voce).map((i) => i.login)).toEqual(['peter']);
    expect(JSON.stringify(res.body)).not.toMatch(/hash/i);
    expect(res.body.truncada).toBe(false);
  });
});

describe('POST /api/admin/usuarios (criar conta de equipe)', () => {
  it('201: médica com login normalizado, senha de 12 caracteres, hash, quem criou e troca obrigatória', async () => {
    const { app, repo, admin } = await cenario();
    const res = await criar(app, await entrar(app, admin), { nome: 'Dra. Maria', login: '  Maria.Dra ', papel: 'medica' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ login: 'maria.dra', nome: 'Dra. Maria', papel: 'medica' });
    expect(res.body.senhaTemporaria).toMatch(SENHA_TEMP);
    const u = repo._usuarios.find((x) => x.login === 'maria.dra');
    expect(u).toMatchObject({ papel: 'medica', precisaTrocarSenha: true, ativo: true, criadoPor: repo._usuarios[0].id });
    expect(u.senhaHash).not.toContain(res.body.senhaTemporaria);
    expect(await senhas.conferir(res.body.senhaTemporaria, u.senhaHash)).toBe(true);
  });

  it('a médica criada entra no /painel (e é barrada no /admin); o admin criado entra no /admin', async () => {
    const { app, admin } = await cenario();
    const cookie = await entrar(app, admin);
    const m = (await criar(app, cookie, { nome: 'Dra. Maria', login: 'dramaria', papel: 'medica' })).body;
    const a = (await criar(app, cookie, { nome: 'Outro Admin', login: 'outroadm', papel: 'admin' })).body;
    const entrarComo = (login, senha, area) => request(app).post('/api/auth/login').send({ login, senha, area });
    const painel = await entrarComo('dramaria', m.senhaTemporaria, 'painel');
    expect(painel.status).toBe(200);
    expect(painel.body.precisaTrocarSenha).toBe(true);
    expect((await entrarComo('dramaria', m.senhaTemporaria, 'admin')).status).toBe(403);
    expect((await entrarComo('outroadm', a.senhaTemporaria, 'admin')).status).toBe(200);
  });

  it('login em uso → 409, inclusive com outra caixa/acento', async () => {
    const { app, admin } = await cenario();
    const cookie = await entrar(app, admin);
    for (const login of ['raquel', 'RAQUEL', ' Raquél ']) {
      expect((await criar(app, cookie, { nome: 'Outra Pessoa', login, papel: 'medica' })).status).toBe(409);
    }
  });

  it('login inválido → 400 (curto, espaço, 41 caracteres, símbolos, não-texto)', async () => {
    const { app, admin } = await cenario();
    const cookie = await entrar(app, admin);
    for (const login of ['ab', 'com espaco', 'a'.repeat(41), 'a/b', 'ma*ria', '', undefined, 123, ['x']]) {
      expect((await criar(app, cookie, { nome: 'Dra. Maria', login, papel: 'medica' })).status).toBe(400);
    }
  });

  it('papel só medica|admin: familia, superuser, ausente, não-texto → 400', async () => {
    const { app, admin } = await cenario();
    const cookie = await entrar(app, admin);
    for (const papel of ['familia', 'superuser', undefined, 5, ['admin'], 'ADMIN']) {
      expect((await criar(app, cookie, { nome: 'Dra. Maria', login: 'dramaria', papel })).status).toBe(400);
    }
  });

  it('nome inválido → 400', async () => {
    const { app, admin } = await cenario();
    const cookie = await entrar(app, admin);
    for (const nome of [undefined, '', 'A', 'x'.repeat(121), 7, { a: 1 }]) {
      expect((await criar(app, cookie, { nome, login: 'dramaria', papel: 'medica' })).status).toBe(400);
    }
  });

  it('mass assignment: ativo/criadoPor/sessaoVersao/senhaHash enviados são ignorados', async () => {
    const { app, repo, admin } = await cenario();
    const res = await criar(app, await entrar(app, admin), {
      nome: 'Dra. Maria', login: 'dramaria', papel: 'medica', ativo: false, criadoPor: 999, sessaoVersao: 50, senhaHash: 'x', precisaTrocarSenha: false,
    });
    expect(res.status).toBe(201);
    const u = repo._usuarios.find((x) => x.login === 'dramaria');
    expect(u).toMatchObject({ ativo: true, sessaoVersao: 1, precisaTrocarSenha: true });
    expect(u.criadoPor).not.toBe(999);
    expect(u.senhaHash).not.toBe('x');
  });
});

describe('POST /api/admin/usuarios/:id/redefinir', () => {
  it('outro admin, médica ou família: nova temporária, volta a exigir troca e derruba a sessão do alvo', async () => {
    const { app, repo, admin, admin2, medica, fam } = await cenario();
    const cookie = await entrar(app, admin);
    for (const [alvo, area] of [[admin2, 'admin'], [medica, 'painel'], [fam, 'familia']]) {
      const sessaoAlvo = await entrar(app, alvo, area);
      const res = await redefinir(app, cookie, alvo.id);
      expect(res.status).toBe(200);
      expect(res.body.login).toBe(alvo.login);
      expect(res.body.senhaTemporaria).toMatch(SENHA_TEMP);
      expect((await request(app).get('/api/auth/me').set('Cookie', sessaoAlvo)).status).toBe(401);
      expect(repo._usuarios.find((u) => u.id === alvo.id).precisaTrocarSenha).toBe(true);
      const nova = await request(app).post('/api/auth/login').send({ login: alvo.login, senha: res.body.senhaTemporaria, area });
      expect(nova.status).toBe(200);
    }
  });

  it('a PRÓPRIA conta → 400 (use "Trocar senha"); a sessão do admin continua valendo', async () => {
    const { app, admin } = await cenario();
    const cookie = await entrar(app, admin);
    const res = await redefinir(app, cookie, admin.id);
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/Trocar senha/);
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(200);
  });

  it('conta desativada → 409; inexistente → 404; id inválido → 400', async () => {
    const { app, repo, admin, fam } = await cenario();
    const cookie = await entrar(app, admin);
    await patch(app, cookie, fam.id, { ativo: false });
    expect((await redefinir(app, cookie, fam.id)).status).toBe(409);
    expect((await redefinir(app, cookie, 99999)).status).toBe(404);
    for (const id of ['abc', '-1', '1.5', '0', '1e3', '01', '0x10', '99999999999']) {
      expect((await request(app).post(`/api/admin/usuarios/${id}/redefinir`).set('Cookie', cookie).send({})).status).toBe(400);
    }
    expect(repo._usuarios.find((u) => u.id === fam.id).ativo).toBe(false);
  });
});

describe('PATCH /api/admin/usuarios/:id (ativar/desativar)', () => {
  it('desativar derruba a sessão do alvo na hora e bloqueia o login; reativar volta com a mesma senha', async () => {
    const { app, admin, medica } = await cenario();
    const cookie = await entrar(app, admin);
    const sessaoMedica = await entrar(app, medica, 'painel');
    const off = await patch(app, cookie, medica.id, { ativo: false });
    expect(off.body).toEqual({ id: medica.id, ativo: false });
    expect((await request(app).get('/api/auth/me').set('Cookie', sessaoMedica)).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ login: 'raquel', senha: medica.senha, area: 'painel' })).status).toBe(401);
    expect((await patch(app, cookie, medica.id, { ativo: true })).body).toEqual({ id: medica.id, ativo: true });
    expect((await request(app).post('/api/auth/login').send({ login: 'raquel', senha: medica.senha, area: 'painel' })).status).toBe(200);
  });

  it('PATCH sem mudança de estado NÃO derruba a sessão do alvo (reativar conta já ativa)', async () => {
    const { app, admin2, admin } = await cenario();
    const cookie = await entrar(app, admin);
    const sessaoDoOutro = await entrar(app, admin2);
    expect((await patch(app, cookie, admin2.id, { ativo: true })).status).toBe(200); // já estava ativo
    expect((await request(app).get('/api/auth/me').set('Cookie', sessaoDoOutro)).status).toBe(200);
  });

  it('a PRÓPRIA conta → 409 em qualquer PATCH (inclusive {ativo:true}); a sessão continua', async () => {
    const { app, admin } = await cenario();
    const cookie = await entrar(app, admin);
    for (const ativo of [false, true]) {
      const res = await patch(app, cookie, admin.id, { ativo });
      expect(res.status).toBe(409);
      expect(res.body.erro).toMatch(/própria conta/);
    }
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(200);
  });

  it('com 2 admins, o admin desativa o outro; o desativado não consegue mais agir', async () => {
    const { app, admin, admin2 } = await cenario();
    const c1 = await entrar(app, admin);
    const c2 = await entrar(app, admin2);
    expect((await patch(app, c1, admin2.id, { ativo: false })).status).toBe(200);
    expect((await patch(app, c2, admin.id, { ativo: false })).status).toBe(401); // sessão do 2º caiu: não consegue desativar o 1º
  });

  it('trava do último admin: o repositório devolve ultimo_admin → 409 e a conta continua ativa', async () => {
    const { app, repo, admin, admin2 } = await cenario();
    const original = repo.definirAtivoComTrava.bind(repo);
    repo.definirAtivoComTrava = async () => ({ ok: false, motivo: 'ultimo_admin' }); // a corrida só existe sob concorrência
    const res = await patch(app, await entrar(app, admin), admin2.id, { ativo: false });
    repo.definirAtivoComTrava = original;
    expect(res.status).toBe(409);
    expect(res.body.erro).toMatch(/ao menos um administrador/i);
    expect(repo._usuarios.find((u) => u.id === admin2.id).ativo).toBe(true);
  });

  it('a regra do repositório falso: único admin ativo não pode ser desativado, inativo não conta', async () => {
    const repo = criarRepoFalso();
    const a = await repo.criarUsuario({ login: 'a1', nome: 'A', papel: 'admin', senhaHash: 'h' });
    const b = await repo.criarUsuario({ login: 'a2', nome: 'B', papel: 'admin', senhaHash: 'h' });
    expect(await repo.definirAtivoComTrava(a, false)).toMatchObject({ ok: true, mudou: true });
    expect(await repo.definirAtivoComTrava(b, false)).toEqual({ ok: false, motivo: 'ultimo_admin' });
    expect(await repo.definirAtivoComTrava(a, false)).toEqual({ ok: true, mudou: false }); // já inativo: nada a travar
    expect(await repo.definirAtivoComTrava(a, true)).toMatchObject({ ok: true, mudou: true });
    expect(await repo.definirAtivoComTrava(99, false)).toEqual({ ok: false, motivo: 'nao_encontrada' });
  });

  it('mutex ocupado (motivo "ocupado") → 503 amigável', async () => {
    const { app, repo, admin, medica } = await cenario();
    repo.definirAtivoComTrava = async () => ({ ok: false, motivo: 'ocupado' });
    const res = await patch(app, await entrar(app, admin), medica.id, { ativo: false });
    expect(res.status).toBe(503);
    expect(res.body.erro).toMatch(/tente de novo/i);
  });

  it('deadlock do banco (errno 1213) → 503 amigável, nunca 500', async () => {
    const { app, repo, admin, medica } = await cenario();
    repo.definirAtivoComTrava = async () => { throw Object.assign(new Error('Deadlock'), { errno: 1213 }); };
    const res = await patch(app, await entrar(app, admin), medica.id, { ativo: false });
    expect(res.status).toBe(503);
    expect(res.body.erro).toMatch(/tente de novo/i);
  });

  it('ativo precisa ser booleano estrito; extras ignorados; inexistente 404; id inválido 400', async () => {
    const { app, repo, admin, medica } = await cenario();
    const cookie = await entrar(app, admin);
    for (const corpo of [{ ativo: 'false' }, { ativo: 0 }, { ativo: 1 }, { ativo: null }, {}, { papel: 'admin' }]) {
      expect((await patch(app, cookie, medica.id, corpo)).status).toBe(400);
    }
    const ok = await patch(app, cookie, medica.id, { ativo: false, papel: 'admin', nome: 'Hack', login: 'hack' });
    expect(ok.status).toBe(200);
    expect(repo._usuarios.find((u) => u.id === medica.id)).toMatchObject({ papel: 'medica', nome: 'Raquel', login: 'raquel', ativo: false });
    expect((await patch(app, cookie, 99999, { ativo: false })).status).toBe(404);
    expect((await patch(app, cookie, 'abc', { ativo: false })).status).toBe(400);
  });
});

describe('/api/painel: reativar conta já ativa não derruba a sessão (correção do Inc. 2)', () => {
  it('PATCH {ativo:true} numa família ativa mantém a sessão dela', async () => {
    const { app, repo, medica, fam } = await cenario();
    const cm = await entrar(app, medica, 'painel');
    const sessaoFam = await entrar(app, fam, 'familia');
    const res = await request(app).patch(`/api/painel/familias/${fam.id}`).set('Cookie', cm).send({ ativo: true });
    expect(res.status).toBe(200);
    expect((await request(app).get('/api/auth/me').set('Cookie', sessaoFam)).status).toBe(200);
    expect(repo._usuarios.find((u) => u.id === fam.id).sessaoVersao).toBe(1);
  });
});

describe('rate limit de geração do admin (conta sucessos, por usuário)', () => {
  it('criar/redefinir com sucesso seguidos → 429 ao passar do limite', async () => {
    const { app, admin } = await cenario({ geracaoSenha: { windowMs: 60000, limit: 3 } });
    const cookie = await entrar(app, admin);
    const statuses = [];
    for (let i = 0; i < 5; i++) statuses.push((await criar(app, cookie, { nome: `Pessoa ${i}`, login: `pessoa${i}`, papel: 'medica' })).status);
    expect(statuses).toEqual([201, 201, 201, 429, 429]);
  });
});
