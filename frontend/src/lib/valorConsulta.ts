// Fonte ÚNICA do valor da consulta. Nenhuma página escreve o preço em texto:
// todas usam useValorConsulta(). Quando existir a área médica, este hook passa a
// buscar GET /api/config/publica (valor editável lá) e cai neste padrão se a API falhar.
export const VALOR_CONSULTA_PADRAO = 400

export function formatarBRL(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

export function useValorConsulta(): number {
  return VALOR_CONSULTA_PADRAO
}
