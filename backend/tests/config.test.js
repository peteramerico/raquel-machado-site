const { carregar } = require('../src/config');

const FORTE = 'a'.repeat(40);

describe('config.carregar', () => {
  let aviso;
  beforeEach(() => { aviso = jest.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => aviso.mockRestore());

  it('em produção exige JWT_SECRET ausente → erro explicativo', () => {
    expect(() => carregar({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET/);
  });
  it('em produção recusa segredo curto (< 32)', () => {
    expect(() => carregar({ NODE_ENV: 'production', JWT_SECRET: 'curto' })).toThrow(/JWT_SECRET/);
  });
  it('em produção recusa o placeholder do .env.example (contém "trocar")', () => {
    expect(() => carregar({ NODE_ENV: 'production', JWT_SECRET: 'trocar_por_string_aleatoria_longa_aqui' })).toThrow(/JWT_SECRET/);
  });
  it('em produção aceita segredo forte e marca produção', () => {
    const c = carregar({ NODE_ENV: 'production', JWT_SECRET: FORTE });
    expect(c.producao).toBe(true);
    expect(c.jwtSecret).toBe(FORTE);
  });
  it('fora de produção gera segredo efêmero (64 hex) com aviso', () => {
    const c = carregar({});
    expect(c.jwtSecret).toMatch(/^[0-9a-f]{64}$/);
    expect(c.producao).toBe(false);
    expect(aviso).toHaveBeenCalled();
  });
  it('custo do bcrypt: padrão 12, configurável e limitado a 4–15', () => {
    expect(carregar({ JWT_SECRET: FORTE }).bcryptCost).toBe(12);
    expect(carregar({ JWT_SECRET: FORTE, BCRYPT_COST: '4' }).bcryptCost).toBe(4);
    expect(carregar({ JWT_SECRET: FORTE, BCRYPT_COST: '2' }).bcryptCost).toBe(4);
    expect(carregar({ JWT_SECRET: FORTE, BCRYPT_COST: '99' }).bcryptCost).toBe(15);
  });
  it('o nome do cookie e a duração da sessão são fixos e conhecidos', () => {
    const c = carregar({ JWT_SECRET: FORTE });
    expect(c.cookieNome).toBe('rm_session');
    expect(c.sessaoDias).toBe(7);
  });
});
