const { criarSenhas, senhaTemporaria, validarNovaSenha, normalizarLogin } = require('../src/senhas');

describe('senhaTemporaria', () => {
  it('tem 12 caracteres do alfabeto sem ambíguos e não repete em 1000 gerações', () => {
    const vistas = new Set();
    for (let i = 0; i < 1000; i++) {
      const s = senhaTemporaria();
      expect(s).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{12}$/);
      vistas.add(s);
    }
    expect(vistas.size).toBe(1000);
  });
});

describe('normalizarLogin', () => {
  it('minúsculo, sem acento, sem espaços nas pontas', () => {
    expect(normalizarLogin('  João.Silva ')).toBe('joao.silva');
    expect(normalizarLogin('RAQUEL')).toBe('raquel');
  });
  it('devolve string vazia para entrada que não é texto', () => {
    expect(normalizarLogin(undefined)).toBe('');
    expect(normalizarLogin(42)).toBe('');
  });
});

describe('validarNovaSenha', () => {
  const ctx = { login: 'maria', nome: 'Maria Souza', senhaAtual: 'temporaria123' };

  it('aceita uma frase longa', () => {
    expect(validarNovaSenha('meu bebe nasceu em marco', ctx)).toBeNull();
  });
  it('recusa menos de 10 caracteres', () => {
    expect(validarNovaSenha('curta123', ctx)).toMatch(/10/);
  });
  it('recusa mais de 72 bytes (limite do bcrypt), contando acentos como 2 bytes', () => {
    expect(validarNovaSenha('a'.repeat(73), ctx)).toMatch(/72/);
    expect(validarNovaSenha('é'.repeat(37), ctx)).toMatch(/72/); // 74 bytes
    expect(validarNovaSenha('a'.repeat(72), ctx)).toBeNull();
  });
  it('recusa só espaços e entrada que não é texto', () => {
    expect(validarNovaSenha('          ', ctx)).toBeTruthy();
    expect(validarNovaSenha(undefined, ctx)).toBeTruthy();
    expect(validarNovaSenha(1234567890, ctx)).toBeTruthy();
  });
  it('recusa igual ao login ou contendo o login', () => {
    expect(validarNovaSenha('mariamariamaria', ctx)).toMatch(/usuário/i);
    expect(validarNovaSenha('MARIA-casa-2026', ctx)).toMatch(/usuário/i);
  });
  it('recusa igual ao nome', () => {
    expect(validarNovaSenha('maria souza', { ...ctx, login: 'x9' })).toMatch(/nome/i);
    expect(validarNovaSenha('MARIA SOUZA', { ...ctx, login: 'x9' })).toMatch(/nome/i);
  });
  it('recusa igual à senha atual', () => {
    expect(validarNovaSenha('temporaria123', ctx)).toMatch(/diferente/i);
  });
});

describe('criarSenhas (bcrypt)', () => {
  const senhas = criarSenhas({ cost: 4 });

  it('hash ≠ senha, e a conferência funciona nos dois sentidos', async () => {
    const hash = await senhas.hash('uma senha longa');
    expect(hash).not.toContain('uma senha longa');
    expect(await senhas.conferir('uma senha longa', hash)).toBe(true);
    expect(await senhas.conferir('outra senha', hash)).toBe(false);
  });
  it('sem hash (usuário inexistente) devolve false MAS ainda gasta o tempo de um compare', async () => {
    const bcrypt = require('bcryptjs');
    const espiao = jest.spyOn(bcrypt, 'compare');
    expect(await senhas.conferir('qualquer', null)).toBe(false);
    expect(await senhas.conferir('qualquer', undefined)).toBe(false);
    expect(espiao).toHaveBeenCalledTimes(2);
    espiao.mockRestore();
  });
  it('senha que não é texto nunca confere', async () => {
    const hash = await senhas.hash('uma senha longa');
    expect(await senhas.conferir(undefined, hash)).toBe(false);
    expect(await senhas.conferir({ $ne: 1 }, hash)).toBe(false);
  });
});
