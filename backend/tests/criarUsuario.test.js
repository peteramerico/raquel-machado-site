const { executar } = require('../src/bin/criar-usuario');
const { criarSenhas } = require('../src/senhas');
const { criarRepoFalso, semear } = require('./helpers/repoFalso');

const senhas = criarSenhas({ cost: 4 });

function rodar(argv, repo) {
  const saida = [];
  const erros = [];
  return executar(argv, { repo, senhas, saida: (l) => saida.push(l), erro: (l) => erros.push(l) })
    .then((codigo) => ({ codigo, saida: saida.join('\n'), erros: erros.join('\n') }));
}

describe('CLI criar-usuario', () => {
  it('cria a conta com senha temporária (12 caracteres), impressa UMA vez, com troca obrigatória', async () => {
    const repo = criarRepoFalso();
    const r = await rodar(['--papel', 'admin', '--login', 'peter', '--nome', 'Peter Américo'], repo);
    expect(r.codigo).toBe(0);
    const u = repo._usuarios[0];
    expect(u).toMatchObject({ login: 'peter', nome: 'Peter Américo', papel: 'admin', precisaTrocarSenha: true, ativo: true });
    const achadas = r.saida.match(/[abcdefghjkmnpqrstuvwxyz23456789]{12}/g) || [];
    expect(achadas).toHaveLength(1);
    expect(u.senhaHash).not.toContain(achadas[0]);
    expect(await senhas.conferir(achadas[0], u.senhaHash)).toBe(true);
    expect(r.saida).toMatch(/uma única vez/i);
  });

  it('login normalizado e contato opcional gravado', async () => {
    const repo = criarRepoFalso();
    await rodar(['--papel', 'familia', '--login', 'Maria', '--nome', 'Maria Souza', '--contato', '5584999990000'], repo);
    expect(repo._usuarios[0]).toMatchObject({ login: 'maria', contato: '5584999990000', papel: 'familia' });
  });

  it('login duplicado → código 1 e mensagem clara, sem senha em lugar nenhum', async () => {
    const repo = criarRepoFalso();
    await semear(repo, senhas, { login: 'raquel', papel: 'medica' });
    const r = await rodar(['--papel', 'medica', '--login', 'raquel', '--nome', 'Outra'], repo);
    expect(r.codigo).toBe(1);
    expect(r.erros).toMatch(/já existe/i);
    expect(r.saida).not.toMatch(/[abcdefghjkmnpqrstuvwxyz23456789]{12}/);
  });

  it('entradas inválidas → código 1 (papel, login curto/estranho, nome ausente)', async () => {
    const repo = criarRepoFalso();
    for (const argv of [
      ['--papel', 'superuser', '--login', 'abc', '--nome', 'X Y'],
      ['--papel', 'admin', '--login', 'ab', '--nome', 'X Y'],
      ['--papel', 'admin', '--login', 'com espaço', '--nome', 'X Y'],
      ['--papel', 'admin', '--login', 'valido'],
      [],
    ]) {
      const r = await rodar(argv, repo);
      expect(r.codigo).toBe(1);
      expect(r.erros).toBeTruthy();
    }
    expect(repo._usuarios).toHaveLength(0);
  });

  it('--redefinir gera nova temporária, exige troca e derruba as sessões (versão +1)', async () => {
    const repo = criarRepoFalso();
    const u = await semear(repo, senhas, { login: 'ana', papel: 'familia', precisaTrocarSenha: false });
    const antes = repo._usuarios[0].senhaHash;
    const r = await rodar(['--redefinir', '--login', 'ana'], repo);
    expect(r.codigo).toBe(0);
    const depois = repo._usuarios[0];
    expect(depois.senhaHash).not.toBe(antes);
    expect(depois.precisaTrocarSenha).toBe(true);
    expect(depois.sessaoVersao).toBe(2);
    const temp = (r.saida.match(/[abcdefghjkmnpqrstuvwxyz23456789]{12}/g) || [])[0];
    expect(await senhas.conferir(temp, depois.senhaHash)).toBe(true);
    expect(await senhas.conferir(u.senha, depois.senhaHash)).toBe(false);
  });

  it('--reativar destrava conta desativada (runbook de recuperação) e derruba sessões antigas', async () => {
    const repo = criarRepoFalso();
    const u = await semear(repo, senhas, { login: 'raquel', papel: 'medica', ativo: false });
    const r = await rodar(['--reativar', '--login', 'raquel'], repo);
    expect(r.codigo).toBe(0);
    expect(r.saida).toMatch(/reativada/i);
    const depois = repo._usuarios.find((x) => x.id === u.id);
    expect(depois.ativo).toBe(true);
    expect(depois.sessaoVersao).toBe(2);
  });

  it('--reativar de conta já ativa não mexe na sessão; de inexistente → código 1', async () => {
    const repo = criarRepoFalso();
    await semear(repo, senhas, { login: 'raquel', papel: 'medica' });
    const r = await rodar(['--reativar', '--login', 'raquel'], repo);
    expect(r.codigo).toBe(0);
    expect(r.saida).toMatch(/já estava ativa/i);
    expect(repo._usuarios[0].sessaoVersao).toBe(1);
    expect((await rodar(['--reativar', '--login', 'fantasma'], repo)).codigo).toBe(1);
  });

  it('--redefinir de login inexistente → código 1', async () => {
    const r = await rodar(['--redefinir', '--login', 'fantasma'], criarRepoFalso());
    expect(r.codigo).toBe(1);
    expect(r.erros).toMatch(/não encontrado/i);
  });
});
