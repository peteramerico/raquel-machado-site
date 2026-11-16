// O valor da consulta é um DADO (tabela configuracoes, editável na área médica) — nunca texto de página.
// Este guarda varre o código de produção do frontend e do backend e falha se o preço antigo reaparecer escrito.
const fs = require('fs');
const path = require('path');

const RAIZES = [
  path.join(__dirname, '..', 'src'),
  path.join(__dirname, '..', '..', 'frontend', 'src'),
];
const EXTENSOES = /\.(js|ts|tsx|css|html)$/;
const IGNORAR = /(\.test\.|testUtils|[\\/]src[\\/]src[\\/])/; // testes e a cópia antiga ignorada pelo git
const PRECO = /R\$\s*400|400,00/;

function listar(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const caminho = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : listar(caminho);
    return EXTENSOES.test(e.name) ? [caminho] : [];
  });
}

describe('preço fixo no código', () => {
  it('as duas bases de código existem (o teste não passa por engano varrendo nada)', () => {
    for (const raiz of RAIZES) expect(fs.existsSync(raiz)).toBe(true);
    expect(RAIZES.flatMap(listar).length).toBeGreaterThan(20);
  });

  it('nenhum arquivo de produção escreve o preço (R$ 400 / 400,00)', () => {
    const ofensores = RAIZES.flatMap(listar)
      .filter((f) => !IGNORAR.test(f))
      .filter((f) => PRECO.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(path.join(__dirname, '..', '..'), f));
    expect(ofensores).toEqual([]);
  });
});
