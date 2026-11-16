// Formatação em reais (pt-BR). Não guarda número nenhum: o valor da consulta vem do servidor.
export function formatarBRL(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}
