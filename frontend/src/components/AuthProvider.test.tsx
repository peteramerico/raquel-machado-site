import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AuthProvider from './AuthProvider'
import { destinoSeguro, useAuth } from '../lib/auth'
import { USUARIO_FAMILIA, mockFetch } from '../testUtils'

function Sonda() {
  const { estado, entrar, sair } = useAuth()
  return (
    <div>
      <p data-testid="situacao">{estado.situacao}</p>
      <p data-testid="nome">{estado.situacao === 'logado' ? estado.usuario.nome : '-'}</p>
      <button onClick={() => entrar('ana', 'segredo', 'familia').catch(() => {})}>entrar</button>
      <button onClick={() => sair()}>sair</button>
    </div>
  )
}

describe('AuthProvider', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('começa "carregando" e vira "logado" quando /me responde 200', async () => {
    mockFetch({ 'GET /api/auth/me': { body: USUARIO_FAMILIA } })
    render(<AuthProvider><Sonda /></AuthProvider>)
    expect(screen.getByTestId('situacao')).toHaveTextContent('carregando')
    await waitFor(() => expect(screen.getByTestId('situacao')).toHaveTextContent('logado'))
    expect(screen.getByTestId('nome')).toHaveTextContent('Ana Souza')
  })

  it('/me 401 → "anonimo"', async () => {
    mockFetch({ 'GET /api/auth/me': { status: 401, body: { erro: 'Não autenticado.' } } })
    render(<AuthProvider><Sonda /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('situacao')).toHaveTextContent('anonimo'))
  })

  it('servidor fora do ar também cai em "anonimo" (nunca fica preso em carregando)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('x') }))
    render(<AuthProvider><Sonda /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('situacao')).toHaveTextContent('anonimo'))
  })

  it('entrar: manda login/senha/área e recarrega o usuário', async () => {
    let logado = false
    const { chamadas } = mockFetch({
      'GET /api/auth/me': () => (logado ? { body: USUARIO_FAMILIA } : { status: 401, body: {} }),
      'POST /api/auth/login': () => { logado = true; return { body: { nome: 'Ana Souza', papel: 'familia', precisaTrocarSenha: false } } },
    })
    render(<AuthProvider><Sonda /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('situacao')).toHaveTextContent('anonimo'))
    await act(async () => { screen.getByText('entrar').click() })
    await waitFor(() => expect(screen.getByTestId('situacao')).toHaveTextContent('logado'))
    expect(chamadas.find((c) => c.chave === 'POST /api/auth/login')?.corpo).toEqual({ login: 'ana', senha: 'segredo', area: 'familia' })
  })

  it('sair: chama logout e volta a "anonimo" mesmo se a chamada falhar', async () => {
    mockFetch({ 'GET /api/auth/me': { body: USUARIO_FAMILIA }, 'POST /api/auth/logout': { status: 500, body: {} } })
    render(<AuthProvider><Sonda /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('situacao')).toHaveTextContent('logado'))
    await act(async () => { screen.getByText('sair').click() })
    await waitFor(() => expect(screen.getByTestId('situacao')).toHaveTextContent('anonimo'))
  })
})

describe('destinoSeguro (anti redirecionamento aberto)', () => {
  it('aceita só caminhos internos', () => {
    expect(destinoSeguro('/familia', '/x')).toBe('/familia')
    expect(destinoSeguro('/familia?a=1#b', '/x')).toBe('/familia?a=1#b')
  })
  it.each(['//evil.com', 'https://evil.com', '/\\evil.com', 'javascript:alert(1)', '', undefined, 42, null])('recusa %s', (ruim) => {
    expect(destinoSeguro(ruim, '/padrao')).toBe('/padrao')
  })
})
