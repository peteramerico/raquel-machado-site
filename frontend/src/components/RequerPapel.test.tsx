import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AuthProvider from './AuthProvider'
import RequerPapel from './RequerPapel'
import { USUARIO_FAMILIA, USUARIO_MEDICA, USUARIO_PENDENTE, mockFetch } from '../testUtils'

function Local() {
  const l = useLocation()
  return <p data-testid="local">{l.pathname}{l.search}</p>
}

function montar(area: 'familia' | 'painel' | 'admin', inicial = '/protegida?x=1') {
  return render(
    <MemoryRouter initialEntries={[inicial]}>
      <AuthProvider>
        <Routes>
          <Route element={<RequerPapel area={area} />}>
            <Route path="/protegida" element={<p>conteúdo protegido</p>} />
          </Route>
          <Route path="/familia/entrar" element={<Local />} />
          <Route path="/painel/entrar" element={<Local />} />
          <Route path="/conta/senha" element={<Local />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('RequerPapel', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('enquanto consulta a sessão mostra "Carregando" (nunca o conteúdo)', () => {
    mockFetch({ 'GET /api/auth/me': { body: USUARIO_FAMILIA } })
    montar('familia')
    expect(screen.getByRole('status')).toHaveTextContent(/carregando/i)
    expect(screen.queryByText('conteúdo protegido')).not.toBeInTheDocument()
  })

  it('sem sessão → vai para o login da própria área', async () => {
    mockFetch({ 'GET /api/auth/me': { status: 401, body: {} } })
    montar('familia')
    await waitFor(() => expect(screen.getByTestId('local')).toHaveTextContent('/familia/entrar'))
    expect(screen.queryByText('conteúdo protegido')).not.toBeInTheDocument()
  })

  it('o login de cada área é o certo (painel → /painel/entrar)', async () => {
    mockFetch({ 'GET /api/auth/me': { status: 401, body: {} } })
    montar('painel')
    await waitFor(() => expect(screen.getByTestId('local')).toHaveTextContent('/painel/entrar'))
  })

  it('senha temporária pendente → /conta/senha', async () => {
    mockFetch({ 'GET /api/auth/me': { body: USUARIO_PENDENTE } })
    montar('familia')
    await waitFor(() => expect(screen.getByTestId('local')).toHaveTextContent('/conta/senha'))
  })

  it('papel suficiente → renderiza a rota filha', async () => {
    mockFetch({ 'GET /api/auth/me': { body: USUARIO_FAMILIA } })
    montar('familia')
    expect(await screen.findByText('conteúdo protegido')).toBeInTheDocument()
  })

  it('hierarquia: médica entra na área da família', async () => {
    mockFetch({ 'GET /api/auth/me': { body: USUARIO_MEDICA } })
    montar('familia')
    expect(await screen.findByText('conteúdo protegido')).toBeInTheDocument()
  })

  it('papel insuficiente (família no painel) → "Acesso restrito" com Sair, sem o conteúdo', async () => {
    mockFetch({ 'GET /api/auth/me': { body: USUARIO_FAMILIA } })
    montar('painel')
    expect(await screen.findByRole('heading', { name: 'Acesso restrito' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument()
    expect(screen.queryByText('conteúdo protegido')).not.toBeInTheDocument()
  })
})
