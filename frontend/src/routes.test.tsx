import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { routes } from './routes'

function abrir(caminho: string) {
  const router = createMemoryRouter(routes, { initialEntries: [caminho] })
  render(<RouterProvider router={router} />)
  return router
}

// Marcadores exclusivos do layout do site: o nav "Principal" (header) e o link "Área da família" no rodapé.
// (/links e /privacidade têm rodapé próprio, então `contentinfo` não serve de critério.)
const temHeader = () => screen.queryByRole('navigation', { name: 'Principal' }) !== null
const temFooter = () => screen.queryAllByRole('link', { name: 'Área da família' }).length >= 2

describe('rotas', () => {
  afterEach(() => vi.restoreAllMocks())

  it('/ tem header e footer do site', () => {
    abrir('/')
    expect(temHeader()).toBe(true)
    expect(temFooter()).toBe(true)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Cuidado especializado/)
  })

  it('/familia tem header e footer do site', () => {
    abrir('/familia')
    expect(temHeader()).toBe(true)
    expect(temFooter()).toBe(true)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Guia da consulta com a Dra. Raquel')
  })

  it('/links e /privacidade ficam sem o header/footer do site (como hoje)', () => {
    abrir('/links')
    expect(temHeader()).toBe(false)
    expect(temFooter()).toBe(false)
  })

  it('/privacidade fica sem o header/footer do site (como hoje)', () => {
    abrir('/privacidade')
    expect(temHeader()).toBe(false)
    expect(temFooter()).toBe(false)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Política de Privacidade')
  })

  it('rota desconhecida (inclusive /blog) redireciona para /', async () => {
    const router = abrir('/blog')
    expect(router.state.location.pathname).toBe('/')
    expect(temHeader()).toBe(true)
  })

  it('só uma instância do header e do footer por página', () => {
    abrir('/familia')
    expect(screen.getAllByRole('navigation', { name: 'Principal' })).toHaveLength(1)
    // header (1) + rodapé (1) = 2 links "Área da família"; se o layout duplicasse, seriam 4
    expect(screen.getAllByRole('link', { name: 'Área da família' })).toHaveLength(2)
  })
})
