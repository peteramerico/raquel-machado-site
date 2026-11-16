const request = require('supertest');
const { criarApp } = require('../src/app');
const { carregar } = require('../src/config');
const { criarSenhas } = require('../src/senhas');
const { criarRepoFalso, semear } = require('./helpers/repoFalso');

const config = carregar({ JWT_SECRET: 'p'.repeat(48), BCRYPT_COST: '4' });
const senhas = criarSenhas({ cost: 4 });
const SENHA_TEMP = /^[abcdefghjkmnpqrstuvwxyz23456789]{12}$/;

async function cenario(limites = { geracaoSenha: { windowMs: 60000, limit: 100 } }) {
  const repo = criarRepoFalso();
  const app = criarApp({ repo, config, limites });
  const medica = await semear(repo, senhas, { login: 'raquel', nome: 'Raquel', papel: 'medica' });
  const admin = await semear(repo, senhas, { login: 'peter', nome: 'Peter', papel: 'admin' });
  return { repo, app, medica, admin };
}

async function entrar(app, u, area = 'painel') {
  const res = await request(app).post('/api/auth/login').send({ login: u.login, senha: u.senha, area });
  return (res.headers['set-cookie'] || [])[0]?.split(';')[0];
}

const criar = (app, cookie, corpo) => request(app).post('/api/painel/familias').set('Cookie', cookie).send(corpo);

describe('autorização do /api/painel', () => {
  const rotas = [
    ['get', '/api/painel/familias'],
    ['post', '/api/painel/familias'],
    ['post', '/api/painel/familias/1/redefinir'],
    ['patch', '/api/painel/familias/1'],
    ['get', '/api/painel/config'],
    ['put', '/api/painel/config'],
  ];

  it.each(rotas)('%s %s: sem sessão → 401', async (metodo, caminho) => {
    const { app } = await cenario();
    expect((await request(app)[metodo](caminho).send({})).status).toBe(401);
  });

  it.each(rotas)('%s %s: família → 403 (mesmo com id inexistente: nada a enumerar)', async (metodo, caminho) => {
    const { app, repo } = await cenario();
    const fam = await semear(repo, senhas, { login: 'ana', papel: 'familia' });
    const cookie = await entrar(app, fam, 'familia');
    expect((await request(app)[metodo](caminho).set('Cookie', cookie).send({})).status).toBe(403);
  });

  it('senha temporária pendente → 403 trocar_senha, inclusive para a médica', async () => {
    const { app, repo } = await cenario();
    const nova = await semear(repo, senhas, { login: 'nova', papel: 'medica', precisaTrocarSenha: true });
    const cookie = await entrar(app, nova);
    const res = await request(app).get('/api/painel/familias').set('Cookie', cookie);
    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe('trocar_senha');
  });

  it('médica e admin acessam', async () => {
    const { app, medica, admin } = await cenario();
    for (const u of [medica, admin]) {
      const cookie = await entrar(app, u);
      expect((await request(app).get('/api/painel/familias').set('Cookie', cookie)).status).toBe(200);
    }
  });

  it('respostas do painel são no-store (a senha temporária trafega em JSON)', async () => {
    const { app, medica } = await cenario();
    const cookie = await entrar(app, medica);
    const res = await criar(app, cookie, { nome: 'Maria Souza' });
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('POST /api/painel/familias (criar acesso)', () => {
  it('201: gera login, senha temporária de 12 caracteres (só na resposta), grava hash e quem criou', async () => {
    const { app, repo, medica } = await cenario();
    const cookie = await entrar(app, medica);
    const res = await criar(app, cookie, { nome: 'Maria Souza', contato: '(84) 99999-0000' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ login: 'maria', nome: 'Maria Souza' });
    expect(res.body.senhaTemporaria).toMatch(SENHA_TEMP);
    const u = repo._usuarios.find((x) => x.login === 'maria');
    expect(u).toMatchObject({ papel: 'familia', precisaTrocarSenha: true, ativo: true, contato: '5584999990000', criadoPor: repo._usuarios[0].id });
    expect(u.senhaHash).not.toContain(res.body.senhaTemporaria);
    expect(await senhas.conferir(res.body.senhaTemporaria, u.senhaHash)).toBe(true);
  });

  it('a conta criada entra com a senha temporária e cai na troca obrigatória', async () => {
    const { app, medica } = await cenario();
    const cookie = await entrar(app, medica);
    const { body } = await criar(app, cookie, { nome: 'Maria Souza' });
    const login = await request(app).post('/api/auth/login').send({ login: body.login, senha: body.senhaTemporaria, area: 'familia' });
    expect(login.status).toBe(200);
    expect(login.body.precisaTrocarSenha).toBe(true);
  });

  it('colisão de nome gera maria2, maria3…', async () => {
    const { app, medica } = await cenario();
    const cookie = await entrar(app, medica);
    const logins = [];
    for (let i = 0; i < 3; i++) logins.push((await criar(app, cookie, { nome: 'Maria Souza' })).body.login);
    expect(logins).toEqual(['maria', 'maria2', 'maria3']);
  });

  it('corrida: se o banco acusar login duplicado, tenta de novo com outro; 5 falhas → 503', async () => {
    const { app, repo, medica } = await cenario();
    const cookie = await entrar(app, medica);
    const original = repo.criarUsuario.bind(repo);
    let falhas = 1;
    repo.criarUsuario = async (dados) => {
      if (dados.papel === 'familia' && falhas-- > 0) throw Object.assign(new Error('dup'), { codigo: 'LOGIN_DUPLICADO' });
      return original(dados);
    };
    const ok = await criar(app, cookie, { nome: 'Joana' });
    expect(ok.status).toBe(201);
    expect(ok.body.login).not.toBe('joana'); // a 1ª tentativa colidiu; saiu outro
    repo.criarUsuario = async () => { throw Object.assign(new Error('dup'), { codigo: 'LOGIN_DUPLICADO' }); };
    const erro = await criar(app, cookie, { nome: 'Outra' });
    expect(erro.status).toBe(503);
  });

  it('nome inválido (ausente, curto, longo, não-texto) → 400', async () => {
    const { app, medica } = await cenario();
    const cookie = await entrar(app, medica);
    for (const corpo of [{}, { nome: '' }, { nome: 'A' }, { nome: 'x'.repeat(121) }, { nome: 123 }, { nome: ['Maria'] }, { nome: { a: 1 } }]) {
      expect((await criar(app, cookie, corpo)).status).toBe(400);
    }
  });

  it('contato: com máscara é normalizado; inválido → 400 (nunca anulado em silêncio)', async () => {
    const { app, medica } = await cenario();
    const cookie = await entrar(app, medica);
    expect((await criar(app, cookie, { nome: 'Ana Lima', contato: '84 99999-0000' })).status).toBe(201);
    for (const contato of ['1234', 'abc', '99999999999999999', 55849999900]) {
      expect((await criar(app, cookie, { nome: 'Ana Lima', contato })).status).toBe(400);
    }
  });

  it('mass assignment: papel/ativo/login enviados no corpo são ignorados (sempre família ativa)', async () => {
    const { app, repo, medica } = await cenario();
    const cookie = await entrar(app, medica);
    const res = await criar(app, cookie, { nome: 'Maria Souza', papel: 'admin', ativo: false, login: 'peter', precisaTrocarSenha: false, criadoPor: 999 });
    expect(res.status).toBe(201);
    const u = repo._usuarios.find((x) => x.login === res.body.login);
    expect(u).toMatchObject({ papel: 'familia', ativo: true, precisaTrocarSenha: true });
    expect(u.criadoPor).not.toBe(999);
    expect(res.body.login).toBe('maria');
  });
});

describe('GET /api/painel/familias', () => {
  it('lista só famílias, por nome, sem hash/senha, com aviso de truncamento', async () => {
    const { app, repo, medica } = await cenario();
    await semear(repo, senhas, { login: 'zeca', nome: 'Zeca Lima', papel: 'familia' });
    await semear(repo, senhas, { login: 'bia', nome: 'Bia Costa', papel: 'familia' });
    const cookie = await entrar(app, medica);
    const res = await request(app).get('/api/painel/familias').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.itens.map((i) => i.login)).toEqual(['bia', 'zeca']); // sem raquel/peter
    expect(res.body.truncada).toBe(false);
    expect(JSON.stringify(res.body)).not.toMatch(/hash|senhaTemporaria/i); // (precisaTrocarSenha é campo legítimo)
  });

  it('a senha temporária NUNCA reaparece depois da criação', async () => {
    const { app, medica } = await cenario();
    const cookie = await entrar(app, medica);
    const { body } = await criar(app, cookie, { nome: 'Maria Souza' });
    const lista = await request(app).get('/api/painel/familias').set('Cookie', cookie);
    expect(JSON.stringify(lista.body)).not.toContain(body.senhaTemporaria);
  });
});

describe('POST /api/painel/familias/:id/redefinir', () => {
  async function comFamilia() {
    const c = await cenario();
    const cookie = await entrar(c.app, c.medica);
    const { body } = await criar(c.app, cookie, { nome: 'Maria Souza' });
    const login = await request(c.app).post('/api/auth/login').send({ login: body.login, senha: body.senhaTemporaria, area: 'familia' });
    return { ...c, cookie, familia: body, cookieFamilia: (login.headers['set-cookie'] || [])[0].split(';')[0] };
  }

  it('gera nova temporária, volta a exigir troca e derruba a sessão da família', async () => {
    const { app, repo, cookie, familia, cookieFamilia } = await comFamilia();
    const id = repo._usuarios.find((u) => u.login === familia.login).id;
    const res = await request(app).post(`/api/painel/familias/${id}/redefinir`).set('Cookie', cookie).send({});
    expect(res.status).toBe(200);
    expect(res.body.login).toBe('maria');
    expect(res.body.senhaTemporaria).toMatch(SENHA_TEMP);
    expect(res.body.senhaTemporaria).not.toBe(familia.senhaTemporaria);
    expect((await request(app).get('/api/auth/me').set('Cookie', cookieFamilia)).status).toBe(401); // sessão caiu
    const velha = await request(app).post('/api/auth/login').send({ login: 'maria', senha: familia.senhaTemporaria, area: 'familia' });
    expect(velha.status).toBe(401);
    const nova = await request(app).post('/api/auth/login').send({ login: 'maria', senha: res.body.senhaTemporaria, area: 'familia' });
    expect(nova.status).toBe(200);
    expect(nova.body.precisaTrocarSenha).toBe(true);
  });

  it('conta de OUTRO papel (médica/admin) → 404 idêntico ao de inexistente, e nada muda', async () => {
    const { app, repo, cookie, medica, admin } = await comFamilia();
    for (const alvo of [medica, admin]) {
      const antes = repo._usuarios.find((u) => u.login === alvo.login).senhaHash;
      const res = await request(app).post(`/api/painel/familias/${alvo.id}/redefinir`).set('Cookie', cookie).send({});
      expect(res.status).toBe(404);
      expect(repo._usuarios.find((u) => u.login === alvo.login).senhaHash).toBe(antes);
    }
    const inexistente = await request(app).post('/api/painel/familias/99999/redefinir').set('Cookie', cookie).send({});
    expect(inexistente.status).toBe(404);
    expect(inexistente.body).toEqual((await request(app).post(`/api/painel/familias/${medica.id}/redefinir`).set('Cookie', cookie).send({})).body);
  });

  it.each(['abc', '-1', '1.5', '0', '1e3', '01', '0x10', '99999999999', '%201'])('id inválido %p → 400', async (id) => {
    const { app, cookie } = await comFamilia();
    expect((await request(app).post(`/api/painel/familias/${id}/redefinir`).set('Cookie', cookie).send({})).status).toBe(400);
  });

  it('conta desativada → 409 (não gera senha para quem não consegue entrar)', async () => {
    const { app, repo, cookie, familia } = await comFamilia();
    const id = repo._usuarios.find((u) => u.login === familia.login).id;
    await request(app).patch(`/api/painel/familias/${id}`).set('Cookie', cookie).send({ ativo: false });
    expect((await request(app).post(`/api/painel/familias/${id}/redefinir`).set('Cookie', cookie).send({})).status).toBe(409);
  });
});

describe('PATCH /api/painel/familias/:id (ativar/desativar)', () => {
  async function comFamilia() {
    const c = await cenario();
    const cookie = await entrar(c.app, c.medica);
    const { body } = await criar(c.app, cookie, { nome: 'Maria Souza' });
    const id = c.repo._usuarios.find((u) => u.login === body.login).id;
    return { ...c, cookie, id, senhaTemp: body.senhaTemporaria };
  }

  it('desativar: o login passa a dar 401 e a sessão aberta cai na hora; reativar: volta com a mesma senha', async () => {
    const { app, cookie, id, senhaTemp } = await comFamilia();
    const sessao = (await request(app).post('/api/auth/login').send({ login: 'maria', senha: senhaTemp, area: 'familia' })).headers['set-cookie'][0].split(';')[0];
    const off = await request(app).patch(`/api/painel/familias/${id}`).set('Cookie', cookie).send({ ativo: false });
    expect(off.status).toBe(200);
    expect(off.body).toEqual({ id, ativo: false });
    expect((await request(app).get('/api/auth/me').set('Cookie', sessao)).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ login: 'maria', senha: senhaTemp, area: 'familia' })).status).toBe(401);
    const on = await request(app).patch(`/api/painel/familias/${id}`).set('Cookie', cookie).send({ ativo: true });
    expect(on.body).toEqual({ id, ativo: true });
    expect((await request(app).post('/api/auth/login').send({ login: 'maria', senha: senhaTemp, area: 'familia' })).status).toBe(200);
  });

  it('ativo precisa ser booleano ESTRITO ("false", 0, null, ausente → 400)', async () => {
    const { app, cookie, id } = await comFamilia();
    for (const corpo of [{ ativo: 'false' }, { ativo: 0 }, { ativo: 1 }, { ativo: null }, {}, { papel: 'admin' }]) {
      expect((await request(app).patch(`/api/painel/familias/${id}`).set('Cookie', cookie).send(corpo)).status).toBe(400);
    }
  });

  it('mass assignment: campos extras (papel, nome, login) são ignorados', async () => {
    const { app, repo, cookie, id } = await comFamilia();
    const antes = { ...repo._usuarios.find((u) => u.id === id) };
    const res = await request(app).patch(`/api/painel/familias/${id}`).set('Cookie', cookie).send({ ativo: false, papel: 'admin', nome: 'Hack', login: 'hack' });
    expect(res.status).toBe(200);
    const depois = repo._usuarios.find((u) => u.id === id);
    expect(depois).toMatchObject({ papel: 'familia', nome: antes.nome, login: antes.login, ativo: false });
  });

  it('alvo de outro papel ou inexistente → 404; id inválido → 400', async () => {
    const { app, repo, cookie, medica, admin } = await comFamilia();
    for (const alvo of [medica, admin]) {
      expect((await request(app).patch(`/api/painel/familias/${alvo.id}`).set('Cookie', cookie).send({ ativo: false })).status).toBe(404);
      expect(repo._usuarios.find((u) => u.login === alvo.login).ativo).toBe(true);
    }
    expect((await request(app).patch('/api/painel/familias/99999').set('Cookie', cookie).send({ ativo: false })).status).toBe(404);
    expect((await request(app).patch('/api/painel/familias/abc').set('Cookie', cookie).send({ ativo: false })).status).toBe(400);
  });
});

describe('config do painel (valor da consulta)', () => {
  it('GET devolve o valor atual (padrão 400 se a chave faltar)', async () => {
    const { app, repo, medica } = await cenario();
    const cookie = await entrar(app, medica);
    expect((await request(app).get('/api/painel/config').set('Cookie', cookie)).body).toEqual({ valorConsulta: 400 });
    await repo.gravarConfig('valor_consulta', '450');
    expect((await request(app).get('/api/painel/config').set('Cookie', cookie)).body).toEqual({ valorConsulta: 450 });
  });

  it.each([[450, 450], ['450', 450], ['450.5', 450.5], ['450,50', 450.5], [512.5, 512.5]])('PUT aceita %p', async (entrada, esperado) => {
    const { app, repo, medica } = await cenario();
    const cookie = await entrar(app, medica);
    const res = await request(app).put('/api/painel/config').set('Cookie', cookie).send({ valorConsulta: entrada });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ valorConsulta: esperado });
    expect(Number(await repo.lerConfig('valor_consulta'))).toBe(esperado);
    expect(repo.lerAtualizadoPor('valor_consulta')).toBe(medica.id);
  });

  it.each([true, null, '', '0x10', '1e3', [450], 'abc', 0, -5, 1.005, '450.505', 100001, NaN])('PUT recusa %p e não altera o valor', async (entrada) => {
    const { app, repo, medica } = await cenario();
    await repo.gravarConfig('valor_consulta', '400');
    const cookie = await entrar(app, medica);
    const res = await request(app).put('/api/painel/config').set('Cookie', cookie).send({ valorConsulta: entrada });
    expect(res.status).toBe(400);
    expect(await repo.lerConfig('valor_consulta')).toBe('400');
  });

  it('PUT sem o campo → 400; o guia da família reflete o novo valor na hora', async () => {
    const { app, repo, medica } = await cenario();
    const cookie = await entrar(app, medica);
    expect((await request(app).put('/api/painel/config').set('Cookie', cookie).send({})).status).toBe(400);
    await request(app).put('/api/painel/config').set('Cookie', cookie).send({ valorConsulta: '480,00' });
    const fam = await semear(repo, senhas, { login: 'ana', papel: 'familia' });
    const cf = await entrar(app, fam, 'familia');
    expect((await request(app).get('/api/familia/guia').set('Cookie', cf)).body.valorConsulta).toBe(480);
  });
});

describe('rate limit de geração de senha (conta TAMBÉM os sucessos)', () => {
  it('criar/redefinir com sucesso seguidos → 429 ao passar do limite', async () => {
    const { app, medica } = await cenario({ geracaoSenha: { windowMs: 60000, limit: 3 } });
    const cookie = await entrar(app, medica);
    const statuses = [];
    for (let i = 0; i < 5; i++) statuses.push((await criar(app, cookie, { nome: `Pessoa ${String.fromCharCode(65 + i)}` })).status);
    expect(statuses).toEqual([201, 201, 201, 429, 429]);
  });

  it('o limite é por usuário: outra pessoa da equipe não é afetada', async () => {
    const { app, admin, medica } = await cenario({ geracaoSenha: { windowMs: 60000, limit: 1 } });
    const cm = await entrar(app, medica);
    const ca = await entrar(app, admin);
    expect((await criar(app, cm, { nome: 'Um Dois' })).status).toBe(201);
    expect((await criar(app, cm, { nome: 'Tres Quatro' })).status).toBe(429);
    expect((await criar(app, ca, { nome: 'Cinco Seis' })).status).toBe(201);
  });
});
