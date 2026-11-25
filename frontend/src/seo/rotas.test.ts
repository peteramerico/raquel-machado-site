import { describe, expect, it } from 'vitest'
import { PALESTRAS } from '../content/palestras'
import { ROTAS_SEO, SITE_URL, arquivoDe, buscarSeo } from './rotas'

describe('mapa de rotas SEO', () => {
  it('cobre as rotas públicas e as palestras do conteúdo', () => {
    const caminhos = ROTAS_SEO.map((r) => r.caminho)
    expect(caminhos).toEqual(
      expect.arrayContaining(['/', '/palestras', '/links', '/privacidade', ...PALESTRAS.map((p) => `/palestras/${p.slug}`)]),
    )
  })

  it('nunca inclui áreas com login', () => {
    for (const r of ROTAS_SEO) expect(r.caminho).not.toMatch(/^\/(familia|painel|admin|conta)/)
  })

  it('título ≤ 70, descrição entre 50 e 160, únicos', () => {
    for (const r of ROTAS_SEO) {
      expect(r.titulo.length, r.caminho).toBeLessThanOrEqual(70)
      expect(r.descricao.length, r.caminho).toBeGreaterThanOrEqual(50)
      expect(r.descricao.length, r.caminho).toBeLessThanOrEqual(160)
    }
    expect(new Set(ROTAS_SEO.map((r) => r.titulo)).size).toBe(ROTAS_SEO.length)
    expect(new Set(ROTAS_SEO.map((r) => r.descricao)).size).toBe(ROTAS_SEO.length)
  })

  it('canonical absoluto no apex (sem www)', () => {
    for (const r of ROTAS_SEO) {
      expect(r.canonical.startsWith(`${SITE_URL}/`)).toBe(true)
      expect(r.canonical).not.toContain('www.')
    }
    expect(buscarSeo('/')?.canonical).toBe(`${SITE_URL}/`)
    expect(buscarSeo('/palestras/sala-de-parto')?.canonical).toBe(`${SITE_URL}/palestras/sala-de-parto`)
  })

  it('arquivo de saída: / vira inicio.html e os demais seguem o caminho', () => {
    expect(arquivoDe('/')).toBe('inicio.html')
    expect(arquivoDe('/palestras')).toBe('palestras.html')
    expect(arquivoDe('/palestras/sala-de-parto')).toBe('palestras/sala-de-parto.html')
    expect(new Set(ROTAS_SEO.map((r) => r.arquivo)).size).toBe(ROTAS_SEO.length)
  })
})

describe('JSON-LD', () => {
  const home = buscarSeo('/')!
  const grafo = home.jsonLd[0] as { '@context': string; '@graph': Array<Record<string, unknown>> }

  it('home: Physician com CRM-RN 9383 e duas clínicas', () => {
    expect(grafo['@context']).toBe('https://schema.org')
    const tipos = grafo['@graph'].map((n) => n['@type'])
    expect(tipos).toEqual(['Physician', 'MedicalClinic', 'MedicalClinic'])
    const medica = grafo['@graph'][0] as { identifier: { propertyID: string; value: string } }
    expect(medica.identifier).toMatchObject({ propertyID: 'CRM-RN', value: '9383' })
  })

  it('home: clínicas com endereço e telefone dos WhatsApps do site', () => {
    const clinicas = grafo['@graph'].slice(1) as Array<{ name: string; telephone: string; address: { addressLocality: string } }>
    expect(clinicas.map((c) => c.name)).toEqual(['Clínica Cativa', 'Fábrica do Amanhã'])
    expect(clinicas.map((c) => c.telephone)).toEqual(['+5584996770404', '+5584992215656'])
    for (const c of clinicas) expect(c.address.addressLocality).toBe('Natal')
  })

  it('nenhuma rota usa avaliações escritas pelo próprio site', () => {
    const tudo = JSON.stringify(ROTAS_SEO.map((r) => r.jsonLd))
    expect(tudo).not.toMatch(/aggregateRating|"Review"/)
  })

  it('palestras: BreadcrumbList com posições 1..n e URLs absolutas', () => {
    const pagina = buscarSeo('/palestras/sala-de-parto')!
    const lista = pagina.jsonLd[0] as { '@type': string; itemListElement: Array<{ position: number; item: string }> }
    expect(lista['@type']).toBe('BreadcrumbList')
    expect(lista.itemListElement.map((i) => i.position)).toEqual([1, 2, 3])
    for (const i of lista.itemListElement) expect(i.item.startsWith(SITE_URL)).toBe(true)
  })
})
