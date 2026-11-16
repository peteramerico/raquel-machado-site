import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AuthProvider from '../../components/AuthProvider'
import AdminUsuarios from './AdminUsuarios'
import { USUARIO_ADMIN, mockFetch } from '../../testUtils'

const base = { contato: null, ativo: true, precisaTrocarSenha: false, ultimoAcessoEm: '2026-11-10T14:30:00.000Z', criadoEm: '2026-11-01T10:00:00.000Z', voce: false }
const PETER = { ...base, id: 1, login: 'peter', nome: 'Peter Américo', papel: 'admin', voce: true }
const OUTRO = { ...base, id: 2, login: 'segundo', nome: 'Segundo Admin', papel: 'admin' }
const RAQUEL = { ...base, id: 3, login: 'raquel', nome: 'Raquel Machado', papel: 'medica' }
const ANA = { ...base, id: 4, login: 'ana', nome: 'Ana Souza', papel: 'familia', contato: '5584999990000' }
const DESATIVADA = { ...base, id: 5, login: 'dra2', nome: 'Dra. Antiga', papel: 'medica', ativo: false }

const ME = { 'GET /api/auth/me': { body: USUARIO_ADMIN } }
const lista = (itens: unknown[], truncada = false) => ({ 'GET /api/admin/usuarios': { body: { itens, truncada } } })

function montar() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <AdminUsuarios />
      </AuthProvider>
    </MemoryRouter>,
  )
}

const cartaoDe = async (nome: string) => (await screen.findByRole('heading', { level: 3, name: new RegExp(nome) })).closest('li') as HTMLElement

describe('AdminUsuarios', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('lista a equipe com papel, usuário e estado; famílias ficam recolhidas', async () => {
    mockFetch({ ...ME, ...lista([PETER, OUTRO, RAQUEL, DESATIVADA, ANA]) })
    montar()
    expect(await screen.findByRole('heading', { level: 3, name: /Raquel Machado/ })).toBeInTheDocument()
    const raquel = await cartaoDe('Raquel Machado')
    expect(within(raquel).getByText('Médica')).toBeInTheDocument()
    expect(within(raquel).getByText('Ativa')).toBeInTheDocument()
    expect(within(await cartaoDe('Dra. Antiga')).getByText('Desativada')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 3, name: 'Ana Souza' })).not.toBeInTheDocument() // recolhida
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar famílias (1)' }))
    expect(await screen.findByRole('heading', { level: 3, name: 'Ana Souza' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar famílias' }))
    expect(screen.queryByRole('heading', { level: 3, name: 'Ana Souza' })).not.toBeInTheDocument()
  })

  it('a linha "Você" não oferece ações (sem autolockout)', async () => {
    mockFetch({ ...ME, ...lista([PETER, OUTRO]) })
    montar()
    const eu = await cartaoDe('Peter Américo')
    expect(within(eu).getByText('Você')).toBeInTheDocument()
    expect(within(eu).queryByRole('button')).not.toBeInTheDocument()
    expect(within(await cartaoDe('Segundo Admin')).getByRole('button', { name: 'Nova senha' })).toBeInTheDocument()
  })

  it('Nova conta (médica): envia {nome, login, papel}, mostra as credenciais SEM WhatsApp e com o login da Área médica', async () => {
    const { chamadas } = mockFetch({
      ...ME,
      ...lista([PETER]),
      'POST /api/admin/usuarios': { status: 201, body: { id: 9, login: 'dra.maria', nome: 'Dra. Maria', papel: 'medica', senhaTemporaria: 'k7m2p9x4q8hn' } },
    })
    const user = userEvent.setup()
    montar()
    await user.click(await screen.findByRole('button', { name: 'Nova conta' }))
    const criar = screen.getByRole('button', { name: 'Criar conta' })
    expect(criar).toBeDisabled()
    await user.type(screen.getByLabelText('Nome'), 'Dra. Maria')
    await user.type(screen.getByLabelText(/Usuário \(para entrar\)/), 'dra.maria')
    expect(criar).toBeEnabled()
    await user.click(criar)

    const cartao = await screen.findByRole('region', { name: 'Acesso de Dra. Maria' })
    expect(within(cartao).getByText('k7m2p9x4q8hn', { selector: 'dd' })).toBeInTheDocument()
    expect(within(cartao).queryByRole('link', { name: 'Enviar pelo WhatsApp' })).not.toBeInTheDocument()
    expect(within(cartao).queryByText(/sem whatsapp cadastrado/i)).not.toBeInTheDocument()
    expect(within(cartao).queryByText(/família/i)).not.toBeInTheDocument() // aviso e mensagem sem "família"
    expect(within(cartao).getByLabelText('Mensagem pronta')).toHaveTextContent(/\/painel\/entrar/)
    expect(chamadas.find((c) => c.chave === 'POST /api/admin/usuarios')?.corpo).toEqual({ nome: 'Dra. Maria', login: 'dra.maria', papel: 'medica' })
    expect(chamadas.filter((c) => c.chave === 'GET /api/admin/usuarios')).toHaveLength(2) // recarregou
  })

  it('Nova conta administrador aponta para /admin/entrar', async () => {
    mockFetch({
      ...ME,
      ...lista([PETER]),
      'POST /api/admin/usuarios': { status: 201, body: { id: 9, login: 'adm2', nome: 'Outro Adm', papel: 'admin', senhaTemporaria: 'k7m2p9x4q8hn' } },
    })
    const user = userEvent.setup()
    montar()
    await user.click(await screen.findByRole('button', { name: 'Nova conta' }))
    await user.type(screen.getByLabelText('Nome'), 'Outro Adm')
    await user.type(screen.getByLabelText(/Usuário \(para entrar\)/), 'adm2')
    await user.selectOptions(screen.getByLabelText('Tipo de conta'), 'admin')
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))
    const cartao = await screen.findByRole('region', { name: 'Acesso de Outro Adm' })
    expect(within(cartao).getByLabelText('Mensagem pronta')).toHaveTextContent(/\/admin\/entrar/)
  })

  it('duplo clique em "Criar conta" cria UMA conta só', async () => {
    const { chamadas } = mockFetch({
      ...ME,
      ...lista([PETER]),
      'POST /api/admin/usuarios': { status: 201, body: { id: 9, login: 'dra.maria', nome: 'Dra. Maria', papel: 'medica', senhaTemporaria: 'k7m2p9x4q8hn' } },
    })
    const original = globalThis.fetch
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') await new Promise((r) => setTimeout(r, 30))
      return original(url, init)
    })
    const user = userEvent.setup()
    montar()
    await user.click(await screen.findByRole('button', { name: 'Nova conta' }))
    await user.type(screen.getByLabelText('Nome'), 'Dra. Maria')
    await user.type(screen.getByLabelText(/Usuário \(para entrar\)/), 'dra.maria')
    await user.dblClick(screen.getByRole('button', { name: 'Criar conta' }))
    await screen.findByRole('region', { name: 'Acesso de Dra. Maria' })
    expect(chamadas.filter((c) => c.chave === 'POST /api/admin/usuarios')).toHaveLength(1)
  })

  it('erro 409 (usuário em uso) aparece em alerta e o formulário continua aberto', async () => {
    mockFetch({
      ...ME,
      ...lista([PETER]),
      'POST /api/admin/usuarios': { status: 409, body: { erro: 'Já existe uma conta com este usuário.' } },
    })
    const user = userEvent.setup()
    montar()
    await user.click(await screen.findByRole('button', { name: 'Nova conta' }))
    await user.type(screen.getByLabelText('Nome'), 'Outra Pessoa')
    await user.type(screen.getByLabelText(/Usuário \(para entrar\)/), 'raquel')
    await user.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/já existe uma conta/i)
    expect(screen.getByRole('form', { name: 'Nova conta' })).toBeInTheDocument()
  })

  it('Nova senha pede confirmação ANTES de chamar a API; depois mostra as credenciais da equipe', async () => {
    const { chamadas } = mockFetch({ ...ME, ...lista([PETER, RAQUEL]), 'POST /api/admin/usuarios/3/redefinir': { body: { login: 'raquel', senhaTemporaria: 'n3w9p4ssw0rd' } } })
    const user = userEvent.setup()
    montar()
    const raquel = await cartaoDe('Raquel Machado')
    await user.click(within(raquel).getByRole('button', { name: 'Nova senha' }))
    expect(within(raquel).getByRole('alertdialog')).toHaveTextContent(/a senha atual deixa de valer/i)
    expect(chamadas.some((c) => c.chave.includes('redefinir'))).toBe(false)
    await user.click(within(raquel).getByRole('button', { name: 'Gerar nova senha' }))
    const cartao = await screen.findByRole('region', { name: 'Acesso de Raquel Machado' })
    expect(within(cartao).getByText('n3w9p4ssw0rd', { selector: 'dd' })).toBeInTheDocument()
    expect(within(cartao).queryByRole('link', { name: 'Enviar pelo WhatsApp' })).not.toBeInTheDocument()
  })

  it('redefinir uma FAMÍLIA mantém a mensagem e o WhatsApp de família', async () => {
    mockFetch({ ...ME, ...lista([PETER, ANA]), 'POST /api/admin/usuarios/4/redefinir': { body: { login: 'ana', senhaTemporaria: 'n3w9p4ssw0rd' } } })
    const user = userEvent.setup()
    montar()
    await user.click(await screen.findByRole('button', { name: 'Mostrar famílias (1)' }))
    const ana = await cartaoDe('Ana Souza')
    await user.click(within(ana).getByRole('button', { name: 'Nova senha' }))
    await user.click(within(ana).getByRole('button', { name: 'Gerar nova senha' }))
    const cartao = await screen.findByRole('region', { name: 'Acesso de Ana Souza' })
    const link = within(cartao).getByRole('link', { name: 'Enviar pelo WhatsApp' })
    expect(link.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/5584999990000\?text=/)
    expect(within(cartao).getByLabelText('Mensagem pronta')).toHaveTextContent(/Área da família/)
  })

  it('Desativar pede confirmação e envia PATCH {ativo:false}; Reativar vai direto com {ativo:true}', async () => {
    const { chamadas } = mockFetch({
      ...ME,
      ...lista([PETER, RAQUEL, DESATIVADA]),
      'PATCH /api/admin/usuarios/3': { body: { id: 3, ativo: false } },
      'PATCH /api/admin/usuarios/5': { body: { id: 5, ativo: true } },
    })
    const user = userEvent.setup()
    montar()
    const raquel = await cartaoDe('Raquel Machado')
    await user.click(within(raquel).getByRole('button', { name: 'Desativar' }))
    expect(within(raquel).getByRole('alertdialog')).toHaveTextContent(/a pessoa sai agora/i)
    await user.click(within(raquel).getByRole('button', { name: 'Desativar' }))
    await waitFor(() => expect(chamadas.find((c) => c.chave === 'PATCH /api/admin/usuarios/3')?.corpo).toEqual({ ativo: false }))
    await user.click(within(await cartaoDe('Dra. Antiga')).getByRole('button', { name: 'Reativar' }))
    await waitFor(() => expect(chamadas.find((c) => c.chave === 'PATCH /api/admin/usuarios/5')?.corpo).toEqual({ ativo: true }))
  })

  it('erro "mantenha ao menos um administrador" (trava do servidor) aparece em alerta', async () => {
    mockFetch({
      ...ME,
      ...lista([PETER, OUTRO]),
      'PATCH /api/admin/usuarios/2': { status: 409, body: { erro: 'Mantenha ao menos um administrador ativo.' } },
    })
    const user = userEvent.setup()
    montar()
    const outro = await cartaoDe('Segundo Admin')
    await user.click(within(outro).getByRole('button', { name: 'Desativar' }))
    await user.click(within(outro).getByRole('button', { name: 'Desativar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/ao menos um administrador/i)
  })

  it('401 no meio da sessão pede à guarda para reavaliar (sem alerta de erro)', async () => {
    const { chamadas } = mockFetch({ 'GET /api/auth/me': { body: USUARIO_ADMIN }, 'GET /api/admin/usuarios': { status: 401, body: { erro: 'x' } } })
    montar()
    await waitFor(() => expect(chamadas.filter((c) => c.chave === 'GET /api/auth/me').length).toBeGreaterThanOrEqual(2))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
