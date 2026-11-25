import { act } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderizar } from './entry-server'
import { routes } from './routes'
import { ROTAS_SEO } from './seo/rotas'

// Garante que o HTML gerado no servidor bate com o que o cliente renderiza: qualquer divergência de
// hidratação aparece como console.error ou como erro recuperável do React, e o teste falha.
describe('hidratação do HTML pré-renderizado', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it.each(ROTAS_SEO.map((r) => r.caminho))('%s hidrata sem divergências', async (caminho) => {
    const html = await renderizar(caminho)
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.appendChild(container)

    const erros: unknown[] = []
    vi.spyOn(console, 'error').mockImplementation((...args) => {
      erros.push(args)
    })
    const roteador = createMemoryRouter(routes, { initialEntries: [caminho] })

    await act(async () => {
      hydrateRoot(container, <RouterProvider router={roteador} />, {
        onRecoverableError: (e) => erros.push(e),
      })
    })

    expect(erros).toEqual([])
    expect(container.querySelector('h1')).not.toBeNull()
  })
})
