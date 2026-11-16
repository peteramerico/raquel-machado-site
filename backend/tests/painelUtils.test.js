const { loginBase, gerarLogin, RESERVADOS } = require('../src/login');
const { parseValor } = require('../src/valor');
const { normalizarContato } = require('../src/contato');

describe('loginBase', () => {
  it('1º nome, sem acento, minúsculo, só [a-z0-9]', () => {
    expect(loginBase('Maria Souza')).toBe('maria');
    expect(loginBase('  JOÃO  da Silva ')).toBe('joao');
    expect(loginBase('Ana-Clara Dias')).toBe('anaclara');
    expect(loginBase("D'Ávila Costa")).toBe('davila');
  });
  it('base curta ganha "fam"; vazia/só símbolos vira "familia"', () => {
    expect(loginBase('Li Wei')).toBe('lifam');
    expect(loginBase('A')).toBe('afam');
    expect(loginBase('')).toBe('familia');
    expect(loginBase('***')).toBe('familia');
    expect(loginBase(undefined)).toBe('familia');
    expect(loginBase(42)).toBe('42fam');
  });
  it('trunca em 30 caracteres (o login tem teto de 40 com o sufixo)', () => {
    expect(loginBase('a'.repeat(80))).toHaveLength(30);
  });
});

describe('gerarLogin', () => {
  const ocupar = (...logins) => async (l) => logins.includes(l);

  it('usa a base quando livre', async () => {
    expect(await gerarLogin('Maria Souza', ocupar())).toBe('maria');
  });
  it('colisões sequenciais: maria → maria2 → maria3', async () => {
    expect(await gerarLogin('Maria', ocupar('maria'))).toBe('maria2');
    expect(await gerarLogin('Maria', ocupar('maria', 'maria2'))).toBe('maria3');
  });
  it('logins reservados nunca saem puros (admin, peter, raquel…)', async () => {
    for (const nome of ['Admin', 'Peter', 'Raquel Machado', 'Root']) {
      const login = await gerarLogin(nome, ocupar());
      expect(RESERVADOS.has(login)).toBe(false);
      expect(login).toMatch(/^[a-z]+2$/);
    }
  });
  it('depois do 99 usa sufixo aleatório de 3 dígitos, sempre ≤ 40 caracteres e casando com a regex da CLI', async () => {
    const todos = new Set(['maria', ...Array.from({ length: 98 }, (_, i) => `maria${i + 2}`)]);
    const login = await gerarLogin('Maria', async (l) => todos.has(l));
    expect(login).toMatch(/^maria\d{3}$/);
    const longo = await gerarLogin('a'.repeat(80), ocupar());
    expect(longo.length).toBeLessThanOrEqual(40);
    expect(longo).toMatch(/^[a-z0-9._-]{3,40}$/);
  });
  it('base de 30 caracteres + sufixo continua ≤ 40', async () => {
    const base = 'a'.repeat(30);
    const login = await gerarLogin('a'.repeat(80), ocupar(base));
    expect(login).toBe(`${base}2`);
    expect(login.length).toBeLessThanOrEqual(40);
  });
  it('esgotado (tudo ocupado) → erro explícito', async () => {
    await expect(gerarLogin('Maria', async () => true)).rejects.toThrow(/login/i);
  });
});

describe('parseValor (estrito, em centavos)', () => {
  it.each([
    [450, 450, '450.00'],
    ['450', 450, '450.00'],
    ['450.5', 450.5, '450.50'],
    ['450,50', 450.5, '450.50'],
    [512.5, 512.5, '512.50'],
    [' 300 ', 300, '300.00'],
    ['1.00', 1, '1.00'],
    ['100000', 100000, '100000.00'],
  ])('aceita %p', (entrada, valor, texto) => {
    expect(parseValor(entrada)).toEqual({ ok: true, valor, texto });
  });

  it.each([
    true, false, null, undefined, '', '   ', 'abc', '0x10', '1e3', 1e3 + 0.5e-6, [450], { valor: 450 },
    NaN, Infinity, -Infinity, '450,5,0', '450.505', 1.005, 450.123, '1.', '.5', '-10', -10, 0, '0', '0,99', 0.5, '100000.01', 100001, '1000000',
  ])('recusa %p', (entrada) => {
    expect(parseValor(entrada).ok).toBe(false);
  });

  it('1.005 é recusado em vez de arredondar em silêncio para 1.00', () => {
    expect(parseValor(1.005).ok).toBe(false);
    expect(parseValor('1.005').ok).toBe(false);
  });
});

describe('normalizarContato', () => {
  it('vazio/ausente → null (opcional)', () => {
    for (const v of [undefined, null, '', '   ']) expect(normalizarContato(v)).toEqual({ ok: true, valor: null });
  });
  it('tira a máscara e prefixa 55 em 10–11 dígitos (o wa.me exige DDI)', () => {
    expect(normalizarContato('(84) 99999-0000')).toEqual({ ok: true, valor: '5584999990000' });
    expect(normalizarContato('84 3222-1111')).toEqual({ ok: true, valor: '558432221111' });
    expect(normalizarContato('84999990000')).toEqual({ ok: true, valor: '5584999990000' });
  });
  it('12–13 dígitos começando em 55 ficam como estão', () => {
    expect(normalizarContato('+55 84 99999-0000')).toEqual({ ok: true, valor: '5584999990000' });
    expect(normalizarContato('558432221111')).toEqual({ ok: true, valor: '558432221111' });
  });
  it('inválido (curto, longo, sem DDI de 12–13 dígitos, não-texto) → recusa', () => {
    for (const v of ['1234', '999990000', '1'.repeat(14), '441234567890', 'abc', {}, [], 5584999990000]) {
      expect(normalizarContato(v).ok).toBe(false);
    }
  });
});
