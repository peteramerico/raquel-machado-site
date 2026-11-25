// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { renderizar } from './entry-server'
import { ROTAS_SEO } from './seo/rotas'

describe('renderizar (servidor, sem window/document)', () => {
  it.each(ROTAS_SEO.map((r) => r.caminho))('%s renderiza com <h1>', async (caminho) => {
    const html = await renderizar(caminho)
    expect(html).toContain('<h1')
  })

  it('home traz o conteúdo real', async () => {
    const html = await renderizar('/')
    expect(html).toContain('Cuidado especializado')
    expect(html).toContain('CRM-RN')
  })

  it('palestra traz o iframe da apresentação e os dados do evento', async () => {
    const html = await renderizar('/palestras/sala-de-parto')
    expect(html).toContain('src="/apresentacoes/sala-de-parto/"')
    expect(html).toContain('Mesa redonda')
    expect(html).toContain('25 de novembro de 2026')
  })

  it('não embute o script de hidratação de dados (sem loaders)', async () => {
    expect(await renderizar('/')).not.toContain('__staticRouterHydrationData')
  })
})
