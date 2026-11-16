const request = require('supertest');
const { criarApp } = require('../src/app');
const { carregar } = require('../src/config');
const { criarSenhas } = require('../src/senhas');
const { criarRepoFalso, semear } = require('./helpers/repoFalso');

const config = carregar({ JWT_SECRET: 'f'.repeat(48), BCRYPT_COST: '4' });
const senhas = criarSenhas({ cost: 4 });

async function entrar(app, { login, senha }, area = 'familia') {
  const res = await request(app).post('/api/auth/login').send({ login, senha, area });
  return (res.headers['set-cookie'] || [])[0]?.split(';')[0];
}

async function cenario() {
  const repo = criarRepoFalso();
  const app = criarApp({ repo, config });
  return { repo, app };
}

describe('GET /api/familia/guia', () => {
  it('sem sessão → 401 e NENHUM conteúdo do guia na resposta', async () => {
    const { app } = await cenario();
    const res = await request(app).get('/api/familia/guia');
    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).not.toMatch(/puericultura|Que bom ter vocês/i);
  });

  it.each(['familia', 'medica', 'admin'])('papel %s → 200 com o guia e o valor', async (papel) => {
    const { app, repo } = await cenario();
    const u = await semear(repo, senhas, { login: 'pessoa', papel });
    const cookie = await entrar(app, u);
    const res = await request(app).get('/api/familia/guia').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.guia.titulo).toBe('Guia da consulta com a Dra. Raquel');
    expect(res.body.guia.capitulos.map((c) => c.id)).toEqual(['puericultura', 'retorno', 'calendario', 'prenatal', 'trazer', 'whatsapp', 'valor']);
    expect(res.body.guia.calendario.faixas).toHaveLength(6);
    expect(res.body.guia.trazer.itens).toHaveLength(5);
  });

  it('senha temporária pendente → 403 trocar_senha (e nada do guia)', async () => {
    const { app, repo } = await cenario();
    const u = await semear(repo, senhas, { login: 'nova', precisaTrocarSenha: true });
    const cookie = await entrar(app, u);
    const res = await request(app).get('/api/familia/guia').set('Cookie', cookie);
    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe('trocar_senha');
    expect(res.body.guia).toBeUndefined();
  });

  it('o valor vem da tabela de configurações (e acompanha a edição)', async () => {
    const { app, repo } = await cenario();
    const u = await semear(repo, senhas, { login: 'ana' });
    const cookie = await entrar(app, u);
    await repo.gravarConfig('valor_consulta', '450');
    expect((await request(app).get('/api/familia/guia').set('Cookie', cookie)).body.valorConsulta).toBe(450);
    await repo.gravarConfig('valor_consulta', '512.5');
    expect((await request(app).get('/api/familia/guia').set('Cookie', cookie)).body.valorConsulta).toBe(512.5);
  });

  it('sem a chave (ou valor inválido) cai no padrão 400, nunca em NaN/0', async () => {
    const { app, repo } = await cenario();
    const u = await semear(repo, senhas, { login: 'ana' });
    const cookie = await entrar(app, u);
    expect((await request(app).get('/api/familia/guia').set('Cookie', cookie)).body.valorConsulta).toBe(400);
    for (const ruim of ['abc', '0', '-10', '']) {
      await repo.gravarConfig('valor_consulta', ruim);
      expect((await request(app).get('/api/familia/guia').set('Cookie', cookie)).body.valorConsulta).toBe(400);
    }
  });

  it('o texto do guia NÃO contém o preço (ele vem à parte, do banco)', async () => {
    const { app, repo } = await cenario();
    const u = await semear(repo, senhas, { login: 'ana' });
    const cookie = await entrar(app, u);
    const { guia } = (await request(app).get('/api/familia/guia').set('Cookie', cookie)).body;
    expect(JSON.stringify(guia)).not.toMatch(/R\$|400/);
  });

  it('a resposta não é cacheável (no-store, Vary: Cookie)', async () => {
    const { app, repo } = await cenario();
    const u = await semear(repo, senhas, { login: 'ana' });
    const cookie = await entrar(app, u);
    const res = await request(app).get('/api/familia/guia').set('Cookie', cookie);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers.vary).toMatch(/Cookie/);
  });
});
