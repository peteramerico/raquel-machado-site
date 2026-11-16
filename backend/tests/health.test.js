const request = require('supertest');
const { criarApp } = require('../src/app');
const { carregar } = require('../src/config');
const { criarRepoFalso } = require('./helpers/repoFalso');

const app = criarApp({ repo: criarRepoFalso(), config: carregar({ JWT_SECRET: 'h'.repeat(48), BCRYPT_COST: '4' }) });

describe('API', () => {
  it('GET /api/health responde 200 { ok: true }', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('rota desconhecida em /api responde 404 em JSON', async () => {
    const res = await request(app).get('/api/nao-existe');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ erro: 'Não encontrado.' });
  });

  it('não expõe mais as rotas do blog', async () => {
    for (const rota of ['/blog', '/api/posts', '/uploads/x.png']) {
      const res = await request(app).get(rota);
      expect(res.status).toBe(404);
    }
  });

  it('criarApp sem repositório falha alto', () => {
    expect(() => criarApp({})).toThrow(/repo/);
  });
});
