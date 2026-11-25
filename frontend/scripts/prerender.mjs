// Gera o HTML estático das rotas públicas a partir da shell limpa (dist/index.html) e do bundle SSR (dist-server).
// Roda no `npm run build` (GitHub Actions e cron da VPS). Só Node; falha alto se algo não bater.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(raiz, 'dist')
const { renderizar, ROTAS_SEO, injetarHtml, gerarSitemap } = await import(
  pathToFileURL(join(raiz, 'dist-server', 'entry-server.js')).href
)

const shell = await readFile(join(dist, 'index.html'), 'utf8')
if (shell.includes('<h1')) throw new Error('dist/index.html já tem conteúdo: a shell precisa estar limpa')

for (const rota of ROTAS_SEO) {
  const corpo = await renderizar(rota.caminho)
  if (!corpo.includes('<h1')) throw new Error(`${rota.caminho}: renderização sem <h1>`)
  const destino = join(dist, rota.arquivo)
  await mkdir(dirname(destino), { recursive: true })
  await writeFile(destino, injetarHtml(shell, rota, corpo))
  console.log(`prerender: ${rota.caminho} -> dist/${rota.arquivo}`)
}

await writeFile(join(dist, 'sitemap.xml'), gerarSitemap(ROTAS_SEO))
console.log(`prerender: sitemap.xml com ${ROTAS_SEO.length} URLs`)
