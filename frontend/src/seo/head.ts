import { SITE_NOME, type RotaSeo } from './rotas'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// "<" vira "<" no JSON: impede fechar o <script> por dentro (o JSON continua equivalente).
const jsonSeguro = (o: object) => JSON.stringify(o).replace(/</g, '\\u003c')

/** Tags de <head> específicas da rota (sem <title> e sem meta description, que a shell já tem e são substituídos). */
export function montarHead(rota: RotaSeo): string {
  const linhas = [
    `<link rel="canonical" href="${esc(rota.canonical)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:locale" content="pt_BR" />`,
    `<meta property="og:site_name" content="${esc(SITE_NOME)}" />`,
    `<meta property="og:title" content="${esc(rota.titulo)}" />`,
    `<meta property="og:description" content="${esc(rota.descricao)}" />`,
    `<meta property="og:url" content="${esc(rota.canonical)}" />`,
  ]
  if (rota.imagem) linhas.push(`<meta property="og:image" content="${esc(rota.imagem)}" />`)
  for (const bloco of rota.jsonLd) linhas.push(`<script type="application/ld+json">${jsonSeguro(bloco)}</script>`)
  return linhas.join('\n    ')
}

/** Shell limpa (dist/index.html) + rota + corpo renderizado => HTML completo da página. */
export function injetarHtml(shell: string, rota: RotaSeo, corpo: string): string {
  if (!shell.includes('<div id="root"></div>')) throw new Error('A shell não tem <div id="root"></div> vazio (#root)')
  if (!/<title>[^<]*<\/title>/.test(shell)) throw new Error('A shell não tem <title>')
  if (!/<meta name="description" content="[^"]*"\s*\/?>/.test(shell)) throw new Error('A shell não tem meta description')

  return shell
    .replace(/<title>[^<]*<\/title>/, () => `<title>${esc(rota.titulo)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, () => `<meta name="description" content="${esc(rota.descricao)}" />`)
    .replace('</head>', () => `    ${montarHead(rota)}\n  </head>`)
    .replace('<div id="root"></div>', () => `<div id="root">${corpo}</div>`)
}
