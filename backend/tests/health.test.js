const request = require('supertest');
const app = require('../src/app');

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
    for (const rota of ['/blog', '/api/posts', '/api/auth/login', '/uploads/x.png']) {
      const res = await request(app).get(rota);
      expect(res.status).toBe(404);
    }
  });
});
