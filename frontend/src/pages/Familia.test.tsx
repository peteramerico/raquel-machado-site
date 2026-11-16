import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AuthProvider from '../components/AuthProvider'
import Familia from './Familia'
import { GUIA_TESTE, USUARIO_FAMILIA, mockFetch } from '../testUtils'

function montar() {
  return render(
    <MemoryRouter initialEntries={['/familia']}>
      <AuthProvider>
        <Familia />
      </AuthProvider>
    </MemoryRouter>,
  )
}

const ME_OK = { 'GET /api/auth/me': { body: USUARIO_FAMILIA } }

describe('Familia (guia vindo da API)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    document.head.querySelector('meta[name="robots"]')?.remove()
  })

  it('mostra "Carregando" e depois o guia', async () => {
    mockFetch({ ...ME_OK, 'GET /api/familia/guia': { body: { guia: GUIA_TESTE, valorConsulta: 450 } } })
    montar()
    expect(screen.getByRole('status')).toHaveTextContent(/carregando/i)
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Guia da consulta com a Dra. Raquel')
  })

  it('renderiza os 7 capítulos e os atalhos para as âncoras', async () => {
    mockFetch({ ...ME_OK, 'GET /api/familia/guia': { body: { guia: GUIA_TESTE, valorConsulta: 450 } } })
    montar()
    await screen.findByRole('heading', { level: 1 })
    const indice = screen.getByRole('navigation', { name: 'Neste guia' })
    for (const c of GUIA_TESTE.capitulos) {
      expect(screen.getByRole('heading', { level: 2, name: c.titulo })).toBeInTheDocument()
      expect(within(indice).getByRole('link', { name: new RegExp(c.rotulo) })).toHaveAttribute('href', `#${c.id}`)
    }
  })

  it('mostra as 6 faixas do calendário, o checklist e a urgência', async () => {
    mockFetch({ ...ME_OK, 'GET /api/familia/guia': { body: { guia: GUIA_TESTE, valorConsulta: 450 } } })
    montar()
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getAllByRole('listitem').filter((li) => li.hasAttribute('data-faixa'))).toHaveLength(6)
    for (const item of GUIA_TESTE.trazer.itens) expect(screen.getByText(item.titulo)).toBeInTheDocument()
    expect(screen.getByText('Em caso de urgência, procurem um pronto atendimento.')).toBeInTheDocument()
  })

  it('o valor vem da API (e acompanha mudanças), formatado em reais', async () => {
    mockFetch({ ...ME_OK, 'GET /api/familia/guia': { body: { guia: GUIA_TESTE, valorConsulta: 512.5 } } })
    montar()
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByText(/^R\$\s512,50$/)).toBeInTheDocument()
  })

  it('mostra "Olá, <primeiro nome>" e o botão Sair', async () => {
    mockFetch({ ...ME_OK, 'GET /api/familia/guia': { body: { guia: GUIA_TESTE, valorConsulta: 450 } } })
    montar()
    await screen.findByRole('heading', { level: 1 })
    expect(await screen.findByText('Olá, Ana')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument()
  })

  it('erro do servidor → mensagem e "Tentar de novo", que busca outra vez', async () => {
    let falhar = true
    const { chamadas } = mockFetch({
      ...ME_OK,
      'GET /api/familia/guia': () => (falhar ? { status: 500, body: { erro: 'Erro interno. Tente novamente em instantes.' } } : { body: { guia: GUIA_TESTE, valorConsulta: 450 } }),
    })
    montar()
    expect(await screen.findByRole('alert')).toHaveTextContent(/erro interno/i)
    falhar = false
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(chamadas.filter((c) => c.chave === 'GET /api/familia/guia')).toHaveLength(2)
  })

  it('401 (sessão caiu) → consulta a sessão de novo e não mostra erro nem guia', async () => {
    const { chamadas } = mockFetch({ 'GET /api/auth/me': { status: 401, body: {} }, 'GET /api/familia/guia': { status: 401, body: { erro: 'Sessão inválida ou expirada.' } } })
    montar()
    await waitFor(() => expect(chamadas.filter((c) => c.chave === 'GET /api/auth/me').length).toBeGreaterThanOrEqual(2))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })

  it('marca a página como noindex', async () => {
    mockFetch({ ...ME_OK, 'GET /api/familia/guia': { body: { guia: GUIA_TESTE, valorConsulta: 450 } } })
    montar()
    await screen.findByRole('heading', { level: 1 })
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
    expect(document.title).toMatch(/Guia da consulta/)
  })
})
