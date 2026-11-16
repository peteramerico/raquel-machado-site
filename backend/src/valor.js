// Só se a chave `valor_consulta` faltar ou estiver corrompida no banco; o valor real é editado na área médica.
const VALOR_PADRAO = 400;
const MIN_CENTAVOS = 100; // R$ 1,00
const MAX_CENTAVOS = 10000000; // R$ 100.000,00

// Valor da consulta vindo do cliente. ESTRITO: só número finito ou string "450", "450.5", "450,50" (até 2 casas);
// trabalha em centavos inteiros (sem ponto flutuante) e RECUSA mais de 2 casas em vez de arredondar em silêncio.
// Devolve { ok: true, valor: 450.5, texto: '450.50' } ou { ok: false }.
function parseValor(entrada) {
  let centavos;

  if (typeof entrada === 'number') {
    if (!Number.isFinite(entrada)) return { ok: false };
    const c = entrada * 100;
    if (Math.abs(c - Math.round(c)) > 1e-6) return { ok: false }; // 1.005, 450.123…
    centavos = Math.round(c);
  } else if (typeof entrada === 'string') {
    const m = /^(\d{1,6})(?:[.,](\d{1,2}))?$/.exec(entrada.trim());
    if (!m) return { ok: false };
    centavos = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || 0);
  } else {
    return { ok: false };
  }

  if (centavos < MIN_CENTAVOS || centavos > MAX_CENTAVOS) return { ok: false };
  return { ok: true, valor: centavos / 100, texto: (centavos / 100).toFixed(2) };
}

// Valor vigente (lido de `configuracoes`). Chave ausente/corrompida/<= 0 cai no padrão, nunca em NaN/0.
async function lerValorConsulta(repo) {
  const valor = Number(await repo.lerConfig('valor_consulta'));
  return Number.isFinite(valor) && valor > 0 ? valor : VALOR_PADRAO;
}

module.exports = { parseValor, lerValorConsulta };
