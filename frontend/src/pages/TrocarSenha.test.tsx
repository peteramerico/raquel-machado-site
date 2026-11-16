import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AuthProvider from '../components/AuthProvider'
import TrocarSenha from './TrocarSenha'
import { USUARIO_PENDENTE, mockFetch } from '../testUtils'

function Local() {
  const l = useLocation()
  return <p data-testid="local">{l.pathname}</p>
}

function montar(state: unknown = { de: '/familia', area: 'familia' }) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/conta/senha', state }]}>
      <AuthProvider>
        <Routes>
          <Route path="/conta/senha" element={<TrocarSenha />} />
          <Route path="/familia" element={<Local />} />
          <Route path="/familia/entrar" element={<Local />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

async function preencher(atual = 'temp-senha-123', nova = 'minha frase nova 2026', confirma = nova) {
  await userEvent.type(await screen.findByLabelText('Senha temporária'), atual)
  await userEvent.type(screen.getByLabelText('Nova senha'), nova)
  await userEvent.type(screen.getByLabelText('Repita a nova senha'), confirma)
}

describe('TrocarSenha', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sem sessão → volta ao login da área', async () => {
    mockFetch({ 'GET /api/auth/me': { status: 401, body: {} } })
    montar()
    await waitFor(() => expect(screen.getByTestId('local')).toHaveTextContent('/familia/entrar'))
  })

  it('1º acesso: explica que a senha é temporária e mostra as regras', async () => {
    mockFetch({ 'GET /api/auth/me': { body: USUARIO_PENDENTE } })
    montar()
    expect(await screen.findByRole('heading', { level: 1, name: 'Crie sua senha' })).toBeInTheDocument()
    expect(screen.getByText(/temporária/i, { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByText(/pelo menos 10 caracteres/i)).toBeInTheDocument()
  })

  it('confirmação diferente → erro local, nada é enviado', async () => {
    const { chamadas } = mockFetch({ 'GET /api/auth/me': { body: USUARIO_PENDENTE } })
    montar()
    await preencher('temp-senha-123', 'minha frase nova 2026', 'outra coisa diferente')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/confirmação/i)
    expect(chamadas.some((c) => c.chave === 'POST /api/auth/trocar-senha')).toBe(false)
  })

  it('senha curta → erro local, nada é enviado', async () => {
    const { chamadas } = mockFetch({ 'GET /api/auth/me': { body: USUARIO_PENDENTE } })
    montar()
    await preencher('temp-senha-123', 'curta123', 'curta123')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/10 caracteres/i)
    expect(chamadas.some((c) => c.chave === 'POST /api/auth/trocar-senha')).toBe(false)
  })

  it('erro do servidor (ex.: senha atual errada) é mostrado', async () => {
    mockFetch({
      'GET /api/auth/me': { body: USUARIO_PENDENTE },
      'POST /api/auth/trocar-senha': { status: 401, body: { erro: 'Senha atual incorreta.' } },
    })
    montar()
    await preencher()
    await userEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Senha atual incorreta.')
  })

  it('sucesso: envia as senhas, recarrega a sessão e vai ao destino', async () => {
    let trocou = false
    const { chamadas } = mockFetch({
      'GET /api/auth/me': () => ({ body: { ...USUARIO_PENDENTE, precisaTrocarSenha: !trocou } }),
      'POST /api/auth/trocar-senha': () => { trocou = true; return { body: { ok: true } } },
    })
    montar()
    await preencher('temp-senha-123', 'minha frase nova 2026')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
    await waitFor(() => expect(screen.getByTestId('local')).toHaveTextContent('/familia'))
    expect(chamadas.find((c) => c.chave === 'POST /api/auth/trocar-senha')?.corpo).toEqual({ senhaAtual: 'temp-senha-123', novaSenha: 'minha frase nova 2026' })
  })

  it('destino externo no state é ignorado', async () => {
    let trocou = false
    mockFetch({
      'GET /api/auth/me': () => ({ body: { ...USUARIO_PENDENTE, precisaTrocarSenha: !trocou } }),
      'POST /api/auth/trocar-senha': () => { trocou = true; return { body: { ok: true } } },
    })
    montar({ de: '//evil.com', area: 'familia' })
    await preencher()
    await userEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
    await waitFor(() => expect(screen.getByTestId('local')).toHaveTextContent('/familia'))
  })
})
