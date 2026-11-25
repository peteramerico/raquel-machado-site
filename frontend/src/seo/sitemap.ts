import type { RotaSeo } from './rotas'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Só <loc>: o Google ignora changefreq/priority e desconfia de lastmod que muda a cada build.
export function gerarSitemap(rotas: readonly RotaSeo[]): string {
  const urls = rotas.map((r) => `  <url>\n    <loc>${esc(r.canonical)}</loc>\n  </url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}
