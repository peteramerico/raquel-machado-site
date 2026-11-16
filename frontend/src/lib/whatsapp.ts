// Mensagem de acesso para a médica mandar à família (texto neutro, em português).
export function mensagemAcesso({ nome, login, senha, url }: { nome: string; login: string; senha: string; url: string }): string {
  const primeiro = nome.trim().split(/\s+/)[0]
  return [
    `Olá, ${primeiro}! A Dra. Raquel liberou o seu acesso à Área da família do site.`,
    '',
    `Endereço: ${url}`,
    `Usuário: ${login}`,
    `Senha temporária: ${senha}`,
    '',
    'No primeiro acesso o site pede para você criar uma senha só sua.',
  ].join('\n')
}

// Link do WhatsApp com o texto pronto; sem contato cadastrado não há link (só "Copiar mensagem").
// `contato` já vem com DDI (o servidor normaliza para 55 + DDD + número).
export function linkWhatsApp(contato: string | null, texto: string): string | null {
  return contato ? `https://wa.me/${contato}?text=${encodeURIComponent(texto)}` : null
}
