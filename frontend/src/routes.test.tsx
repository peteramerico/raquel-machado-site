import { render, screen, waitFor } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { routes } from './routes'
import { GUIA_TESTE, USUARIO_FAMILIA, USUARIO_MEDICA, mockFetch } from './testUtils'

function abrir(caminho: string) {
  const router = createMemoryRouter(routes, { initialEntries: [caminho] })
  render(<RouterProvider router={router} />)
  return router
}

// Marcadores exclusivos do layout do site: o nav "Principal" (header) e o link "Área da família" no rodapé.
// (/links e /privacidade têm rodapé próprio, então `contentinfo` não serve de critério.)
const temHeader = () => screen.queryByRole('navigation', { name: 'Principal' }) !== null
const temFooter = () => screen.queryAllByRole('link', { name: 'Área da família' }).length >= 2

describe('rotas públicas', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('/ tem header e footer e NÃO consulta a sessão (/api/auth/me só nas áreas restritas)', () => {
    const { fn } = mockFetch({})
    abrir('/')
    expect(temHeader()).toBe(true)
    expect(temFooter()).toBe(true)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Cuidado especializado/)
    expect(fn).not.toHaveBeenCalled()
  })

  it('/links e /privacidade ficam sem o header/footer do site e sem chamar a API', () => {
    const { fn } = mockFetch({})
    abrir('/links')
    expect(temHeader()).toBe(false)
    expect(temFooter()).toBe(false)
    expect(fn).not.toHaveBeenCalled()
  })

  it('/privacidade fica sem o header/footer do site', () => {
    mockFetch({})
    abrir('/privacidade')
    expect(temHeader()).toBe(false)
    expect(temFooter()).toBe(false)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Política de Privacidade')
  })

  it('rota desconhecida (inclusive /blog) redireciona para /', () => {
    mockFetch({})
    const router = abrir('/blog')
    expect(router.state.location.pathname).toBe('/')
    expect(temHeader()).toBe(true)
  })
})

describe('áreas restritas', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('/familia sem sessão vai para /familia/entrar (com header e rodapé do site)', async () => {
    mockFetch({ 'GET /api/auth/me': { status: 401, body: {} } })
    const router = abrir('/familia')
    await waitFor(() => expect(router.state.location.pathname).toBe('/familia/entrar'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Área da família' })).toBeInTheDocument()
    expect(temHeader()).toBe(true)
    expect(temFooter()).toBe(true)
  })

  it('/familia com sessão mostra o guia vindo da API', async () => {
    mockFetch({
      'GET /api/auth/me': { body: USUARIO_FAMILIA },
      'GET /api/familia/guia': { body: { guia: GUIA_TESTE, valorConsulta: 450 } },
    })
    abrir('/familia')
    expect(await screen.findByRole('heading', { level: 1, name: 'Guia da consulta com a Dra. Raquel' })).toBeInTheDocument()
    expect(temHeader()).toBe(true)
  })

  it('o guia NUNCA é pedido sem passar pela guarda (anônimo não dispara /api/familia/guia)', async () => {
    const { chamadas } = mockFetch({ 'GET /api/auth/me': { status: 401, body: {} } })
    const router = abrir('/familia')
    await waitFor(() => expect(router.state.location.pathname).toBe('/familia/entrar'))
    expect(chamadas.some((c) => c.chave === 'GET /api/familia/guia')).toBe(false)
  })

  it('uma instância só do header e do footer por página', async () => {
    mockFetch({ 'GET /api/auth/me': { status: 401, body: {} } })
    abrir('/familia/entrar')
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getAllByRole('navigation', { name: 'Principal' })).toHaveLength(1)
    expect(screen.getAllByRole('link', { name: 'Área da família' })).toHaveLength(2)
  })
})

describe('área médica (/painel)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('/painel sem sessão vai para /painel/entrar (título "Área médica")', async () => {
    mockFetch({ 'GET /api/auth/me': { status: 401, body: {} } })
    const router = abrir('/painel')
    await waitFor(() => expect(router.state.location.pathname).toBe('/painel/entrar'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Área médica' })).toBeInTheDocument()
  })

  it('família logada em /painel vê "Acesso restrito" e NÃO dispara chamadas do painel', async () => {
    const { chamadas } = mockFetch({ 'GET /api/auth/me': { body: USUARIO_FAMILIA } })
    abrir('/painel')
    expect(await screen.findByRole('heading', { name: 'Acesso restrito' })).toBeInTheDocument()
    expect(chamadas.some((c) => c.chave.includes('/api/painel'))).toBe(false)
  })

  it('médica logada vê o painel com as abas e a lista de famílias', async () => {
    mockFetch({
      'GET /api/auth/me': { body: USUARIO_MEDICA },
      'GET /api/painel/familias': { body: { itens: [], truncada: false } },
    })
    abrir('/painel')
    expect(await screen.findByRole('heading', { level: 1, name: 'Área médica' })).toBeInTheDocument()
    const abas = screen.getByRole('navigation', { name: 'Seções da área médica' })
    expect(abas).toHaveTextContent('Famílias')
    expect(abas).toHaveTextContent('Valor da consulta')
    expect(await screen.findByRole('heading', { level: 2, name: 'Famílias' })).toBeInTheDocument()
  })

  it('/painel/valor mostra a edição do valor da consulta', async () => {
    mockFetch({
      'GET /api/auth/me': { body: USUARIO_MEDICA },
      'GET /api/painel/config': { body: { valorConsulta: 450 } },
    })
    abrir('/painel/valor')
    expect(await screen.findByRole('heading', { level: 2, name: 'Valor da consulta' })).toBeInTheDocument()
  })

  it('a médica também entra na área da família (hierarquia)', async () => {
    mockFetch({
      'GET /api/auth/me': { body: USUARIO_MEDICA },
      'GET /api/familia/guia': { body: { guia: GUIA_TESTE, valorConsulta: 450 } },
    })
    abrir('/familia')
    expect(await screen.findByRole('heading', { level: 1, name: 'Guia da consulta com a Dra. Raquel' })).toBeInTheDocument()
  })
})
