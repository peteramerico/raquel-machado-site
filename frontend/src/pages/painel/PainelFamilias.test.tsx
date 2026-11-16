import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AuthProvider from '../../components/AuthProvider'
import PainelFamilias from './PainelFamilias'
import { USUARIO_MEDICA, mockFetch } from '../../testUtils'

const ANA = { id: 1, login: 'ana', nome: 'Ana Souza', contato: '5584999990000', ativo: true, precisaTrocarSenha: false, ultimoAcessoEm: '2026-11-10T14:30:00.000Z', criadoEm: '2026-11-01T10:00:00.000Z' }
const BIA = { id: 2, login: 'bia', nome: 'Bia Costa', contato: null, ativo: true, precisaTrocarSenha: true, ultimoAcessoEm: null, criadoEm: '2026-11-12T10:00:00.000Z' }
const CLE = { id: 3, login: 'cle', nome: 'Clê Lima', contato: null, ativo: false, precisaTrocarSenha: false, ultimoAcessoEm: null, criadoEm: '2026-11-02T10:00:00.000Z' }
const ME = { 'GET /api/auth/me': { body: USUARIO_MEDICA } }
const lista = (itens: unknown[], truncada = false) => ({ 'GET /api/painel/familias': { body: { itens, truncada } } })

function montar() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <PainelFamilias />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('PainelFamilias', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('carrega a lista com nome, usuário e o estado de cada conta', async () => {
    mockFetch({ ...ME, ...lista([ANA, BIA, CLE]) })
    montar()
    expect(screen.getByRole('status')).toHaveTextContent(/carregando/i)
    expect(await screen.findByRole('heading', { level: 3, name: 'Ana Souza' })).toBeInTheDocument()
    const itens = screen.getAllByRole('listitem')
    expect(within(itens[0]).getByText('Ativa')).toBeInTheDocument()
    expect(within(itens[1]).getByText('Aguardando 1º acesso')).toBeInTheDocument()
    expect(within(itens[1]).getByText(/ainda não entrou/i)).toBeInTheDocument()
    expect(within(itens[2]).getByText('Desativada')).toBeInTheDocument()
    expect(within(itens[2]).getByRole('button', { name: 'Reativar' })).toBeInTheDocument()
  })

  it('lista vazia → mensagem amigável; truncada → aviso', async () => {
    mockFetch({ ...ME, ...lista([]) })
    const { unmount } = montar()
    expect(await screen.findByText(/nenhuma família cadastrada/i)).toBeInTheDocument()
    unmount()
    mockFetch({ ...ME, ...lista([ANA], true) })
    montar()
    expect(await screen.findByText(/mostrando as primeiras 1 famílias/i)).toBeInTheDocument()
  })

  it('Novo acesso: o botão só habilita com nome, envia {nome, contato} e mostra as credenciais uma vez', async () => {
    const { chamadas } = mockFetch({
      ...ME,
      ...lista([]),
      'POST /api/painel/familias': { status: 201, body: { id: 9, login: 'maria', nome: 'Maria Souza', contato: '5584999990000', senhaTemporaria: 'k7m2p9x4q8hn' } },
    })
    const user = userEvent.setup()
    montar()
    await user.click(await screen.findByRole('button', { name: 'Novo acesso' }))
    const criar = screen.getByRole('button', { name: 'Criar acesso' })
    expect(criar).toBeDisabled()
    await user.type(screen.getByLabelText(/Nome da família/), 'Maria Souza')
    await user.type(screen.getByLabelText(/WhatsApp/), '(84) 99999-0000')
    expect(criar).toBeEnabled()
    await user.click(criar)

    const cartao = await screen.findByRole('region', { name: 'Acesso de Maria Souza' })
    expect(within(cartao).getByText('maria', { selector: 'dd' })).toBeInTheDocument()
    expect(within(cartao).getByText('k7m2p9x4q8hn', { selector: 'dd' })).toBeInTheDocument()
    expect(within(cartao).getByText(/só aparece agora/i)).toBeInTheDocument()
    expect(chamadas.find((c) => c.chave === 'POST /api/painel/familias')?.corpo).toEqual({ nome: 'Maria Souza', contato: '(84) 99999-0000' })
    expect(chamadas.filter((c) => c.chave === 'GET /api/painel/familias')).toHaveLength(2) // recarregou a lista
  })

  it('duplo clique em "Criar acesso" cria UMA conta só', async () => {
    let resolver: (() => void) | undefined
    const { chamadas } = mockFetch({
      ...ME,
      ...lista([]),
      'POST /api/painel/familias': () => ({ status: 201, body: { id: 9, login: 'maria', nome: 'Maria', contato: null, senhaTemporaria: 'k7m2p9x4q8hn' } }),
    })
    // atrasa a resposta do POST para dar tempo do segundo clique
    const original = globalThis.fetch
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') await new Promise<void>((r) => { resolver = r; setTimeout(r, 30) })
      return original(url, init)
    })
    const user = userEvent.setup()
    montar()
    await user.click(await screen.findByRole('button', { name: 'Novo acesso' }))
    await user.type(screen.getByLabelText(/Nome da família/), 'Maria')
    const criar = screen.getByRole('button', { name: 'Criar acesso' })
    await user.dblClick(criar)
    await screen.findByRole('region', { name: 'Acesso de Maria' })
    resolver?.()
    expect(chamadas.filter((c) => c.chave === 'POST /api/painel/familias')).toHaveLength(1)
  })

  it('cartão de credenciais: copiar a mensagem, link do WhatsApp com contato e fechar sem confirmação depois de copiar', async () => {
    mockFetch({
      ...ME,
      ...lista([ANA]),
      'POST /api/painel/familias/1/redefinir': { body: { login: 'ana', senhaTemporaria: 'n3w9p4ssw0rd' } },
    })
    const user = userEvent.setup()
    montar()
    const cartaoAna = (await screen.findByRole('heading', { level: 3, name: 'Ana Souza' })).closest('li') as HTMLElement
    await user.click(within(cartaoAna).getByRole('button', { name: 'Nova senha' }))
    await user.click(within(cartaoAna).getByRole('button', { name: 'Gerar nova senha' }))

    const cartao = await screen.findByRole('region', { name: 'Acesso de Ana Souza' })
    const link = within(cartao).getByRole('link', { name: 'Enviar pelo WhatsApp' })
    expect(link.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/5584999990000\?text=/)
    expect(decodeURIComponent(link.getAttribute('href') ?? '')).toContain('Senha temporária: n3w9p4ssw0rd')

    await user.click(within(cartao).getByRole('button', { name: 'Copiar mensagem' }))
    expect(await within(cartao).findByRole('button', { name: /Mensagem copiada/ })).toBeInTheDocument()
    expect(await navigator.clipboard.readText()).toContain('Senha temporária: n3w9p4ssw0rd')
    await user.click(within(cartao).getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('region', { name: /Acesso de/ })).not.toBeInTheDocument() // já copiou: fecha direto
  })

  it('fechar o cartão SEM copiar/enviar pede confirmação ("a senha se perde")', async () => {
    mockFetch({
      ...ME,
      ...lista([BIA]),
      'POST /api/painel/familias/2/redefinir': { body: { login: 'bia', senhaTemporaria: 'z8y7x6w5v4u3' } },
    })
    const user = userEvent.setup()
    montar()
    const li = (await screen.findByRole('heading', { level: 3, name: 'Bia Costa' })).closest('li') as HTMLElement
    await user.click(within(li).getByRole('button', { name: 'Nova senha' }))
    await user.click(within(li).getByRole('button', { name: 'Gerar nova senha' }))
    const cartao = await screen.findByRole('region', { name: 'Acesso de Bia Costa' })
    expect(within(cartao).queryByRole('link', { name: 'Enviar pelo WhatsApp' })).not.toBeInTheDocument() // sem contato
    expect(within(cartao).getByText(/sem whatsapp cadastrado/i)).toBeInTheDocument()
    await user.click(within(cartao).getByRole('button', { name: 'Fechar' }))
    const alerta = within(cartao).getByRole('alertdialog')
    expect(alerta).toHaveTextContent(/a senha se perde/i)
    await user.click(within(alerta).getByRole('button', { name: 'Voltar' }))
    expect(screen.getByRole('region', { name: 'Acesso de Bia Costa' })).toBeInTheDocument()
    await user.click(within(cartao).getByRole('button', { name: 'Fechar' }))
    await user.click(within(cartao).getByRole('button', { name: 'Fechar mesmo assim' }))
    expect(screen.queryByRole('region', { name: /Acesso de/ })).not.toBeInTheDocument()
  })

  it('Nova senha pede confirmação ANTES de chamar a API; cancelar não faz nada', async () => {
    const { chamadas } = mockFetch({ ...ME, ...lista([ANA]), 'POST /api/painel/familias/1/redefinir': { body: { login: 'ana', senhaTemporaria: 'n3w9p4ssw0rd' } } })
    const user = userEvent.setup()
    montar()
    const li = (await screen.findByRole('heading', { level: 3, name: 'Ana Souza' })).closest('li') as HTMLElement
    await user.click(within(li).getByRole('button', { name: 'Nova senha' }))
    expect(within(li).getByRole('alertdialog')).toHaveTextContent(/a senha atual deixa de valer/i)
    expect(chamadas.some((c) => c.chave.includes('redefinir'))).toBe(false)
    await user.click(within(li).getByRole('button', { name: 'Cancelar' }))
    expect(within(li).queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(chamadas.some((c) => c.chave.includes('redefinir'))).toBe(false)
  })

  it('Desativar pede confirmação e envia PATCH {ativo:false}; Reativar vai direto com {ativo:true}', async () => {
    const { chamadas } = mockFetch({ ...ME, ...lista([ANA, CLE]), 'PATCH /api/painel/familias/1': { body: { id: 1, ativo: false } }, 'PATCH /api/painel/familias/3': { body: { id: 3, ativo: true } } })
    const user = userEvent.setup()
    montar()
    const ana = (await screen.findByRole('heading', { level: 3, name: 'Ana Souza' })).closest('li') as HTMLElement
    await user.click(within(ana).getByRole('button', { name: 'Desativar' }))
    expect(within(ana).getByRole('alertdialog')).toHaveTextContent(/a família sai agora/i)
    await user.click(within(ana).getByRole('button', { name: 'Desativar' }))
    await waitFor(() => expect(chamadas.find((c) => c.chave === 'PATCH /api/painel/familias/1')?.corpo).toEqual({ ativo: false }))

    const cle = (await screen.findByRole('heading', { level: 3, name: 'Clê Lima' })).closest('li') as HTMLElement
    await user.click(within(cle).getByRole('button', { name: 'Reativar' }))
    await waitFor(() => expect(chamadas.find((c) => c.chave === 'PATCH /api/painel/familias/3')?.corpo).toEqual({ ativo: true }))
  })

  it('erro da API aparece em alerta (mensagem do servidor)', async () => {
    mockFetch({ ...ME, ...lista([]), 'POST /api/painel/familias': { status: 400, body: { erro: 'WhatsApp inválido. Use DDD + número, por exemplo (84) 99999-0000.' } } })
    const user = userEvent.setup()
    montar()
    await user.click(await screen.findByRole('button', { name: 'Novo acesso' }))
    await user.type(screen.getByLabelText(/Nome da família/), 'Maria')
    await user.type(screen.getByLabelText(/WhatsApp/), '123')
    await user.click(screen.getByRole('button', { name: 'Criar acesso' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/WhatsApp inválido/)
  })

  it('401 no meio da sessão: não mostra "erro", pede à guarda para reavaliar a sessão', async () => {
    const { chamadas } = mockFetch({ 'GET /api/auth/me': { body: USUARIO_MEDICA }, 'GET /api/painel/familias': { status: 401, body: { erro: 'Sessão inválida ou expirada.' } } })
    montar()
    await waitFor(() => expect(chamadas.filter((c) => c.chave === 'GET /api/auth/me').length).toBeGreaterThanOrEqual(2))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
