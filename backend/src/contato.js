// WhatsApp da família (opcional). Tira a máscara; 10–11 dígitos (DDD + número) ganham o DDI 55, porque o
// wa.me exige DDI; 12–13 dígitos precisam já começar com 55. Qualquer outra coisa é inválida (nada de anular em silêncio).
function normalizarContato(entrada) {
  if (entrada === undefined || entrada === null) return { ok: true, valor: null };
  if (typeof entrada !== 'string') return { ok: false };
  if (entrada.trim() === '') return { ok: true, valor: null };

  const digitos = entrada.replace(/\D/g, '');
  if (digitos.length === 10 || digitos.length === 11) return { ok: true, valor: `55${digitos}` };
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) return { ok: true, valor: digitos };
  return { ok: false };
}

module.exports = { normalizarContato };
