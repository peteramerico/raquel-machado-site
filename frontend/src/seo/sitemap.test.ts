import { describe, expect, it } from 'vitest'
import { ROTAS_SEO } from './rotas'
import { gerarSitemap } from './sitemap'

describe('gerarSitemap', () => {
  const xml = gerarSitemap(ROTAS_SEO)

  it('cabeçalho XML e namespace do sitemap', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
  })

  it('uma <loc> por rota do mapa, com a URL canônica', () => {
    for (const r of ROTAS_SEO) expect(xml).toContain(`<loc>${r.canonical}</loc>`)
    expect(xml.match(/<loc>/g)).toHaveLength(ROTAS_SEO.length)
  })

  it('escapa caracteres especiais', () => {
    const x = gerarSitemap([{ ...ROTAS_SEO[0], canonical: 'https://a.com/?a=1&b=2' }])
    expect(x).toContain('<loc>https://a.com/?a=1&amp;b=2</loc>')
  })
})
