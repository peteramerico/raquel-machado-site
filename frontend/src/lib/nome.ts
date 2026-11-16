// Primeiro nome para saudações: ignora títulos no início ("Dra. Maria Souza" → "Maria", "Dr João" → "João").
export function primeiroNome(nome: string): string {
  const semTitulo = nome.trim().replace(/^(?:dra?|doutora?|prof|profa)\.?\s+/i, '')
  const primeiro = semTitulo.split(/\s+/)[0]
  return primeiro || nome.trim()
}
