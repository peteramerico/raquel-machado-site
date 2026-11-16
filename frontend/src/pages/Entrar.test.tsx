import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AuthProvider from '../components/AuthProvider'
import Entrar from './Entrar'
import { USUARIO_FAMILIA, mockFetch } from '../testUtils'

function Local() {
  const l = useLocation()
  return <p data-testid="local">{l.pathname}</p>
}

function montar(estadoInicial?: unknown, area: 'familia' | 'painel' | 'admin' = 'familia') {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/entrar', state: estadoInicial }]}>
      <AuthProvider>
        <Routes>
          <Route path="/entrar" element={<Entrar area={area} />} />
          <Route path="/familia" element={<Local />} />
          <Route path="/painel" element={<Local />} />
          <Route path="/conta/senha" element={<Local />} />
          <Route path="/outra" element={<Local />} />
          <Route path="/" element={<Local />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

async function preencher(login = 'ana', senha = 'minha-senha-1') {
  await userEvent.type(await screen.findByLabelText('Usuário'), login)
  await userEvent.type(screen.getByLabelText('Senha'), senha)
}

describe('Entrar', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    document.head.querySelector('meta[name="robots"]')?.remove()
  })

  it('mostra o título da área e marca noindex', async () => {
    mockFetch({ 'GET /api/auth/me': { status: 401, body: {} } })
    montar()
    expect(await screen.findByRole('heading', { level: 1, name: 'Área da família' })).toBeInTheDocument()
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
  })

  it('o título muda por área', async () => {
    mockFetch({ 'GET /api/auth/me': { status: 401, body: {} } })
    montar(undefined, 'painel')
    expect(await screen.findByRole('heading', { level: 1, name: 'Área médica' })).toBeInTheDocument()
  })

  it('envia usuário, senha e a ÁREA para o login', async () => {
    let logado = false
    const { chamadas } = mockFetch({
      'GET /api/auth/me': () => (logado ? { body: USUARIO_FAMILIA } : { status: 401, body: {} }),
      'POST /api/auth/login': () => { logado = true; return { body: { nome: 'Ana Souza', papel: 'familia', precisaTrocarSenha: false } } },
    })
    montar()
    await preencher('  ana ', 'minha-senha-1')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(screen.getByTestId('local')).toHaveTextContent('/familia'))
    expect(chamadas.find((c) => c.chave === 'POST /api/auth/login')?.corpo).toEqual({ login: 'ana', senha: 'minha-senha-1', area: 'familia' })
  })

  it('depois de entrar volta ao destino que a guarda guardou (caminho interno)', async () => {
    let logado = false
    mockFetch({
      'GET /api/auth/me': () => (logado ? { body: USUARIO_FAMILIA } : { status: 401, body: {} }),
      'POST /api/auth/login': () => { logado = true; return { body: { nome: 'Ana', papel: 'familia', precisaTrocarSenha: false } } },
    })
    montar({ de: '/outra' })
    await preencher()
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(screen.getByTestId('local')).toHaveTextContent('/outra'))
  })

  it('destino externo no state é ignorado (anti redirecionamento aberto)', async () => {
    let logado = false
    mockFetch({
      'GET /api/auth/me': () => (logado ? { body: USUARIO_FAMILIA } : { status: 401, body: {} }),
      'POST /api/auth/login': () => { logado = true; return { body: { nome: 'Ana', papel: 'familia', precisaTrocarSenha: false } } },
    })
    montar({ de: 'https://evil.com/x' })
    await preencher()
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(screen.getByTestId('local')).toHaveTextContent('/familia'))
  })

  it('senha temporária → vai para /conta/senha', async () => {
    let logado = false
    mockFetch({
      'GET /api/auth/me': () => (logado ? { body: { ...USUARIO_FAMILIA, precisaTrocarSenha: true } } : { status: 401, body: {} }),
      'POST /api/auth/login': () => { logado = true; return { body: { nome: 'Ana', papel: 'familia', precisaTrocarSenha: true } } },
    })
    montar()
    await preencher()
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(screen.getByTestId('local')).toHaveTextContent('/conta/senha'))
  })

  it('401: mostra o erro do servidor, limpa a senha e mantém o usuário', async () => {
    mockFetch({
      'GET /api/auth/me': { status: 401, body: {} },
      'POST /api/auth/login': { status: 401, body: { erro: 'Usuário ou senha incorretos.' } },
    })
    montar()
    await preencher('ana', 'errada-123')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Usuário ou senha incorretos.')
    expect(screen.getByLabelText('Senha')).toHaveValue('')
    expect(screen.getByLabelText('Usuário')).toHaveValue('ana')
  })

  it('429: mostra a mensagem de espera', async () => {
    mockFetch({
      'GET /api/auth/me': { status: 401, body: {} },
      'POST /api/auth/login': { status: 429, body: { erro: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' } },
    })
    montar()
    await preencher()
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/muitas tentativas/i)
  })

  it('403 de área errada mostra a explicação do servidor', async () => {
    mockFetch({
      'GET /api/auth/me': { status: 401, body: {} },
      'POST /api/auth/login': { status: 403, body: { erro: 'Este acesso pertence a outra área do site.', codigo: 'area_errada' } },
    })
    montar(undefined, 'painel')
    await preencher()
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/outra área/i)
  })

  it('o botão só habilita com usuário e senha preenchidos; Mostrar/Ocultar alterna o campo', async () => {
    mockFetch({ 'GET /api/auth/me': { status: 401, body: {} } })
    montar()
    const entrar = await screen.findByRole('button', { name: 'Entrar' })
    expect(entrar).toBeDisabled()
    await preencher()
    expect(entrar).toBeEnabled()
    const campo = screen.getByLabelText('Senha')
    expect(campo).toHaveAttribute('type', 'password')
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar' }))
    expect(campo).toHaveAttribute('type', 'text')
  })

  it('quem já está logado é levado direto ao destino', async () => {
    mockFetch({ 'GET /api/auth/me': { body: USUARIO_FAMILIA } })
    montar()
    await waitFor(() => expect(screen.getByTestId('local')).toHaveTextContent('/familia'))
  })

  it('tem o link de ajuda por WhatsApp (sem recuperação por e-mail nesta fase)', async () => {
    mockFetch({ 'GET /api/auth/me': { status: 401, body: {} } })
    montar()
    expect(await screen.findByRole('link', { name: /Fale com a Dra. Raquel/ })).toHaveAttribute('href', 'https://wa.me/5584996770404')
  })
})
