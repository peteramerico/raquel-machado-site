const jwt = require('jsonwebtoken');
const { carregar } = require('../src/config');
const { criarSessao } = require('../src/sessao');

const FORTE = 'k'.repeat(48);
const config = carregar({ JWT_SECRET: FORTE, BCRYPT_COST: '4' });
const sessao = criarSessao(config);

describe('sessao (JWT)', () => {
  it('assinar/verificar: ida e volta com id e versão', () => {
    const token = sessao.assinar({ id: 7, sessaoVersao: 3 });
    expect(sessao.verificar(token)).toEqual({ id: 7, v: 3 });
  });

  it('token adulterado, de outro segredo ou lixo → null', () => {
    const token = sessao.assinar({ id: 7, sessaoVersao: 1 });
    expect(sessao.verificar(token.slice(0, -2) + 'xx')).toBeNull();
    const outro = criarSessao(carregar({ JWT_SECRET: 'z'.repeat(48) }));
    expect(sessao.verificar(outro.assinar({ id: 7, sessaoVersao: 1 }))).toBeNull();
    expect(sessao.verificar('lixo')).toBeNull();
    expect(sessao.verificar(undefined)).toBeNull();
  });

  it('token expirado → null', () => {
    const velho = jwt.sign({ sub: '7', v: 1 }, FORTE, { algorithm: 'HS256', expiresIn: -10 });
    expect(sessao.verificar(velho)).toBeNull();
  });

  it('só aceita HS256: token "alg: none" e outros algoritmos são recusados', () => {
    const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url') + '.' +
      Buffer.from(JSON.stringify({ sub: '7', v: 1 })).toString('base64url') + '.';
    expect(sessao.verificar(none)).toBeNull();
    const hs512 = jwt.sign({ sub: '7', v: 1 }, FORTE, { algorithm: 'HS512' });
    expect(sessao.verificar(hs512)).toBeNull();
  });

  it('payload sem id/versão inteiros → null', () => {
    expect(sessao.verificar(jwt.sign({ sub: 'abc', v: 1 }, FORTE, { algorithm: 'HS256' }))).toBeNull();
    expect(sessao.verificar(jwt.sign({ sub: '7' }, FORTE, { algorithm: 'HS256' }))).toBeNull();
  });

  it('o token NÃO carrega papel (o papel vem sempre do banco)', () => {
    const decodificado = jwt.decode(sessao.assinar({ id: 7, sessaoVersao: 1, papel: 'admin' }));
    expect(decodificado.papel).toBeUndefined();
    expect(Object.keys(decodificado).sort()).toEqual(['exp', 'iat', 'sub', 'v']);
  });

  it('opções do cookie: httpOnly, sameSite lax, path /, secure só em produção, 7 dias', () => {
    expect(sessao.cookieOpcoes).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', secure: false, maxAge: 7 * 24 * 3600 * 1000 });
    const prod = criarSessao(carregar({ NODE_ENV: 'production', JWT_SECRET: FORTE }));
    expect(prod.cookieOpcoes.secure).toBe(true);
  });
});
